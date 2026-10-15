# PT-BRAND-001 — Positioning and product promise

Prepared 2026-10-15. Status: proposed baseline for review; accepted when this PR merges.
Owner: Akshat. Scope: messaging and implementation brief, not a deployed redesign.

## Positioning

**Everyday PDF tools. Free forever. Processed on your device.**

PDF Tools helps people prepare, organize, read and convert everyday documents directly in their browser, without an account or document upload. Its public source lets people inspect how it works and contribute improvements. Clear limits and dependable outputs matter more than advertising a large tool count.

Primary audiences follow [PT-PD-001](../product/PT-PD-001-product-scope.md): students preparing readings and submissions; professionals assembling attachments; people who prefer to avoid sending documents to a conversion service; and mobile users doing short tasks. We are not positioning R1 as an enterprise document-management system or a certified signature service.

The combination of free access, inspectable source, local computation and straightforward workflows is the proposition. Local/free competitors also exist; do not claim we are the first, only, safest or fastest. Smallpdf is a category reference, not a brand, layout, asset or copy template.

## Free-forever commitment and roadmap reconciliation

The user requested a free-forever, open-source product. This brief turns that direction into the following proposed commitment:

> The PDF tools we release for local processing will remain free to use. No subscriptions, account requirement, paid exports, daily paywalls or promotional watermarks. The application source is available under the MIT license.

This covers the released local toolset and future tools released within this same local product promise. Device memory, supported formats, browser capabilities and documented safety quotas still apply. “Free forever” does not mean unlimited file size, every PDF feature, guaranteed hosting uptime, or indefinite maintenance.

PT-PD-001 §6 left R5 cloud and billing as optional. **For this product, billing cannot become a paywall for promised local tools.** R5 remains deferred and outside the present brand promise. No cloud feature, account, file upload or commercial service is authorized by this brief. A future proposal must have a separate specification and clearly identified service boundary, cost, consent and retention terms; it must preserve free access to the promised local tools. If that cannot be achieved, reject the proposal rather than weaken the pledge through fine print.

Merging this brief adopts this interpretation of the older optional R5 scope. No backlog task is implemented or activated by that decision. Track D21 as a decision requiring owner review until merge; record the accepted resolution in the sheet afterward.

MIT permits reuse/forking of licensed releases under its conditions. It is not a guarantee that every external fork or third-party host stays free. Dependency licenses retain their own terms; do not label every bundled dependency MIT.

## Claim matrix

All wording below concerns the application on its published project URL. Source inspection is evidence of design, not completion of the planned security audits.

