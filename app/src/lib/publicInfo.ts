/**
 * PT-REL-001 — public, authored and document-independent help/privacy copy.
 * No source file, query, browser storage or user text is interpolated.
 * PT-SEO-010 will handle full crawlable German translations separately.
 */
const SOURCE = 'https://github.com/Akshat4112/pdf-tools'
const ISSUE = `${SOURCE}/issues/new`
const LICENSE = `${SOURCE}/blob/main/LICENSE`
const AUDIT = `${SOURCE}/blob/main/docs/security/PT-SEC-002-local-processing-audit.md`

const pages: Record<string, { heading: string; body: string }> = {
  '/trust': {
    heading: 'Trust and transparency',
    body: `
    <p>PDF Tools is a free, MIT-licensed collection of browser-based PDF tools. Here are the public sources behind the promises on this website, and the limits those promises do not cover.</p>
    <section aria-labelledby="trust-source"><h2 id="trust-source">Open source, with a real license</h2>
      <p>Inspect the <a href="${SOURCE}" rel="noopener noreferrer">public source repository</a> and its <a href="${LICENSE}" rel="noopener noreferrer">MIT license</a>. Source availability is not a claim that every third-party dependency uses the MIT license or that the software has a third-party security certification.</p>
    </section>
    <section aria-labelledby="trust-local"><h2 id="trust-local">Local document processing</h2>
      <p>The currently released PDF tools process selected document contents in the browser, rather than sending them to a document-conversion server. The <a href="${AUDIT}" rel="noopener noreferrer">all-tool local-processing audit</a> documents synthetic-input browser tests for all 14 shipped tools, including network boundaries, temporary resources and reset/exit behavior. These are project-owned tests, not an independent audit or a guarantee against compromised browsers or extensions.</p>
      <p>Opening the site still downloads code and assets from GitHub Pages, which receives standard request metadata including IP addresses. That is separate from document processing. Read <a href="/pdf-tools/privacy/">Privacy and local processing</a> for the hosting boundary and storage details.</p>
    </section>
    <section aria-labelledby="trust-reset"><h2 id="trust-reset">Clear and reset: what actually disappears</h2>
      <p>Clear files and Start over release the app's references to selected files, previews, results and temporary object URLs. They do not securely overwrite operating-system memory, delete files already downloaded or erase originals, caches or printouts. See the <a href="${SOURCE}/blob/main/docs/product/PT-PD-003-data-lifecycle.md" rel="noopener noreferrer">data lifecycle specification</a> and the <a href="/pdf-tools/help/">Help and FAQ</a> for the behavior available to users.</p>
    </section>
    <section aria-labelledby="trust-release"><h2 id="trust-release">Current release and limitations</h2>
      <p>The public catalog offers 14 implemented browser workflows; the <a href="/pdf-tools/">tool directory</a> reflects the available tools. See <a href="/pdf-tools/limitations/">supported features and limitations</a> for 50 MiB input limits, PDF page quotas, signature changes and unsupported OCR, permanent redaction, password unlocking or cloud features. For the history of published source changes, inspect <a href="${SOURCE}/commits/main" rel="noopener noreferrer">repository commits</a>. A published workflow is not a promise of support for every PDF or device.</p>
    </section>
    <section aria-labelledby="trust-feedback"><h2 id="trust-feedback">Feedback, contribution and security concerns</h2>
      <p>Read the <a href="${SOURCE}/blob/main/docs/operations/PT-OPS-001-pr-task-workflow.md" rel="noopener noreferrer">contributor and pull-request workflow</a> to propose changes. Ordinary reproducible defects can be reported using <a href="${ISSUE}" rel="noopener noreferrer">public GitHub Issues</a>, with browser details, steps and only synthetic test files.</p>
      <p><strong>Never attach private, personal, financial, password-protected or confidential PDFs to public issues.</strong> For suspected security vulnerabilities, check the repository's <a href="${SOURCE}/security" rel="noopener noreferrer">Security page</a> for an enabled private reporting option before sending sensitive details. Private vulnerability reporting is not guaranteed to be available; public issues are not a confidential security inbox.</p>
    </section>`,
  },
  '/help': {
    heading: 'Help and frequently asked questions',
    body: `
    <p>PDF Tools is a free, open-source collection of document tools that run in your browser. The currently available tools do not require an account and do not send your selected file contents to a conversion server.</p>
    <section><h2>Get started in three steps</h2>
      <ol><li><a href="/pdf-tools/">Choose a working tool</a>. Use the category list if you are unsure which action you need.</li>
      <li>Choose files from your device, review the displayed order, supported file types, limits and output settings.</li>
      <li>Process the files, check the result and save your downloaded copy. Use Start over to clear the current workspace references; this does not delete your originals or downloaded files.</li></ol>
    </section>
    <section><h2>Choose the right PDF task</h2><ul>
      <li><a href="/pdf-tools/merge/">Merge PDFs</a> combines several documents in the order shown.</li>
      <li><a href="/pdf-tools/split/">Split PDF</a> creates separate files from page ranges or fixed-size parts.</li>
      <li><a href="/pdf-tools/extract-pages/">Extract pages</a> keeps chosen pages together. <a href="/pdf-tools/delete-pages/">Delete pages</a> removes whole pages from a copy, not sensitive content elsewhere.</li>
      <li><a href="/pdf-tools/organize/">Organize pages</a> reorders, rotates and duplicates pages with a review step.</li>
      <li><a href="/pdf-tools/images-to-pdf/">JPG/PNG to PDF</a> assembles supported images. <a href="/pdf-tools/pdf-to-jpg/">PDF to JPG</a> and <a href="/pdf-tools/pdf-to-png/">PDF to PNG</a> export rendered pages as images.</li>
      <li><a href="/pdf-tools/reader/">PDF Reader</a> reads, navigates, searches existing text and prints. <a href="/pdf-tools/pdf-to-text/">PDF to text</a> exports an existing selectable text layer; it does not perform OCR.</li>
      <li><a href="/pdf-tools/doc-info/">Document information</a> inspects page dimensions and metadata without rewriting a PDF.</li>
      <li><a href="/pdf-tools/page-numbers/">Page numbers</a> and <a href="/pdf-tools/watermark/">Watermark</a> add visible marks to a new PDF copy.</li>
    </ul></section>
    <section><h2>Frequently asked questions</h2>
      <h3>Are my documents uploaded?</h3><p>Selected document contents are processed by the shipped tools within this browser. Loading this website and its assets still makes requests to GitHub Pages. Read the <a href="/pdf-tools/privacy/">privacy notice</a> for the distinction.</p>
      <h3>Why is my PDF rejected?</h3><p>Check that it is a supported file, not empty or encrypted, and within the limits shown for the tool. The common input limit is 50 MiB per file and 300 PDF pages. Some workflows have tighter output, memory or page constraints. This release does not unlock password-protected PDFs.</p>
      <h3>Why is there no text in my exported file?</h3><p>Scanned pages may contain only images. PDF to text extracts existing text, not text recognized from images. OCR is not available in the shipped release.</p>
      <h3>Does removing pages or adding a watermark make a document private?</h3><p>No. Page removal is not content redaction; a visible watermark does not hide or securely erase underlying content. Keep originals and review every page of the output.</p>
      <h3>Will my signed PDF stay signed?</h3><p>Rewriting a PDF can invalidate digital signatures and can omit interactive fields, annotations, bookmarks or metadata. Signed documents should be checked independently. The app does not certify signature validity.</p>
      <h3>Where are my results?</h3><p>Use the Download control to save verified results to your device. Browser download folders and any files you print or save are outside the app's reset control.</p>
    </section>
    <section><h2>Report a problem</h2><p>For reproducible bugs or feature feedback, open a <a href="${ISSUE}" rel="noopener noreferrer">public GitHub issue</a>. Include browser and OS versions, the tool, steps and a synthetic example you created. <strong>Never post personal, confidential, password-protected or financial documents, names or document screenshots publicly.</strong> Issues are public and are not a secure support inbox.</p></section>
    <p>Read <a href="/pdf-tools/limitations/">supported formats and limitations</a> and <a href="${LICENSE}" rel="noopener noreferrer">the MIT license</a>.</p>`,
  },
  '/privacy': {
    heading: 'Privacy and local processing',
    body: `
    <p><strong>Scope:</strong> This notice describes the currently shipped static PDF Tools website and browser-based document workflows, not an unrelated third-party service. It is a technical transparency notice; it is not a claim of legal certification or anonymity.</p>
    <section><h2>What happens to your selected files</h2>
      <p>The shipped tools read selected PDFs or JPG/PNG images and perform their documented operations in your browser. The site does not send selected PDF bytes, text, filenames or processing settings to a document-conversion backend. You do not need an account to use these local tools.</p>
      <p>File contents, previews and results are held in temporary browser memory while needed. Start over or leaving a workspace clears the app's references and revokes its temporary download URLs where possible. This does <strong>not</strong> guarantee secure erasure from device memory, browser caches, operating-system swap or backups. Original files and results already downloaded to your device are not deleted.</p>
    </section>
    <section><h2>Network requests and hosting</h2>
      <p>GitHub Pages hosts the public HTML, JavaScript, styles, icons, fonts and local PDF processing engine assets. Your browser therefore contacts GitHub Pages to load the site, which can expose your IP address and standard request information to the host. We do not control GitHub's underlying server logs or retention. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" rel="noopener noreferrer">GitHub's privacy statement</a>.</p>
      <p>Following links to GitHub issues, source code or external documentation also takes you to those sites under their own policies. Downloading the publicly offered synthetic examples requests those example files from GitHub Pages.</p>
    </section>
    <section><h2>Storage and tracking in this app</h2>
      <p>This release intentionally avoids saving selected document contents in localStorage, sessionStorage, IndexedDB, cookies or a cloud workspace. It does not embed an on-site analytics tracker or document-processing telemetry. Language selection is held in memory only, so it resets after a full page reload. Browser history, downloads and normal browser/platform operations are separate from app storage.</p>
      <p>Printing uses your browser and operating system's print facilities. Choosing a printer or a PDF output location may involve services outside this site's control.</p>
    </section>
    <section><h2>Your choices and limitations</h2>
      <p>You can close the tab, use Start over, keep your originals, and refrain from following external links. Avoid using public issue trackers to share private documents. For extra confidence, inspect the <a href="${SOURCE}" rel="noopener noreferrer">MIT-licensed source code</a> and the <a href="${AUDIT}" rel="noopener noreferrer">local-processing audit</a>. Neither constitutes an independent security certification.</p>
      <p>This page may require further publisher/contact details before it can serve as a complete jurisdiction-specific legal privacy notice. Do not interpret it as a GDPR compliance certificate.</p>
    </section>
    <p>For supported workflows and feature loss warnings, see <a href="/pdf-tools/limitations/">limitations</a> or <a href="/pdf-tools/help/">help</a>.</p>`,
  },
  '/limitations': {
    heading: 'Supported features and limitations',
    body: `
    <p>These limits reflect the working browser-based PDF Tools release, not every format or capability shown on a roadmap. Keep your original files until you have checked the new result.</p>
    <section><h2>Inputs, outputs and performance</h2><ul>
      <li>PDF inputs and static JPG/PNG images are supported by the corresponding live tools. HEIC, Office conversion, OCR, password unlocking, permanent redaction, certificate signing and universal conversion are <strong>not</strong> shipped here.</li>
      <li>The common per-file input ceiling is <strong>50 MiB</strong> (52,428,800 bytes) and supported PDF inputs are generally limited to <strong>300 pages</strong>. Individual tools may impose tighter limits on total pages, number of files, outputs, resolution or memory; follow the limits displayed in each workspace.</li>
      <li>Large files, complex fonts, image-heavy pages and low-memory phones may process slowly, time out or fail. Device and browser capabilities vary; no universal no-crash or fidelity guarantee is made.</li>
      <li>JPG and PNG exports render PDF page appearance as pixels; they do not preserve selectable text or necessarily extract original embedded images. PDF-to-text exports existing text only; it does not recognize scanned text or preserve original layout.</li>
    </ul></section>
    <section><h2>PDF fidelity and signatures</h2>
      <p>A modified PDF copy can invalidate cryptographic signatures and can omit or change interactive forms, annotations, bookmarks, JavaScript actions and some metadata. Output verification checks supported properties; it does not prove every object or interactive feature has been preserved. The document-information inspector reports indicators rather than validating a signature certificate.</p>
      <p>Deleting whole pages does not redact information elsewhere in a PDF. An overlaid watermark is not encryption, redaction or tamper protection. Cropping or covering content should never be assumed to securely remove it. Use a separately validated redaction workflow when secure removal is required.</p>
    </section>
    <section><h2>Local-processing boundaries</h2>
      <p>Local browser execution does not mean offline by default: site assets come from GitHub Pages, and browser visits reveal network metadata to the host. Start over does not erase originals, downloaded files or every possible memory/cache copy. There is no account, cloud sync, persistent on-site file history, backend processing or paid conversion tier in this release.</p>
      <p>For a practical walkthrough, read the <a href="/pdf-tools/help/">help and FAQ</a>. For network and temporary-memory details, read <a href="/pdf-tools/privacy/">privacy and local processing</a>.</p>
    </section>
    <section><h2>License and reporting</h2><p>The project is open source under the <a href="${LICENSE}" rel="noopener noreferrer">MIT license</a>. Source and limitations can be inspected in the <a href="${SOURCE}" rel="noopener noreferrer">public repository</a>. Report reproducible issues with synthetic files only through <a href="${ISSUE}" rel="noopener noreferrer">GitHub Issues</a>; do not attach private or confidential documents to public reports.</p></section>`,
  },
}

export function publicInfoHtml(path: string): string | undefined {
  const page = pages[path]
  if (!page) return undefined
  return `<nav class="workspace-breadcrumb" aria-label="Breadcrumb"><a href="/pdf-tools/">All PDF tools</a><span aria-hidden="true">/</span><span aria-current="page">${page.heading}</span></nav><article class="guide-content public-info" lang="en"><header><h1>${page.heading}</h1></header>${page.body}</article>`
}
