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

// Search for text first
const quads = page.search("PACKING-BOX-0001", {});

if (quads.length > 0 && quads[0].length > 0) {
  for (const quad of quads[0]) {  // quads[0] is the array of quads
    const xs = [quad[0], quad[2], quad[4], quad[6]];
    const ys = [quad[1], quad[3], quad[5], quad[7]];
    const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    console.log("Quad rect:", rect);
    
    const annot = page.createAnnotation("Redact");
    annot.setRect(rect);
    annot.setColor([1, 0, 0]);
    annot.update();
  }
  
  // Apply redactions BEFORE page.update()
  page.applyRedactions(true, 1, 1, 1);
  // Then update the page to reflect changes
  page.update();
  
  doc.save(path.join(OUT_DIR, "debug-redacted4.pdf"));
  doc.destroy();
  
  console.log("Saved. Checking...");
  
  // Check raw content
  const rawBytes = fs.readFileSync(path.join(OUT_DIR, "debug-redacted4.pdf"));
  const rawText = rawBytes.toString("binary");
  console.log("Raw contains PACKING-BOX-0001:", rawText.includes("PACKING-BOX-0001"));
  
  // Also check pdf.js text extraction
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(rawBytes);
  const task = getDocument({ data });
  const pdfjsDoc = await task.promise;
  for (let i = 1; i <= pdfjsDoc.numPages; i++) {
    const p = await pdfjsDoc.getPage(i);
    const tc = await p.getTextContent();
    const text = tc.items.map((it) => it.str).join(" ");
    console.log(`Page ${i} text:`, text.slice(0, 200));
  }
  await pdfjsDoc._task.destroy();
} else {
  console.log("No quads found");
  doc.destroy();
}
