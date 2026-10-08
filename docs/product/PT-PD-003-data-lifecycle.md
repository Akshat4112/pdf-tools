# PT-PD-003 — Local data lifecycle specification

- Specification version: 1.0
- Prepared: 2026-10-08
- Status: proposed, ready for PR review. Becomes the data-lifecycle baseline when merged.
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- Planned production URL: https://akshat4112.github.io/pdf-tools/
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-PD-001 (merged, PR #1)
- This task delivers a specification. It does not implement or deploy PDF tools.

## 1. Purpose and scope

PT-PD-001 section 5 established the privacy boundary as product intent. This document turns that intent into a concrete, verifiable data-lifecycle specification: what application memory and storage locations may hold document-derived data, when each datum is created and destroyed, and what the implementation (PT-FND-004) and audits (PT-SEC-002) must prove.

Data classes covered: **original files, parsed document structures, page renders/thumbnails, generated outputs, extracted text, OCR text (R3), passwords/signature images (R2+), configuration options, and tool-session state.**

Out of scope: backend processing (R5 has a separate consent and retention design if ever approved), and operating-system/browser-level artifacts outside the application's control (§9 discloses them honestly instead of promising their erasure).

## 2. Lifecycle model

Every document-derived datum follows the same state machine:

```
absent → selected → held (memory) → transformed (memory) → revoked → absent
                                    ↘ exported (user download) — leaves app scope
```

Rules:

1. **Selected:** the browser hands the app a `File` handle. From this point the app may read bytes on demand. The raw file never moves: no `fetch`, no `XMLHttpRequest`, no `sendBeacon`, no WebSocket carrying document bytes may appear in the codebase (verified by PT-SEC-002 static + runtime audit).
2. **Held:** all derived structures (ArrayBuffers, PDF.js document objects, page renders, text strings, option objects) live in JS memory or `Worker` transferables. Workers receive bytes by transfer or copy; nothing is persisted.
3. **Transformed:** outputs are built in memory as `Blob`s. A `URL.createObjectURL(blob)` reference is created only when a download affordance needs it.
4. **Revoked:** on tool reset, session end, or navigation, every object URL is `URL.revokeObjectURL()`-ed and every in-memory reference is dropped (see §5).
5. **Exported:** a user-initiated download hands bytes to the browser's download manager. After export the app treats the file as out of scope and says so honestly (§9).

**Invariants:** no state in this model ever writes document-derived data to any persistent store; no datum may exist in two lifecycle stages for the same object simultaneously; a failed or cancelled job must end with its intermediate structures revoked (no zombie blobs).

## 3. Storage locations — allowed vs forbidden

| Location | Document-derived data | Non-document app data (allowed) |
| --- | --- | --- |
| JS heap / Worker memory | **Allowed** (the only holding area) | Allowed |
| `localStorage` | **Forbidden** | UI preferences (language, theme) — small, non-document, key-scoped |
| `sessionStorage` | **Forbidden** | Same constraints as localStorage |
| `IndexedDB` | **Forbidden in R1** (no offline feature exists to justify it) | Forbidden until PT-ADV-017 approves a cache scope |
| Cache API / service-worker caches | **Forbidden for document data** | Only approved static app assets, `/pdf-tools/`-scoped, if offline mode ships (R3) |
| Cookies | **Forbidden** | None (no analytics/auth in R1) |
| URLs: path, query, fragment | **Forbidden** (also no file names, page ranges, extracted text, or passwords in URLs) | Route paths for tool names only |
| `document.title`, `postMessage` targets, history state | File names **forbidden** (tab title stays generic; history entries carry no document data) | — |
| Application logs / console | **Forbidden** (no file names, byte sizes that identify content, or extracted text) | Non-document diagnostics |
| Analytics / crash reporting | **Not present in R1** — no such script loads at all | — |
| Source control, CI artifacts | **Forbidden** (synthetic fixtures only, see §10) | — |
| Third-party network endpoints | **Forbidden** — zero runtime third-party requests for document processing or telemetry | App assets self-hosted (PT-PD-001 §5) |

The same-origin caveat from PT-PD-001 applies: `akshat4112.github.io` hosts sibling projects, so **every storage key the app uses must be prefixed** (e.g. `pdf-tools:language`) and any future service worker must be registered with scope strictly limited to `/pdf-tools/`. Sibling projects must not be able to read this app's keys by name collision, and this app must not register at the origin root.

## 4. Per-datum lifecycle table

| Datum | Created | Lives | Destroyed | Implementation note |
| --- | --- | --- | --- | --- |
| Original file handle + bytes | At selection | App memory (File handle); bytes read on demand | Clear files / tool switch / page unload | Never re-read from disk after Clear |
| Parsed PDF document object | On first parse/preview | Worker memory | With session | One parse per session unless invalidated |
| Page renders / thumbnails | During preview | ImageBitmap/canvas in memory; transferred to UI as needed | When thumbnails are removed or session ends | Bounded pixel quota (PT-SP-002) |
| Generated output Blob | At process completion | Memory + object URL for download | Clear files, session end, or after confirmed download handshake (URL revoked; blob held until reset) | Named outputs use safe sanitized names (PT-SEC-001) |
| Extracted text / OCR text | During text export / OCR | Memory; result Blob | With session | Never echoed into logs or errors verbatim |
| Passwords (R3 protect/unlock) | Typed by user | Memory only, passed to worker | Cleared on tool switch; never stored, never in URL/state/logs | Typed into a field marked as not persisted |
| Signature images (R2 visual sign) | Selected/drawn | Memory | With session | Same rules as original files |
| Tool configuration | As user edits | React state (memory) + optionally UI-preference summary (non-document) in localStorage | With session or when user resets preferences | A page range like "3-7" is borderline: treated as non-document UI state, but **never** persisted to localStorage in R1 |
| Error/report data | On failure | In-memory error object with taxonomy code | With session | Error text may include file name? **No** — errors reference files by index ("file 2 of 3"), not name, unless the user explicitly shares a name themselves |
| Crash/dev diagnostics | On error | Console (dev builds only) | n/a | Production build strips document-derived log output |

## 4.1 Session definition

A **session** is the lifetime of the loaded application document in a tab: from first navigation until tab close, page reload, or route change away from the app path. Within a session, "Continue to another tool" (PT-PD-002 §3 S6) may carry an output forward **in memory** as a new input — this is the only cross-tool data flow. It is not persistence. Leaving the app path entirely (external navigation) or reloading ends the session and drops all document data.

## 5. Reset and deletion semantics

Three reset levels exist; the UI names them honestly:

1. **Tool reset (Clear files):** drops file chips, revokes object URLs for that tool's outputs, cancels in-flight jobs, discards previews, resets tool options to defaults. Other session state (language) untouched.
2. **Session reset (Start over / leave app):** all of the above across tools, plus worker termination and a fresh application state. Implemented by the app itself (state clear + worker `terminate()`), not by demanding a page reload — though a reload must also be safe.
3. **Tab/browser close:** the application cannot act. Since data lived only in memory, closing the tab frees it (GC and OS-level reclamation follow). The privacy page must state this as "nothing is kept by the website", not as "securely wiped from your device".

**Deletion boundary (honest wording, per PT-PD-001 §5):** Clear files is application cleanup — it guarantees no references remain reachable from the application. It does **not** claim: secure overwrite of browser-internal memory allocator pages, erasure of OS page cache/swap, or deletion of files the user already downloaded. The UI copy and privacy page must use exactly this framing; PT-SEC-002 verifies the copy matches observed behavior.

**Cancelled/failed jobs:** cancellation stops the worker mid-job and discards all intermediates for that job. No partial output may remain offered as a result (PT-PD-002 E-PROC-01); a cancelled job cannot expose another job's data (workers are per-job isolated or single-threaded serialized with job-scoped buffers).

## 6. Object URL discipline

- Object URLs are created lazily at result-display time, tracked in a central registry, and revoked at: tool reset, session reset, new run replacing an old result, and page unload (`beforeunload` best-effort).
- Registry must be empty after S8 reset in the PT-PD-002 journey — auditable via a dev-mode counter shown in tests (0 after reset).
- Output naming (PT-SEC-001): sanitized, non-executable, derived from input name but collision-safe (`report-merged-1.pdf`), never raw user-supplied strings used in DOM without text-node insertion (no `innerHTML` with any document-derived string anywhere).

## 7. Network and request audit contract

R1 ships with **zero runtime third-party requests** (assets bundled and self-hosted under `/pdf-tools/`, fonts included as project assets). The only network traffic when loading the site is fetching the application's own static assets from the GitHub Pages origin.

PT-SEC-002 must verify, and this spec defines as the pass condition:

1. Loading and running any R1 tool with a synthetic document produces **no request** other than app-asset loads (verified with devtools network panel, request count and destinations enumerated).
2. No storage write of document-derived data: snapshot `localStorage`/`sessionStorage`/IndexedDB/cookies before and after a full journey; diffs may contain only the allowed non-document keys (§3 table, right column).
3. No document bytes in any request payload (network log payload inspection on the fixtures corpus).
4. Clear files leaves zero reachable references (object-URL registry empty; DOM contains no file names; React state empty).
5. The privacy/help page wording matches observed behavior exactly (claims audited, not assumed).

## 8. Worker memory and transfer rules

- Workers are the primary processing location (PT-FND-003); the main thread holds only UI state and small previews.
- Transfer bytes with `postMessage(..., [transferables])` where possible to avoid copies; never post document data to a worker that is not owned by the current job/session.
- A worker is terminated on session reset and after errors that could leave partial state; a fresh worker is spawned per tool-session as needed.
- Byte/page/pixel quotas come from PT-SP-002 measurements; this spec only requires that limits be *enforced before* allocation attempts that could OOM the browser (fail fast with E-INPUT-04/E-PROC-02, never mid-allocation on mobile).

## 9. Honest disclosure requirements (user-facing copy)

The privacy page and in-app notices must state:

1. Documents are processed **locally in the browser**; the site does not upload, receive, or store document contents.
2. The website itself keeps **nothing** after the tab is closed (no accounts, no server copy).
3. "Clear files" removes the site's references; it does not securely erase browser-internal caches or files you already downloaded.
4. GitHub Pages (the host) records standard visitor access logs (IP, user agent, requested URLs) like any web host — this is **not** document content, but the privacy claim must not say "absolutely nothing is collected."
5. Downloads and browser print are user actions; what happens to a downloaded file afterwards is the user's device domain.
6. No analytics, crash reporting, or third-party embeds are included.

## 10. Fixtures and CI hygiene

- Only synthetic or explicitly licensed fixtures enter the repo and CI (PT-PD-005 corpus).
- CI artifacts must not contain document-derived dumps; test failures must not print fixture content into logs beyond what is needed (page counts, checksums — not text content).
- Test code follows the same URL/storage rules as production code where feasible; deviations (e.g. a dev-mode counter) must be removed from production builds.

## 11. PT-PD-003 acceptance review

| Tracker requirement | Evidence |
| --- | --- |
| Define memory-only originals, outputs, passwords, signatures and OCR text | §2 lifecycle model, §4 per-datum table (incl. passwords, signature images, OCR text rows) |
| Specify opt-in app-asset cache and deletion boundaries | §3 Cache API row (R3 offline gate), §5 three reset levels + honest deletion boundary |
| No document data in localStorage, IndexedDB, URLs, analytics, logs, service-worker caches or GitHub artifacts | §3 forbidden table; §7 audit contract; §10 CI hygiene |
| Review data-flow and same-origin storage risks | §3 same-origin key-prefix + SW scope rule; §8 worker isolation; §7 network audit |

Downstream consumers: PT-FND-004 (implements the session/lifecycle machinery), PT-SEC-002 (audits against §7), PT-PD-005 (fixture corpus follows §10), PT-REL-001 (privacy/help copy follows §9 verbatim framing).

After merge, PT-PD-003 is **Done**; PT-PD-005 loses its last blocking dependency.
