# PT-UI-003 — Consistent branded footer

Implementation PR: PT-UI-003. All routes use the **same semantic footer in the shared HTML shell**, rather than rendering one copy in the homepage React component. This also places the footer after the crawlable `noscript` route article on non-JavaScript pages.

## Content and truthful claims

- Public navigation to shipped tool routes and published PDF guides; Help / Privacy / Limitations from PT-REL-001; public Trust evidence from PT-TRUST-002.
- Public project source, actual root [MIT license](../../LICENSE), existing [contributor workflow](../operations/PT-OPS-001-pr-task-workflow.md), public issues and GitHub Security page for *checking availability* of private vulnerability reporting.
- Concise, qualified promise: selected document contents are handled on-device by the released browser tools, and static site requests still reach GitHub Pages; third-party dependencies may have different licenses.
- Public-reporting warning not to upload confidential PDFs. No unsupported OCR, redaction or certification claims; no invented support address.
- Footer works on 404 and static no-JavaScript content. English/German labels use the existing document `lang` attribute, which the in-memory app locale switch updates; no preference persistence, added network endpoint, new JS chunk or tracking.

## Verification

- Dedicated browser coverage: routes, tool entries, categories, help/guide/trust pages, all internal link HTTP responses, external allowlist, mobile/dark mode/keyboard/language, no-JS readability.
- Existing Playwright / unit / static SEO / privacy / performance checks must pass on exact PR head.
- **Still needed for full project launch sign-off:** real hardware browser and screen-reader matrix (PT-QA-002 and PT-UI-007), publisher/legal privacy contact details (PT-REL-001), external structured-data validation where blocked by verification.
