# PT-GROW-001 — Public repository discovery and honest metadata

## Recommended GitHub About settings

The repository metadata currently has an empty **description**, **homepage** and **topics**. The connected GitHub publishing actions can commit README and documentation, but do not expose repository-settings writes; a repository administrator must apply these manually using the GitHub repository's **About → Edit** UI.

- **Description:** `Free, open-source PDF tools that process documents locally in your browser — no account required.`
- **Website:** `https://akshat4112.github.io/pdf-tools/`
- **Topics:** `pdf-tools`, `pdf`, `local-first`, `open-source`, `privacy-first`, `react`, `typescript`, `pdfjs`, `pdf-lib`, `github-pages`

These strings are suggestions, **not confirmed settings**. Re-read the public repository metadata after applying them; don't mark the acceptance item complete until the actual description/topics/homepage are visible.

## Evidence-first README quality gates

- The hero and direct working-tool list align with the published 14-tool registry; unsupported OCR, redaction, password unlock, signing and compression remain clearly excluded.
- All public information links refer to real routes: Help, Privacy, Limitations, Trust, Guides and source.
- The banner in README is an original **brand social-card illustration, not an application screenshot**. Do not label it as mobile/browser QA evidence. Future UI screenshots must use synthetic PDFs, show an actual current build and exclude private user filenames and content.
- CI badges link to the actual repository workflows, and never claim user counts, audited security, ratings, GDPR/WCAG certificates or device support.
- Hosting requests and host IP metadata are distinguished from client-side document processing.
- Reviewer: check internal relative paths and the published website, verify link destinations and visual preview, and confirm the code is still MIT-licensed.
- Existing PT-OPS-002 tracks public GitHub Issue templates; avoid duplicating that work here.

## Remaining acceptance work

- Repo administrator sets About description/homepage/topics, checks visibility.
- Check the README image and links in the GitHub rendered preview, plus a clean checkout contributor flow (Node 24, `cd app && npm ci && npm run build`).
- Consider adding original screenshots from automated synthetic empty-workspace coverage after a reviewed screenshot privacy scrub. Until then the README preview is explicitly labeled artwork.
