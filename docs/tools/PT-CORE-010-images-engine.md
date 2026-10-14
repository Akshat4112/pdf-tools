# PT-CORE-010 — JPG and PNG to PDF engine

The engine converts an ordered selection of static JPG/PNG images into one verified PDF. The Images to PDF interface and registry activation are PT-CORE-011; the public route remains planned until that task ships.

## Integration contract

`startImagesToPdf({ images, options }, events)` returns the existing cancellable job handle. Each image has `displayName` and `bytes`. Selection order and options are snapshotted before asynchronous work. Callers retain immutable source bytes for the duration of the job; the engine never mutates or transfers them. Track the handle with `JobSession` and cancel on replacement, reset or exit when wiring the interface.

`readImageMetadata` provides raw pixel dimensions and primary EXIF orientation. `planImagePage` is the pure geometry contract for both preview and export. The next interface must use these same helpers rather than calculate its own fit or orientation.

- A4: 595.276 × 841.89 points. Letter: 612 × 792 points.
- Auto orientation follows the image dimensions after EXIF orientation. Explicit portrait/landscape changes the paper, without applying an additional image rotation.
- Original sizing uses oriented pixels × 72 / chosen DPI (96, 150 or 200), plus the margins on each side. It requires auto orientation. Camera resolution tags are ignored; the DPI setting only affects original sizing.
- Contain fits the entire image and preserves its aspect ratio. Cover fills the available frame and crops the centered image to that frame. Both preserve the margins.
- Default: A4, auto orientation, 18-point margins, contain, 150 DPI, white background.
- The page contains an explicit white rectangle. Transparent PNG regions therefore appear white even with a nonwhite reader background.
- All eight EXIF transformations are honored, including mirrored orientations. JPEG APP1 and PNG eXIf are read with bounded little/big-endian TIFF IFD0 access. Thumbnail/camera-data pointers are not followed. Conflicting or damaged primary orientation metadata is rejected.
- JPEG bytes are embedded directly; PNG alpha is retained by the writer over the white page. No canvas re-encoding of source images is performed. Full color-profile fidelity is not claimed.

## Limits and failures

Before image decoding: at most 300 images, 50 MiB encoded input bytes in total, 16 million pixels per image, and 25.6 million pixels in the selection. Maximum page dimension is 14,400 points. These are initial conservative guards, not measurements of the entire browser memory footprint; the later mobile memory benchmark must confirm or tighten them. Embedding is sequential, and decoded browser preflight bitmaps are closed immediately.

Supported input: static PNG (legal PNG bit depths/color types, with PNG alpha) and 8-bit baseline/progressive JPEG (grayscale, RGB or CMYK). Animation chunks, unsupported JPEG coding modes and unknown critical PNG chunks are rejected. Magic bytes determine format; names are not trusted. PNG chunk bounds and CRCs are checked; malformed dimensions and EXIF offsets fail before allocation. Missing JPEG scan data is rejected. Browser-native image decoding also rejects files it cannot decode before embedding; some recoverable image damage may be accepted by the decoder, so this is not a forensic integrity check. Node unit tests exercise the headers/writer, and Chromium tests exercise actual image decoding and rendering.

Invalid input/configuration and quota failures use the existing error taxonomy and recovery affordances. Processing is cooperative on the existing executor: cancellation is checked before work and between decoding, embedding and readback steps, and late output is discarded. A synchronous decoder cannot be interrupted mid-call; the limits bound that work. No partial output is exposed. A new job can retry after failure or cancellation.

The independent PDF.js reader checks the page count and every page's dimensions/rotation before structural verification marks the result downloadable. Rendering and image appearance are additionally checked in the browser regression suite. Output names are sanitized and use the first image stem plus `-images.pdf`. Source data, output bytes and metadata remain in memory; no source filename, metadata or bytes are sent to a service or persistent browser storage.

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
```

On constrained machines, use `npm test -- --maxWorkers=2`. Set `PDF_TOOLS_CHROMIUM_PATH` to use an existing Chromium installation.

The test-only Vite harness is served from `e2e/images-engine/` and uses the built self-hosted PDF.js worker. It is not a production build entry or public UI. Its synthetic four-color JPEG was generated with Pillow at quality 100, without chroma subsampling; PNGs are generated in the tests. No user files are included in fixtures or uploaded as CI artifacts.

Unit tests cover byte-order/offset handling, malformed and truncated inputs, orientation metadata, limits, layout validation, options/order snapshots, input preservation, cancellation and recovery. Desktop and mobile Chromium independently render the exported PDF and inspect corner pixels for every JPEG/PNG EXIF orientation, aspect ratio, white alpha backgrounds, contain/cover clipping, margins, image order and damaged-image recovery. CI runs these alongside the existing page-tool regressions.

PNG structure and eXIf format reference: [W3C PNG specification](https://www.w3.org/TR/png-3/#eXIf).
