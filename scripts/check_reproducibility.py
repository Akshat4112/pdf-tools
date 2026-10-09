#!/usr/bin/env python3
"""PT-FND-008: structural reproducibility of the fixture corpus.

Regenerated fixtures must match the committed corpus structurally
(byte sizes, page counts, field names, rotations). Byte-identity is NOT
expected: PDF creation IDs/timestamps vary per run. The committed sha256-pinned
corpus remains the canonical reference.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def structural(entry: dict) -> dict:
    expected = entry.get("expected", {})
    return {
        "id": entry["id"],
        "bytes": entry["bytes"],
        "pages": expected.get("pages"),
        "fields": expected.get("form_fields"),
        "rotations": expected.get("rotations"),
    }


def main() -> int:
    committed = json.loads(
        subprocess.run(
            ["git", "show", "HEAD:fixtures/manifest.json"],
            capture_output=True, text=True, check=True, cwd=ROOT,
        ).stdout
    )
    regenerated = json.loads((ROOT / "fixtures/manifest.json").read_text())
    a = [structural(e) for e in committed["fixtures"]]
    b = [structural(e) for e in regenerated["fixtures"]]
    if a != b:
        sys.exit("::error::Regenerated corpus differs structurally from committed manifest")
    print("Structural reproducibility: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
