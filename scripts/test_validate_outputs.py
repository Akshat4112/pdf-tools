"""PT-QA-001: independent output validator smoke and tampering tests."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from validate_outputs import validate_entry

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "fixtures/pdf/F-001-plain-text-3p.pdf"

class OutputValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        shutil.copyfile(FIXTURE, self.root / "test.pdf")

    def tearDown(self):
        self.tmp.cleanup()

    def test_two_readers_and_ordered_content(self):
        item = {"file":"test.pdf", "kind":"pdf", "pages":3}
        self.assertEqual(validate_entry(item, self.root), [])

    def test_wrong_page_count_fails(self):
        errors = validate_entry({"file":"test.pdf","kind":"pdf","pages":999}, self.root)
        self.assertTrue(any("pages" in e for e in errors))

    def test_truncated_output_fails(self):
        (self.root / "test.pdf").write_bytes(b"%PDF-1.7\n")
        self.assertTrue(validate_entry({"file":"test.pdf","kind":"pdf"}, self.root))

    def test_reject_path_escape(self):
        self.assertTrue(validate_entry({"file":"../test.pdf","kind":"pdf"}, self.root))

    def test_text_integrity(self):
        (self.root / "test.txt").write_text("sample marker", encoding="utf-8")
        self.assertEqual(validate_entry({"file":"test.txt","kind":"txt","text_markers":["marker"]}, self.root), [])
        self.assertTrue(validate_entry({"file":"test.txt","kind":"txt","text_markers":["absent"]}, self.root))

if __name__ == "__main__":
    unittest.main()
