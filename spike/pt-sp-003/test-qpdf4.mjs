import qpdfModule from "@neslinesli93/qpdf-wasm";
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
  console.log("Loading @neslinesli93/qpdf-wasm...");
  const wasmPath = path.join(HERE, "node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm");
  const qpdf = await qpdfModule({ locateFile: () => wasmPath });
  console.log("Loaded.");

  // Test 1: Encrypt plain PDF with AES-256
  console.log("\n=== Test 1: AES-256 Encryption ===");
  const inputData = fs.readFileSync(path.join(PDF_DIR, "F-001-plain-text-3p.pdf"));
  qpdf.FS.writeFile("/input.pdf", inputData);
  
  let exitCode = qpdf.callMain([
    "--encrypt", "userpass", "ownerpass", "256",
    "--", "/input.pdf", "/encrypted-out.pdf"
  ]);
  console.log("Encrypt exit code:", exitCode);
  
  const encryptedData = qpdf.FS.readFile("/encrypted-out.pdf");
  fs.writeFileSync(path.join(OUT_DIR, "qpdf-encrypted.pdf"), Buffer.from(encryptedData));
  console.log("Encrypted size:", encryptedData.length);
  
  // Verify encrypted PDF is readable with password
  qpdf.FS.writeFile("/encrypted-verify.pdf", encryptedData);
  exitCode = qpdf.callMain([
    "--decrypt", "--password=userpass",
    "--", "/encrypted-verify.pdf", "/decrypted-verify.pdf"
  ]);
  console.log("Decrypt (verify) exit code:", exitCode);
  if (exitCode === 0) {
    const decData = qpdf.FS.readFile("/decrypted-verify.pdf");
    fs.writeFileSync(path.join(OUT_DIR, "qpdf-decrypted-verify.pdf"), Buffer.from(decData));
    const pages = await pdfjsPageCount(path.join(OUT_DIR, "qpdf-decrypted-verify.pdf"));
    const texts = await extractTextPages(path.join(OUT_DIR, "qpdf-decrypted-verify.pdf"));
    console.log("Decrypted pages:", pages, "Content OK:", texts.join(" ").includes("PACKING-BOX-0001"));
  }

  // Test 2: Decrypt the fixture encrypted PDF (need to find correct password)
  console.log("\n=== Test 2: Decrypt Fixture PDF ===");
  const fixtureEnc = fs.readFileSync(path.join(PDF_DIR, "F-010-encrypted-aes256.pdf"));
  qpdf.FS.writeFile("/fixture-enc.pdf", fixtureEnc);
  
  // Try common passwords
  for (const pwd of ["userpass", "ownerpass", "password", "test", ""]) {
    qpdf.FS.writeFile("/fixture-enc-test.pdf", fixtureEnc);
    try {
      exitCode = qpdf.callMain([
        "--decrypt", `--password=${pwd}`,
        "--", "/fixture-enc-test.pdf", "/fixture-dec.pdf"
      ]);
      if (exitCode === 0) {
        console.log(`Decrypt with password "${pwd}" succeeded!`);
        const decData = qpdf.FS.readFile("/fixture-dec.pdf");
        fs.writeFileSync(path.join(OUT_DIR, "qpdf-fixture-decrypted.pdf"), Buffer.from(decData));
        const pages = await pdfjsPageCount(path.join(OUT_DIR, "qpdf-fixture-decrypted.pdf"));
        const texts = await extractTextPages(path.join(OUT_DIR, "qpdf-fixture-decrypted.pdf"));
        console.log("Pages:", pages, "Content:", texts.join(" ").slice(0, 100));
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  // Test 3: Optimize (linearize + compress)
  console.log("\n=== Test 3: Optimization ===");
  const largeData = fs.readFileSync(path.join(PDF_DIR, "F-002-plain-text-30p.pdf"));
  qpdf.FS.writeFile("/large.pdf", largeData);
  
  exitCode = qpdf.callMain([
    "--linearize", "--compress-streams=y", "--object-streams=generate",
    "--", "/large.pdf", "/optimized.pdf"
  ]);
  console.log("Optimize exit code:", exitCode);
  const optData = qpdf.FS.readFile("/optimized.pdf");
  fs.writeFileSync(path.join(OUT_DIR, "qpdf-optimized.pdf"), Buffer.from(optData));
  
  const origSize = largeData.length;
  const optSize = optData.length;
  const reduction = ((origSize - optSize) / origSize * 100).toFixed(1);
  console.log(`Optimized: ${origSize} -> ${optSize} bytes (${reduction}% reduction)`);
  
  const pages = await pdfjsPageCount(path.join(OUT_DIR, "qpdf-optimized.pdf"));
  console.log("Optimized pages:", pages, "(expected 30)");

  // Test 4: Remove password from encrypted PDF (same as decrypt but verify output)
  console.log("\n=== Test 4: Password Removal (Encrypt -> Decrypt Roundtrip) ===");
  qpdf.FS.writeFile("/roundtrip-input.pdf", inputData);
  exitCode = qpdf.callMain([
    "--encrypt", "userpass", "ownerpass", "256",
    "--", "/roundtrip-input.pdf", "/roundtrip-enc.pdf"
  ]);
  console.log("Roundtrip encrypt:", exitCode);
  
  const roundtripEnc = qpdf.FS.readFile("/roundtrip-enc.pdf");
  qpdf.FS.writeFile("/roundtrip-enc2.pdf", roundtripEnc);
  exitCode = qpdf.callMain([
    "--decrypt", "--password=userpass",
    "--", "/roundtrip-enc2.pdf", "/roundtrip-dec.pdf"
  ]);
  console.log("Roundtrip decrypt:", exitCode);
  
  if (exitCode === 0) {
    const decData = qpdf.FS.readFile("/roundtrip-dec.pdf");
    fs.writeFileSync(path.join(OUT_DIR, "qpdf-roundtrip.pdf"), Buffer.from(decData));
    const pages = await pdfjsPageCount(path.join(OUT_DIR, "qpdf-roundtrip.pdf"));
    const texts = await extractTextPages(path.join(OUT_DIR, "qpdf-roundtrip.pdf"));
    console.log("Roundtrip pages:", pages, "Content preserved:", texts.join(" ").includes("PACKING-BOX-0001"));
  }

  // Test 5: Check if encrypted PDF is actually encrypted (pdf.js should reject)
  console.log("\n=== Test 5: Verify Encrypted PDF Rejected by pdf.js ===");
  try {
    await loadPdfjs(path.join(OUT_DIR, "qpdf-encrypted.pdf"));
    console.log("pdf.js opened encrypted PDF WITHOUT password - UNEXPECTED");
  } catch (e) {
    console.log("pdf.js correctly rejects encrypted PDF:", e.message.slice(0, 80));
  }

  // Test 6: Measure startup time
  console.log("\n=== Test 6: Startup Time ===");
  const startTime = Date.now();
  const qpdf2 = await qpdfModule({ locateFile: () => wasmPath });
  console.log("Second load time:", Date.now() - startTime, "ms");

  console.log("\n=== ALL TESTS COMPLETE ===");
}

test().catch(e => {
  console.error("Test error:", e);
  process.exit(1);
});
