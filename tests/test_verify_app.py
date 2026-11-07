# Verification guidance: ISO MCP SDLC-003, AGENT-009.
# These checks do not establish ISO certification or full security coverage.
"""Tests for storefront structure and script syntax checks."""

import tempfile
import unittest
from pathlib import Path
import subprocess
from scripts.verify_app import verify


class VerificationTests(unittest.TestCase):
    def run_fixture(self, text):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "index.html"
            path.write_text(text, encoding="utf-8")
            verify(path)

    def test_valid_document(self):
        self.run_fixture('<!DOCTYPE html><meta name="viewport"><div id="root"></div><script type="module">const n = 1;</script>')

    def test_empty_document_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_fixture('')

    def test_missing_module_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_fixture('<!DOCTYPE html><meta name="viewport"><div id="root"></div>')

    def test_invalid_javascript_is_rejected(self):
        with self.assertRaises(subprocess.CalledProcessError):
            self.run_fixture('<!DOCTYPE html><meta name="viewport"><div id="root"></div><script type="module">const = ;</script>')


class MarqueeTests(unittest.TestCase):
    def test_marquee_animation_contract(self):
        # Structural guard; visual and timing behavior also need browser tests.
        html = Path("index.html").read_text(encoding="utf-8")
        self.assertIn("animation:marquee 60s linear infinite", html)
        self.assertIn("transform:translateX(-50%)", html)
        self.assertIn(".marquee-track > span{\n  flex-shrink:0;\n  min-width:100vw;", html)
        self.assertIn("@media (prefers-reduced-motion: reduce)", html)


if __name__ == '__main__':
    unittest.main()
