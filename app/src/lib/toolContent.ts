import type { ToolId } from '../registry.ts'

/** Public editorial copy only: never populated from a selected file. */
export const TOOL_CONTENT = {
  "merge": {
    "intro": "Combine separate PDFs into one reading sequence, such as a cover letter followed by supporting documents. File order determines the order of the combined pages.",
    "steps": [
      "Choose at least two PDFs.",
      "Arrange the files in the order you want and review the merge order.",
      "Select Merge PDFs, then download the verified new file."
    ],
    "formats": "PDF files in; one combined PDF out.",
    "limit": "Each input is limited to 50 MB and 300 pages. The merged result is limited to 300 pages.",
    "example": "For two synthetic PDFs containing 2 and 3 pages, placing the 2-page file first creates a 5-page PDF in that sequence.",
    "faq": {
      "question": "Does merging change my originals?",
      "answer": "No. The tool creates a separate file. Keep your originals: interactive forms, annotations, bookmarks and metadata may not survive rewriting, and digital signatures can be invalidated."
    }
  },
  "split": {
    "intro": "Separate a PDF into smaller documents for sharing specific sections. Split by explicit page ranges, a fixed number of pages per part, or one PDF per page.",
    "steps": [
      "Choose one PDF and a split mode.",
      "Enter ranges or the number of pages per part, then review the planned parts.",
      "Split the PDF and download the ZIP containing the new PDFs."
    ],
    "formats": "One PDF in; a ZIP of PDF parts out.",
    "limit": "Up to 50 MB and 300 pages per input. Every requested page must exist in the source.",
    "example": "With a synthetic 3-page PDF, choosing one file per page produces a ZIP containing three single-page PDFs.",
    "faq": {
      "question": "Can I download one combined PDF instead?",
      "answer": "Split produces separate documents inside a ZIP. Use Extract pages when you want selected pages together in one PDF."
    }
  },
  "rotate": {
    "intro": "Correct sideways pages without rotating the rest of a document. Rotate selected pages in 90-degree steps and review their orientation before creating a copy.",
    "steps": [
      "Choose a PDF.",
      "Select the pages to rotate and use the rotation controls.",
      "Review the preview, create the rotated copy and download it."
    ],
    "formats": "One PDF in; one rotated PDF out.",
    "limit": "Up to 50 MB and 300 pages. Rotation is in quarter turns; this is not a free-angle deskew tool.",
    "example": "In a synthetic 3-page PDF, rotate only page 2 by 90 degrees; pages 1 and 3 keep their original orientation.",
    "faq": {
      "question": "Can this straighten a slightly tilted scan?",
      "answer": "No. This tool rotates pages in 90-degree steps. It does not deskew scanned text or edit the pixels within a page."
    }
  },
  "delete-pages": {
    "intro": "Remove whole pages from a new copy of a PDF. Review the marked pages carefully, especially when source page numbers differ from printed page labels.",
    "steps": [
      "Choose a PDF and mark pages to remove using thumbnails or ranges.",
      "Review and confirm the deletion selection; keep at least one page.",
      "Create the new copy and download the verified PDF."
    ],
    "formats": "One PDF in; one PDF containing the remaining pages out.",
    "limit": "Up to 50 MB and 300 pages. Removing every page is not allowed.",
    "example": "Remove page 2 from a synthetic 3-page PDF to produce a copy containing source pages 1 and 3.",
    "faq": {
      "question": "Is deleting pages a redaction tool?",
      "answer": "No. It removes selected whole pages from the new copy. It does not securely redact words, images or hidden information elsewhere in the document."
    }
  },
  "extract-pages": {
    "intro": "Make a focused PDF from selected source pages without changing the original. Page numbers and ranges let you specify the output sequence.",
    "steps": [
      "Choose one PDF.",
      "Enter page numbers or ranges, or select thumbnails, then review the output order.",
      "Create and download the extracted PDF."
    ],
    "formats": "One PDF in; one PDF of selected pages out.",
    "limit": "Up to 50 MB and 300 pages. Repeated page numbers are included once.",
    "example": "For a synthetic 3-page PDF, the selection 3, 1 creates a two-page copy with source page 3 before source page 1.",
    "faq": {
      "question": "How do I create separate files for each page?",
      "answer": "Use Split PDF with one file per page. Extract pages combines your chosen pages into a single new PDF."
    }
  },
  "organize": {
    "intro": "Arrange a document by reordering, rotating, duplicating or removing pages. Undo lets you reverse layout changes before creating the output.",
    "steps": [
      "Choose one PDF to load its page previews.",
      "Use the page controls to change the order, orientation or included pages; review the sequence.",
      "Create the organized copy and download it."
    ],
    "formats": "One PDF in; one reorganized PDF out.",
    "limit": "Up to 50 MB and 300 pages. Keep at least one output page and follow the output-page limit shown in the utility.",
    "example": "Move page 3 before page 1 in a synthetic 3-page PDF to review the sequence 3, 1, 2 before saving.",
    "faq": {
      "question": "Does organizing edit the text inside a page?",
      "answer": "No. It changes the arrangement and orientation of whole pages. It does not edit paragraphs, repair scanned text or add OCR."
    }
  },
  "images-to-pdf": {
    "intro": "Collect JPG and PNG images into a PDF with one image per page. Choose page size, orientation, margins and how each image fits on the page.",
    "steps": [
      "Choose static JPG or PNG images and arrange their order.",
      "Set page size, fit and margins, then review the layout previews.",
      "Create the PDF and download the verified file."
    ],
    "formats": "Static JPG and PNG images in; one PDF out.",
    "limit": "Up to 300 images and 50 MB total, with 16 million pixels per image and 25.6 million pixels across the selection. Animated images are not supported.",
    "example": "Choose two synthetic PNGs to create a two-page PDF. Fit keeps the whole image; Fill crops the center to cover the area inside the margins.",
    "faq": {
      "question": "Will the PDF contain searchable text?",
      "answer": "Images remain images. This tool does not recognize text with OCR. Keep the original images if you need them separately later."
    }
  },
  "pdf-to-jpg": {
    "intro": "Render PDF pages as JPG images for use in presentations or image-based workflows. Resolution and JPG quality affect detail and the encoded download size.",
    "steps": [
      "Choose a PDF and select pages to render.",
      "Set the resolution and JPG quality, then review the conversion settings.",
      "Create images and download them individually or as a ZIP."
    ],
    "formats": "One PDF in; JPG page images and an optional ZIP out.",
    "limit": "PDF up to 50 MB and 300 pages. Each image is limited to 8192 pixels per side and 16 million pixels; encoded images total at most 50 MB.",
    "example": "Select page 2 of a synthetic 3-page PDF to create a JPG of that page only. A higher DPI needs more pixel memory.",
    "faq": {
      "question": "Does this extract the original photographs embedded in a PDF?",
      "answer": "No. It renders the visible page as a new image. JPG uses lossy compression and cannot preserve searchable PDF text or a transparent background."
    }
  },
  "pdf-to-png": {
    "intro": "Render selected PDF pages to PNG when you want lossless page images or an explicit background choice. The output represents page appearance rather than editable PDF objects.",
    "steps": [
      "Choose a PDF and the pages to convert.",
      "Select resolution and a white or transparent background.",
      "Create PNGs and download individual images or the ZIP."
    ],
    "formats": "One PDF in; PNG page images and an optional ZIP out.",
    "limit": "PDF up to 50 MB and 300 pages. Each image is limited to 8192 pixels per side and 16 million pixels; encoded images total at most 50 MB.",
    "example": "Select pages 1 and 3 from a synthetic 3-page PDF to generate two PNGs in that selection order.",
    "faq": {
      "question": "Does transparent background remove white objects?",
      "answer": "No. It leaves unpainted page areas transparent. White artwork or backgrounds painted by the source document can remain white."
    }
  },
  "reader": {
    "intro": "Read a PDF without converting it first. Navigate pages, zoom, search the existing text layer, select text and prepare a local print copy.",
    "steps": [
      "Choose a PDF to open in the reader.",
      "Navigate or zoom, and use Search this PDF to find existing text.",
      "Copy selected text or choose a print range and prepare the print pages."
    ],
    "formats": "One PDF in; an on-screen reading view and optional browser print copy.",
    "limit": "Up to 50 MB and 300 pages. Printing uses 96 DPI and a 64 MB retained-pixel budget; select a smaller print range for long documents.",
    "example": "Search for a word in a synthetic text PDF, choose a matching page, then print only that page rather than the entire document.",
    "faq": {
      "question": "Why can I not find words on a scanned page?",
      "answer": "Search needs an existing text layer. Image-only scans require OCR, which is not provided here. PDF scripts are not run, and the reader is not a form editor."
    }
  },
  "page-numbers": {
    "intro": "Add visible page numbers to selected pages in a new PDF. Choose a starting number, placement and appearance, then inspect the modified preview before applying.",
    "steps": [
      "Choose a PDF and the pages to number.",
      "Set the starting number, position and style; wait for the updated preview.",
      "Review placement, apply page numbers and download the new copy."
    ],
    "formats": "One PDF in; one PDF with visible added numbers out.",
    "limit": "Up to 50 MB and 300 pages. Numbering applies to selected pages; unselected pages stay unchanged.",
    "example": "For a synthetic 3-page PDF, select all pages and start at 5 to add the visible numbers 5, 6 and 7.",
    "faq": {
      "question": "Does this change PDF page labels or a table of contents?",
      "answer": "No. It adds visible text to the selected pages. It does not update bookmarks, printed cross-references or internal PDF page-label metadata."
    }
  },
  "watermark": {
    "intro": "Add a visible text stamp such as DRAFT to selected pages. Position, font size and opacity help you keep the stamp away from important source content.",
    "steps": [
      "Choose a PDF and enter watermark text.",
      "Choose pages, position and opacity, then wait for the modified preview.",
      "Review the placement, apply the watermark and download a separate copy."
    ],
    "formats": "One PDF in; one PDF with added text watermarks out.",
    "limit": "Up to 50 MB and 300 pages. Text watermarks only; unsupported characters need correction or the offered explicit replacement.",
    "example": "Apply the text DRAFT to all pages of a synthetic 3-page PDF, using the preview to check that it does not obscure important content.",
    "faq": {
      "question": "Does a watermark prevent copying or hide confidential text?",
      "answer": "No. A visible watermark is not encryption, access control or redaction. Underlying text and images remain; do not use a stamp to conceal sensitive information."
    }
  },
  "pdf-to-text": {
    "intro": "Export a PDF’s existing text layer as a UTF-8 text file. This is useful for reading or reusing text when the PDF already contains machine-readable characters.",
    "steps": [
      "Choose a PDF with an existing text layer.",
      "Select Export text, then review the extraction report and any pages without usable text.",
      "Download the UTF-8 TXT file when text is available."
    ],
    "formats": "One PDF in; one UTF-8 TXT file out.",
    "limit": "Up to 50 MB and 300 pages. Image-only scans need OCR; complex columns and layouts may not retain their visual reading order.",
    "example": "Export a synthetic 3-page text PDF, then open the TXT file to review its characters and page text. Images and original page styling are not included.",
    "faq": {
      "question": "Can this convert a scanned PDF or create a Word document?",
      "answer": "No. It does not recognize text in images and does not create DOCX files. Extraction quality depends on the text and font information present in the source PDF."
    }
  },
  "doc-info": {
    "intro": "Inspect a PDF before deciding how to use it. View metadata, page count, visible cropped dimensions, rotation and document indicators without rewriting the file.",
    "steps": [
      "Choose a PDF and select Inspect PDF.",
      "Review the summary, metadata and document indicators.",
      "Browse the page-dimension table when a full report is available."
    ],
    "formats": "One PDF in; an on-screen information report. No modified PDF is produced.",
    "limit": "Up to 50 MB and 300 pages for normal inspection. Password-protected files show a limited report; password entry and certificate validation are not supported.",
    "example": "Inspect a synthetic 3-page PDF to compare each page’s visible size and rotation. Dimensions are shown in points and millimetres.",
    "faq": {
      "question": "Do metadata and signature indicators prove authenticity?",
      "answer": "No. Supplied metadata may be inaccurate or incomplete. A signature indicator is not cryptographic validation of identity, certificate trust or document integrity."
    }
  }
} as const satisfies Record<ToolId, { intro: string; steps: readonly string[]; formats: string; limit: string; example: string; faq: { question: string; answer: string } }>

