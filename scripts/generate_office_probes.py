#!/usr/bin/env python3
"""PT-SP-006: deterministic, synthetic Office structure probes (no user files).

Generate minimal OPC DOCX/XLSX/PPTX documents and independently read their
XML back. This is a parser baseline, NOT a visual fidelity benchmark.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fixtures" / "office"
NS = {
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
}
MARKER = "Synthetic Grüße 2026 — office probe"

def xml(s: str) -> bytes:
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + s).encode("utf-8")

def archive(path: Path, parts: dict[str, bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w") as z:
        for name, payload in sorted(parts.items()):
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, payload)

def common(kind: str, main: str, content_type: str) -> dict[str, bytes]:
    return {
        "[Content_Types].xml": xml(
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            f'<Override PartName="/{main}" ContentType="{content_type}"/></Types>'
        ),
        "_rels/.rels": xml(
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/{kind}" Target="{main}"/>'
            '</Relationships>'
        ),
    }

def generate() -> list[dict]:
    doc = OUT / "O-01-basic.docx"
    parts = common("officeDocument", "word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml")
    parts["word/document.xml"] = xml(
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body><w:p><w:r><w:t>{MARKER}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>'
    )
    archive(doc, parts)

    book = OUT / "O-04-basic.xlsx"
    parts = common("officeDocument", "xl/workbook.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml")
    parts["xl/workbook.xml"] = xml(
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="Probe" sheetId="1" r:id="rId1"/></sheets></workbook>'
    )
    parts["xl/_rels/workbook.xml.rels"] = xml(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
        '</Relationships>'
    )
    parts["xl/worksheets/sheet1.xml"] = xml(
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Probe</t></is></c>'
        '<c r="B1"><v>42</v></c></row></sheetData></worksheet>'
    )
    archive(book, parts)

    deck = OUT / "O-06-basic.pptx"
    parts = common("officeDocument", "ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml")
    parts["ppt/presentation.xml"] = xml(
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst>'
        '<p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>'
        '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>'
    )
    parts["ppt/_rels/presentation.xml.rels"] = xml(
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>'
        '</Relationships>'
    )
    parts["ppt/slides/slide1.xml"] = xml(
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
        '<p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr/></a:lstStyle>'
        '<a:p><a:r><a:rPr lang="en-US"/><a:t>Office slide probe</a:t></a:r></a:p>'
        '</p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
    )
    archive(deck, parts)
    return [
        {"id": "O-01", "file": doc, "expected": {"text": MARKER}},
        {"id": "O-04", "file": book, "expected": {"sheet": "Probe", "A1": "Probe", "B1": "42"}},
        {"id": "O-06", "file": deck, "expected": {"slides": 1, "text": "Office slide probe"}},
    ]

def verify(path: Path, fixture_id: str) -> None:
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        assert len(names) == len(set(names)), "duplicate ZIP entries"
        assert "[Content_Types].xml" in names and "_rels/.rels" in names
        assert all(not n.startswith("/") and ".." not in Path(n).parts for n in names)
        assert all(i.file_size < 1024 * 1024 for i in z.infolist())
        for name in names:
            if name.endswith((".xml", ".rels")) or name == "[Content_Types].xml":
                ET.fromstring(z.read(name))
        if fixture_id == "O-01":
            root = ET.fromstring(z.read("word/document.xml"))
            assert "".join(t.text or "" for t in root.findall(".//w:t", NS)) == MARKER
        elif fixture_id == "O-04":
            root = ET.fromstring(z.read("xl/workbook.xml"))
            assert root.find(".//x:sheet", NS).attrib["name"] == "Probe"
            root = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
            assert root.find(".//x:c[@r='A1']/x:is/x:t", NS).text == "Probe"
            assert root.find(".//x:c[@r='B1']/x:v", NS).text == "42"
        elif fixture_id == "O-06":
            root = ET.fromstring(z.read("ppt/presentation.xml"))
            assert len(root.findall(".//{http://schemas.openxmlformats.org/presentationml/2006/main}sldId")) == 1
            root = ET.fromstring(z.read("ppt/slides/slide1.xml"))
            assert "Office slide probe" in [t.text for t in root.findall(".//a:t", NS)]

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Verify generated files match committed manifest")
    args = parser.parse_args()
    entries = generate()
    manifest = []
    for entry in entries:
        path = entry["file"]
        verify(path, entry["id"])
        manifest.append({
            "id": entry["id"], "file": str(path.relative_to(ROOT)),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "bytes": path.stat().st_size, "expected": entry["expected"],
            "verification": "stdlib ZIP/XML structural readback only; no Office rendering or fidelity claim",
        })
    output = json.dumps({"generator": "Python standard library OOXML synthetic probe v1", "fixtures": manifest}, indent=2, ensure_ascii=False) + "\n"
    manifest_path = OUT / "manifest.json"
    if args.check:
        assert manifest_path.exists(), "Run generator first and commit manifest"
        assert manifest_path.read_text(encoding="utf-8") == output, "Fixture manifest drift"
    else:
        manifest_path.write_text(output, encoding="utf-8")
    print(f"Verified {len(entries)} synthetic Office structure probes")

if __name__ == "__main__":
    main()
