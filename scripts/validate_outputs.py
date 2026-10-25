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
import tempfile
import zipfile
from pathlib import Path
import pymupdf

KINDS = {"pdf", "png", "jpeg", "txt", "zip"}

def pixel_error(actual, expected):
    if (actual.width, actual.height, actual.n) != (expected.width, expected.height, expected.n):
        return float("inf")
    return sum(abs(a-b) for a, b in zip(actual.samples, expected.samples)) / len(actual.samples)


def reference_checks(doc, item, root, name):
    errors = []
    reference = item.get("reference")
    if not reference:
        return errors
    source = (root / reference["file"]).resolve()
    if not source.is_relative_to(root.resolve()):
        return [f"{name}: unsafe reference"]
    with pymupdf.open(source) as original:
        plan = reference["pages"]
        if len(plan) != len(doc):
            return [f"{name}: reference page count differs"]
        for index, source_index in enumerate(plan):
            expected = original[source_index]
            expected.set_rotation(reference.get("rotations", [original[i].rotation for i in plan])[index])
            page = doc[index]
            if page.rect != expected.rect or page.rotation != expected.rotation:
                errors.append(f"{name}: reference geometry/rotation differs on page {index+1}")
            if not reference.get("raster_only"):
                # Preserve source text even for overlay exports; whitespace may be segmented differently.
                if ''.join(expected.get_text().split()) not in ''.join(page.get_text().split()):
                    errors.append(f"{name}: reference text lost on page {index+1}")
            diff = pixel_error(page.get_pixmap(alpha=False, annots=not reference.get("ignore_annotations", False)), expected.get_pixmap(alpha=False, annots=not reference.get("ignore_annotations", False)))
            if reference.get("overlay"):
                if not 0.01 < diff < 30:
                    errors.append(f"{name}: overlay missing or unexpectedly destructive on page {index+1}")
            elif diff > reference.get("pixel_tolerance", 1):
                errors.append(f"{name}: visual difference on page {index+1}: {diff:.3f}")
    return errors


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
                errors.extend(reference_checks(doc, item, root, name))
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
                for i, markers in enumerate(item.get("page_required_text", [])):
                    for marker in markers:
                        if marker not in texts[i]:
                            errors.append(f"{name}: page {i+1} missing required overlay text")
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
        try:
            with zipfile.ZipFile(path) as archive:
                names = archive.namelist()
                if archive.testzip() is not None or not names:
                    errors.append(f"{name}: corrupt or empty ZIP")
                for member in names:
                    if member.startswith("/") or ".." in Path(member).parts:
                        errors.append(f"{name}: unsafe ZIP member {member}")
                if "members" in item:
                    if names != [m["file"] for m in item["members"]]:
                        errors.append(f"{name}: ZIP member names/order differ")
                    with tempfile.TemporaryDirectory(dir=root) as directory:
                        target = Path(directory)
                        for member in item["members"]:
                            if member["file"] not in names:
                                errors.append(f"{name}: missing expected member")
                                continue
                            # Never extract untrusted archive paths.
                            local = dict(member, file="member.bin")
                            (target / "member.bin").write_bytes(archive.read(member["file"]))
                            if "reference" in local:
                                local["reference"] = dict(local["reference"])
                                ref = root / local["reference"]["file"]
                                (target / "source.pdf").write_bytes(ref.read_bytes())
                                local["reference"]["file"] = "source.pdf"
                            if "image_reference" in local:
                                local["image_reference"] = dict(local["image_reference"])
                                (target / "image-source.pdf").write_bytes((root / local["image_reference"]["file"]).read_bytes())
                                local["image_reference"]["file"] = "image-source.pdf"
                            errors.extend(validate_entry(local, target))
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
    if kind in {"png", "jpeg"} and "image_reference" in item and not errors:
        ref = item["image_reference"]
        source = (root / ref["file"]).resolve()
        if not source.is_relative_to(root.resolve()):
            errors.append(f"{name}: unsafe image reference")
        else:
            with pymupdf.open(source) as doc:
                expected = doc[ref["page"]].get_pixmap(matrix=pymupdf.Matrix(ref["dpi"]/72, ref["dpi"]/72), alpha=False)
                actual = pymupdf.Pixmap(path)
                if actual.alpha:
                    actual = pymupdf.Pixmap(actual, 0)
                if pixel_error(actual, expected) > ref.get("pixel_tolerance", 8):
                    errors.append(f"{name}: raster dimensions/colors/content differ")
    if kind == "txt" and "ordered_text" in item and not errors:
        cursor = 0
        for marker in item["ordered_text"]:
            at = data.find(marker, cursor)
            if at < 0:
                errors.append(f"{name}: text order/content differs")
                break
            cursor = at + len(marker)
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
