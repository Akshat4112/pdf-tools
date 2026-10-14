# PT-CORE-013 — PDF to Images interface

The `/pdf-tools/pdf-to-jpg/` and `/pdf-tools/pdf-to-png/` routes now open the live PDF-to-Images workspace, defaulting to JPG and PNG respectively. Both tools are enabled in the registry. Conversion uses the verified PT-CORE-012 engine.

## User workflow

1. Choose or drop one local PDF. Input, page, pixel and encoded-output limits are visible before selection. Protected or unreadable input receives the existing error/recovery message.
2. All pages are selected by default. Enter custom ranges such as `3, 1, 5-8`, or use keyboard/touch/pointer thumbnail buttons. Select all and Clear page selection are available. The shared parser preserves custom order and removes duplicates.
3. Choose JPG/PNG and 96/150/200 DPI. JPG exposes a 0–100% quality field and always uses white. PNG exposes White/Transparent background. Switching format resets quality to 80% and the background to white, avoiding hidden invalid options. Headings reflect the selected format.
4. Review at most eight source-page previews at a time. Background transparency uses a checkerboard only behind the page canvas, so page edges remain clear. The preview is a small page-appearance render; JPEG compression is represented by actual encoded previews after conversion.
5. Review exact output pixel dimensions, obtained from the engine's viewport planner (CropBox, UserUnit, rotation and DPI). The pre-conversion size estimate is explicitly labeled as uncompressed RGBA pixel memory summed across selected pages, not an encoded download-size prediction. The screen explains that one page is rendered at a time and actual download sizes depend on content/quality.
6. Create images. Deterministic progress and cancellation use the shared panels. No image or ZIP is downloadable until the engine verifies the complete batch.
7. Results show actual sizes, source page numbers, pixel dimensions, actual encoded previews, individual download buttons and Download all as ZIP. Stable source-page filenames and ZIP order come from the engine. Results paginate in groups of eight.
8. Adjust settings discards generated outputs/URLs while retaining the PDF and current settings. Start over restores the route's default format/settings and clears files, previews and output. Clear files retains image preferences while clearing document state. Back/Back to all tools disposes the workspace.

The screen clearly states that this renders PDF pages and does not extract the original embedded images.

## Validation and plan isolation

The source document is tied to a unique selected-file ID. Reader callbacks are ignored after replacement/exit and their loading task is destroyed. Output planning carries a key containing source identity, page expression and normalized options. Changing source, ranges, DPI, format, background or quality immediately makes the old plan unusable. Every selected page is checked before Create images is enabled.

Selection and option validation are separate: invalid quality does not deselect thumbnails or mark the page-range field invalid. Empty/out-of-range page selections and invalid quality disable conversion with useful messages. Oversized pages disable conversion until DPI is lowered or the selection/source is changed. Async planning callbacks ignore disposed state, so stale page dimensions cannot enable the button for a new request.

The engine retains final preflight/output budget checks, because a memory estimate cannot predict JPEG/PNG compression size or the complexity of embedded resources. Limits and fidelity caveats remain those documented in PT-CORE-012; physical low-memory device benchmarks are still a later task.

## Lifecycle and privacy

Source and result displays mount at most eight canvases. Source renders are cancelled and canvases cleared on pagination, replacement, processing or exit. Result image decoding runs sequentially through a shared queue, requests bounded bitmap dimensions and closes every bitmap; queued previews skip work after disposal. Results use byte-backed canvases, without preview object URLs.

Jobs are tracked by JobSession and checked against both mounted state and active job identity before accepting progress/completion. A cancelled or superseded job cannot expose late results. Repeated downloads cache URLs by output filename, so ZIP and individual images remain distinct. Adjust settings, reset and exit revoke all download URLs and clear stored outputs. Document handles are destroyed on clear/replacement/exit.

Document bytes, names, ranges, settings, images and archives remain in memory. The interface adds no server upload, persistent browser storage or document data in URLs/logs. Hosted application assets and PDF.js worker/font/decoder resources stay under the project path.

## Verification

From `app/`:

```sh
npm ci
npm run lint
npm test
npx tsc -p tsconfig.test.json --noEmit
npm run build
npx playwright install --with-deps chromium
npm run test:pages-ui
npm run test:images-engine
npm audit --omit=dev --audit-level=high
```

On constrained machines use `npm test -- --maxWorkers=2`. `PDF_TOOLS_CHROMIUM_PATH` selects an existing browser. Optional local screenshots use `PDF_TOOLS_VISUAL_DIR`; desktop/mobile layouts were inspected without uploading document-bearing CI artifacts.

New desktop/mobile interface checks verify:

- PNG default route, custom/deduplicated order, rotated dimensions, transparent preview pixels, actual result pixels, CRC-checked ZIP contents and exact equality of individual downloads with their archive entries.
- JPG default route, invalid quality recovery, all three DPIs, white encoding, format switches and safe background/quality defaults.
- Keyboard thumbnail selection, eight-canvas pagination, all-page export, result pagination and source replacement resetting the plan.
- Protected/unreadable PDFs, invalid/empty ranges, oversized page plans, DPI recovery and reset.
- Correct separate ZIP/image download URLs, reuse, and revocation after adjust/reset/exit.
- Held native image verification followed by cancel/reset: no partial or late result, followed by a successful fresh conversion.

The existing live-tool regressions and engine render checks run alongside these cases. All documents/colors are synthetic. Desktop and mobile Chromium are emulated browser profiles, not claims of testing physical mobile memory behavior.
