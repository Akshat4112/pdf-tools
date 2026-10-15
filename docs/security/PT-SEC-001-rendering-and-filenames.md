# PT-SEC-001 — Rendering, actions and filename hardening

## Scope and implementation

The app accepts selected bytes rather than PDF URLs. All production PDF.js loads go through `openDocument`, with explicit XFA-off and document range/stream/autofetch-off options. Font/CMap/WASM/ICC resources and the PDF worker remain self-hosted assets: this is not an offline or zero-network promise. The pinned PDF.js 6.4.299 source no longer consumes the legacy `isEvalSupported` flag; that flag is not evidence that document scripts are disabled.

The reader supplies no scripting or download manager, leaves interactive forms and annotation editing disabled, and disables automatic text linking. Its link service removes external URI destinations from anchors, including context-menu/middle-click destinations, rather than relying on an empty href. External PDF URLs are not repeated into link titles. Internal page links and the four page-navigation named actions remain available; other named actions, attachment retrieval and media opening are outside the supported reader scope. Annotation appearances and normal selectable text remain. Annotation icon resources are copied from the pinned PDF.js package under the project asset base. Print uses the existing app-created canvas-only sandboxed iframe, without scripts, PDF markup, forms or links.

Selection validation and FileSession now share `security/fileNames.ts`. It strips platform path components, controls, bidi/zero-width formatting, trailing/leading dots/whitespace and platform-reserved characters; applies NFC; prefixes Windows device names; and bounds names to 120 UTF-16 units while retaining short extensions and whole Unicode characters. Names are plain text, not escaped HTML. React text children and PDF.js's maintained text/annotation rendering remain the DOM boundary; no raw PDF text is inserted with innerHTML. User watermark/text content is not rewritten into lossy HTML escapes.

Verified outputs and stored downloads use a MIME-derived extension allowlist (PDF, ZIP, TXT, JPG, PNG). Download anchors use the stored safe name. Merge naming happens before output verification instead of overriding its name afterward. ZIP creation rejects unsafe/noncanonical member names before opening a writer; it never silently renames members into collisions. Existing indexed part naming stays deterministic. This hardens app-created output names, not the filesystem or contents of an imported ZIP (ZIP import is not offered).

## Verification

`security.test.ts` covers shared selection/session naming, controls/bidi, reserved names including superscript device digits, Unicode length/extension bounds, MIME-extension binding, unsafe ZIP member rejection and verified names. Existing engine, lifecycle and archive round-trip tests remain required.

`e2e/security.spec.ts` generates a synthetic PDF containing document/named/page JavaScript actions, HTTP/HTTPS/same-origin/javascript/data URIs, Launch/SubmitForm/remote-GoTo/named Print actions, an internal page link, hostile metadata/rich annotation text, an HTML attachment and an external XFA image reference. Browser checks intercept requests, dialogs and window.open, exercise disabled anchors and attachment activation, follow the internal page link, check the raster-only print frame and download text from a bidi/device-name input. Only the tool entry and self-hosted asset paths are allowed during the reader test; unexpected requests fail it. Existing reader corpus/forms/annotations/search/geometry/print checks run alongside it. No private fixtures, screenshots or telemetry are added.

Local lint, unit tests, TypeScript/build and browser-test typechecking run before PR publication. Actual Chromium checks run in CI if the local browser is unavailable. Record the exact final CI commit and results in the PR.

## Boundaries and follow-up

These controls are defense in depth for app rendering and generated names, not an antivirus/disarm service, an OS/process sandbox, a third-party security audit or a guarantee against every future PDF.js/browser vulnerability. Exported PDFs can retain active or embedded content: opening them later in another PDF application is governed by that application's controls. We do not claim that editing/merging sanitizes document contents. Current file quotas and the pinned engine/update gates remain necessary.

The site shares its origin with other portfolio projects; this task does not establish cross-project origin isolation. PT-SEC-002 still owns the full all-tool network/console/storage/reset audit and host logging explanation. PT-TRUST-001 must use that evidence before stronger public privacy copy. PR #48 (header) and PR #43 (inspector) are independent; this branch starts from main after PR #47.

Primary references reviewed 2026-10-15: [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [loading source](https://mozilla.github.io/pdf.js/api/draft/api.js.html), [component viewer example](https://github.com/mozilla/pdf.js/blob/master/examples/components/simpleviewer.mjs). For exact behavior, inspect the pinned installed `pdfjs-dist/legacy/build/pdf.mjs` and `legacy/web/pdf_viewer.mjs`; web docs may describe a newer build. In particular, scripting is enabled by supplying a scripting manager; it is separate from document loading/autofetch options.
