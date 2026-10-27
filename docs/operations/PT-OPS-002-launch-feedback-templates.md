# PT-OPS-002 — Public feedback and issue templates

Status: implementation in PR, release issue chooser verification pending.

The public [issue chooser](https://github.com/Akshat4112/pdf-tools/issues/new/choose) offers a **Bug report** form and a **Feature request** form plus links to Help, Trust and the GitHub Security page. No email inbox, confidential upload channel, analytics, or application code is introduced.

Both issue forms prominently explain that GitHub Issues are public; require acknowledgements against private PDFs, real document text, identifying filenames, credentials, logs and sensitive screenshots; and forbid posting vulnerability details. The Security link only tells visitors to check whether private vulnerability reporting is available: it does not claim it is enabled.

Bug reporting asks for the affected implemented tool, browser/version, OS/device, synthetic reproducible steps, expected/actual result and synthetic-input type. Feature reporting asks for the problem, desired behavior, category, optional workarounds and privacy/accessibility considerations. **Never require actual source documents or promise that a requested feature will ship.**

## Acceptance checks

1. Run `cd app && npx vitest run src/__tests__/issueForms.test.ts`. The source test guards field IDs, required privacy confirmations, links and chooser configuration.
2. After merge, open [GitHub's public issue chooser](https://github.com/Akshat4112/pdf-tools/issues/new/choose) and inspect the rendered fields (including mandatory acknowledgements) of each form without submitting anything private.
3. Confirm the Help, Trust and Security links resolve and that unrestricted blank issues are disabled. Check Security settings separately; a generic security tab is not a guaranteed confidential channel.
4. If a maintainer tests submitting, use **only synthetic test data** and close the temporary public issue afterward. No real user files, filenames or private logs are acceptable.

GitHub ultimately stores public submissions. The warnings cannot enforce redaction of pasted documents. Maintainers should monitor for accidentally disclosed sensitive data and follow GitHub procedures.
