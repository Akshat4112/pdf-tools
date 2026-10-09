import qpdfModule from "qpdf-wasm-esm-embedded";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PDF_DIR = path.join(HERE, "../../fixtures/pdf");
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

async function test() {
  console.log("Loading qpdf-wasm-esm-embedded...");
  const qpdf = await qpdfModule();
  console.log("Loaded. Available:", Object.keys(qpdf));
  
  // Test encrypt
  const inputData = fs.readFileSync(path.join(PDF_DIR, "F-001-plain-text-3p.pdf"));
  const inputPath = "/input.pdf";
  const outputPath = "/output.pdf";
  
  // Write input to virtual FS
  qpdf.FS.writeFile(inputPath, inputData);
  console.log("Input written to FS");
  
  // Try encrypt
  try {
    const exitCode = qpdf.callMain([
      "--encrypt", "userpass", "ownerpass", "256",
      "--", inputPath, outputPath
    ]);
    console.log("Encrypt exit code:", exitCode);
    
    // Read output
    const outputData = qpdf.FS.readFile(outputPath);
    fs.writeFileSync(path.join(OUT_DIR, "test-encrypted.pdf"), Buffer.from(outputData));
    console.log("Encrypted PDF written, size:", outputData.length);
  } catch (e) {
    console.error("Encrypt failed:", e);
  }
  
  // Test decrypt
  const encData = fs.readFileSync(path.join(PDF_DIR, "F-010-encrypted-aes256.pdf"));
  qpdf.FS.writeFile("/encrypted.pdf", encData);
  try {
    const exitCode = qpdf.callMain([
      "--decrypt", "--password=userpass",
      "--", "/encrypted.pdf", "/decrypted.pdf"
    ]);
    console.log("Decrypt exit code:", exitCode);
    const decData = qpdf.FS.readFile("/decrypted.pdf");
    fs.writeFileSync(path.join(OUT_DIR, "test-decrypted.pdf"), Buffer.from(decData));
    console.log("Decrypted PDF written, size:", decData.length);
  } catch (e) {
    console.error("Decrypt failed:", e);
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
    fs.writeFileSync(path.join(OUT_DIR, "test-optimized.pdf"), Buffer.from(optData));
    console.log("Optimized PDF written, size:", optData.length, "vs original", largeData.length);
  } catch (e) {
    console.error("Optimize failed:", e);
  }
}

test().catch(console.error);
