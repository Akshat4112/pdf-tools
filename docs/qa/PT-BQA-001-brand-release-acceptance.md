# PT-BQA-001 — Branded website / privacy / SEO release acceptance

Status: **automated acceptance work submitted for review, release acceptance NOT complete.** This task has prerequisite PT-UI-007 and PT-SEO-006 in `Review` (manual real-device/assistive-tech and hosted structured-data validation). This file documents the exact criteria and evidence-gathering procedure and does not grant acceptance by itself.

## Integrated automated gate

`app/e2e/brandedReleaseAcceptance.spec.ts` exercises the reviewed production build under `/pdf-tools/`:

- The 14 `implemented` registry tools must each have a statically served, canonical page and a corresponding sitemap URL (no roadmap tool presented as shipped).
- A public evidence chain must be present in crawlable HTML: homepage, footer, Help, Privacy, Limitations and Trust, including real MIT license and all-tool local-processing audit links, 50 MiB/300-page limits, OCR/redaction/signature caveats and GitHub Pages hosting-IP disclosure.
- A synthetic two-page merge is run in the real browser, downloaded, reopened independently with pdf-lib, reset, and checked for selected filename/text in `<head>`, application storage, and off-origin network requests. Only synthetic data are used.
- Existing CI supplements the new gate with all-tool output and corpus checks, Chromium/Firefox/Linux WebKit compatibility, 320px and color/keyboard/reflow checks, structured JSON-LD static+client parity, no-JS pages, supply-chain audit and cold-start performance. Don't equate Linux WebKit to physical macOS/iOS Safari.
- The new test is picked up by existing R1 browser regression CI. To run locally: `cd app && npm ci && npm run build && npx playwright test brandedReleaseAcceptance.spec.ts`. Record the **exact tested SHA** plus named workflow conclusions. Avoid copying stale earlier PR test counts.

## Acceptance matrix

| ID | Criteria | Evidence / owner | Gate |
| --- | --- | --- | --- |
| BQA-01 | Shipped tools: registry/catalog/SEO/output and reset agree | New integrated Playwright gate + PT-QA-001 and PT-QA-002 exact-head suites | CI |
| BQA-02 | Local processing: synthetic network/storage/content canaries, copy/reset warnings and security audit | New gate + PT-SEC-001/PT-SEC-002, browser network inspection | CI; manual copy review |
| BQA-03 | 320px/mobile, light/dark, keyboard/contrast/reduced motion, native zoom and screen-reader | PT-UI-007 merged checks + real-device/AT review | **Manual outstanding** |
| BQA-04 | Static SEO: every canonical, sitemap, JSON-LD, hosted validator and no-JS link crawl | Metadata/schema suites; hosted schema validator evidence PT-SEO-006 | **Manual hosted validation outstanding** |
| BQA-05 | Public trust/legal: MIT, free/local limits, Pages IP/logging, reset boundaries and accurate legal/privacy text | PT-REL-001 technical pages + owner/publisher legal/privacy contact approval | **Manual outstanding** |
| BQA-06 | Production URLs: deep links/404/download in fresh browsers and shared-root safety | GitHub Pages deploy SHA + production desktop/mobile smoke | **Manual production smoke outstanding** |
| BQA-07 | Source/feedback: README/issue templates/real source links, no private issue uploads | PT-GROW-001 and PT-OPS-002 merged code; public GitHub rendered chooser/About settings review | **Manual outstanding** |
| BQA-08 | Search Console: ownership, sitemap submitted, URL Inspection readback | PT-SEO-008 owner account | **Owner/account outstanding; BQA-002 dependency** |

## Final disposition

**Release approval is BLOCKED** until outstanding critical manual checks are evidenced and any failures triaged. Automated success is evidence for the specific scenarios checked, not proof of WCAG 2.2 AA compliance, independent security certification, full PDF-format fidelity, GDPR certification, Google indexing or universal device support.

Maintainer should verify `main` deploy workflow corresponds to reviewed SHA, document rollback point, perform fresh-browser synthetic workflows and attach only sanitized public or synthetic screenshots. Never upload confidential PDFs, real filenames, traces or user documents to CI artifacts or issues. PT-BQA-002 owns final deployment and its distinct release/rollback record.

**2026-10-27: 404 SEO regression resolved.** Integrated tests initially exposed missing `noindex` in the generated GitHub Pages `404.html`. Its HTTP 404 response is the primary search indexing boundary; the generator now adds `<meta name="robots" content="noindex,nofollow">` as defense in depth if a host accidentally serves the fallback as HTTP 200. The new test confirms the directive on `404.html` but absent on the real homepage. It is a build-time fix; it adds no application startup JS/CSS.
