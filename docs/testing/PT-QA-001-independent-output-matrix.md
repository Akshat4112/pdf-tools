# PT-QA-001 — Independent R1 output audit (incremental)

The R1 regression suites already exercise all 14 tool flows using synthetic inputs and app/browser PDF.js assertions. The fixture corpus gate additionally uses PyMuPDF and qpdf on source fixtures. **Neither is proof that all generated outputs are independently verified by both readers.**

This increment adds `scripts/validate_outputs.py` to verify downloaded/generated **synthetic** files independently of the browser implementation:

```sh
python3 scripts/validate_outputs.py --manifest /tmp/qa-outputs/manifest.json
```

The manifest directory contains output files and JSON:

```json
{"outputs":[
 {"file":"merge.pdf","kind":"pdf","pages":3,"page_text_markers":["PAGE-1","PAGE-2","PAGE-3"]},
 {"file":"converted.png","kind":"png"},
 {"file":"extracted.txt","kind":"txt","text_markers":["PAGE-1"]},
 {"file":"split.zip","kind":"zip","entries":["part-001.pdf","part-002.pdf"]}
]}
```

The validator checks two independently implemented PDF readers (PyMuPDF and qpdf), page counts/order markers, per-page geometry and rotation, rasterization, plus TXT/ZIP/JPEG/PNG format integrity. Use only synthetic fixture-derived outputs, not personal PDFs. CI tests the verifier with the corpus's 3-page fixture, wrong counts, truncation and path-traversal, but **does not yet feed browser-produced downloads into the independent validator**.

## Remaining work before marking PT-QA-001 Done

- Generate/download outputs from merge, split, rotate, organize, extract/delete, images-to-PDF, PDF-to-JPG/PNG, page numbering, watermark and PDF-to-text journeys; validate their contents with external readers. Inspect read-only reader and document-info against expected source fixture properties.
- Add page-order, text preservation, font rendering, image geometry/color and visual-diff assertions for applicable tools, recording intentional losses (e.g. rasterized exports vs searchable PDFs).
- Add a CI bridge for browser download artifacts with synthetic files, avoiding private document uploads, and check every supported corpus fixture/format.
- Record all known intentional losses and limitations in user-facing tool copy under PT-REL-001/PT-UI-005.
- Rerun on final exact commit, and complete independent output coverage before changing tracker state from Review to Done.

This PR is the independent validation foundation and regression gate, not complete acceptance of the entire PT-QA-001 task.
