# PT-SEO-007 — mobile startup performance

Opening the catalog previously imported every tool component. That brought the PDF writer and PDF.js viewer styles into the homepage even before a tool or document was selected. ToolEntry now loads only the selected workspace; the PDF writer loads when processing starts. Viewer styles, reader code, fontkit, workers and WASM remain behind their existing document/reader boundaries.

The loading state reserves workspace height and keeps a return-to-catalog action available. A failed module download offers a full reload (necessary because React.lazy caches a rejected import) and explains that reload clears working files. Navigating away while loading cannot mount the old workspace in the catalog. Existing per-tool keys, document ownership and cleanup remain unchanged.

## Bundle baseline and budgets

Baseline: main commit `994069b1a212426101ce7493e0dc038ab67e98ad`, rebuilt with the locked dependencies. Measurements cover the Vite manifest's **static** import closure from `index.html`, including CSS and the module runtime. Dynamic imports are excluded and tested separately through browser requests. Gzip uses Node's default gzipSync settings, so it can differ slightly from Vite's display.

| Initial resources | Baseline raw bytes | Candidate budget raw bytes | Candidate budget gzip bytes |
| --- | ---: | ---: | ---: |
| JavaScript | 808,952 | 280,000 | 90,000 |
| CSS | 270,243 | 45,000 | 10,000 |

The comparison also requires at least 60% less initial JavaScript and 80% less initial CSS than the baseline. These measured budgets leave modest room above this change's approximately 247 KB JS and 40 KB CSS. Browser regression tests assert that home and the Convert hub fetch no tool/engine scripts or viewer CSS, and that an empty Merge workspace does not fetch the writer package, PDF.js, fontkit or WASM.

## Repeatable mobile lab comparison

The `startup performance` workflow builds the pinned baseline and candidate on the same runner, then serves both with gzip and a disabled cache. Each sample uses a fresh Chromium context: 390 × 844 CSS pixels, DPR 2, 4× CPU slowdown, 150 ms network latency, 200,000 bytes/sec download and 93,750 bytes/sec upload. It repeats home, the Convert hub and empty Merge three times each. Pinning the original baseline makes future budget drift visible; update the pin and baseline JSON only after a deliberate performance review.

The reports include resource bytes, FCP, observed startup LCP/CLS, long-task excess above 50 ms and readiness time. Readiness means the hero/hub heading or Merge file input is attached. Route comparisons use medians; startup CLS must stay at or below 0.1 and readiness cannot regress beyond 20% plus 100 ms on the same runner. This tolerance accounts for runner noise; deterministic asset and request checks provide the stable regression gates. The public JSON comparison is retained in CI artifacts for seven days and printed in the workflow logs; the PR records the measured results and run link.

To reproduce after building both distributions (the baseline needs `npm run build -- --manifest`):

```sh
node scripts/measure_startup.mjs /path/to/baseline/app/dist /tmp/baseline.json baseline
node scripts/measure_startup.mjs app/dist /tmp/candidate.json candidate
node scripts/compare_startup.mjs /tmp/baseline.json /tmp/candidate.json /tmp/comparison.json
```

This is a controlled DevTools lab comparison, not a Lighthouse score or a real device result. The long-task aggregate is not Lighthouse TBT because its observation window differs. No field LCP/INP/CLS, p75, CrUX or traffic claim is made. Field targets remain LCP ≤ 2.5 s, INP ≤ 200 ms and CLS ≤ 0.1 once sufficient field data exists. The startup observer does not measure INP. Both workflows use only empty public pages for performance artifacts; no selected documents, traces or document screenshots are uploaded.

## Functional and privacy verification

The regular checks workflow runs unit/engine tests, desktop and mobile browser flows, independent PDF output readers, image conversion, privacy surface, supply-chain/license, audit, base-path and corpus gates. New browser checks exercise a deliberately delayed workspace download, safe navigation during loading, failed download and reload recovery. SSR control tests wait for lazy modules and retain their original file-picker/action assertions.

This task is independent of PT-SEO-006 / PR #67, which remains under review with hosted structured-data validation pending. It neither claims that validation nor includes the structured-data changes.
