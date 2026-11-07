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


if __name__ == '__main__':
    unittest.main()