| Claim | Exact proposed public wording | Evidence and boundary | Publication gate |
| --- | --- | --- | --- |
| Free forever | “Free forever” with nearby pledge link | User direction; commitment above; no billing in R1 | Owner accepts this brief; implementation includes the scope explanation |
| Open source | “Open source · MIT” | Public [repository](https://github.com/Akshat4112/pdf-tools) and root [LICENSE](../../LICENSE); third-party notices remain separate | Link to actual source/license; recheck visibility before deployment |
| No account | “No account required” | Current static app has no sign-in/account flow; PT-PD-001 §2 | Recheck all published tool journeys in release QA |
| Local processing | “Files processed on your device” | Browser engine adapters and session lifecycle; [PT-PD-003](../product/PT-PD-003-data-lifecycle.md); self-hosted PDF.js assets | PT-SEC-002 full network/storage/reset audit before claiming verified across all tools |
| No document uploads | “Your documents are processed in your browser. We do not upload document contents.” | No document-processing backend in current scope; source review is consistent with local design | PT-SEC-002 covers bytes, filenames, text, metadata, errors and URLs across every shipped tool |
| No on-site tracking | “No analytics or advertising trackers in the app” | No tracking integration observed in current app source; hosting access logs are separate | PT-SEC-002 runtime request/cookie/storage checks; audit dependencies as well |
| Reset | “Clear files removes the files and results from this workspace” | Application drops references/revokes URLs; session implementation and tests | PT-SEC-002 validates all tool resets; never promise forensic erasure |
| Offline | No global offline claim in R1 | Initial page, worker, font and lazy asset loads need connectivity; no approved offline cache | PT-ADV-017 and a separate tested offline contract |
| Security | Explain local handling; no security badge or absolute promise | PT-SEC-001/002 and dependency review are still planned | No “100% secure,” anonymity, GDPR/certification badge or encryption claim without specific established evidence |

Current evidence baseline: main commit `6b8df84d8416d8cac44fcc3419d6b5ec7856defa`, inspected 2026-10-15. Live catalog advertises 13 working tools; document information remains unavailable pending PR #43. A broad security/compliance audit has not been completed by this task.

## Privacy explanation and limits

Use the short local-processing statement near file selection. Link to a readable privacy explanation owned by PT-REL-001 and PT-TRUST-001. That explanation must cover:

- The website and processing assets are downloaded from the host. Local processing does not mean zero network requests or that the visitor is anonymous.
- GitHub Pages may record standard access information such as IP address, user agent and requested URL. Never put document contents or names in URLs, analytics or logs. See [GitHub Pages overview](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
- Selected files, previews, extracted text and generated results belong in application/worker memory. The app must not persist document data in browser storage. Static assets and any future approved non-document preferences are a different data class.
- Clear/reset releases application references and object URLs. It does not securely overwrite browser/OS memory, delete the original file, or remove downloads, clipboard copies or print outputs. Browser extensions, the operating system and the user's device remain outside app control.
- The shared `akshat4112.github.io` origin also hosts other projects. Path and storage-key scoping avoid collisions but are not security isolation from other code on the same origin; do not imply otherwise.

Until PT-SEC-002 passes, trust copy may describe the local architecture but cannot say “independently audited,” “verified zero uploads,” or “all security checks passed.” Keep evidence/status visible in review, not in an alarming implementation-heavy user flow.

## Copy and placement handoff

These are implementation-ready drafts, subject to the gates above and the later name decision. Keep “PDF Tools” as the working name until PT-BRAND-002 is accepted.

| Surface | Proposed copy and behavior | Owning task |
| --- | --- | --- |
| Home headline | “Everyday PDF tools. Free forever.” | PT-UI-001 |
| Home introduction | “Merge, split, organize and convert PDFs in your browser. No account required. Your files are processed on your device.” | PT-UI-001 |
| Trust strip | “Free forever” · “Open source” · “Processed on your device”; each links to its explanation/source, not an invented badge | PT-TRUST-001/002 |
| Primary action | “Explore PDF tools” links to the catalog; common working tools appear immediately | PT-UI-001/004 |
| Header | Logo + final name; Tools, How it works, Privacy, Source. Do not show links to pages that do not exist | PT-UI-002 |
| File picker | “Choose PDFs” / “Choose images”; short note “Processed on your device. No account required.” Use “select” rather than “upload” for local file selection | PT-UI-005 |
| Tool example | Merge: “Combine PDF files in the order you choose.” CTA “Merge PDFs”; result “Download merged PDF”; reset “Clear files” | PT-UI-005/006 |
| Footer | “Free forever. Open source. Files processed on your device.” Links: tools, privacy, help, source, MIT license and dependency notices; source/issues opens external destination clearly | PT-UI-003 |
| Pledge explanation | Commitment text from above, with supported-format/device limits and source link | PT-TRUST-001, PT-REL-001 |
| Limits | Per-tool facts beside options/help: supported input/output, quotas and preservation limits; TXT export does not perform OCR, text watermark is not secure redaction | PT-SEO-003, PT-REL-001 |
| Roadmap | Unavailable tools clearly marked; never included in “available tools” counts, feature demos or capability promises | PT-UI-004, PT-SEO-002 |

Tone: calm, practical and specific. Prefer “Choose files → set options → download” over hype. Explain recoverable errors with a next action. Do not use fake testimonials, user counts, awards, urgency, certification logos or unsupported performance comparisons.

Visual direction for PT-BRAND-003/004: distinctive original vector mark legible at favicon size; restrained accent color, neutral surfaces, consistent type/spacing and accessible contrast. Use a clear wordmark, not a security shield that suggests certification. Final colors, logo and name are separate deliverables. Header/footer and trust messaging must work on every tool route and on mobile without hiding the workspace.

## Acceptance and next tasks

- [x] Audience, differentiation, tone and exact free/local/open-source wording defined.
- [x] Four requested core claims have scope, evidence and publication gates.
- [x] Deferred cloud/billing conflict has an explicit proposed decision preserving the local pledge.
- [x] Home/header/footer/tool wording maps to implementation owners.
- [x] Security, host logs, shared origin, reset and offline boundaries are explicit.
- [ ] Owner accepts this proposed baseline by reviewing/merging the PR.
- [ ] PT-SEC-001/002 complete their actual verification before stronger trust claims ship.

After acceptance, evaluate PT-BRAND-002 (name and domain decision) and PT-BRAND-003 (logo/assets) against their tracker dependencies. Keep the existing project URL until that decision is made. PT-SEO-001 supplies the technical/content baseline in parallel. This document does not buy a domain, change the app, install tracking or publish promotional material.
