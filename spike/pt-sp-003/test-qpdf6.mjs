import qpdfModule from "qpdf-wasm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(HERE, "../../fixtures/pdf");
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function loadPdfjs(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const task = getDocument({
    data,
    useSystemFonts: false,
    isEvalSupported: false,
    useWorkerFetch: false,
    standardFontDataUrl: new URL("pdfjs-dist/standard_fonts/", import.meta.url).pathname,
  });
  const doc = await task.promise;
  doc._task = task;
  return doc;
}

async function closePdfjs(doc) {
  await doc._task.destroy();
}

async function pdfjsPageCount(file) {
  const doc = await loadPdfjs(file);
  const n = doc.numPages;
  await closePdfjs(doc);
  return n;
}

async function extractTextPages(file) {
  const doc = await loadPdfjs(file);
  const texts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    texts.push(tc.items.map((it) => it.str).join(" "));
    page.cleanup();
  }
  await closePdfjs(doc);
  return texts;
}

async function test() {
  console.log("Loading qpdf-wasm (jsscheller)...");
  const qpdf = await qpdfModule();
  console.log("Loaded. Available:", Object.keys(qpdf));
  
  // Test encrypt
  const inputData = fs.readFileSync(path.join(PDF_DIR, "F-001-plain-text-3p.pdf"));
  qpdf.FS.writeFile("/input.pdf", inputData);
  
  try {
    const exitCode = qpdf.callMain([
      "--encrypt", "userpass", "ownerpass", "256",
      "--", "/input.pdf", "/encrypted-out.pdf"
    ]);
    console.log("Encrypt exit code:", exitCode);
    
    const encryptedData = qpdf.FS.readFile("/encrypted-out.pdf");
    fs.writeFileSync(path.join(OUT_DIR, "qpdf-jss-encrypted.pdf"), Buffer.from(encryptedData));
    console.log("Encrypted size:", encryptedData.length);
    
    // Verify decrypt
    qpdf.FS.writeFile("/encrypted-verify.pdf", encryptedData);
    const exitCode2 = qpdf.callMain([
      "--decrypt", "--password=userpass",
      "--", "/encrypted-verify.pdf", "/decrypted-verify.pdf"
    ]);
    console.log("Decrypt exit code:", exitCode2);
    
    if (exitCode2 === 0) {
      const decData = qpdf.FS.readFile("/decrypted-verify.pdf");
      fs.writeFileSync(path.join(OUT_DIR, "qpdf-jss-decrypted.pdf"), Buffer.from(decData));
      const pages = await pdfjsPageCount(path.join(OUT_DIR, "qpdf-jss-decrypted.pdf"));
      const texts = await extractTextPages(path.join(OUT_DIR, "qpdf-jss-decrypted.pdf"));
      console.log("Decrypted pages:", pages, "Content OK:", texts.join(" ").includes("PACKING-BOX-0001"));
    }
  } catch (e) {
    console.error("Test failed:", e);
  }
  
  // Test optimize
  const largeData = fs.readFileSync(path.join(PDF_DIR, "F-002-plain-text-30p.pdf"));
  qpdf.FS.writeFile("/large.pdf", largeData);
  
  try {
    const exitCode = qpdf.callMain([
      "--linearize", "--compress-streams=y", "--object-streams=generate",
      "--", "/large.pdf", "/optimized.pdf"
    ]);
    console.log("Optimize exit code:", exitCode);
    const optData = qpdf.FS.readFile("/optimized.pdf");
    fs.writeFileSync(path.join(OUT_DIR, "qpdf-jss-optimized.pdf"), Buffer.from(optData));
    
    const origSize = largeData.length;
    const optSize = optData.length;
    const reduction = ((origSize - optSize) / origSize * 100).toFixed(1);
    console.log(`Optimized: ${origSize} -> ${optSize} bytes (${reduction}% reduction)`);
    
    const pages = await pdfjsPageCount(path.join(OUT_DIR, "qpdf-jss-optimized.pdf"));
    console.log("Optimized pages:", pages, "(expected 30)");
  } catch (e) {
    console.error("Optimize failed:", e);
  }
}

test().catch(console.error);
