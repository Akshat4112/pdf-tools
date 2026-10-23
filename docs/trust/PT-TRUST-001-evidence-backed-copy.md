# PT-TRUST-001 — Evidence-backed privacy and product copy

Status: proposed publication copy specification (2026-10-23). **This document alone does not publish website copy.** Product: **FolioLocal** at https://akshat4112.github.io/pdf-tools/. Scope: shipped browser-only R1 tools; changes to processing architecture require revalidation.

## Source-of-truth evidence and scope

- [PT-BRAND-001](../brand/PT-BRAND-001-positioning-and-promise.md) establishes the free-forever commitment for released local tools and defers any optional cloud/billing concept.
- [MIT license](../../LICENSE) and the [public repository](https://github.com/Akshat4112/pdf-tools) substantiate source availability. Individual dependencies have their own licenses.
- [PT-SEC-001](../security/PT-SEC-001-rendering-and-filenames.md) documents PDF.js loading/reader boundary, inert metadata, safe filenames, self-hosted worker/assets, and limitations on exported PDFs.
- [PT-SEC-002](../security/PT-SEC-002-local-processing-audit.md), merged in [PR #50](https://github.com/Akshat4112/pdf-tools/pull/50), covers runtime network/console/storage/reset/exit/reload journeys for **all 14 shipped tools**, using synthetic test data. Final run [38877011258](https://github.com/Akshat4112/pdf-tools/actions/runs/38877011258) passed on `9389f4d` (320 unit, 142 UI, 28 image-engine checks). This is project CI evidence, **not** independent certification, heap-forensics, Safari/device security testing, or a proof against compromised hosts/extensions/dependencies.
- [GitHub Pages data collection](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection): Pages records visitor IP addresses for security; also see [GitHub privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). No host retention or anonymization promises.

## Approved claim matrix

| Public claim | Approved wording | Evidence | Mandatory qualifier / placement |
| --- | --- | --- | --- |
| Product identity | “FolioLocal — everyday PDF tools” | Brand name decision and shipped catalog | Do not imply every imagined tool is shipped. |
| Price | “Free forever for the browser-based PDF tools we release.” | PT-BRAND-001 commitment | No subscription, paywall, account, paid export or forced watermark on promised local tools. Browser/file limits apply; optional future cloud services are not part of this promise. |
| Open source | “Open source · MIT-licensed application.” | Root LICENSE, public GitHub repo | Link to repo/license; don't say every dependency or downstream fork is MIT/free. |
| Account | “No account required.” | R1 flows, PT-SEC-002 | Only released browser workflows; no guarantee for unbuilt optional future services. |
| Processing | “Your PDFs are processed on your device in your browser.” | PT-SEC-002 all-tool runtime audit | The website still fetches assets from its host; not “offline” or “zero network.” |
| Uploads | “This version does not upload your document contents for processing.” | PT-SEC-002 request and data canary audit | Scoped to audited released tools. Don't make universal claims about extensions, compromised hosts, or future services. |
| App analytics | “The application does not include analytics or crash-reporting services.” | PT-SEC-002 network, API and storage checks | Hosting-provider access/security logs are separate; do not say “no tracking of any kind.” |
| Clear/reset | “Clear files removes selected documents, previews and results from this workspace.” | PT-SEC-002 cleanup and route/reload checks | Releases app-owned references/URLs/workers, not secure memory overwrite; won't delete original files, downloads, browser/OS caches or print copies. |
| Safety | “Local handling reduces the need to share documents with a conversion service.” | PT-SEC-001/002 | Avoid “100% secure,” “anonymous,” “encrypted end-to-end,” GDPR-certified, virus-free or independently audited. |
| Exports | “Download the file you created.” | Existing output verification and PT-SEC-001 | Export does not sanitize/disarm dangerous document contents in other viewers. |

## Ready-to-use page copy

### Homepage (PT-UI-001)
- **Hero heading:** “PDF tools that work in your browser.”
- **Subtitle:** “Merge, split, organize, read and convert PDFs with FolioLocal. Free forever, open source, and processed on your device — no account required.”
- **Trust strip:** “Free forever for local tools” · “Open source (MIT)” · “Files processed in your browser” · “No account required”.
- **How it works:** “Choose a tool, select files on your device, then download the result. In the current release, document processing runs in your browser rather than uploading files to a conversion server.”
- **Disclosure link label:** “How local processing and privacy work” (point to the real PT-REL-001 privacy/help URL **only after that page ships**; until then link to PT-SEC-002 evidence instead, with an accurate label).

### Header (PT-UI-002 existing)
- Compact: “Free · Open source · Processed locally”.
- Prefer “Processed on your device” if space allows; don't replace the already-working navigation just for marketing.
- “Privacy” should link to a **real existing** resource until PT-REL-001 publishes the privacy route. Never use a dead link or disguise a GitHub specification as a legal privacy policy.

### Footer (PT-UI-003)
- Short: “FolioLocal — free and open-source PDF tools. Documents are processed on your device in this browser-based release.”
- Links: Source (public repository), MIT license (root LICENSE), How privacy works (the eventual published PT-REL-001 page), Help/limitations (once published).
- **Small-print note near privacy copy:** “Loading this site contacts GitHub Pages, which logs visitor IP addresses for security. Clearing files does not remove files you downloaded or printed.”
- Keep copyright and license attribution factual; no fabricated certificates/security badges.

### Tool upload / result workspaces (PT-UI-005, PT-UI-006)
- Below file selection: “Your selected files are processed in this browser, not uploaded for conversion.”
- Near Clear files / Start over: “Remove selected files and generated results from this workspace. Files already saved to your device are unaffected.”
- Near result: “Your result is ready to download.” Avoid implying the file is sanitized, malware-safe or erased from all memory.
- In reader/print: “Printing uses your browser/operating-system print flow; printed and saved copies are outside this app's control.”
- Do not imply encrypted PDFs can be unlocked; R1 locked PDFs are only supported through explicitly limited read-only inspection.

## Full privacy/help explanation for PT-REL-001 (content requirements; not yet published)

1. **Document boundary:** Selected file bytes, names, previews, extracted text and resulting documents stay within browser processing in this audited release; not intentionally stored in localStorage/sessionStorage/IndexedDB/cookies by the app or sent to a document-processing server. Treat this as a version-scoped tested statement.
2. **Necessary host traffic:** To load the site, browser workers, fonts/WASM and other static assets, the browser makes network requests to GitHub Pages. GitHub Pages collects visitor IP addresses for security. Do not promise a log retention duration or anonymity.
3. **Clear/reset versus deletion:** Reset and navigation release application-managed resources and visible state; they cannot securely erase browser memory or erase originals, downloads, browser/OS caches, printed outputs, clipboard copies and OS swap.
4. **Shared origin:** Other sites under `akshat4112.github.io` share an origin; origin-scoped storage is not an isolation boundary. The audited release writes no document data there. Malicious extensions, host compromise, inherited root service workers and malicious dependencies are outside the audit.
5. **Security limits:** Reader mitigations do not neutralize every malicious PDF. Reopening exported PDFs in other software may execute functionality managed by that viewer. No third-party audit/certification, virus-free or absolute-security claim.
6. **Future changes:** A future cloud/AI/signing/integration feature needs an explicit service boundary, consent, retention explanation and separate review. Do not automatically inherit local/no-upload copy.

## Publication gates and hand-off

- PT-UI-001 uses the homepage copy and keeps working tool discovery prominent; verify all listed tools really ship.
- PT-UI-003 and PT-TRUST-002 provide working evidence/source/privacy links, without duplicating privacy policy content.
- PT-REL-001 publishes a proper user-readable help/privacy/limitations page; before then link to factual project documentation with explicit labels.
- PT-SEO-003/005 may use the exact scoped claims in static content/metadata; do **not** include user filenames or PDF contents in titles, URLs, previews, or logs.
- PT-BQA-001 reruns production-build network/storage/reset checks, validates copy versus released code, tests all privacy links and responsive accessibility, and checks no newly shipped flow silently sends document data.
- Update this matrix and rerun PT-SEC-002 on new tools, storage, network access, translations, hosting changes, dependencies or new reports/analytics.

### Editorial test before publishing any trust copy

For every sentence: (1) identify exact released feature and evidence above; (2) check whether it implies more than tested; (3) show necessary qualifiers with discoverable links; (4) refuse unsupported superlatives, promises of anonymity, guarantees, security certifications and claims that clearing files securely wipes bytes. This specification is a *copy contract*, not an implementation of privacy page, frontend redesign, or new telemetry.
