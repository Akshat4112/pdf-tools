# PT-QA-001 — Independent R1 output audit

`app/e2e/independentOutputs.spec.ts` drives the built production app, downloads real outputs, and invokes `scripts/validate_outputs.py` in a temporary synthetic-only directory. Each test removes its directory in `finally`. CI installs pinned PyMuPDF 1.28.0 and qpdf before browser execution. No downloads, traces, screenshots or reports containing document data are uploaded.

## Coverage

| Flow | Independent evidence |
| --- | --- |
| Merge | Six pages from two inputs; text, rotations, geometry and rendered content compared to source-page plan |
| Split | Ordered ZIP members; each PDF parsed by qpdf and PyMuPDF and compared against its range |
| Rotate | Selected rotation composed with existing rotation; text and raster compared to externally rotated source |
| Organize | Reorder and rotation; source-page plan controls expected text and raster order |
| Extract / Delete | Requested order / complement; text, rotation, geometry and raster preservation |
| Images to PDF | Original-size 96-DPI geometry, independent rendered pixel comparison; generated PNG plus corpus JPEG/PNG |
| PDF to PNG / JPG | Reversed page order; ZIP CRC/names/member decoding, 96-DPI dimensions/colors/content compared with independent source render; individual download byte equality |
| Page numbers / Watermark | Original text and geometry preserved, per-page expected added text (including German glyphs), nonzero bounded raster change |
| Text | UTF-8, NUL rejection and ordered page/text markers including German glyphs |
| Reader | All three source-page text layers, independent source structure/order/rotation checks; read-only, no export |
| Document information | Page count, metadata and per-page geometry/rotation compared with synthetic known values, independently parsed source; no export |

Every implemented registry tool produces a scenario on desktop Chromium and Pixel 7 emulation. Existing tool suites retain more detailed selection, cancellation, preview/print, transparency, EXIF, range and UI regressions. The external readers are separate implementations from production PDF.js/pdf-lib; source construction is synthetic pdf-lib while expected rendering/inspection is external PyMuPDF.

## Corpus and losses

All readable, unlocked PDF corpus fixtures F-001–009, F-014 and F-015 are exported through Extract pages, including the 30/60-page cases. All pages are compared for source text and geometry/rotation; normal page content is raster-compared. F-005 forms and F-006 annotations are compared with annotation rendering disabled on both sides: this checks page contents, **not preservation of interactive widgets or annotation appearances**. F-007 JPEG and F-013 PNG are converted through Images to PDF with independent pixel comparison. Existing malformed/empty/encrypted rejection suites cover F-010–012; these are not supported modifying-tool inputs.

The shared PDF selection UI now explains that modified exports can invalidate signatures and may lose interactive forms, annotations, bookmarks or document metadata; originals should be retained. Raster exports lose searchable text, and text export neither performs OCR nor preserves layout. Existing image layout copy warns about color profile differences. The signed-marker fixture is a visual stamp, not a cryptographically signed sample; no signature-validity claim is made.

## What the comparisons establish

Page-copy raster error is mean absolute RGB difference at 72 DPI, bounded by 1/255 per channel; image conversion allows 8/255 for JPEG/renderer differences. Original-size generated PNG comparison allows 2/255. These bounds catch missing content, blank output, wrong color blocks or page order without requiring identical antialiasing. Overlay output must retain source text, contain the expected overlay text on each page, and show a nonzero mean raster change below 30/255; existing overlay tests additionally compare browser previews and exports. This is not a perceptual guarantee for every font, color profile, PDF feature, device or printer.

Negative verifier tests reject wrong page counts/order/rotation, blank visual content, missing overlay output, corrupt PDF bytes inside a valid ZIP and wrong text order. qpdf warnings count as failures. The validator never extracts arbitrary archive paths.

Run after a production build:

```sh
cd app
npx playwright test independentOutputs.spec.ts --max-failures=1
cd ..
python3 -m unittest discover -s scripts -p 'test_validate_outputs.py'
```

PT-QA-002 remains the cross-browser/device/accessibility/performance task. Public help pages remain PT-REL-001. Task acceptance requires the final exact-head CI run, not just committed test code.
