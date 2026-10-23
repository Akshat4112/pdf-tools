#!/usr/bin/env python3
"""Independent downloaded-output checks: PyMuPDF plus qpdf, PNG/JPEG signatures.

Use: python3 scripts/validate_outputs.py --manifest /path/to/outputs.json
Manifest: {"outputs":[{"file":"merged.pdf","kind":"pdf","pages":3,
"text_markers":["..."],"rotations":[0,90,0],"page_sizes_pt":[[595,842],...]}]}
Only run with synthetic test data; never commit/export private document artifacts.
"""
import argparse
import json
import subprocess
from pathlib import Path
import pymupdf

KINDS = {"pdf", "png", "jpeg", "txt", "zip"}

def validate_entry(item, root):
    errors = []
    name = item.get("file", "")
    path = (root / name).resolve()
    if not name or not path.is_relative_to(root.resolve()) or not path.is_file():
        return [f"missing or unsafe output path: {name}"]
    payload = path.read_bytes()
    if not payload:
        return [f"{name}: empty output"]
    kind = item.get("kind")
    if kind not in KINDS:
        return [f"{name}: unsupported kind {kind}"]
    if kind == "pdf":
        check = subprocess.run(["qpdf", "--check", str(path)], capture_output=True, text=True)
        if check.returncode:
            errors.append(f"{name}: independent qpdf parser rejected file")
        try:
            with pymupdf.open(path) as doc:
                if "pages" in item and doc.page_count != item["pages"]:
                    errors.append(f"{name}: pages {doc.page_count} != {item['pages']}")
                texts = [p.get_text() for p in doc]
                for marker in item.get("text_markers", []):
                    if not any(marker in t for t in texts):
                        errors.append(f"{name}: missing text marker {marker!r}")
                if "page_text_markers" in item:
                    markers = item["page_text_markers"]
                    if len(markers) != doc.page_count:
                        errors.append(f"{name}: page marker count mismatch")
                    else:
                        for i, marker in enumerate(markers):
                            if marker not in texts[i]:
                                errors.append(f"{name}: page {i + 1} missing ordered marker {marker!r}")
                if "rotations" in item and [p.rotation for p in doc] != item["rotations"]:
                    errors.append(f"{name}: rotations differ")
                if "page_sizes_pt" in item:
                    measured = [[round(p.rect.width), round(p.rect.height)] for p in doc]
                    if measured != item["page_sizes_pt"]:
                        errors.append(f"{name}: geometry differs")
                for page in doc:
                    try:
                        pix = page.get_pixmap(matrix=pymupdf.Matrix(0.5, 0.5), alpha=False)
                        if pix.width < 1 or pix.height < 1:
                            errors.append(f"{name}: empty raster page")
                    except Exception:
                        errors.append(f"{name}: page rasterization failed")
        except Exception:
            errors.append(f"{name}: PyMuPDF could not open output")
    elif kind == "png":
        if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
            errors.append(f"{name}: bad PNG header")
        else:
            try:
                pix = pymupdf.Pixmap(path)
                if pix.width < 1 or pix.height < 1:
                    errors.append(f"{name}: invalid raster dimensions")
            except Exception:
                errors.append(f"{name}: independent PNG decoder rejected file")
    elif kind == "jpeg":
        if not (payload.startswith(b"\xff\xd8\xff") and payload.endswith(b"\xff\xd9")):
            errors.append(f"{name}: bad JPEG markers")
        else:
            try:
                pymupdf.Pixmap(path)
            except Exception:
                errors.append(f"{name}: independent JPEG decoder rejected file")
    elif kind == "zip":
        import zipfile
        try:
            with zipfile.ZipFile(path) as archive:
                names = archive.namelist()
                if archive.testzip() is not None or not names:
                    errors.append(f"{name}: corrupt or empty ZIP")
                for member in names:
                    if member.startswith("/") or ".." in Path(member).parts:
                        errors.append(f"{name}: unsafe ZIP member {member}")
                if "entries" in item and names != item["entries"]:
                    errors.append(f"{name}: member names/order differ")
        except Exception:
            errors.append(f"{name}: ZIP parser rejected file")
    elif kind == "txt":
        try:
            data = payload.decode("utf-8")
            if "\x00" in data:
                errors.append(f"{name}: NUL in text output")
            for marker in item.get("text_markers", []):
                if marker not in data:
                    errors.append(f"{name}: missing text marker {marker!r}")
        except UnicodeError:
            errors.append(f"{name}: invalid UTF-8")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    outputs = manifest.get("outputs", [])
    if not outputs:
        parser.error("manifest must contain at least one output")
    errors = []
    for item in outputs:
        errors.extend(validate_entry(item, args.manifest.parent))
    for err in errors:
        print("FAIL:", err)
    print(f"Validated {len(outputs)} outputs; {len(errors)} errors")
    raise SystemExit(1 if errors else 0)

if __name__ == "__main__":
    main()
