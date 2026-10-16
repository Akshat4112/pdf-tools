# PT-SEC-002 — Local processing and reset audit

Audit date: 2026-10-16. Scope: production build of the current R1 application, all 14 implemented registry tools, desktop Chromium and Pixel 7 Chromium emulation. Synthetic inputs only. Final exact commit, CI counts and result are recorded in the PR; no private PDFs, network traces or screenshot artifacts are uploaded.

## Changes and evidence

- All production PDF.js document loads and owned workers now use verbosity zero. Previously the inspector requested quiet loading, but other tools could emit parser diagnostics containing document-controlled font/resource names. Errors still reach the UI through the existing generic taxonomy. `quiet` remains accepted for inspector API compatibility; there is no production opt-out from this logging policy.
- Merge and Split now register their jobs and explicitly reset their sessions on unmount; route exit must revoke their output URLs and cancel ongoing jobs.
- `FileSession.clearFiles()` itself now cancels tracked jobs before revoking URLs and dropping file/output maps; resetSession delegates to this same path. A held-job unit regression proves cancellation, zero owner counters and rejection of late output independently of UI callbacks.
- `privacy.spec.ts` and its test-only observer exercise every implemented tool from selection through actual processing/read/inspection, download or print preparation, Start over, Clear files, route exit/back and reload. Each route-exit check leaves a second completed download/inspection/print result present before navigation; it does not clear the source first. Filename, extracted text, metadata and watermark canaries are synthetic. Sources contain two small pages; image input is generated locally. No password-entry feature exists in R1; a locked fixture checks the rejection boundary without claiming password processing support.
- The browser guard allows only exact built static assets and the app's own favicon/logo/tool-entry/catalog paths, with GET, no query and no request body. It observes requests from frames/workers through BrowserContext routing; unexpected requests are blocked and fail the test. Beacon/socket/event-source/service-worker API use is separately observed and fails the test. Downloads remain an explicit user action; generated files must contain bytes.
- Success journeys require no console messages or page errors; failed/locked/unknown-font reader cases check the same diagnostics boundary. A held text-extraction worker checks cancellation and no late offered result. Existing worker-cancellation and file-read-generation tests remain complementary coverage across other tools.
- Before/after snapshots compare localStorage, sessionStorage, IndexedDB database names, Cache API keys, service-worker registrations and cookies. Native calls are observed rather than hidden. Seeded unrelated sibling preference keys must remain unchanged. Every normal journey observes no storage mutations. History, route and generic tab title must contain no document information during processing.
- Reset checks require no file rows, download actions, print frame, selected native FileList entries, live tracked object URLs or tracked workers. Source/text/metadata canaries must disappear from the visible app after Start over. Tests retain resource identifiers/counts, not document/Blob copies. zip.js retains an immutable JavaScript loader blob URL after its workers terminate; only loader bytes matching the pinned dependency's SHA-256 are excluded from document-resource counts. The observer briefly hashes JavaScript-typed blobs to classify this exact static asset; arbitrary JavaScript blobs remain counted. These are application-owner cleanup checks, not a heap-forensics or secure memory-erasure proof.
- `scripts/check_privacy_surface.mjs` parses executable app-owned TS/TSX with the TypeScript AST, excluding comments/tests/dependency internals. CI rejects new network/upload, console, cookie, persistence or service-worker API references until an explicit policy change is reviewed. It includes negative/safe self-checks. The guard does not purport to inspect every dependency implementation; browser network/log evidence and pinned-dependency checks complement it.

## Journey matrix

| Tool(s) | Covered work before reset | Additional privacy checks |
| --- | --- | --- |
| Merge | Two selected PDFs → verified merged download | Both source names disappear; output URL revoked |
| Split | Two custom ranges → verified ZIP download | ZIP name/bytes stay in browser |
| Rotate / Organize | Edit page rotation → verified PDF download | Parser/thumbnail workers terminate on reset |
| Extract / Delete pages | Explicit page selection; deletion confirmation → verified PDF | New-copy output and previews discarded |
| Images to PDF | Local PNG → verified PDF download | Image preview ownership cleared |
| PDF to JPG / PNG | Render both pages → verified image download | Canvas/URL/worker ownership cleared |
| Reader | Text search → local print preparation | Print iframe removed; no source retained in DOM |
| Page numbers / Watermark | Local preview → verified overlay PDF | User watermark text absent after Start over |
| PDF to text | Text extraction → verified TXT download | Extracted canary never logged/stored/sent |
| Document information | Metadata/dimensions inspection | Metadata canary removed on reset/exit |

These representative all-tool journeys are not exhaustive proof for every possible PDF or browser. Existing corpus, adversarial PDF, geometry, output verification, replacement/reset and cancellation suites run alongside them. Chromium mobile emulation is not an independent Safari/iOS audit. Browser tests run in CI when local Chromium is unavailable. Network routing permits actual static resource requests; it does not simulate successful document uploads or suppress failures to make an audit pass.

## Hosting and cleanup disclosures for later public copy

GitHub's [Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) states that visitors' IP addresses are logged/stored for security, including signed-out visitors. The [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) also describes technical/service usage and website interaction data. Sources checked 2026-10-16. This application does not control or erase the host's access/security logs, and this audit does not establish a retention period. Loading online app/worker/font/WASM assets necessarily contacts the host; this is separate from document processing.

Supported wording: documents are processed on the device; this tested release does not upload document contents or use application analytics/crash reporting. Clear files/Start over release application-owned source/output/preview references and resources; no secure overwrite is claimed. Downloaded files, browser/OS print spools, browser caches, allocator pages, swap and user copies remain outside application deletion control. Tab closing/reload ends in-memory application state; it does not erase those external copies. Output PDFs are not malware-disarmed and may retain active content when opened in another PDF program.

The portfolio's sibling projects share the same origin. Prefixing future preference keys prevents accidental collisions but is not an access-control boundary: same-origin scripts can access origin-scoped storage. This R1 build writes no document data to it. A pre-existing root service worker, compromised origin, browser extension or compromised dependency is outside this isolated clean-context regression. Do not call this an independent audit, 100% secure, anonymous, fully offline, or guaranteed zero network.

PT-TRUST-001 should use this evidence to draft concise public claims with these limitations. PT-REL-001 still owns the public help/privacy page. No new account, tracking, telemetry, backend, browser storage or public claim is introduced by this task. Future tools, persistence, translations or offline caching require updating the matrix and rerunning these checks.
