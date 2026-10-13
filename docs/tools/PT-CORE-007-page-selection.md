# PT-CORE-007 — Extract and Delete Pages interfaces

## Behavior

The `/pdf-tools/extract-pages/` and `/pdf-tools/delete-pages/` entry points mount a shared page-selection workspace over the existing PT-CORE-006 engines. The catalog enables these two tools; Rotate and Organize remain gated by their own interface tasks.

Select one unencrypted PDF. Type page numbers/ranges or pick page thumbnails with a pointer, touch or keyboard. The range field and thumbnail selection stay synchronized.

- **Extract:** preserve the order in the range expression or thumbnail picks. Repeated pages are included once. Selecting all pages is allowed.
- **Delete:** show both the removal set and the remaining pages in source order. Reject an empty output, including deletion of the only page of a one-page PDF.
- **Review:** display the exact output order before processing. Deletion requires a checkbox confirming review of the new copy. Every selection edit, file replacement, reset or retry clears that confirmation.
- **Result:** the existing flows verify the output before the result panel offers a PDF download. The original input is not changed. Modifying a PDF may invalidate digital signatures.
- **Recovery:** reject unsupported/encrypted/malformed files clearly, allow configuration correction after failure, and support cancellation and Start over.

## Resource and privacy handling

Only eight thumbnails are mounted at once. Each preview canvas is bounded to a 280 × 360 pixel envelope while retaining aspect ratio. These are UI thumbnail limits, not changes to the existing input/page quotas or export resolution.

The document reader opens once per selected source. A replacement cannot reuse the previous reader or selection. Teardown cancels thumbnail renders and destroys the reader. Reset/exit cancels tracked jobs, revokes generated download URLs and releases application-held file/output references. Late completions from an old job are ignored.

No document bytes, selections or thumbnails are stored persistently or sent to an external service. This change is not the complete R1 security/privacy audit; PT-SEC-001/002 remain separate launch tasks.

## Verification

The preview model shares the existing range parser and deletion-complement function with the engines. Unit tests check custom order, deduplication, invalid ranges, all-delete rejection, thumbnail synchronization, source-bound review keys and the two mounted routes.

Playwright drives the built application under the real `/pdf-tools/` base path in desktop Chromium and mobile Chromium emulation. It checks:

1. Typed ranges, keyboard thumbnail picks and downloaded page order using independent PDF.js text readback.
2. Fresh deletion confirmation after editing the selection and exact remaining-page output.
3. Empty, invalid, out-of-bounds, backwards and all-delete selections.
4. Eight-canvas pagination, file replacement and selection/confirmation reset.
5. One-page deletion rejection and document cleanup on route changes.
6. Encrypted/malformed input recovery, actual rendered thumbnails and viewport fit.
7. Cancel/reset followed by a fresh job, with no late output from the cancelled job.
8. Download URL revocation on Start over and rejection of external network requests during these local workflows.

Only committed synthetic fixtures or synthetic generated input are used. Browser traces/videos/screenshots are disabled in the automated suite and test output is ignored by Git. CI runs the browser regression suite after the production build and does not upload document-bearing artifacts.

From `app/`:

```sh
npm ci
npm test
npm run lint
npx tsc -p tsconfig.test.json --noEmit
npm run build
npx playwright install chromium
npm run test:pages-ui
```

The browser suite includes its own TypeScript check. It launches a strict-port Vite preview server automatically. If Chromium is already installed in a supported environment, `PDF_TOOLS_CHROMIUM_PATH=/absolute/path/to/chromium npm run test:pages-ui` selects that executable. Mobile coverage is Chromium emulation, not a claim of physical-device or Safari validation.

## Tracker acceptance

| Requirement | Implementation and evidence |
| --- | --- |
| Thumbnail selection and range input | `PageSelectionTool`, bounded `PageThumbnail` previews, synchronization unit/browser checks |
| Clear Extract/Delete modes | Separate routes and mode-specific headings, controls, previews and output names |
| Selection matches output | Shared parser/preview plan and independent downloaded-page text readback |
| Removal requires review of a new copy | File/selection-bound confirmation, explicit removal/remainder preview and all-delete guard |
| Selection/download flows | Desktop/mobile browser tests, verified outputs and reset/cancellation coverage |

The task is ready for review after its checks pass. Mark it Done only after merge. Next: **PT-CORE-009 — Ship Organize PDF workspace**.
