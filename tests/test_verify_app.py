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


class MetadataTests(unittest.TestCase):
    def test_page_has_real_title_and_description(self):
        html = Path("index.html").read_text(encoding="utf-8")
        self.assertNotIn("<title>React Artifact</title>", html)
        self.assertIn("<title>Jels Kitchenwares", html)
        self.assertIn('<meta name="description" content="Jels Kitchenwares', html)
        self.assertIn('rel="icon"', html)


class VideoPlaybackTests(unittest.TestCase):
    """Structural guards for phone autoplay. Real playback needs a browser or device."""

    def setUp(self):
        self.html = Path("index.html").read_text(encoding="utf-8")

    def test_uses_native_muted_inline_looping_video(self):
        for token in ('o("video",{key:attempt', "muted:!0", "loop:!0", "playsInline:!0", 'objectFit:"cover"'):
            self.assertIn(token, self.html)

    def test_plays_when_visible_and_recovers_after_a_touch(self):
        self.assertIn("new IntersectionObserver((list)=>list.forEach", self.html)
        self.assertIn('gestures=["touchend","pointerup","click","keydown"]', self.html)
        self.assertIn('document.addEventListener("visibilitychange",onVis)', self.html)

    def test_falls_back_to_the_cloudinary_player(self):
        self.assertIn("onError:()=>setAttempt((x)=>x+1)", self.html)
        self.assertIn('r.searchParams.set("player[autoplay]","true")', self.html)
        self.assertIn('allow:"autoplay; encrypted-media"', self.html)


if __name__ == '__main__':
    unittest.main()
