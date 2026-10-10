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
    // Set quad points directly on the redaction annotation
    const annot = page.createAnnotation("Redact");
    annot.setQuadPoints([quad]); // Pass as array of quads
    annot.setColor([1, 0, 0]);
    annot.update();
  }
  
  // Apply redactions
  page.applyRedactions(true, 1, 1, 1);
  page.update();
  
  doc.save(path.join(OUT_DIR, "debug-redacted6.pdf"));
  doc.destroy();
  
  // Check raw content after redaction
  const rawBytes = fs.readFileSync(path.join(OUT_DIR, "debug-redacted6.pdf"));
  const rawText = rawBytes.toString("binary");
  console.log("After redaction - raw contains PACKING-BOX-0001:", rawText.includes("PACKING-BOX-0001"));
  
  // Check page content stream
  const doc2 = mupdf.PDFDocument.openDocument(path.join(OUT_DIR, "debug-redacted6.pdf"));
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
