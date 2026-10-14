# PT-CORE-014 — Local PDF reader with search and print

`/reader/` mounts the shipped read-only workspace. One validated PDF stays in memory (50 MB / 300 pages); replacement, clear, reset and route exit destroy its PDF.js loading task. Nothing is uploaded, persisted, or sent to analytics.

## Reading and search

- Previous/next and validated page-number navigation, 50–400% zoom, fit-width and fit-page. Fit modes respond to container resize. Intrinsic rotation, CropBox and UserUnit are handled by PDF.js viewports.
- PDF.js's matching **legacy** viewer component is loaded only after the existing core adapter. Its legacy polyfills support the same browser baseline as the core (including literal searches with punctuation on Chromium 133).
- The native text layer supports selection/copy and highlighted local search across the document, previous/next matches, wrapping and optional case sensitivity. Enter/Shift+Enter navigate matches; Ctrl/Cmd+F in the workspace focuses local search. Search is capped at 256 input characters.
- Current-page text inspection distinguishes pages with extractable text from image-only pages. Scans need OCR; OCR is not implemented here. Text order/appearance can differ in complex layouts.
- Single-page scroll mode bounds visible rendering. PDF.js evicts cached views; canvases are capped at 2 million pixels / 4096 px per side and detail canvases are disabled, so high zoom can look softer. The viewer receives a lifetime AbortSignal to remove scroll listeners and disconnect its ResizeObserver. Search/extraction callbacks ignore disposed workspaces.
- No scripting manager, annotation editor, form editing, automatic links or enabled external links. Static annotation/form appearances are shown read-only. The adapter disables eval; PDF JavaScript/OpenAction actions are never executed. This is a reader, not signature verification or document editing.

## Printing

Print ranges use the existing ordered, deduplicating range parser. Current/all-page shortcuts are available. Printing first preflights every selected page at 96 DPI, preserving the PDF.js page dimensions and rotation. Invalid geometry, a side above 8192 px, or a combined 16 million pixels (64 MB RGBA) is refused before allocating canvases. Long documents must be printed in smaller ranges.

Preparation sequentially renders to a sandboxed `about:blank` iframe containing only app-created styles, sections and canvases. No original PDF bytes, PDF text as HTML, active links/forms, scripts or attachments enter the print document; no print object URLs are used. Render/image decoding failures produce no printable partial result. A second explicit click opens `iframe.contentWindow.print()` after all pages are ready, preserving browser user activation. Paper/driver scaling is controlled by the browser. Printing is a 96-DPI raster copy, not vector-quality export; actual device printing and cross-browser/mobile system dialogs are not asserted by headless tests.

Cancellation aborts the active render, zeros/removes print canvases, and retains the PDF and settings for retry. Late asynchronous completions cannot expose a print button. Range changes, new preparation, source replacement, reset, exit and Clear print copy dispose the print workspace. A finished print copy remains available until explicitly cleared or the source/route changes, so browsers with asynchronous dialogs are not raced by early cleanup.

## Verification

Four browser scenarios run on desktop and mobile:

1. Selectable text, cross-page search/counts/case sensitivity, highlighted match navigation, missing query, validated page navigation, rotation and zoom; an embedded OpenAction script does not run; controls fit the viewport.
2. Ordered/deduplicated print pages with decoded pixel ink and correct rotated canvas dimensions; browser print invocation, invalid range retry, current-page shortcut and reset cleanup.
3. All eleven valid launch-corpus PDFs, including text, images, scan, mixed sizes, rotation, forms, annotations, signed marker, outlines and 60 pages; encrypted/malformed recovery and source replacement/exit.
4. Deterministically delayed print rendering, cancellation, discarded late callbacks, retry, replacement cleanup, and preflight memory refusal without print canvases.

All browser requests are restricted to the local origin/data/blob/about schemes. Uncaught page errors fail tests. Screenshots are opt-in through `PDF_TOOLS_VISUAL_DIR` and are never committed or uploaded by CI. Desktop/mobile screenshots are visually reviewed. The shared unit, interface and image-engine suites, TypeScript checks, lint, production build and dependency audit remain required.

Next task: **PT-CORE-015 — PDF to Text export**, building on the reader's text availability contract.
