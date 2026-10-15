"""Regression checks for PDF trailer ID size normalization."""
import unittest
from check_reproducibility import normalized_size, structural


class ReproducibilityTests(unittest.TestCase):
    def test_variable_trailer_id_lengths_do_not_change_structural_size(self):
        a = b'%PDF-1.7\ncontent\ntrailer\n<</Size 4/ID[<AA><BB>]>>\n%%EOF'
        b = a.replace(b'<AA><BB>', b'<' + b'AB' * 20 + b'><' + b'CD' * 16 + b'>')
        self.assertNotEqual(len(a), len(b))
        self.assertEqual(normalized_size(a), normalized_size(b))
        literal = a.replace(b'<AA><BB>', rb'(abc\(def\)\211)(ghi\\j)')
        self.assertEqual(normalized_size(a), normalized_size(literal))

    def test_content_size_changes_still_fail_even_with_variable_ids(self):
        a = b'%PDF-1.7\ncontent\ntrailer\n<</ID[<AA><BB>]>>\n%%EOF'
        self.assertNotEqual(normalized_size(a), normalized_size(a.replace(b'content', b'longer-content')))

    def test_no_trailer_images_and_truncated_inputs_keep_exact_sizes(self):
        for data in [b'', b'PNGdata', b'PNG\ntrailer\n/ID[<AA><BB>]', b'%PDF-1.7 /ID[<AA><BB>] content only']:
            self.assertEqual(normalized_size(data), len(data))

    def test_page_geometry_remains_part_of_structural_comparison(self):
        entry = {'id': 'test', 'expected': {'pages': 1, 'page_sizes_pt': [[100, 200]]}}
        changed = {'id': 'test', 'expected': {'pages': 1, 'page_sizes_pt': [[200, 100]]}}
        self.assertNotEqual(structural(entry, b'pdf'), structural(changed, b'pdf'))


if __name__ == '__main__':
    unittest.main()
