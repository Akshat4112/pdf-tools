import { GUIDES, guideByPath, guideDirectoryHtml, guideHref, type Guide } from './guideCatalog.ts'
import { getTool } from '../registry.ts'

const sample = (file: string, label: string) => `<a class="guide-download" href="/pdf-tools/examples/${file}" download>${label}</a>`
const RELATED: Record<Guide['id'], Guide['id']> = {
  'combine-pdfs-in-order': 'share-selected-pages',
  'share-selected-pages': 'combine-pdfs-in-order',
  'images-to-readable-pdf': 'copy-text-or-scan',
  'copy-text-or-scan': 'images-to-readable-pdf',
}

/** Authored public copy, never populated from a selected file or URL query. */
const CONTENT: Record<Guide['id'], string> = {
  'combine-pdfs-in-order': `
    <p>A combined PDF should read in the order your recipient needs. Putting several files into one container is only the first step: a cover page at the end, a duplicated section or an upside-down page can make the result harder to use.</p>
    <h2>Start with a short reading plan</h2>
    <p>Decide which document comes first and whether each file belongs in full. For example, put a cover sheet before two supporting pages. If you need only part of a source document, extract those pages first, then merge the smaller copy. Keep the original files separately.</p>
    <h2>Try a three-page synthetic example</h2>
    <p>These samples contain invented labels and no personal information. Download the one-page cover and two-page appendix:</p>
    <div class="guide-samples">${sample('cover.pdf', 'Download synthetic cover PDF')}${sample('appendix.pdf', 'Download synthetic appendix PDF')}</div>
    <ol><li>Open Merge PDF and choose both sample files.</li><li>Arrange the cover before the appendix. File order becomes page order; selecting both at once does not replace this review.</li><li>Select Merge PDFs, then download the new file.</li><li>Open the result in PDF reader. It should have three pages: SYNTHETIC_COVER, SYNTHETIC_APPENDIX_1, then SYNTHETIC_APPENDIX_2.</li></ol>
    <h2>Correct a page inside the combined file</h2>
    <p>Merge changes the order of whole source files. If one page needs to move within the result, open the downloaded copy in Organize PDF. Review the page thumbnails, move the page, and create another new copy. Check the first page, every join between documents and the final page before sharing.</p>
    <h2>Check more than the page count</h2>
    <p>A three-page result can still be in the wrong order. Read the labels and inspect orientation, cropped content and any interactive elements you rely on. Rewriting can omit forms, annotations, bookmarks or metadata and can invalidate digital signatures. Keep signed originals and do not treat the combined copy as evidence that a signature remains valid.</p>
    <p>Each input is limited to 50 MB and 300 pages, and the combined output is limited to 300 pages. If the workflow rejects a file or reports verification failure, resolve that message before sharing a result. This workflow creates a separate file; it does not replace the sources on your device.</p>`,
  'share-selected-pages': `
    <p>If someone needs two pages from a larger document, sending the entire file can expose unrelated material. Start by deciding whether the recipient needs one combined excerpt or several separate documents, then review the new files before sending them.</p>
    <h2>Choose the output shape first</h2>
    <ul><li><strong>Extract pages</strong> keeps selected pages together in one new PDF, in the order you specify.</li><li><strong>Delete pages</strong> creates a copy without marked whole pages. You must retain at least one page.</li><li><strong>Split PDF</strong> creates separate PDFs inside a ZIP, using ranges, a fixed number of pages per part or one file per page.</li></ul>
    <h2>Make a two-page excerpt</h2>
    <p>The sample has three pages, visibly labelled SYNTHETIC_PAGE_1 through SYNTHETIC_PAGE_3.</p>
    <div class="guide-samples">${sample('pages.pdf', 'Download synthetic three-page PDF')}</div>
    <ol><li>Open Extract pages and choose the sample.</li><li>Enter <code>3, 1</code> in Pages to extract. Review the output plan: page 3 comes before page 1. Repeated numbers are included once.</li><li>Select Extract pages and download the new copy.</li><li>Read both output pages. The result should contain page 3 followed by page 1, with page 2 absent.</li></ol>
    <p>The number in the selection refers to the page position shown by the tool, which can differ from a number printed inside the document. Use thumbnails and visible labels to confirm you selected the intended pages.</p>
    <h2>Page deletion is not redaction</h2>
    <p>Removing a whole page does not securely remove a name, sentence or image from a page that remains. Covering text with a watermark is not redaction either. This release has no permanent redaction workflow. Do not use these page tools as proof that sensitive content, metadata or hidden information elsewhere in the file has been sanitized.</p>
    <h2>Review the actual copy you will send</h2>
    <p>Open the downloaded file, check its page count and sequence, and inspect every retained page. If the recipient needs separate files, use Split instead and open each PDF from the ZIP. Confirm you are attaching the new excerpt rather than the full original.</p>
    <p>Inputs are limited to 50 MB and 300 pages. Rewriting can change interactive features and invalidate digital signatures; retain the originals. Files are processed in this browser, but downloading this public sample or loading the site still connects to GitHub Pages.</p>`,
  'images-to-readable-pdf': `
    <p>Collecting images into one PDF can make a small set easier to read in sequence. The important choice is how each image fits on the page: a neat stack of pages is not useful if a cropped edge loses a label or small writing becomes unreadable.</p>
    <h2>Prepare supported images</h2>
    <p>Use static JPG or PNG files. HEIC images need conversion before this tool can accept them. Put the files in reading order, then review the previews; names and the order of selection are not a substitute for checking the visible sequence.</p>
    <h2>Compare layout using synthetic patterns</h2>
    <p>These are colored test patterns, not photographs or real documents. One is landscape (640 × 400 pixels) and the other is portrait (400 × 640 pixels).</p>
    <div class="guide-samples">${sample('landscape.png', 'Download synthetic landscape PNG')}${sample('portrait.png', 'Download synthetic portrait PNG')}</div>
    <ol><li>Open JPG/PNG to PDF and choose both PNGs.</li><li>For the reference result, choose Original image size, 96 DPI and 0-point margins. Keep landscape before portrait.</li><li>Review the two page previews, select Create PDF and download the new file.</li><li>Open it in PDF reader. Expect two pages: a landscape page measuring 480 × 300 points, followed by a portrait page measuring 300 × 480 points. Check that all four colored corners remain visible.</li></ol>
    <h2>Choose contain or crop deliberately</h2>
    <p>For a fixed A4 or Letter page, Fit entire image (contain) keeps the image within the available area and can leave blank space. Fill page — crop edges (cover) fills that area by trimming image edges. Use the preview to decide whether losing an edge is acceptable; choose contain when the whole document image matters. Margins reduce the area available for the image.</p>
    <h2>Check the result at reading size</h2>
    <p>For your own images, inspect small text, orientation and the edges of every page in the downloaded PDF. A larger page or a different DPI setting changes placement and physical dimensions; it does not create missing detail in a low-resolution image. If the source is blurred or clipped, replace it before building the final copy.</p>
    <p>This tool places images on PDF pages. It does not perform OCR or add a searchable text layer. Up to 300 images are allowed, with a 50 MB total file-size limit, 16 million pixels per image and 25.6 million pixels across the selection. If you later need selectable text from a scan, exporting text alone will not recognize it.</p>`,
  'copy-text-or-scan': `
    <p>A PDF can look like text while containing only a picture of a page. Text export reads an existing text layer; OCR recognizes writing inside an image. Knowing which kind of document you have helps explain an empty export without assuming the tool has lost visible content.</p>
    <h2>Check what can be selected or searched</h2>
    <p>Open the document in PDF reader and try searching for a visible word. Search works on existing text, not image pixels. An unsuccessful search is a clue to investigate, not a definitive classification: the word can be encoded differently or the PDF can have a partial or unusual text layer.</p>
    <h2>Try the text sample</h2>
    <div class="guide-samples">${sample('pages.pdf', 'Download synthetic three-page text PDF')}${sample('scan.pdf', 'Download synthetic image-only PDF')}</div>
    <ol><li>Open PDF to text and select the three-page text sample.</li><li>Select Export text and review the report and extracted-text preview.</li><li>Download the UTF-8 TXT file and open it in a text editor.</li><li>Check that SYNTHETIC_PAGE_1, SYNTHETIC_PAGE_2 and SYNTHETIC_PAGE_3 appear in that order, with each page’s sample sentence present.</li></ol>
    <h2>Recognize an empty image-only export</h2>
    <p>Start over, then try the image-only sample. Its page contains a colored pattern with no text layer, so there is no text to export. The utility reports the lack of extractable text rather than inventing a transcription. This release has no OCR tool; converting the scan to PNG and back to PDF will not recognize text.</p>
    <h2>Plain text does not preserve page layout</h2>
    <p>The result is TXT, not an editable Word document or a formatted reconstruction. Tables, columns, spacing and reading order can differ from the visual page. The export separates source pages with form-feed characters; an editor may display those as a control character or page break. Review the text against the source before reusing names, numbers or a multi-column passage.</p>
    <p>A document can mix text pages and scans. Check the report’s pages-without-text list and inspect those pages separately. A searchable scan may already contain an OCR text layer; its export can include errors from that earlier recognition step. Extraction does not prove that the text is complete or accurate.</p>
    <p>Inputs are limited to 50 MB and 300 pages. Processing happens in this browser, and the downloaded text is a new file. Keep the original PDF so you can compare content and layout.</p>`,
}

