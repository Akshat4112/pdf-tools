"""Run with python -m unittest discover -s scripts -p test_measure_office_layout.py."""
import unittest
from measure_office_layout import measure


class LayoutTest(unittest.TestCase):
    def test_normalized_bounds_and_overflow(self):
        result = measure('<html xmlns="http://www.w3.org/1999/xhtml"><body><doc>'
                         '<page width="100" height="200">'
                         '<word xMin="10" yMin="20" xMax="50" yMax="40">Probe</word>'
                         '<word xMin="90" yMin="20" xMax="110" yMax="40">Overflow</word>'
                         '</page></doc></body></html>')
        page = result["pages"][0]
        self.assertEqual(result["page_count"], 1)
        self.assertEqual(page["word_count"], 2)
        self.assertEqual(page["outside_page_words"], 1)
        self.assertEqual(page["words"][0]["bounds_normalized"], [0.1, 0.1, 0.5, 0.2])

    def test_empty_document(self):
        with self.assertRaises(ValueError):
            measure("<html/>")

    def test_invalid_dimensions(self):
        with self.assertRaises(ValueError):
            measure('<html><page width="0" height="200"/></html>')

    def test_inverted_bounds(self):
        with self.assertRaises(ValueError):
            measure('<html><page width="100" height="200">'
                    '<word xMin="20" yMin="10" xMax="10" yMax="20">Bad</word>'
                    '</page></html>')


if __name__ == "__main__":
    unittest.main()
