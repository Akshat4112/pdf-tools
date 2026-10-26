# PT-REL-001 — Public help, privacy and limitations pages

Status: **Implementation in draft.** Release/compliance sign-off depends on PT-QA-002 browser/device acceptance and a publisher/legal review; no claim of GDPR certification.

## Pages and evidence
- `/pdf-tools/help/`: steps, links to shipped tools, FAQ, support issue instructions (synthetic data only).
- `/pdf-tools/privacy/`: selected documents remain in browser; GitHub Pages asset/host requests and potential IP logging are distinct from processing. No on-site analytics or browser-based document persistence. Reset releases app references but is not guaranteed physical-memory erasure; browser downloads and OS print facilities are outside app control.
- `/pdf-tools/limitations/`: input quotas (50 MiB per file and generally 300 PDF pages), working formats, performance caveats, signature invalidation, potential loss of interactive PDF fields, no OCR/password unlock/secure redaction/cloud processing.
- Metadata and sitemap have individual public canonicals, and no-JS HTML contains useful text. Client SPA links and history work; information pages are lazy loaded so initial PDF catalog utility stays fast. English copy is explicit via `lang="en"`; full crawlable translated pages are PT-SEO-010, not part of this PR.

## Claims review
- Local processing: `docs/security/PT-SEC-002-local-processing-audit.md`; verify no document uploads/logging with the active browser matrix and actual GitHub Pages boundary.
- MIT license: `LICENSE`. Do not state independent audit, absolute security, universal zero logging or all-platform support.
- Technical privacy notice is not a legal certification. Publisher identity/contact/controller disclosure and jurisdiction-specific legal requirements need review before calling it legally complete.
- The public issue URL is not private support. No user file samples or real identifiable information should be posted there.

## Verification
- New Vitest tests cover canonical allowlists and safe copy.
- New Playwright tests cover static HTML/canonicals, live navigation/hrefs/history and disclosures.
- Existing CI gates cover privacy, security, full UI and performance. Merge only on reviewed exact head with green checks; PT-QA-002 manual review may still constrain release acceptance.
- PT-TRUST-002 should reuse these public pages, while PT-UI-003 should link them from the site-wide footer instead of inventing legal/verification badges.
