#!/usr/bin/env python3
"""PT-SP-006: measure synthetic OOXML import in a real LibreOffice renderer.

This is evidence gathering, not a claim of browser-side or Microsoft Office fidelity.
Only generated fixtures are processed. Failures are recorded as unsupported rather
than silently treated as successful conversions.
"""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from measure_office_layout import measure
from xml.etree.ElementTree import ParseError

ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "fixtures" / "office"
REPORT = CORPUS / "renderer-report.json"
FIXTURES = ("O-01-basic.docx", "O-04-basic.xlsx", "O-06-basic.pptx")
EXPECTED = {
    "O-01-basic.docx": ["Synthetic", "office probe"],
    "O-04-basic.xlsx": ["Probe", "42"],
    "O-06-basic.pptx": ["Office slide probe"],
}


def command(args: list[str], timeout: int = 45) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, text=True, capture_output=True, timeout=timeout, check=False)


def benchmark() -> dict:
    results = []
    with tempfile.TemporaryDirectory(prefix="office-probe-") as tmp:
        output = Path(tmp) / "pdf"
        output.mkdir()
        profile = Path(tmp) / "lo-profile"
        for name in FIXTURES:
            source = CORPUS / name
            record = {"fixture": name, "renderer": "LibreOffice headless", "status": "unverified"}
            try:
                proc = command([
                    "libreoffice", "-env:UserInstallation=" + profile.as_uri(),
                    "--headless", "--convert-to", "pdf", "--outdir", str(output), str(source)
                ])
                pdf = output / (source.stem + ".pdf")
                record["renderer_exit_code"] = proc.returncode
                record["pdf_generated"] = pdf.is_file() and pdf.stat().st_size > 0
                if proc.returncode != 0 or not record["pdf_generated"]:
                    record["status"] = "import_or_export_failed"
                    record["diagnostic"] = (proc.stderr or proc.stdout)[-500:]
                else:
                    info = command(["pdfinfo", str(pdf)])
                    extracted = command(["pdftotext", "-layout", str(pdf), "-"])
                    pages = next((line.split(":", 1)[1].strip() for line in info.stdout.splitlines() if line.startswith("Pages:")), None)
                    text = extracted.stdout
                    record["page_count"] = int(pages) if pages and pages.isdigit() else None
                    record["expected_text_checks"] = {token: token in text for token in EXPECTED[name]}
                    record["status"] = ("text_readback_pass" if info.returncode == 0 and
                                        extracted.returncode == 0 and record["page_count"] and
                                        all(record["expected_text_checks"].values())
                                        else "text_readback_failed")
                    try:
                        bbox = command(["pdftotext", "-bbox", str(pdf), "-"])
                        if bbox.returncode != 0:
                            raise ValueError("Poppler bbox extraction failed")
                        record["text_geometry"] = measure(bbox.stdout)
                        record["geometry_status"] = "measured"
                    except (ValueError, ParseError, OSError, subprocess.TimeoutExpired) as exc:
                        record["geometry_status"] = "measurement_failed"
                        record["geometry_diagnostic"] = str(exc)[:500]
            except (OSError, subprocess.TimeoutExpired) as exc:
                record["status"] = "renderer_unavailable_or_timeout"
                record["diagnostic"] = str(exc)[:500]
            results.append(record)
    return {
        "scope": "Synthetic basic OOXML to PDF through LibreOffice on CI Linux",
        "limitations": [
            "Not a browser-only conversion benchmark",
            "Not Microsoft Office compatibility evidence",
            "Text extraction is not visual-layout or font fidelity",
            "Complex tables, charts, print areas and scans not yet tested"
        ],
        "results": results,
    }


if __name__ == "__main__":
    assert all((CORPUS / name).is_file() for name in FIXTURES), "Generate fixtures first"
    REPORT.write_text(json.dumps(benchmark(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(REPORT.read_text(encoding="utf-8"))
