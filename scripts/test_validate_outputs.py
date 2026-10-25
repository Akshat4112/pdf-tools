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

    def test_reference_detects_wrong_order_and_rotation(self):
        item = {"file":"test.pdf", "kind":"pdf", "reference":{"file":"test.pdf", "pages":[2,1,0]}}
        self.assertTrue(validate_entry(item, self.root))
        item["reference"]["pages"] = [0,1,2]
        item["reference"]["rotations"] = [90,0,0]
        self.assertTrue(validate_entry(item, self.root))

    def test_valid_container_with_wrong_member_content_fails(self):
        import zipfile
        with zipfile.ZipFile(self.root / "test.zip", "w") as archive:
            archive.writestr("part.pdf", b"%PDF-broken")
        self.assertTrue(validate_entry({"file":"test.zip","kind":"zip","members":[{"file":"part.pdf","kind":"pdf","pages":1}]}, self.root))

    def test_visual_and_overlay_assertions_reject_blank_page(self):
        import pymupdf
        with pymupdf.open() as doc:
            for _ in range(3): doc.new_page(width=595, height=842)
            doc.save(self.root / "blank.pdf")
        for overlay in (False, True):
            item = {"file":"blank.pdf","kind":"pdf","reference":{"file":"test.pdf","pages":[0,1,2],"overlay":overlay}}
            self.assertTrue(validate_entry(item, self.root))

    def test_text_order_rejects_valid_utf8_in_wrong_order(self):
        (self.root / "test.txt").write_text("third first second")
        self.assertTrue(validate_entry({"file":"test.txt","kind":"txt","ordered_text":["first","second","third"]},self.root))

if __name__ == "__main__":
    unittest.main()
