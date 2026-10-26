# PT-QA-002 — Browser, accessibility, performance and device verification

Status: **Automated compatibility in progress; manual support sign-off pending.** This is a release gate, not a claim that every browser or device has already been tested.

## Evidence and boundaries

- `app/e2e/compatibility.spec.ts` tests keyboard shortcut/focus, language switching, functional merge-download/readback/reset, 50 MiB size rejection, and isolation between two tabs on synthetic documents.
- `app/playwright.compat.config.ts` runs the same test against installed Chromium, Firefox, and WebKit on Linux, plus Pixel 7 (Chromium) and iPhone 13 (WebKit) *emulation*. These emulations use desktop-class browser binaries, not Android Chrome or iOS Safari.
- `.github/workflows/compatibility.yml` runs on exact PR/push commits. It must be green *alongside*, not instead of, the existing full R1 Chromium matrix and the independent-output QA suite.
- Existing R1 checks cover 14 shipped tools, processing cancellation, failure recovery, quotas, responsive 320/390/768/1440 layouts, contrast, reduced motion, local data/network/storage audit, keyboard, and synthetic downloads. Cite the exact commit/run before declaring support.
- CSS `zoom: 2` in the automated test is a 200% layout probe, **not a replacement** for using the browser's 200% zoom control.
- No user PDFs, sensitive sample files, screenshots of document content, traces, test downloads, or raw document data are uploaded by this compatibility workflow.

## Browser/device support evidence matrix

| Target | Automated evidence | Manual evidence | Release claim |
| --- | --- | --- | --- |
| Chromium on Linux (desktop) | Full R1 suite + compatibility smoke | Keyboard/zoom/real-device still required | Not yet signed off |
| Firefox on Linux (desktop) | PT-QA-002 compatibility smoke | Manual Firefox/zoom/AT pending | Not yet signed off |
| WebKit on Linux (desktop) | PT-QA-002 compatibility smoke | **macOS Safari** pending | Cannot call this Safari tested |
| Android-style viewport/touch | Pixel 7 emulation smoke | **Physical Android + Chrome** pending | Not Android certified |
| iPhone-style viewport/touch | iPhone 13 WebKit emulation smoke | **Physical iPhone + Safari** pending | Not iOS certified |
| Edge on Windows | Chromium similarities only | **Windows Edge** pending | Not Edge tested |
| High-resolution/large PDFs | Existing synthetic 30/60-page corpus and declared 50 MiB/300-page limits | Memory/timeout on lower-RAM devices pending | No universal no-crash claim |

## Required human checklist before Done / PT-REL-001

Record dated browser/OS/device version, display and DPR, language, tested URL and commit, result, observable memory/CPU limits, and reproducible issue IDs. Use synthetic PDFs only; never attach personal documents to public issues.

1. Real Chrome and Edge on current Windows, Firefox on Windows or Linux, Safari on macOS, Safari on iPhone, and Chrome on physical Android. Explicitly mark **not tested** where devices are unavailable.
2. Keyboard-only flow: focus order, menu, tool cards, file picker, reorder arrows, page range, preview, cancel, result download and reset. Verify meaningful live statuses with NVDA/VoiceOver where available.
3. 200% browser zoom, 320 CSS px, landscape device rotation, visible focus, minimum 44 px targets, dark/light mode, reduced motion, touch scrolling and no horizontal clipping.
4. Synthetic representative PDF and image workflows: valid output readback, incorrect/encrypted/over-limit inputs, cancellation during a long job, restart/retry, two-tab isolation, no upload/network anomalies.
5. Exercise worst published quotas (50 MiB per file and 300 pages where supported) **without promising support for every file structure**; capture responsiveness, failures, memory pressure and recovery. Publish conservative, measured browser support and limitations.
6. Compare any failures with `docs/testing/PT-QA-001-independent-output-matrix.md` and the privacy audit. No claim of automatic secure memory erasure. Record known limitations and fixes before promoting task to Done.

Run locally after building:

```sh
cd app
npm ci
npm run build
npx playwright install --with-deps chromium firefox webkit
npx playwright test --config playwright.compat.config.ts --max-failures=1
```

**Gate:** green cross-browser CI and linked exact-head R1 checks, then real-device/browser/assistive-tech matrix and written support policy. Keep PT-QA-002 in Review until both automated and manual evidence exist. PT-REL-001 and PT-TRUST-002 remain dependent.
