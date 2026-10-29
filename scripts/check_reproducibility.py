#!/usr/bin/env python3
"""PT-FND-008: structural reproducibility of the fixture corpus.

Regenerated fixtures must match the committed corpus structurally
(normalized byte sizes, page counts, field names, rotations). Byte-identity is NOT
expected: PDF creation IDs/timestamps vary per run. The committed sha256-pinned
corpus remains the canonical reference.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def normalized_size(data: bytes) -> int:
    """Ignore only variable-length document IDs in the final trailer.

    MuPDF-generated IDs can expand through UTF-8 encoding; this changes the PDF
    size without changing pages or content. IDs may be serialized as hex or
    escaped literal strings. Preserve every other byte's size.
    """
    if not data.startswith(b"%PDF-"):
        return len(data)
    start = data.rfind(b"\ntrailer\n")
    if start < 0:
        return len(data)
    token = rb"(?:<[0-9a-fA-F\s]*>|\((?:\\[\s\S]|[^\\()])*\))"
    pattern = rb"(/ID\s*\[\s*)" + token + rb"(\s*)" + token + rb"(\s*\])"
    tail = re.sub(pattern, lambda m: m[1] + b"<" + b"0" * 32 + b">" + m[2] + b"<" + b"0" * 32 + b">" + m[3], data[start:], count=1)
    return start + len(tail)


def structural(entry: dict, data: bytes) -> dict:
    expected = entry.get("expected", {})
    # F-011 is the intentionally truncated first 45% of generated F-001.
    # PDF IDs/timestamps change its byte length before truncation, so exact
    # byte count is not a reproducible structural feature of this negative
    # fixture. Preserve its malformed-PDF structure and two-reader rejection
    # checks instead of comparing nondeterministic lengths.
    is_truncated = entry["id"] == "F-011"
    if is_truncated and not (
        data.startswith(b"%PDF-") and len(data) > 128 and b"%%EOF" not in data
    ):
        raise ValueError("F-011 must remain a nonempty, truncated PDF header")
    return {
        "id": entry["id"],
        "normalized_bytes": None if is_truncated else normalized_size(data),
        "truncated_pdf_header": True if is_truncated else None,
        "pages": expected.get("pages"),
        "fields": expected.get("form_fields"),
        "rotations": expected.get("rotations"),
        "page_sizes_pt": expected.get("page_sizes_pt"),
    }


def main() -> int:
    committed = json.loads(
        subprocess.run(
            ["git", "show", "HEAD:fixtures/manifest.json"],
            capture_output=True, text=True, check=True, cwd=ROOT,
        ).stdout
    )
    regenerated = json.loads((ROOT / "fixtures/manifest.json").read_text())
    a = [structural(e, subprocess.run(
        ["git", "show", f"HEAD:{e['file']}"], capture_output=True, check=True, cwd=ROOT,
    ).stdout) for e in committed["fixtures"]]
    b = [structural(e, (ROOT / e["file"]).read_bytes()) for e in regenerated["fixtures"]]
    if a != b:
        differences = [entry["id"] for entry, other in zip(a, b) if entry != other]
        sys.exit(f"::error::Regenerated corpus differs structurally: {', '.join(differences) or 'fixture list changed'}")
    print("Structural reproducibility: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
