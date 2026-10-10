import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mupdf from "mupdf";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(HERE, "../../fixtures/pdf");
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

const inputPath = path.join(PDF_DIR, "F-001-plain-text-3p.pdf");
const doc = mupdf.PDFDocument.openDocument(inputPath);

console.log("Page count:", doc.countPages());

const page = doc.loadPage(0);

// Search for text
const quads = page.search("PACKING-BOX-0001", {});

if (quads.length > 0 && quads[0].length > 0) {
  for (const quad of quads[0]) {
    // Use setRect with the quad rect
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    
    const annot = page.createAnnotation("Redact");
    annot.setRect(rect);
    // Try setting the quad points instead
    annot.setQuadPoints([quad]);
    annot.setColor([1, 0, 0]);
    annot.update();
  }
  
  // Try different applyRedactions parameters
  // text_method: 0 = REDACT_TEXT_REMOVE (default), 1 = REDACT_TEXT_NONE
  // image_method: 1 = REDACT_IMAGE_REMOVE, 2 = REDACT_IMAGE_PIXELS
  // line_art_method: 1 = REMOVE_IF_COVERED, 2 = REMOVE_IF_TOUCHED
  page.applyRedactions(true, 1, 1, 0); // black_boxes, image_method, line_art_method, text_method
  page.update();
  
  doc.save(path.join(OUT_DIR, "debug-redacted7.pdf"));
  doc.destroy();
  
  // Check raw content after redaction
  const rawBytes = fs.readFileSync(path.join(OUT_DIR, "debug-redacted7.pdf"));
  const rawText = rawBytes.toString("binary");
  console.log("After redaction - raw contains PACKING-BOX-0001:", rawText.includes("PACKING-BOX-0001"));
  
  // Check page content stream
  const doc2 = mupdf.PDFDocument.openDocument(path.join(OUT_DIR, "debug-redacted7.pdf"));
  const page2 = doc2.loadPage(0);
  const pageObj2 = page2.getObject();
  const contents2 = pageObj2.get("Contents");
  let streamObj2 = contents2.isArray() ? contents2.get(0) : contents2;
  const streamDataAfter = streamObj2.readStream();
  const afterText = streamDataAfter.asString();
  console.log("After redaction - stream contains PACKING-BOX-0001:", afterText.includes("PACKING-BOX-0001"));
  doc2.destroy();
} else {
  console.log("No quads found");
  doc.destroy();
}
