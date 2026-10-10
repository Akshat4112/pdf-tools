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
const bounds = page.getBounds();
console.log("Page bounds:", bounds);

// Search for text first
const quads = page.search("PACKING-BOX-0001", {});
console.log("Search quads for PACKING-BOX-0001:", quads);

if (quads.length > 0) {
  for (const quad of quads) {
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    console.log("Quad rect:", rect);
    
    const annot = page.createAnnotation("Redact");
    annot.setRect(rect);
    annot.setColor([1, 0, 0]);
    annot.update();
  }
  
  page.update();
  page.applyRedactions(true, 1, 1, 1);
  page.update(); // Try update after redaction too
  
  doc.save(path.join(OUT_DIR, "debug-redacted.pdf"));
  doc.destroy();
  
  console.log("Saved. Checking...");
  
  // Check raw content
  const rawBytes = fs.readFileSync(path.join(OUT_DIR, "debug-redacted.pdf"));
  const rawText = rawBytes.toString("binary");
  console.log("Raw contains PACKING-BOX-0001:", rawText.includes("PACKING-BOX-0001"));
} else {
  console.log("No quads found");
  doc.destroy();
}
