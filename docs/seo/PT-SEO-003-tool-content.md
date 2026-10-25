# PT-SEO-003 — Public tool guides

All 14 shipped tools have supporting content after the complete utility: a distinct explanation, three steps, input/output formats, limits, a synthetic example, a practical FAQ and local-processing context. The compact help above the utility remains separate. No processing engines, document/session data, metadata URLs or availability flags change.

`app/src/lib/toolContent.ts` owns the editorial source and HTML renderer. Every string is escaped, including the title; there are no raw-content slots or inputs from selected files. ToolEntry renders this fixed article after ToolContent. The Vite prerenderer places the identical article in the existing no-JavaScript fallback, alongside the honest JavaScript requirement. No duplicate visible article is added when JavaScript is enabled. Home and 404 do not receive tool articles.

## Editorial checks

Copy was compared with the registry, FileSelection, the shipped tool components, page range parser and existing engine/flow suites. In particular:

- Merge has a 300-page combined-output limit. Split downloads a ZIP of parts.
- Extract keeps selection order and deduplicates; delete keeps remaining source order and cannot delete all pages. Organize uses whole-page operations, not text editing.
- Images to PDF accepts static JPG/PNG, 300 images, 50 MB total, 16 million pixels each and 25.6 million pixels total. Fit/Fill behavior follows the current layout preview.
- PDF to JPG/PNG renders selected pages, not embedded image extraction. The 8192-pixel-side, 16-million-pixel and 50 MB encoded-image limits are stated. Transparency does not erase painted white content.
- Reader searches an existing text layer; local printing is bounded to 96 DPI/64 MB retained pixels.
- Overlay content needs a current modified preview. Visible page numbers do not update page-label metadata. A watermark is neither access control nor redaction.
- Text extraction runs before the result report, produces UTF-8 TXT, and cannot OCR scans or create DOCX. No blank export is promised for image-only documents.
- Inspection is read-only, has a limited locked-file report, and does not validate certificates or authenticity.

Rewriting warnings and host-request/privacy qualifications follow the existing trust specification. Free/open-source positioning is already in the shared header; these guides do not claim anonymity, certification, guaranteed search rank or unsupported capabilities.

## Verification

Unit checks cover escaping, shipped-route coverage, distinct copy and the published selection/organization examples against the actual planning functions. Existing merge, image conversion, reader, overlay, text and inspector suites cover the corresponding engine behaviors. Browser checks compare every guide field with the shared source on all 14 routes with JavaScript enabled and disabled, confirm one visible main/article, preserve utility-first order and check 320px horizontal fit. Full regression, privacy, build and typing checks remain required.

This task introduces no guides hub, category URLs, structured data, language variants or Search Console configuration; those have separate tracker tasks. Browser emulation is not a real-device or screen-reader audit.
