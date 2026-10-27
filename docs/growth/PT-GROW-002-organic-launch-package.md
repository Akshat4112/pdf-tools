# PT-GROW-002 — Organic launch and feedback package

Status: **DRAFT; DO NOT PUBLISH** until PT-BQA-002 production acceptance and owner review. This is an outreach preparation task, not authorization to promote.

## Scope, truthful product description

**PDF Tools** is a free, MIT-licensed, open-source browser-based PDF toolkit with 14 implemented tool routes at the current reviewed release. Selected documents are processed locally in the browser; site assets and ordinary hosting requests are delivered by GitHub Pages. Do not imply zero network requests, anonymous access, independent security certification, complete redaction, true electronic signatures, OCR, or support for all PDF conversions. Confirm live capability count and wording before publication.

Live demo (verify before posting): https://akshat4112.github.io/pdf-tools/
Source: https://github.com/Akshat4112/pdf-tools

## Channel priority and guardrails

| Priority | Channel | Angle | Conditions / gate |
| --- | --- | --- | --- |
| 1 | Show HN | Try a genuinely usable, no-signup local-browser PDF workflow; discuss implementation boundaries | Only after independently verified public demo, full acceptance and developer available for discussion. Official guidelines: https://news.ycombinator.com/showhn.html |
| 2 | Reddit r/SideProject | Screenshots of synthetic example and specific feedback questions | Re-check current community rules immediately before posting; identify yourself as creator; no repetitive cross-posts. https://www.reddit.com/r/SideProject/ |
| 3 | Reddit r/opensource | Engineering design trade-offs, open license and privacy boundaries | Community restricts spam/excessive self-promotion; consult current sidebar and moderators where uncertain. https://www.reddit.com/r/opensource/ |
| 4 | DEV Community | Detailed technical article about static routing, local processing, and testable output | Make useful original engineering content, not keyword-stuffed promotion; review publication policy. https://dev.to/ |
| 5 | GitHub repository and relevant curated directories | Accurate README, screenshots, topic tags, license, contribution and issue links | PT-GROW-001 GitHub About fields and screenshot review must be complete; comply with individual listing terms |

Sources were checked as of 2026-10-27; rules can change. No launch scheduling, social posts, subreddit submissions or paid listings are performed in this task.

## Ready-to-review drafts

### Show HN — *hold until live acceptance*

**Title:** Show HN: PDF Tools – free open-source PDF utilities that process files in your browser

**First comment:** I built PDF Tools because I wanted straightforward PDF workflows without having to upload selected documents to a processing server. It is MIT-licensed and runs implemented PDF operations in the browser; the static website itself is hosted on GitHub Pages, so serving the site still involves normal hosting requests. I've focused on clear limitations and synthetic reproducible tests rather than broad claims about security or format fidelity. I'd love feedback on whether the tool states and reset behavior are understandable, and which real-world PDF edge cases are missing. Please use synthetic files in public bug reports.

### r/SideProject — *draft, verify rules*

**Title:** Built an open-source PDF toolkit that processes selected files locally — feedback on the UX?

**Body:** I've been working on PDF Tools, a free MIT-licensed web app with browser-local processing for supported PDF tasks. I tried to make limitations and reset behavior visible instead of promising all-in-one conversion. A sample workflow is merging two synthetic PDFs and downloading the result. Which part is most confusing to a first-time user: finding the right tool, managing inputs, or trusting the download/reset flow? Project/demo link only where subreddit rules allow it. I'm the maintainer.

### r/opensource — *discussion-first, rule check required*

**Title:** Trade-offs in a static, browser-local PDF toolkit

**Body:** I maintain an MIT-licensed PDF utilities project on static hosting. The interesting trade-off is that selected document processing can remain in the browser, but the public website still serves assets and has hosting-level request metadata. We added a concrete trust/limitations page and synthetic PDF output checks to keep these distinctions visible. How would you evaluate whether these privacy disclosures are clear enough for nontechnical users? [Source link, only if approved by subreddit rules.]

### DEV — *outline*

**Title:** Testing browser-local PDF workflows without real documents

Sections: why local processing and static hosting are distinct privacy promises; synthetic fixture creation; download/reopen verification; network and storage canaries; static URL/sitemap validation; limits of browser emulation and production sign-off. Link real source and test paths. Avoid confidential screenshots or copied PDF excerpts.

## Synthetic demonstration assets

1. Record a short screen capture showing two obviously synthetic PDFs, merge, independently reopen the downloaded PDF, then reset. Blur browser/account identifiers; do not use real user documents.
2. Make a desktop and mobile screenshot of live production. State the date, tested commit and browser; label artwork as artwork, not a screenshot.
3. Keep a small ready-to-copy feedback prompt: “What tool were you trying? Browser/OS? Expected vs actual? Could you reproduce with a document containing only invented text?” Never request private files publicly.

## Publication decision checklist

- [ ] PT-BQA-002 has an accepted production deployment and reviewed SHA
- [ ] PT-BQA-001 manual critical gates and legal disclosure review resolved
- [ ] PT-SEO-008 owner verification handled honestly (no indexing/ranking promise)
- [ ] All claims/link counts/screenshots rechecked against live site
- [ ] Current community rules checked by maintainer, channel-specific draft approved
- [ ] User explicitly chooses channels and authorizes posting
- [ ] Feedback response owner and cadence assigned; avoid engagement manipulation

**Success:** a reviewed, credible package and individually approved future publication actions, not a post count or guaranteed traffic.
