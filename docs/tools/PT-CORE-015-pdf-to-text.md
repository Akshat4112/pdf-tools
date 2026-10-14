# PT-CORE-015 — Verified PDF-to-Text export

`/pdf-to-text/` exports one local PDF's available text layer to UTF-8 `.txt`. The source is limited to 50 MB / 300 pages; generated text is limited to 50 MB. No OCR, uploads, storage or PDF scripting are introduced.

## Extraction contract

- A separate strict PDF.js document is opened for each cancellable job; pages are processed in document order with cleanup and deterministic progress.
- Text follows PDF.js text-item order, joining adjacent items with spaces and honoring available end-of-line hints. Multi-column reading order, tables, ligatures, font mappings and layout reconstruction limits are disclosed before conversion and remain visible with the result.
- Every page retains a position. A form-feed (`U+000C`, `\f`) separates consecutive pages, including empty first, middle and last pages. This boundary rule is documented in the interface. Some editors render it as a page break.
- Text characters are encoded as UTF-8; byte counts are actual output bytes. The producing flow performs fatal UTF-8 readback and exact byte comparison, then passes the shared output gate. That gate now rejects malformed UTF-8 rather than silently substituting replacement characters, and still rejects NUL-bearing text.
- Input names use the existing sanitizer; output stems are safe, bounded and deterministic. Text is displayed as React text, never interpreted as markup.
- The report lists every page without extractable text and counts pages containing text. Such pages may be blank or need OCR. Mixed documents export their available text and preserve empty page positions.
- If no page has extractable text, the outcome explicitly says no text layer was found and OCR comes in a later release. No empty/blank download or success file is offered. The OCR capability remains deferred; no fake enabled OCR link is added.
- Preview retention is capped at 8,000 UTF-16 code units; the verified download retains the full text up to its byte limit. Form feeds are shown as labeled page breaks only in the preview, without changing download bytes.

## Lifecycle

Cancellation checks run around page/text requests and verification. A cancellation monitor is installed before document loading. Signal-bearing loads own their PDF.js worker and terminate it immediately on abort, including while setup/parsing is pending; abort races settle loading/text waits without waiting for an acknowledgement from a terminated worker. The adapter invokes loading-task teardown once, and ordinary successful/error teardown remains awaited. Cancellation, failure and replacement cannot expose partial text or an older job's result. Adjust/retry retains the selected PDF; full reset removes it. Source changes, reset and exit cancel work and revoke download URLs. Repeated downloads reuse their one tracked output URL. PDF.js loading tasks are destroyed exactly once per job; page cleanup and cancellation-monitor cleanup run on all paths.

The reader's search-match state is also stored in React state rather than read from mutable refs during rendering. Its version-pinned arbitrary-match bridge is isolated outside the component. Existing click-to-jump/pagination/next-match regressions remain required.

## Verification

- Unit checks cover actual corpus text and page boundaries, Unicode/line hints, unchanged source bytes, deterministic names, scan-only outcomes, mixed empty positions, invalid/encrypted/over-page-limit input, cancellation/retry, bounded preview, output limit and document teardown. Shared verification tests reject malformed UTF-8.
- Desktop/mobile browser checks use a real PDF with a ToUnicode map containing German, Greek, Chinese and an emoji, two stored-order columns, a blank page and a scanned page. The downloaded bytes are decoded strictly and compared with the report. PDF text resembling script markup remains inert.
- Further browser checks verify scan-only messaging without a download, encrypted/malformed recovery, full text behind a bounded preview, repeated download URL reuse/revocation, and deliberately held PDF.js loading and text requests, asserted worker termination, then cancel/retry and discarded late text.
- All browser requests stay on the local origin/data/blob schemes; uncaught page errors fail tests. Desktop/mobile screenshots are opt-in temporary QA evidence and never uploaded by CI.
- Required gates: unit tests, TypeScript (app/tests/e2e), lint, production build, complete interface/image-engine browser suites, dependency audit and fixture-corpus CI.

Next task: **PT-CORE-016 — Page numbers and text watermark**.