export function guideHtml(path: string): string | undefined {
  if (path === '/guides') return `<nav class="workspace-breadcrumb" aria-label="Breadcrumb"><a href="/pdf-tools/">All PDF tools</a><span aria-hidden="true">/</span><span aria-current="page">Guides</span></nav><header><h1>Practical PDF guides</h1><p>Complete a specific workflow, try small synthetic examples and check what the tools actually produce.</p></header>${guideDirectoryHtml('Choose a guide')}<p>All examples are invented and safe to download. Opening the website and downloading examples connects to GitHub Pages; processing your own documents remains in your browser.</p>`
  const guide = guideByPath(path)
  if (!guide) return undefined
  const related = GUIDES.find(item => item.id === RELATED[guide.id])!
  return `<nav class="workspace-breadcrumb" aria-label="Breadcrumb"><a href="/pdf-tools/">All PDF tools</a><span aria-hidden="true">/</span><a href="/pdf-tools/guides/">Guides</a><span aria-hidden="true">/</span><span aria-current="page">${guide.title}</span></nav><article class="guide-content"><header><p class="fl-eyebrow">PRACTICAL GUIDE</p><h1>${guide.title}</h1><p class="guide-intro">${guide.summary}</p></header><nav class="guide-tools" aria-label="Tools used in this guide">${guide.tools.map(id => `<a href="/pdf-tools${getTool(id).route}/">${getTool(id).title}</a>`).join('')}</nav>${CONTENT[guide.id]}<aside class="guide-next"><h2>Continue with another task</h2><a href="${guideHref(related)}">${related.title}</a><a href="/pdf-tools/guides/">Browse all PDF guides</a></aside></article>`
}
