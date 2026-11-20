# Contributing to PDF Tools

Thank you for helping improve a free, browser-first PDF utility.

## Before starting

Read the [README](README.md), [existing issues](https://github.com/Akshat4112/pdf-tools/issues), [contributor workflow](docs/operations/PT-OPS-001-pr-task-workflow.md), and [project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit). Keep changes focused; discuss large changes before implementation.

## Development

Use Node.js 24 and npm. From the repository root:

```bash
cd app
npm ci
npm run dev
npm run lint
npm test
npm run build
```

See [app/README.md](app/README.md) for browser tests, preview commands and prerequisites. Check relevant English and German routes. Do not introduce remote document processing or telemetry without an explicit product and privacy decision.

## Pull request checklist

- [ ] Explain the problem, scope and expected behavior.
- [ ] Include relevant tests with synthetic fixtures, including independent output validation where applicable.
- [ ] Verify affected browser flows, accessibility and privacy boundaries.
- [ ] Review dependencies, licenses and security implications.
- [ ] Link the relevant task or issue; document known limitations.
- [ ] Confirm required CI checks for the latest commit.

Report bugs using the [issue templates](https://github.com/Akshat4112/pdf-tools/issues/new/choose), with browser version, steps and expected versus observed behavior. Never attach real private documents, credentials or personal information. For security concerns, follow [SECURITY.md](SECURITY.md). Contributions are under the project's [MIT license](LICENSE).
