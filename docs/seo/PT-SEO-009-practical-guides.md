# PT-SEO-009 — practical guides and editorial backlog

The first four guides solve multi-step tasks rather than repeat a tool's landing page. They are public, original copy with fictional examples, explicit output checks and links to shipped tools. The guide directory and articles have static HTML, canonical URLs and metadata; the same content appears during client navigation. Articles load in a separate chunk so browsing the catalog does not download them or a PDF engine.

## Prioritized eight-topic backlog

| Priority | Topic / user problem | State | Implemented tools and distinct scope |
| --- | --- | --- | --- |
| 1 | Combine PDFs in the right reading order | Published at `guides/combine-pdfs-in-order/` | Merge → Reader; Organize for an internal page correction. Check every file boundary and preserve originals. |
| 2 | Share selected pages without the whole file | Published at `guides/share-selected-pages/` | Extract versus Delete versus Split; output shape, page-position order and deletion versus redaction. |
| 3 | Turn images into a readable PDF | Published at `guides/images-to-readable-pdf/` | Image order, contain/crop, margins, DPI and checking an actual exported layout. No OCR claim. |
| 4 | Get text and recognize an image-only scan | Published at `guides/copy-text-or-scan/` | Reader/search → UTF-8 extraction; mixed documents, form-feed separators, reading-order review and no-text states. |
| 5 | Correct a mixed-size document's orientation and order | Backlog | Rotate and Organize. Include a synthetic mixed-geometry PDF and verify that page sizes and unaffected rotations survive. |
| 6 | Export a diagram or photo page as PNG or JPG | Backlog | PDF to PNG/JPG. Compare raster output, background and quality settings; distinguish page rendering from original embedded-image extraction. |
| 7 | Number a packet and add a draft watermark | Backlog | Page numbers and Text watermark. Check overlap/placement on mixed-size pages; explain page labels, access control and signature limitations. |
| 8 | Inspect a PDF before choosing a workflow | Backlog | Document information and Reader. Explain dimensions, metadata and document indicators without implying signature validation or complete sanitization. |

These priorities reflect task usefulness, shipped capabilities and opportunities for verifiable examples. They are not search-volume measurements. Backlog ideas have no public placeholder routes, indexable duplicates or claims of unshipped functionality.

## Synthetic inputs and output evidence

`app/src/lib/guideExamples.ts` generates six public inputs during the build, beneath `dist/examples/`. They contain invented labels or simple colored patterns, never user documents. Source code and generated sample content use the repository's MIT license. No new dependencies or third-party photos are introduced. The build-only generator is not part of the browser entry's static import closure.

| Example | Expected result checked in the browser |
| --- | --- |
| Cover + two-page appendix | Merge makes exactly three pages: SYNTHETIC_COVER, SYNTHETIC_APPENDIX_1, SYNTHETIC_APPENDIX_2. PDF.js independently reads the downloaded output. |
| Three-page text PDF; extraction `3, 1` | Exactly two output pages, source page 3 before source page 1. PDF.js verifies marker sequence. |
| 640×400 and 400×640 PNGs; original size, 96 DPI, zero margin | Exactly two pages measuring 480×300 and 300×480 points. pdf-lib reads the output geometry; the existing image conversion suite retains its independent raster/preview checks. |
| Three-page text PDF | UTF-8 download has three form-feed-separated parts with the correct markers and sample sentence. |
| Image-only PDF | Independent PDF.js extraction returns no text; the UI reports no text layer and creates no blank TXT download. |

The examples are authored for this task. Labels identifying them as synthetic are part of the PDF text and guide copy. The image-only sample deliberately has no text layer and is described as a synthetic pattern, not as a photograph or a real scanned document. Expected outputs are assertions, not marketing claims inferred from page counts alone.

## Editorial review

- Instructions use current UI labels and actual limits. Image conversion has a **50 MB total** input limit, 16 million pixels per image and 25.6 million pixels across the selection; it does not support HEIC or OCR.
- Page deletion, extraction, visible watermarks and text export are not represented as permanent redaction or comprehensive sanitization. No legal/security certification is implied.
- Rewriting can omit interactive features or invalidate digital signatures. The guides ask readers to retain originals and inspect downloaded copies.
- Text export is TXT from an existing text layer; it does not create Word documents, recover an absent text layer or guarantee reading order/accuracy.
- Public-page loading and example downloads contact GitHub Pages. Processing selected documents remains in the browser. No tracking, storage, upload endpoint, user filename or query/fragment content is introduced into public articles or metadata.
- Reading uses shared brand colors, responsive text width, visible keyboard focus, 44 px link targets and existing light/dark themes. Articles and downloads work without JavaScript; processing tools still require JavaScript.

## Verification

Unit checks cover publication allowlists, metadata/router agreement, unknown/private-state paths and generated sample structures. Browser checks cover all five no-JS pages, sample links, light/dark reading at 320/1440 px, keyboard routes, client history, 404s, selected-file isolation and the four real example workflows. Existing full static-link graph and metadata tests expand to all 24 public pages; no tool regression is removed.

The normal CI workflow runs these browser checks early and uploads only screenshots of the public guide article, captured before any file is selected. No processing screenshots or private documents are uploaded. Existing startup budgets remain unchanged and run against the pinned pre-optimization baseline. Exact-head CI results and artifact links are recorded in the PR and tracker after completion.

PT-SEO-008's merged repository preparation does not imply Google ownership or sitemap submission. Its owner-account actions remain pending; this independent content task makes no indexing or ranking claim. PR #67's hosted structured-data validation also remains separate.
