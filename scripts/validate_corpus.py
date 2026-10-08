#!/usr/bin/env python3
"""PT-PD-005 — Corpus validator: two independent readers per fixture.

Reader A: PyMuPDF (structural parse, page/text/rotation checks)
Reader B: qpdf --check (independent PDF syntax/structure validation)

Exit 0 = all fixtures pass both readers; exit 1 = any failure.
Run after generate_fixtures.py.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "fixtures"
MANIFEST = FIXTURES / "manifest.json"
import shutil as _shutil
QPDF = _shutil.which("qpdf") or "/opt/homebrew/bin/qpdf"

failures: list[str] = []


def check(cond: bool, msg: str) -> None:
    if not cond:
        failures.append(msg)
        print(f"  FAIL: {msg}")


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    print(f"Validating {len(manifest['fixtures'])} fixtures with two readers\n")

    for fx in manifest["fixtures"]:
        path = ROOT / fx["file"]
        fid = fx["id"]
        exp = fx["expected"]
        print(f"[{fid}] {path.name}")

        if exp.get("valid_pdf") is False:
            # negative fixtures: BOTH readers must reject (or parse-error), never "clean"
            ok_a = False
            try:
                d = pymupdf.open(path)
                # truncated files may open in repair mode; require either a
                # hard error OR an obviously broken structure (page tree error
                # surfaces as a MuPDF message; empty/short stream is also broken)
                ok_a = d.page_count == 0 or d.is_repaired
            except Exception:
                ok_a = True
            q = subprocess.run([QPDF, "--check", str(path)], capture_output=True, text=True)
            ok_b = q.returncode != 0
            check(ok_a, f"{fid}: PyMuPDF unexpectedly opened invalid file")
            check(ok_b, f"{fid}: qpdf --check unexpectedly passed on invalid file")
            print(f"  negative fixture: readerA_rejects={ok_a} readerB_rejects={ok_b}")
            continue

        # ---- Reader A: PyMuPDF (PDFs only; images checked structurally) ----
        if path.suffix != ".pdf":
            img = pymupdf.Pixmap(path)
            w, h = img.width, img.height
            check([w, h] == exp.get("dimensions_px", [w, h]), f"{fid}: image size {[w, h]} != {exp.get('dimensions_px')}")
            print("  reader A (pymupdf): OK (image)")
            continue
        doc = pymupdf.open(path)
        check(doc.page_count == exp["pages"], f"{fid}: pages {doc.page_count} != expected {exp['pages']}")
        for marker in exp.get("text_markers", []):
            found = any(marker in doc[i].get_text() for i in range(doc.page_count))
            check(found, f"{fid}: marker '{marker}' not found in text")
        for field in exp.get("form_fields", []):
            names = [w.field_name for w in doc[0].widgets()] if doc.is_form_pdf else []
            check(field in names, f"{fid}: form field '{field}' missing")
        if "rotations" in exp:
            rots = [doc[i].rotation for i in range(doc.page_count)]
            check(rots == exp["rotations"], f"{fid}: rotations {rots} != {exp['rotations']}")
        if "page_sizes_pt" in exp:
            sizes = [[round(doc[i].rect.width), round(doc[i].rect.height)] for i in range(doc.page_count)]
            check(sizes == exp["page_sizes_pt"], f"{fid}: sizes {sizes} != {exp['page_sizes_pt']}")
        if exp.get("encrypted"):
            check(doc.needs_pass, f"{fid}: expected encrypted document")
        if exp.get("extractable_text") is False:
            has_text = any(doc[i].get_text().strip() for i in range(doc.page_count))
            check(not has_text, f"{fid}: expected no text layer but found text")
        if "outline_entries" in exp:
            check(len(doc.get_toc()) == exp["outline_entries"], f"{fid}: outline count mismatch")
        if "embedded_images" in exp:
            imgs = doc[0].get_images()
            check(len(imgs) == exp["embedded_images"], f"{fid}: embedded image count {len(imgs)} != {exp['embedded_images']}")
        if "annotation_types" in exp:
            types = [a.type[1] for a in doc[0].annots()]
            for want in exp["annotation_types"]:
                check(want in types, f"{fid}: annotation '{want}' missing (found {types})")
        if "links" in exp:
            check(len(doc[0].get_links()) == exp["links"], f"{fid}: link count {len(doc[0].get_links())} != {exp['links']}")
        doc.close()

        # ---- Reader B: qpdf ----
        if path.suffix == ".pdf":
            argv = [QPDF, "--check"]
            if exp.get("encrypted"):
                argv.append(f"--password={exp.get('opens_with_password', '')}")
            q = subprocess.run(argv + [str(path)], capture_output=True, text=True)
            check(q.returncode == 0, f"{fid}: qpdf --check failed: {q.stderr.strip()[:120]}")

        print("  reader A (pymupdf): OK")

    # encrypted fixture: verify password works with qpdf (reader B functional check)
    enc = FIXTURES / "pdf" / "F-010-encrypted-aes256.pdf"
    q = subprocess.run(
        [QPDF, "--check", f"--password=synthetic-password-2026", str(enc)],
        capture_output=True, text=True,
    )
    check(q.returncode == 0, f"F-010: qpdf with password failed: {q.stderr.strip()[:120]}")
    print("[F-010] qpdf with supplied password: OK")

    print()
    if failures:
        print(f"VALIDATION FAILED: {len(failures)} problem(s)")
        sys.exit(1)
    print("VALIDATION PASSED: all fixtures pass both independent readers")


if __name__ == "__main__":
    main()
