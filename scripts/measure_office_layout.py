#!/usr/bin/env python3
"""Measure text placement in synthetic Office-rendered PDFs using Poppler.

This is a geometry probe, not a visual fidelity or browser conversion claim.
Run on synthetic benchmark outputs only.
"""
import argparse
import json
import math
import subprocess
from pathlib import Path
from xml.etree import ElementTree as ET


def measure(xml):
    root = ET.fromstring(xml)
    pages = []
    for page in root.findall(".//{*}page"):
        width, height = (float(page.attrib[k]) for k in ("width", "height"))
        if not all(math.isfinite(v) and v > 0 for v in (width, height)):
            raise ValueError("Invalid page dimensions")
        words = []
        outside = 0
        for word in page.findall(".//{*}word"):
            x0, y0, x1, y1 = (float(word.attrib[k]) for k in ("xMin", "yMin", "xMax", "yMax"))
            if not all(math.isfinite(v) for v in (x0, y0, x1, y1)) or x1 < x0 or y1 < y0:
                raise ValueError("Invalid word bounds")
            outside += int(x0 < -0.5 or y0 < -0.5 or x1 > width + 0.5 or y1 > height + 0.5)
            words.append({"text": word.text or "", "bounds_normalized": [
                round(x0 / width, 6), round(y0 / height, 6),
                round(x1 / width, 6), round(y1 / height, 6)]})
        pages.append({"width_pt": width, "height_pt": height,
                      "word_count": len(words), "outside_page_words": outside, "words": words})
    if not pages:
        raise ValueError("No pages in Poppler output")
    return {"page_count": len(pages), "pages": pages,
            "limitation": "Text geometry only; no reference-render comparison or visual fidelity verdict."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    args = parser.parse_args()
    result = subprocess.run(["pdftotext", "-bbox", str(args.pdf.resolve()), "-"],
                            check=True, capture_output=True, timeout=60)
    print(json.dumps(measure(result.stdout), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
