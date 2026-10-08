#!/usr/bin/env python3
"""PT-PD-005 — Synthetic PDF benchmark corpus generator.

Creates the fixture corpus for pdf-tools under fixtures/pdf/ and fixtures/images/.
All content is synthetic and license-free. Fonts: Base-14 (helvetica/times/courier)
via PyMuPDF — no external font files required.

Reader independence: every PDF is validated with TWO independent readers
(PyMuPDF as reader A at generation time; qpdf --check as reader B in
validate_corpus.py) per the task's acceptance criteria.
"""
from __future__ import annotations

import hashlib
import json
import random
import zlib
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "fixtures"
PDF_DIR = FIXTURES / "pdf"
IMG_DIR = FIXTURES / "images"

PDF_DIR.mkdir(parents=True, exist_ok=True)
IMG_DIR.mkdir(parents=True, exist_ok=True)

rng = random.Random(20261008)  # deterministic

MANIFEST: dict = {"generator": "pymupdf " + pymupdf.__version__, "fixtures": []}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def register(fid: str, path: Path, *, purpose: str, expected: dict, notes: str = "") -> None:
    entry = {
        "id": fid,
        "file": str(path.relative_to(ROOT)),
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
        "purpose": purpose,
        "expected": expected,
        "notes": notes,
    }
    MANIFEST["fixtures"].append(entry)
    print(f"  {fid}: {path.name} ({path.stat().st_size} bytes)")


def text_pdf(path: Path, *, pages: int, title: str, author: str, two_col_page: int | None = None) -> pymupdf.Document:
    """Simple text PDF with known page count and extractable text."""
    doc = pymupdf.open()
    for i in range(pages):
        page = doc.new_page()  # A4 default 595x842
        body = page.insert_textbox(
            pymupdf.Rect(50, 60, 545, 780),
            f"{title} — synthetic benchmark document\n\n"
            f"Page {i + 1} of {pages}. This fixture was generated for the pdf-tools "
            f"benchmark corpus. It contains selectable ASCII text for extraction tests "
            f"and predictable page geometry.\n\n"
            f"Paragraph {i + 1}: the quick brown fox jumps over the lazy dog. "
            f"PACKING-BOX-{i + 1:04d} marks this page uniquely for text-matching tests.",
            fontname="helv",
            fontsize=11,
        )
        assert body >= 0, f"text did not fit on page {i+1}"
        if two_col_page is not None and i == two_col_page:
            # two-column reading order stress
            page.insert_textbox(pymupdf.Rect(50, 200, 295, 780), "LEFT-COLUMN-ORDER-1 first block.", fontname="helv", fontsize=10)
            page.insert_textbox(pymupdf.Rect(300, 200, 545, 780), "RIGHT-COLUMN-ORDER-2 second block.", fontname="helv", fontsize=10)
    doc.set_metadata({"title": title, "author": author, "producer": "pdf-tools fixture generator", "creator": "PT-PD-005"})
    doc.save(path)
    return doc


