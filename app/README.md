# FolioLocal application

This directory contains the React/TypeScript browser application. Start with the [project README](../README.md) for available tools, privacy boundaries, limitations and contribution guidance.

## Setup and local preview

Use Node.js 24 and npm. Run these commands from `app/`:

```bash
npm ci
npm run build
npm run preview -- --host 127.0.0.1
```

Open **http://127.0.0.1:4173/pdf-tools/**. Vite's build copies the pinned PDF.js worker, standard fonts, CMaps, WASM, ICC and viewer-image assets into `dist/assets/`. Use this built preview for complete document-processing checks.

For UI development with hot reload:

```bash
npm run dev
```

Open **http://localhost:5173/pdf-tools/**. The project base path is `/pdf-tools/`, including local previews. No API keys, accounts or document-processing backend are required.

## Checks

```bash
npm run lint
npm test
npx tsc -p tsconfig.test.json --noEmit
npx tsc -p tsconfig.e2e.json --noEmit
npm run build
node ../scripts/check_privacy_surface.mjs
python3 ../scripts/check_design_reference.py
node ../scripts/check_supply_chain.mjs --self-test
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
```

The supply-chain gate checks dependency licenses, lockfile integrity and vendored notices. CI uses its `--write-notices` option before building; consult the [supply-chain documentation](../docs/security/PT-SEC-003-supply-chain.md) when changing dependencies.

## Browser and independent output checks

Install Chromium and its operating-system dependencies:

```bash
npx playwright install --with-deps chromium
```

The download-validation tests also need Python (CI uses 3.12), `pymupdf==1.28.0` in the Python environment used by the tests, and `qpdf` on `PATH`. On Debian/Ubuntu, install qpdf using `sudo apt-get install qpdf`. Use a Python virtual environment for Python packages where required by your system.

After installing these prerequisites:

```bash
npm run build
npm run test:pages-ui
npm run test:images-engine
```

The page suite starts its own built-preview server on port **4178**. The image-engine suite starts its dedicated Vite harness on port **4180**. Both run desktop and emulated mobile Chromium. Leave those ports free. To use an existing compatible Chromium installation, set `PDF_TOOLS_CHROMIUM_PATH` to its executable path.

From the repository root, validate the committed synthetic corpus and validator logic:

```bash
python3 scripts/validate_corpus.py
python3 -m unittest discover -s scripts -p 'test_validate_outputs.py'
python3 -m unittest discover -s scripts -p 'test_check_reproducibility.py'
```

See the [CI workflow](../.github/workflows/checks.yml) for the authoritative full sequence, including fixture regeneration and structural reproducibility. Generated fixture bytes may differ because of timestamps and document identifiers; the committed corpus is the canonical reference.

## Implementation map

| Location | Responsibility |
| --- | --- |
| `src/registry.ts` | Tool availability, routes, engine contracts and baseline quotas. |
| `src/components/` | Tool workspaces and shared interface components. |
| `src/engines/` | PDF and image engine adapters. |
| `src/tools/` | Per-tool flow and transformation plans. |
| `src/session/`, `src/jobs/` | In-memory resources and job orchestration. |
| `src/security/`, `src/outputs/` | PDF loading/filename policies and output verification. |
| `e2e/` | Browser journeys, privacy audits and downloaded-output checks. |
| `public/brand/` | FolioLocal logo, icon and social artwork with license notices. |
| `vite.config.ts` | Project base, PDF.js asset copying and generated static route pages. |

Use synthetic documents for tests. Do not commit private files or document-bearing debug artifacts. Application changes must preserve the [local data lifecycle](../docs/product/PT-PD-003-data-lifecycle.md) and the [contributor workflow](../docs/operations/PT-OPS-001-pr-task-workflow.md).