export const LOCAL_PROCESSING = 'Document processing happens in this browser; files are not uploaded for conversion. The site and its assets are downloaded from the host, which can receive ordinary connection information such as your IP address. This is not a promise of anonymity. Use Start over or leave the tool to clear its working state; downloads you save remain on your device.'
export const REWRITE_WARNING = 'Keep your original PDF. Rewriting can invalidate digital signatures, and interactive forms, annotations, bookmarks and metadata may not be preserved.'
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
/** Same escaped, file-independent article for static HTML and the interactive view. */
export function toolArticleHtml(id: ToolId, title: string): string {
  const c = TOOL_CONTENT[id]
  const paragraph = (s: string) => `<p>${escape(s)}</p>`
  const rewrite = ['merge','split','rotate','delete-pages','extract-pages','organize','page-numbers','watermark'].includes(id)
  return `<section class="tool-article" aria-label="${escape(title)} guide"><h2>About ${escape(title)}</h2>${paragraph(c.intro)}<h3>How to use this tool</h3><ol>${c.steps.map(s => `<li>${escape(s)}</li>`).join('')}</ol><h3>Formats and limits</h3>${paragraph(c.formats)}${paragraph(c.limit)}${rewrite ? paragraph(REWRITE_WARNING) : ''}<h3>Example with a synthetic file</h3>${paragraph(c.example)}<h3>Common question</h3><h4>${escape(c.faq.question)}</h4>${paragraph(c.faq.answer)}<h3>Local processing and privacy</h3>${paragraph(LOCAL_PROCESSING)}</section>`
}
