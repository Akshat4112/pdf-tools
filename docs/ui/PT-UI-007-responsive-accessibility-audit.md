# PT-UI-007 — Responsive and accessibility review

Status: **Implementation review, not a full accessibility certification.** Scope is the R1 redesigned site chrome, homepage, static content, 14 shipped tools and navigation. No real user PDFs, sensitive issue attachments, analytics or host network changes.

## Review results and fixes
- **Fixed:** shared, localized skip-to-main navigation, visually revealed on keyboard focus, works with JS on home/tools/guides/help/trust/404 and with no-JS prerendered pages. Each main receives `tabindex="-1"` for fragment targeting. Previously the 404 did not have a `main` landmark.
- **Automated:** responsive bounds for 320/390/768/1440 px, both light/dark modes, reduced-motion, shared header/footer 44px controls, no side-scrolling, single main/banners/footers/H1, keyboard skip/return, primary search/tool journey, and selected real computed text contrasts meeting at least 4.5:1. Read-only synthetic/empty workspaces only.
- **200%:** CSS zoom=2 at a 640px viewport is a browser-engine reflow approximation. Native browser 200% UI zoom on actual devices is still **not verified**.
- Existing evidence: PT-UI-005 all-tool responsive checks, PT-QA-002 emulated browser/device compatibility, PT-UI-006 progress/preview action safety, PT-UI-003 bilingual footer/nav tests.

## Remaining acceptance matrix (manual)
| Check | Method | Status |
| --- | --- | --- |
| Windows Edge native and macOS Safari native | Real OS/browser release, primary selected-document journey | Open, not tested by Linux Playwright engines |
| Physical iOS Safari and Android Chrome | 320px equivalent, file picker, select/process/download, touch and memory quota | Open, emulation != hardware |
| NVDA/JAWS/VoiceOver screen readers | Heading/landmark announce, file input hints, busy status, errors and progress, results, keyboard control | Open, Playwright roles are not AT testing |
| Browser-native 200% and 400% zoom | All pages/primary flows, long filenames, tool forms/footer/menus | Open |
| WCAG 2.2 AA systematic audit (incl. axe), high-contrast/forced colors | Auditor/axe-core, focus order, contrast non-text, status announcements, keyboard traps | Open; browser checks cover only named subset |
| Reduced-motion/dark themes on real devices | Native OS/browser preferences and assistive features | Open |

## Release decision
Do not mark PT-UI-007 Done or claim WCAG compliance until the above meaningful manual/axe acceptance is conducted and any failures are fixed or separately recorded as blockers. A green implementation PR confirms only the checks actually run.
