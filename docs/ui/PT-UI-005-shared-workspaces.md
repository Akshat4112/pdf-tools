# PT-UI-005 — Shared tool workspace layout

All 14 shipped tools use the same ToolEntry main landmark, breadcrumb back to the catalog and collapsed, tool-specific usage help. The wrapper owns no file/session/job state. Existing selection, configuration, engine, verification and cleanup handlers remain in their tool components.

## Visual contract

`app/src/styles/theme.css` defines the accepted PDF Tools light/dark palette, fonts, spacing, radii and focus colors. Legacy workspace color variables are aliases of these tokens. The header, homepage and catalog consume the same palette rather than defining competing root colors. The newer PT-UI-006 state panels remain intact.

`workspaces.css` scopes typography, upload areas, file rows, panels, configuration fields, previews, action controls and focus treatment to the tool workspace. Controls have 44px minimum targets and visible 3px focus outlines. Error surfaces use the semantic danger colors. Mobile panels reduce padding and maintain wrapping. Help remains collapsed initially so it does not displace the utility.

PDF.js page/text/annotation layers retain their geometry and native appearance; application control overrides explicitly exclude those layers. No filter or dark-mode inversion is applied to document canvases. The reader page restores PDF.js content-box sizing so the global app reset cannot shrink its canvas inside the page border at narrow widths. No document or export code is changed.

## Verification and captures

The workspace suite visits all shipped routes at 320px and 1440px in light/dark themes, checks one main landmark, current breadcrumb, keyboard help, shared palette and control targets, then captures seven representative empty workspaces per theme/width. Captures contain no selected file, file name or document canvas; the suite asserts that boundary before saving them. Only these empty captures are uploaded as one-day CI artifacts.

A separate synthetic-input test checks populated merge, organize, conversion, reader, overlay and inspector controls at 320px in both themes, including boundary/text contrast, file-action targets, horizontal fit and reader canvas aspect ratio/filter. It does not capture documents. The complete existing output, page-order, rotation, image, overlay, reader, inspector, metadata and privacy/reset suites remain required.

The main workspace shell and controls are shared; this task does not publish the separately gated footer/help/privacy pages. Broader real-device, screen-reader and redesign accessibility review remains PT-QA-002/PT-UI-007.
