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

// Get page content stream before redaction
const pageObj = page.getObject();
const contents = pageObj.get("Contents");
let streamObj = contents.isArray() ? contents.get(0) : contents;
const streamDataBefore = streamObj.readStream();
const originalText = streamDataBefore.asString();
console.log("Before redaction - stream contains PACKING-BOX-0001:", originalText.includes("PACKING-BOX-0001"));

// Search for text
const quads = page.search("PACKING-BOX-0001", {});

if (quads.length > 0 && quads[0].length > 0) {
  for (const quad of quads[0]) {
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    console.log("Quad rect:", rect);
    
    const annot = page.createAnnotation("Redact");
    annot.setRect(rect);
    annot.setColor([1, 0, 0]);
    annot.update();
  }
  
  // Apply redactions
  page.applyRedactions(true, 1, 1, 1);
  page.update();
  
  doc.save(path.join(OUT_DIR, "debug-redacted5.pdf"));
  doc.destroy();
  
  // Check raw content after redaction
  const rawBytes = fs.readFileSync(path.join(OUT_DIR, "debug-redacted5.pdf"));
  const rawText = rawBytes.toString("binary");
  console.log("After redaction - raw contains PACKING-BOX-0001:", rawText.includes("PACKING-BOX-0001"));
  
  // Also check the page content stream after redaction
  const doc2 = mupdf.PDFDocument.openDocument(path.join(OUT_DIR, "debug-redacted5.pdf"));
  const page2 = doc2.loadPage(0);
  const pageObj2 = page2.getObject();
  const contents2 = pageObj2.get("Contents");
  let streamObj2 = contents2.isArray() ? contents2.get(0) : contents2;
  const streamDataAfter = streamObj2.readStream();
  const afterText = streamDataAfter.asString();
  console.log("After redaction - stream contains PACKING-BOX-0001:", afterText.includes("PACKING-BOX-0001"));
  console.log("Stream after:", afterText.slice(0, 500));
  doc2.destroy();
} else {
  console.log("No quads found");
  doc.destroy();
}
