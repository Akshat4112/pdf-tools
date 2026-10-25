<picture>
  <source media="(prefers-color-scheme: dark)" srcset="app/public/brand/logo-dark.svg">
  <img src="app/public/brand/logo-light.svg" alt="FolioLocal" width="280">
</picture>

# FolioLocal

**Free PDF tools. On your device.**

Merge, split, organize, read and convert PDFs in your browser. FolioLocal is open source, requires no account, and processes your selected documents on your device instead of uploading them to a conversion server.

**[Open FolioLocal](https://akshat4112.github.io/pdf-tools/)** · [Browse tools](https://akshat4112.github.io/pdf-tools/#tool-catalog) · [Report an issue](https://github.com/Akshat4112/pdf-tools/issues) · [MIT license](LICENSE)

The repository and site path remain `pdf-tools`; the product name is FolioLocal.

## Why FolioLocal?

- **Free forever for the browser-based tools we release:** no subscriptions, paid exports, account requirements or forced watermarks. File and browser limits apply.
- **Local document processing:** file contents are handled in your browser, with no document-processing backend.
- **Open source:** inspect the implementation, run it yourself, or contribute under the MIT license.
- **Originals stay intact:** transformations create new downloads. Review the result before sharing it.

## Available tools

All 14 tools below are implemented in the [tool registry](app/src/registry.ts). Later roadmap features are not included in this list.

| Tool | What you can do |
| --- | --- |
| [Merge PDF](https://akshat4112.github.io/pdf-tools/merge/) | Combine PDFs in the order you choose. |
| [Split PDF](https://akshat4112.github.io/pdf-tools/split/) | Split by ranges, every N pages, or one file per page; download a ZIP. |
| [Rotate PDF](https://akshat4112.github.io/pdf-tools/rotate/) | Rotate selected or all pages in 90° steps. |
| [Delete pages](https://akshat4112.github.io/pdf-tools/delete-pages/) | Remove selected pages into a new PDF. |
| [Extract pages](https://akshat4112.github.io/pdf-tools/extract-pages/) | Create a PDF from selected pages in your chosen order. |
| [Organize PDF](https://akshat4112.github.io/pdf-tools/organize/) | Reorder, duplicate, rotate and delete pages, with undo. |
| [JPG/PNG to PDF](https://akshat4112.github.io/pdf-tools/images-to-pdf/) | Create one PDF with one image per page and page-size, fit and margin options. |
| [PDF to JPG](https://akshat4112.github.io/pdf-tools/pdf-to-jpg/) | Render selected pages as JPG images, individually or in a ZIP. |
| [PDF to PNG](https://akshat4112.github.io/pdf-tools/pdf-to-png/) | Render selected pages as PNG images with background options. |
| [PDF reader](https://akshat4112.github.io/pdf-tools/reader/) | Navigate, zoom, search existing text, copy and print. |
| [Page numbers](https://akshat4112.github.io/pdf-tools/page-numbers/) | Add numbering with a starting number, position and page selection. |
| [Text watermark](https://akshat4112.github.io/pdf-tools/watermark/) | Add text with position, opacity and page-selection options. |
| [PDF to text](https://akshat4112.github.io/pdf-tools/pdf-to-text/) | Export the existing text layer as UTF-8 TXT. |
| [Document information](https://akshat4112.github.io/pdf-tools/doc-info/) | Inspect metadata, page dimensions and document indicators. |

Choose a tool, select your files, configure the operation, then review and download the result. Use **Clear files** or **Start over** to remove the current workspace's files and results.

## Privacy and security

Selected documents, filenames, previews, extracted text and generated results are handled in browser memory. The released application does not intentionally persist document data in browser storage and does not include analytics or crash-reporting services.

Loading the website still requests static assets from GitHub Pages. GitHub Pages logs visitor IP addresses for security, as explained in its [data-collection documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection). Local processing does not mean offline operation or anonymity.

Clearing a workspace releases application-managed state and resources. It does not securely overwrite memory or delete your original files, downloaded files, clipboard contents or printed copies. Reader protections also do not sanitize exported PDFs for use in other viewers.

Read the [local data lifecycle](docs/product/PT-PD-003-data-lifecycle.md), [rendering and filename protections](docs/security/PT-SEC-001-rendering-and-filenames.md), and [all-tool local-processing audit](docs/security/PT-SEC-002-local-processing-audit.md) for implementation details and test boundaries. These are project documentation and CI evidence, not an independent security certification.

## Current limits

- PDF, JPEG and PNG inputs only, depending on the tool. Current baseline quotas are **50 MiB per file** and **300 PDF pages**; individual workflows also enforce batch, pixel and processing limits. See the limits displayed in each tool.
- PDF-to-image tools render pages; they do not extract original embedded images.
- Text export and reader search use existing PDF text. Image-only scans need OCR, which is not currently available. Reading order may vary in complex documents.
- Password unlocking, OCR, compression, redaction, Office conversion and certificate signing are not shipped features. Document-information indicators do not validate a signature or certificate chain.
- Modified copies may not preserve interactive forms, annotations, bookmarks, accessibility tags or signatures. Review the export warning and the resulting document, especially before modifying signed PDFs. Deleting a page or covering text is not secure redaction.
- Browser memory and device performance affect capacity. Automated browser coverage currently uses desktop Chromium and mobile Chromium emulation; this is not a claim of complete Safari, Firefox or real-device verification.

## Run locally

Use **Node.js 24** and npm. No API keys or backend services are required.

```bash
git clone https://github.com/Akshat4112/pdf-tools.git
cd pdf-tools/app
npm ci
npm run build
npm run preview -- --host 127.0.0.1
```

Open **http://127.0.0.1:4173/pdf-tools/**. The build copies the PDF.js worker, fonts and supporting assets needed for document workflows.

For UI development, run `npm run dev` from `app/` and open **http://localhost:5173/pdf-tools/**. Use the built preview for complete processing checks. More commands and browser-test prerequisites are in the [app development guide](app/README.md).

## Development and verification

The app uses React, TypeScript and Vite, with PDF.js for reading/rendering, pdf-lib for PDF generation, and zip.js/fflate for archive handling. PDF.js assets are served with the application.

From `app/`:

```bash
npm run lint
npm test
npm run build
```

CI also checks browser workflows, privacy boundaries, dependency licenses/integrity and vulnerabilities. Real browser-generated downloads are checked with PyMuPDF and qpdf. See the [output-validation matrix](docs/testing/PT-QA-001-independent-output-matrix.md), [synthetic fixture corpus](docs/testing/PT-PD-005-benchmark-corpus.md), and [CI workflow](.github/workflows/checks.yml) for coverage and prerequisites.

| Path | Contents |
| --- | --- |
| [`app/`](app/) | Browser application, unit tests and Playwright suites. |
| [`docs/`](docs/) | Product decisions, tool contracts, brand, security and QA evidence. |
| [`fixtures/`](fixtures/) | Synthetic PDFs/images and expected properties. |
| [`scripts/`](scripts/) | Fixture generation, output validation, privacy and supply-chain checks. |
| [`spike/`](spike/) | Prototype investigations; not the production app. |

## Contributing and feedback

Bug reports, documentation improvements and focused pull requests are welcome. Read the [contributor workflow](docs/operations/PT-OPS-001-pr-task-workflow.md) before starting. Use the [project tracker](https://docs.google.com/spreadsheets/d/1m3iyaksGD-hY51JwFfIzb-JS5S3GSp0uJqS4Ae77-lg/edit) for task dependencies, acceptance criteria and progress; planned features are not availability promises.

For public bug reports, include the tool, browser/version, reproduction steps and expected result. Use a small synthetic example. **Do not attach private PDFs, personal information, credentials or sensitive screenshots to public issues or pull requests.** For a suspected vulnerability, avoid posting exploit details publicly; use GitHub private vulnerability reporting if the repository offers it.

Keep contributions scoped to one task, verify relevant checks, and preserve the local-processing boundary. New dependencies need license and security review.

## License and brand assets

Application code is [MIT licensed](LICENSE). Third-party libraries and fonts retain their own licenses and distribution requirements; see the [dependency decisions](docs/architecture/PT-PD-006-dependency-decisions.md) and [supply-chain policy](docs/security/PT-SEC-003-supply-chain.md).

The original FolioLocal artwork, editable SVGs, export files and font notices are in the [brand asset kit](app/public/brand/README.md).
