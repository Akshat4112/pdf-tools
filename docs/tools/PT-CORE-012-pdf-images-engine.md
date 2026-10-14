# PT-CORE-012 — PDF pages to JPG/PNG engine

The engine renders selected PDF pages to verified JPG/PNG images and a verified ZIP. It renders page appearances; it does not extract original embedded images. The public PDF-to-JPG and PDF-to-PNG interfaces remain planned until PT-CORE-013.

## Integration contract

`startPdfToImages({ file, pagesExpr, options }, events)` returns a cancellable job. `file` has `displayName` and `bytes`. An omitted `pagesExpr` selects all pages; an explicitly empty expression is an error. The shared range parser preserves custom order and removes duplicates. Options and file identity are snapshotted before asynchronous work; callers keep source bytes immutable until completion. PDF.js receives a private byte copy, and the original remains unchanged.

Options:

- `format`: `jpeg` (default) or `png`.
- `dpi`: 96, 150 (default) or 200.
- `quality`: 0–1, default 0.8. Only JPEG encoding uses this setting.
- `background`: `white` (default) or `transparent`. JPEG requires white; transparency is offered only for PNG. A PNG can preserve semitransparent content and an unpainted page background; content that the PDF itself paints white stays white.

`planPdfImagePage` uses the actual PDF.js viewport, including CropBox, UserUnit and intrinsic rotation, at `dpi / 72`. Pixel dimensions are rounded up so fractional edges are retained. This helper is the dimension/limit contract for the later interface and preview.

Successful output is `{ images, zip }`. Each image contains verified bytes/name/mime/actual size plus source page, width, height, DPI, background and JPEG quality when applicable. Names identify source pages (`document-page-03.png`) and are padded against the full document page count. Image and ZIP entry order follows the requested page order, including a custom order. The archive name is `document-jpg.zip` or `document-png.zip`, even for a single selected page. The UI may expose individual images or the complete ZIP using these verified outputs.

## Rendering, limits and verification

1. Validate options and PDF input; reject encrypted PDFs. Read the document with stricter parsing enabled for this flow.
2. Resolve page selection and preflight every selected page before allocating the first render canvas.
3. Render pages sequentially, using OffscreenCanvas when supported and HTML Canvas otherwise. Only one page canvas is held at a time.
4. Check image resources that PDF.js has decoded: failed/null image XObjects cannot become a verified blank substitute. The operator-list resource callback may complete after the operator list; verification waits for that completion with cancellation checks.
5. Encode with the requested native image codec. Reject empty data or a fallback to a different format. Clear the canvas and clean up the page even after render/encode failure or cancellation.
6. Verify every generated image by its encoded structure/format, header dimensions and a fresh native bitmap decode. Close the verification bitmap on every path.
7. Pack verified images only, then reopen the archive and compare its count, order, filenames, sizes, CRC-checked extracted bytes and exact content against each image. Report success only after archive verification.

Limits: source PDF at most 50 MiB/300 pages; output image at most 8192 pixels on either axis and 16 million pixels total; encoded image bytes at most 50 MiB in total across the selection. ZIP headers add a small amount beyond that encoded-image budget. These canvas/output limits are conservative guards, not a claim that total PDF decoding memory is bounded by the canvas size. PDF.js is also given a 64-million-byte internal canvas resizing budget. Its source-image omission limit is deliberately not used, because it can silently drop visible page content. Large internal PDF resources and complex pages remain subject to the existing memory/compatibility benchmark work. Desktop/mobile Chromium tests use mobile emulation, not physical low-memory devices.

The adapter now self-hosts PDF.js CMaps, image-decoder WASM and ICC resources alongside the worker/fonts, including packaged license notices. All URLs are under `/pdf-tools/assets/`. Build/deployment checks verify representative files are present. This supports rendering resources without an external CDN. Full fidelity for every PDF feature or color profile is not promised.

The reader adapter also destroys a failed loading task before translating its error. Existing callers retain the default recovery behavior; stricter parsing and the internal canvas budget are opt-in for this conversion flow.

## Cancellation and privacy

Jobs check cancellation during planning, between pages, after rendering/encoding/verification and around packaging. A short-lived poll calls the PDF.js RenderTask cancellation method while a render is pending. That poll is cleared afterward. Native encoding/decoding and ZIP work may finish a current operation, but late output is discarded and a cancelled/failed batch never exposes partial images or an archive as success. Canvas backing stores, page handles, document loading tasks, verification bitmaps and archive readers are released on their corresponding exit paths.

All source bytes, plans and outputs remain in memory. No document data is uploaded or written to browser storage, URLs or logs by the flow. The later interface must track the job in FileSession/JobSession and revoke download URLs on reset/exit. The 30-second job timeout remains cooperative, not a hard execution deadline.

## Verification

From `app/`:

```sh
npm ci
npm run lint
npm test
npx tsc -p tsconfig.test.json --noEmit
npm run build
npx playwright install --with-deps chromium
npm run test:images-engine
npm run test:pages-ui
npm audit --omit=dev --audit-level=high
```

On constrained machines use `npm test -- --maxWorkers=2`. A preinstalled browser can be selected with `PDF_TOOLS_CHROMIUM_PATH`.

Unit coverage checks option validation, quality endpoints, crop/rotation/UserUnit sizing, invalid and oversized viewports, complete-selection preflight, ordered/deduplicated selection, snapshot/source preservation, encoded output limits, verification failures, archive readback, cancellation and retry. Unit flow tests substitute raster output/native bitmap decoding; actual rendering/encoding is verified by the browser suite.

Desktop/mobile browser cases inspect real encoded images for all three DPIs, rotation, custom page order, color, alpha, white JPEG/PNG backgrounds, JPEG quality, crop/scale geometry and archive results. They verify canvas cleanup, pending-render cancellation, malformed/encrypted input, failed embedded images, large source dimension hints without silent content removal, HTML Canvas fallback and empty encoder failure. Existing image-to-PDF engine cases and all live interface regressions also run. Test documents and colors are synthetic; test-only harnesses do not enter the production build or document-bearing CI artifacts.