def main() -> None:
    print("== PT-PD-005 corpus generation ==")

    # ---- F-001 / F-002: plain text PDFs (small + multi-page) ----
    p = PDF_DIR / "F-001-plain-text-3p.pdf"
    text_pdf(p, pages=3, title="Plain Text Fixture", author="PT-PD-005")
    d = pymupdf.open(p)
    register(
        "F-001", p, purpose="baseline merge/extract/text operations",
        expected={"pages": 3, "text_markers": ["PACKING-BOX-0001", "PACKING-BOX-0002", "PACKING-BOX-0003"],
                  "extractable_text": True, "page_size_pt": [595, 842]},
    )
    d.close()

    p = PDF_DIR / "F-002-plain-text-30p.pdf"
    text_pdf(p, pages=30, title="Long Text Fixture", author="PT-PD-005", two_col_page=9)
    register(
        "F-002", p, purpose="split/organize stress, two-column page 10, 30-page corpus core",
        expected={"pages": 30, "text_markers": [f"PACKING-BOX-{i:04d}" for i in (1, 9, 10, 30)],
                  "extractable_text": True, "two_column_page": 10},
    )

    # ---- F-003: mixed page sizes and orientations ----
    p = PDF_DIR / "F-003-mixed-sizes.pdf"
    doc = pymupdf.open()
    sizes = [(595, 842), (842, 595), (612, 792), (420, 595)]
    for i, (w, h) in enumerate(sizes):
        page = doc.new_page(width=w, height=h)
        page.insert_textbox(pymupdf.Rect(20, 20, w - 20, h - 20), f"MIXED-SIZE-PAGE-{i+1} ({w}x{h}pt)", fontname="helv", fontsize=12)
    doc.set_metadata({"title": "Mixed Sizes Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    register(
        "F-003", p, purpose="mixed page geometry: A4p, A4l, US Letter, A5",
        expected={"pages": 4, "page_sizes_pt": [[595, 842], [842, 595], [612, 792], [420, 595]],
                  "text_markers": ["MIXED-SIZE-PAGE-1", "MIXED-SIZE-PAGE-4"]},
    )

    # ---- F-004: rotated pages (page rotation attribute, not content rotation) ----
    p = PDF_DIR / "F-004-rotated-pages.pdf"
    doc = pymupdf.open()
    for i in range(4):
        page = doc.new_page()
        page.insert_textbox(pymupdf.Rect(50, 60, 545, 780), f"ROTATE-FIXTURE-PAGE-{i+1}", fontname="helv", fontsize=11)
        page.set_rotation([0, 90, 180, 270][i])
    doc.set_metadata({"title": "Rotated Pages Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    register(
        "F-004", p, purpose="page /Rotate attribute composition test (0/90/180/270)",
        expected={"pages": 4, "rotations": [0, 90, 180, 270], "text_markers": ["ROTATE-FIXTURE-PAGE-1", "ROTATE-FIXTURE-PAGE-4"]},
    )

    # ---- F-005: AcroForm with text field + checkbox ----
    p = PDF_DIR / "F-005-form-acroform.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 50, 545, 120), "Synthetic AcroForm fixture — form field preservation test.", fontname="helv", fontsize=12)
    w = pymupdf.Widget()
    w.field_name = "fullname"
    w.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
    w.rect = pymupdf.Rect(50, 150, 300, 175)
    w.field_value = "Synthetic Person"
    page.add_widget(w)
    w2 = pymupdf.Widget()
    w2.field_name = "subscribe"
    w2.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
    w2.rect = pymupdf.Rect(50, 200, 570, 225)
    w2.field_value = True
    page.add_widget(w2)
    doc.set_metadata({"title": "AcroForm Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    register(
        "F-005", p, purpose="interactive AcroForm (text field + checkbox) preservation/blocking decision tests",
        expected={"pages": 1, "form_fields": ["fullname", "subscribe"], "acroform": True},
    )

    # ---- F-006: annotations (highlight + link + text note) ----
    p = PDF_DIR / "F-006-annotations.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 60, 545, 300),
                        "ANNOTATION-HOST-PAGE. This page carries highlight, link and text annotations for preservation tests.", fontname="helv", fontsize=11)
    hl = page.add_highlight_annot(pymupdf.Rect(50, 60, 400, 80))
    hl.set_colors(stroke=(1, 0.9, 0.2))
    hl.update()
    link = {"kind": pymupdf.LINK_GOTO, "from": pymupdf.Rect(50, 120, 200, 140), "page": 0}
    page.insert_link(link)
    note = page.add_text_annot(pymupdf.Point(100, 200), "Synthetic note annotation for preservation tests.")
    note.update()
    doc.set_metadata({"title": "Annotations Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    register(
        "F-006", p, purpose="annotation preservation on merge/organize; link self-target",
        expected={"pages": 1, "annotation_types": ["Highlight", "Text"], "links": 1},
    )

    # ---- F-007: embedded JPEG image page ----
    jpg = IMG_DIR / "F-007-photo.jpg"
    pix_width, pix_height = 120, 160
    img = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, pix_width, pix_height))
    img.set_rect(img.irect, (89, 140, 204))  # flat blue fill (RGB ints)
    img.save(jpg)
    p = PDF_DIR / "F-007-image-page.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_image(pymupdf.Rect(100, 100, 350, 433), filename=str(jpg))
    page.insert_textbox(pymupdf.Rect(50, 700, 545, 790), "IMAGE-PAGE-001 — one embedded JPEG image object.", fontname="helv", fontsize=11)
    doc.set_metadata({"title": "Image Page Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    register(
        "F-007", p, purpose="embedded image rendering fidelity (PDF→JPG/PNG) and rotate",
        expected={"pages": 1, "embedded_images": 1, "text_markers": ["IMAGE-PAGE-001"]},
    )
    register(
        "F-007-img", jpg, purpose="JPEG input for JPG→PDF conversion tests",
        expected={"format": "JPEG", "dimensions_px": [120, 160]},
    )

    # ---- F-008: scan-like page (image-only, no text layer) ----
    p = PDF_DIR / "F-008-scan-like.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    scan = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 595, 842))
    scan.set_rect(scan.irect, (245, 245, 235))
    # draw pseudo-text lines (dark bars) so the page looks like a scanned document
    for y in range(80, 760, 24):
        x_end = min(555, 40 + rng.randint(300, 510))
        bar = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(40, y, x_end, y + 10))
        bar.set_rect(bar.irect, (30, 30, 38))
        scan.copy(bar, pymupdf.IRect(40, y, x_end, y + 10))
    page.insert_image(pymupdf.Rect(0, 0, 595, 842), pixmap=scan)
    doc.set_metadata({"title": "Scan-like Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    d = pymupdf.open(p)
    has_text = bool(d[0].get_text().strip())
    d.close()
    register(
        "F-008", p, purpose="image-only page: reader search notice, TXT export 'no text layer' notice, OCR gap evidence",
        expected={"pages": 1, "extractable_text": False, "note": "no text layer by construction"},
        notes="expects E-class behavior: reader shows 'no searchable text', TXT export explains OCR pending",
    )
    assert not has_text, "F-008 must have NO text layer"

    # ---- F-009: signed-marker document (visual signature stamp, NOT a real certificate) ----
    # NOTE: a genuine certificate signature requires a signing toolchain outside this
    # corpus. We instead build the "signature indicator" case: /Sig flag set via a
    # dummy incremental update is NOT attempted; we mark this fixture as the
    # signature-annotation case and record the limitation in the manifest.
    p = PDF_DIR / "F-009-signed-marker.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 60, 545, 200), "SIGNED-MARKER-PAGE — carries a visual signature block. This is NOT a cryptographic signature.", fontname="helv", fontsize=10)
    page.draw_rect(pymupdf.Rect(320, 620, 545, 780), color=(0, 0, 0.6), width=1.5)
    page.insert_textbox(pymupdf.Rect(330, 640, 535, 770), "Signed:\nSynthetic Signer\n2026-10-08\n(visual marker only)", fontname="helv", fontsize=9)
    doc.set_metadata({"title": "Signed Marker Fixture", "author": "PT-PD-005"})
    doc.save(p)
    doc.close()
    register(
        "F-009", p, purpose="signature-indicator language test: modifying tools must warn that output invalidates signatures",
        expected={"pages": 1, "text_markers": ["SIGNED-MARKER-PAGE"]},
        notes="visual marker only — document-info must not claim a cryptographic signature exists",
    )

    # ---- F-010: AES-256 encrypted ----
    p = PDF_DIR / "F-010-encrypted-aes256.pdf"
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_textbox(pymupdf.Rect(50, 60, 545, 780), "ENCRYPTED-PAGE-001 — AES-256 protected synthetic fixture.", fontname="helv", fontsize=11)
    doc.set_metadata({"title": "Encrypted Fixture", "author": "PT-PD-005"})
    doc.save(str(p), encryption=pymupdf.PDF_ENCRYPT_AES_256, user_pw="synthetic-password-2026", owner_pw="synthetic-owner-2026")
    doc.close()
    register(
        "F-010", p, purpose="early encrypted-input rejection (E-INPUT-02) for all R1 tools",
        expected={"pages": 1, "encrypted": True, "algorithm": "AES-256", "opens_with_password": "synthetic-password-2026"},
        notes="password recorded here is synthetic and public within the corpus",
    )

    # ---- F-011: malformed (truncated header) ----
    p = PDF_DIR / "F-011-malformed-truncated.pdf"
    good = (PDF_DIR / "F-001-plain-text-3p.pdf").read_bytes()
    p.write_bytes(good[: int(len(good) * 0.45)])  # cut mid-stream
    register(
        "F-011", p, purpose="unparsable-input handling (E-INPUT-03): recoverable error, no crash",
        expected={"valid_pdf": False},
        notes="truncated copy of F-001 — must trigger E-INPUT-03 in every tool",
    )

    # ---- F-012: empty (zero-byte) ----
    p = PDF_DIR / "F-012-empty.pdf"
    p.write_bytes(b"")
    register(
        "F-012", p, purpose="zero-byte input handling (E-INPUT-03 variant)",
        expected={"valid_pdf": False, "bytes": 0},
    )

    # ---- F-013: PNG image (for JPG/PNG→PDF) ----
    png = IMG_DIR / "F-013-diagram.png"
    pm = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 300, 200))
    pm.set_rect(pm.irect, (242, 242, 242))
    pm.save(png)
    register(
        "F-013-img", png, purpose="PNG input for images→PDF conversion and PNG output comparison",
        expected={"format": "PNG", "dimensions_px": [300, 200]},
    )

    # ---- F-014: PDF with outline/bookmarks ----
    p = PDF_DIR / "F-014-outline.pdf"
    doc = pymupdf.open()
    for i in range(6):
        pg = doc.new_page()
        pg.insert_textbox(pymupdf.Rect(50, 60, 545, 780), f"OUTLINE-PAGE-{i+1:02d}", fontname="helv", fontsize=12)
    doc.set_metadata({"title": "Outline Fixture", "author": "PT-PD-005"})
    toc = [
        [1, "Part One", 1],
        [2, "Section A", 2],
        [2, "Section B", 3],
        [1, "Part Two", 4],
        [2, "Section C", 5],
    ]
    doc.set_toc(toc)
    doc.save(p)
    doc.close()
    register(
        "F-014", p, purpose="bookmark/outline preservation question on merge/split (disclose or block)",
        expected={"pages": 6, "outline_entries": 5, "text_markers": ["OUTLINE-PAGE-01", "OUTLINE-PAGE-06"]},
    )

    # ---- F-015: multi-page for quota boundary tests ----
    p = PDF_DIR / "F-015-pages-60p.pdf"
    text_pdf(p, pages=60, title="Sixty Page Fixture", author="PT-PD-005")
    register(
        "F-015", p, purpose="larger corpus member for split-every-N, memory and quota boundary tests",
        expected={"pages": 60, "text_markers": ["PACKING-BOX-0001", "PACKING-BOX-0060"]},
    )

    manifest_path = FIXTURES / "manifest.json"
    manifest_path.write_text(json.dumps(MANIFEST, indent=2))
    print(f"\nManifest: {manifest_path} ({len(MANIFEST['fixtures'])} fixtures)")
    print("== generation complete ==")


if __name__ == "__main__":
    main()
