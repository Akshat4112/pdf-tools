# PT-TRUST-002 — Public trust & open-source evidence

Status: Implementation submitted for review. This PR adds a static, indexable `/pdf-tools/trust/` route plus a discovery link in the homepage trust strip; PT-UI-003 owns the site-wide footer.

## Source-to-claim map

| Public statement | Existing evidence | Important boundary |
| --- | --- | --- |
| Free and MIT-licensed | [Public source repository](https://github.com/Akshat4112/pdf-tools), root [MIT LICENSE](../../LICENSE), [brand contract](../brand/PT-BRAND-001-positioning-and-promise.md) | Applies to shipped browser-based tools, not every dependency or future cloud feature |
| Browser-local processing | [PT-SEC-002 all-tool runtime audit](../security/PT-SEC-002-local-processing-audit.md) for 14 shipped tools, synthetic input/network/storage/reset tests | Project-authored automated tests, not a third-party audit, proof against compromised browsers or offline-only operation |
| Hosting and network visibility | [PT-REL-001 privacy](https://akshat4112.github.io/pdf-tools/privacy/), [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection) | Loading static assets exposes host request metadata, potentially IP address |
| Clear and Start over | [PT-PD-003 local-data lifecycle](../product/PT-PD-003-data-lifecycle.md), [PT-SEC-002](../security/PT-SEC-002-local-processing-audit.md) | Releases owned app memory/URLs; cannot erase originals, saved downloads, OS caches or swap |
| Current releases and missing features | [Live tool catalog](https://akshat4112.github.io/pdf-tools/), [limitations](https://akshat4112.github.io/pdf-tools/limitations/), [registry](../../app/src/registry.ts) | 14 implemented tools, no OCR, permanent redaction, password unlocking or complete signed-PDF preservation |
| Reporting and contribution | [PT-OPS-001 contributor workflow](../operations/PT-OPS-001-pr-task-workflow.md), [GitHub Issues](https://github.com/Akshat4112/pdf-tools/issues/new), [Security tab](https://github.com/Akshat4112/pdf-tools/security) | Public issues aren't confidential; check whether GitHub private vulnerability reporting is enabled, and never post private documents |

## Publication and acceptance

- `/trust/` is included in the static sitemap, canonical/OG tags and no-JavaScript body, using the existing public-info route generation; source content is static and has no selected document inputs.
- Homepage keeps a clear linked CTA; German UI label is translated. The evidence article intentionally declares English language until localized public routes ship in PT-SEO-010.
- Playwright verifies static route, navigation/history, links, keyboard, German UI, small viewports, and limitations. Vitest checks static safe claims and exact metadata; existing performance checks constrain initial JS/CSS.
- **Not independently verified:** physical iOS/Android/macOS Safari/Edge, screen-reader auditing, hosted structured-data validator, publisher/legal privacy notice approval, enabled private vulnerability reporting. Do not mark this task fully accepted until these project sign-offs are reviewed, even when implementation CI passes.
