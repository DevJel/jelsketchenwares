# Verification guidance: ISO MCP SDLC-003, AGENT-009.
# These checks do not establish ISO certification or full security coverage.
"""Check the storefront document and the syntax of its embedded scripts."""

from html.parser import HTMLParser
from pathlib import Path
import subprocess
import sys
import tempfile


class StorefrontParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.has_doctype = False
        self.has_viewport = False
        self.has_root = False
        self.scripts = []
        self._script = None

    def handle_decl(self, declaration):
        if declaration.lower() == "doctype html":
            self.has_doctype = True

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and attrs.get("name", "").lower() == "viewport":
            self.has_viewport = True
        if attrs.get("id") == "root":
            self.has_root = True
        if tag == "script" and not attrs.get("src"):
            script_type = attrs.get("type", "").lower()
            if script_type in ("", "module", "text/javascript", "application/javascript"):
                self._script = [script_type, []]

    def handle_data(self, data):
        if self._script is not None:
            self._script[1].append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._script is not None:
            self.scripts.append((self._script[0], "".join(self._script[1])))
            self._script = None


def verify(path):
    parser = StorefrontParser()
    parser.feed(Path(path).read_text(encoding="utf-8"))
    if not (parser.has_doctype and parser.has_viewport and parser.has_root):
        raise ValueError("Missing HTML5 doctype, viewport, or app root")
    if not any(kind == "module" and content.strip() for kind, content in parser.scripts):
        raise ValueError("Missing storefront module script")
    with tempfile.TemporaryDirectory() as directory:
        for index, (kind, content) in enumerate(parser.scripts):
            path = Path(directory) / (f"script-{index}.mjs" if kind == "module" else f"script-{index}.js")
            path.write_text(content, encoding="utf-8")
            subprocess.run(["node", "--check", str(path)], check=True, timeout=60)
    print(f"Validated document structure and {len(parser.scripts)} JavaScript scripts")


if __name__ == "__main__":
    try:
        verify(sys.argv[1] if len(sys.argv) > 1 else "index.html")
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f"Storefront verification failed: {exc}", file=sys.stderr)
        sys.exit(1)
