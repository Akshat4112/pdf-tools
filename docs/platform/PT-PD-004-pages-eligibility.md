# PT-PD-004 — Repository and Pages deployment eligibility

- Report version: 1.0
- Prepared: 2026-10-08
- Status: proposed, ready for PR review. Becomes the hosting-eligibility baseline when merged.
- Repository: [Akshat4112/pdf-tools](https://github.com/Akshat4112/pdf-tools)
- Planned production URL: https://akshat4112.github.io/pdf-tools/
- [Project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit)
- Depends on: PT-PD-001 (merged, PR #1)
- This task verifies hosting eligibility only. It does not deploy anything (PT-FND-009 does, after the app exists).

## 1. Verification method

All findings below were checked live against the GitHub REST API on 2026-10-08 using the repository owner's authenticated session (`gh api`), not assumed from documentation. GitHub Pages plan/limit facts are stated with their source in §3.

## 2. Repository state (observed)

| Property | Value (2026-10-08) | Note |
| --- | --- | --- |
| Owner | `Akshat4112` (User account) | Project-site URL form applies: `/<repo>/` path |
| Visibility | **Public** | Changed from private since the 2026-09-30 research; visibility was not modified by this task, and no visibility change is required for eligibility |
| Default branch | `main` | Contains README, MIT LICENSE, `docs/product/*` specs |
| Contents | docs-only; 1 KB | No app code yet, as planned |
| GitHub Pages | **Not enabled** (API 404 on `/pages`) | Expected; enabling happens in PT-FND-009 with the first deployable build |
| Actions permissions | **All actions allowed** | `actions: enabled_workflow_platforms = all` — deploy workflows permitted |
| Sibling origin | `Akshat4112/akshat4112.github.io` exists (public, `main`) | Confirms the shared-origin risk documented in PT-PD-003 §3; key-prefixing and SW scoping remain mandatory |

## 3. Pages eligibility determination

**Result: eligible.** The planned deployment is a user-account **project site** at `https://akshat4112.github.io/pdf-tools/`.

1. **Plan requirement:** GitHub Pages is available on all plans, including GitHub Free, **for public repositories**. Private-repository Pages requires GitHub Pro/Team/Enterprise. The repository is public as of this verification, so Pages is eligible on the free tier. (If the repository ever returns to private, a paid plan becomes required — flagged as a change-control condition in §6.)
2. **Project-site path:** user-account repositories that are not named `<user>.github.io` are served at `https://<user>.github.io/<repo>/` — this matches the intended `/pdf-tools/` path in PT-PD-001 §7. All asset URLs, the router base, and any future service-worker scope must use `/pdf-tools/` as their base.
3. **Deployment source choice for PT-FND-009:** GitHub Pages supports two sources — *Deploy from a branch* (root or `/docs`) and *GitHub Actions*. The React/Vite application requires a build step, so **GitHub Actions is the correct source** (build → upload artifact → `actions/deploy-pages`). Branch deployment of prebuilt files would put build artifacts in version control and is rejected as an approach.
4. **Actions permission:** verified `all` — no organization/user policy blocks the deploy workflow.

## 4. Hosting limits (published GitHub Pages limits, to respect at deployment)

| Limit | Value | Impact on this project |
| --- | --- | --- |
| Published site size | 1 GB | Vite bundle + self-hosted fonts/WASM engines will be well under; re-measure in PT-SP-002 |
| Bandwidth | 100 GB / month (soft) | Fine for a free utility; no change needed |
| Builds | 10 per hour (soft) | CI deploys on merge only — no risk |
| Supported content | static only | Matches the no-backend R1 boundary (PT-PD-001 §7) |
| HTTPS | enforced | Default; no insecure-asset (mixed-content) risk if all assets are same-origin |

**GitHub Pages terms note:** Pages is not intended for solely commercial use (running a business/e-commerce). R1 is a free, non-commercial utility with no billing — compliant. The PT-PD-001 §6 condition ("a commercial SaaS goal requires revisiting the hosting model before adding billing") remains the controlling rule if that ever changes.

**Access logging:** GitHub (the host) records standard visitor request logs. PT-PD-003 §9 already requires the privacy copy to disclose this; no further action here.

## 5. Deployment design decisions (recorded for PT-FND-009)

1. Source: **GitHub Actions**, workflow on `main` (or release branch) only — no preview-per-PR deploys in R1 to keep quota and complexity low.
2. Workflow stages: install (pinned Node LTS) → typecheck + lint + unit tests → build (`vite build` with `base: '/pdf-tools/'`) → upload pages artifact → deploy. Gate: build fails ⇒ no deploy.
3. Vite `base` **must** be `/pdf-tools/` — this is an acceptance criterion for PT-FND-009/PT-UX-004 (asset URLs, router, refresh behavior, 404 page).
4. No secrets in the workflow (static output; nothing to inject). The R5 backend, if ever approved, lives elsewhere.
5. Rollback: redeploy the previous passing main commit (document exact command in PT-REL-002's release notes, as PT-PD-001 §8 requires rollback instructions).

## 6. Conditions and change control

- **Visibility:** eligibility holds while the repo is public. Switching to private without a Pro+ plan breaks Pages — any visibility change is a deliberate decision requiring a tracker update (and is explicitly out of scope for automation; PT-PD-001 acceptance already forbids silent visibility changes).
- **Repo rename:** renaming changes the `/pdf-tools/` path; forbidden without a spec PR (PT-PD-001 §8).
- **User-site collision:** `akshat4112.github.io` serves the portfolio root; this app must never write cookies/storage outside prefixed keys or register a root-scoped service worker (PT-PD-003 §3).

## 7. PT-PD-004 acceptance review

| Tracker requirement | Evidence |
| --- | --- |
| Repo private and empty as of research — confirm eligibility now | §2 observed state: docs-only, **public** now; §3 eligibility determination on the free plan |
| Confirm eligible GitHub plan | §3.1 — public repo ⇒ Pages on GitHub Free; private would need Pro (flagged §6) |
| Confirm deployment source | §3.3/§5 — GitHub Actions chosen; branch-deploy rejected |
| Confirm permissions | §2 — Actions `all`; owner controls repo |
| Confirm static-site limits | §4 — 1 GB site, 100 GB/mo, 10 builds/h, static-only; all compatible |
| No visibility change without instruction | No visibility change was made by this task; observed change noted in §2; change-control rule in §6 |

After merge, PT-PD-004 is **Done**. This unblocks PT-SP-002 (memory/asset benchmark) and PT-FND-009 (Pages build config) once their other dependencies complete.

## 8. Sources

- Live API inspection 2026-10-08: `GET /repos/Akshat4112/pdf-tools`, `GET /repos/Akshat4112/pdf-tools/pages` (404 — not enabled), `GET /repos/Akshat4112/pdf-tools/actions/permissions`, `GET /users/Akshat4112`, `GET /repos/Akshat4112/akshat4112.github.io`.
- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): site size, bandwidth, builds.
- [What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): plan availability (public free / private Pro+), project-site paths, static-only, HTTPS.
- [GitHub Acceptable Use / Pages terms](https://docs.github.com/en/site-policy/acceptable-use-policies/github-terms-of-service): commercial-use boundary.
