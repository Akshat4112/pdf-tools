/**
 * PT-SP-003 — Compression and encryption engine spike.
 *
 * Evaluates qpdf WASM builds (and alternatives) for:
 *   A. AES-256 encryption / decryption (password protect / remove)
 *   B. PDF optimization / compression (linearize, compress-streams, object streams)
 *   C. Startup time, bundle size, license, browser compatibility
 *   D. Cross-reader verification of outputs (pdf.js re-parse)
 *
 * Uses the PT-PD-005 fixture corpus (in /tmp/pdf-tools/fixtures/pdf).
 *
 * Usage: node spike.mjs   (from spike/pt-sp-003)
 * Exit 0 = all checks pass. Exit 1 = failures recorded in the report.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PDF_DIR = path.join(ROOT, "fixtures/pdf");
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const report = { date: new Date().toISOString(), checks: results, engines: {} };

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

function recordEngine(name, info) {
  report.engines[name] = info;
  console.log(`  ENGINE ${name}: ${JSON.stringify(info)}`);
}

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

async function runEngineTests() {
  // Test each qpdf WASM package
  const engines = [
    { name: "qpdf-wasm", import: "qpdf-wasm" },
    { name: "@neslinesli93/qpdf-wasm", import: "@neslinesli93/qpdf-wasm" },
    { name: "qpdf-wasm-esm-embedded", import: "qpdf-wasm-esm-embedded" },
  ];

  for (const eng of engines) {
    console.log(`\n=== Testing ${eng.name} ===`);
    let qpdf;
    let loadTime = 0;
    
    try {
      const t0 = Date.now();
      const mod = await import(eng.import);
      loadTime = Date.now() - t0;
      qpdf = mod.default || mod;
      recordEngine(eng.name, { loadTimeMs: loadTime, loaded: true });
    } catch (e) {
      recordEngine(eng.name, { loadTimeMs: loadTime, loaded: false, error: e.message });
      record(`${eng.name} load`, false, e.message);
      continue;
    }

    // Test if the engine has the expected API
    const hasQpdf = typeof qpdf === "function" || (qpdf && typeof qpdf === "object");
    record(`${eng.name} has API`, hasQpdf, hasQpdf ? "function or object" : typeof qpdf);
    if (!hasQpdf) continue;

    // Try to initialize the WASM module
    let instance;
    try {
      const t0 = Date.now();
      if (typeof qpdf === "function") {
        instance = await qpdf();
      } else if (typeof qpdf.initialize === "function") {
        instance = await qpdf.initialize();
      } else if (typeof qpdf.create === "function") {
        instance = await qpdf.create();
      } else {
        throw new Error("Unknown initialization API");
      }
      const initTime = Date.now() - t0;
      recordEngine(eng.name, { ...report.engines[eng.name], initTimeMs: initTime, initialized: true });
      record(`${eng.name} init`, true, `${initTime}ms`);
    } catch (e) {
      recordEngine(eng.name, { ...report.engines[eng.name], initialized: false, error: e.message });
      record(`${eng.name} init`, false, e.message);
      continue;
    }

    // Test A: Encryption - encrypt a PDF with AES-256
    const plainPdf = path.join(PDF_DIR, "F-001-plain-text-3p.pdf");
    const encryptedOut = path.join(OUT_DIR, `${eng.name}-encrypted.pdf`);
    try {
      const t0 = Date.now();
      // qpdf CLI: --encrypt user-pass owner-pass 256 --
      // Need to figure out the WASM API
      const inputData = fs.readFileSync(plainPdf);
      let outputData;
      
      // Try different API patterns
      if (typeof instance.process === "function") {
        // qpdf-wasm-esm-embedded style
        outputData = await instance.process([
          "--encrypt", "userpass", "ownerpass", "256",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.run === "function") {
        // @neslinesli93/qpdf-wasm style
        outputData = await instance.run([
          "--encrypt", "userpass", "ownerpass", "256",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.exec === "function") {
        // qpdf-wasm (jsscheller) style
        outputData = await instance.exec([
          "--encrypt", "userpass", "ownerpass", "256",
          "--", "-", "-"
        ], inputData);
      } else {
        throw new Error("No recognized process/run/exec method");
      }
      
      const encryptTime = Date.now() - t0;
      fs.writeFileSync(encryptedOut, Buffer.from(outputData));
      record(`${eng.name} AES-256 encrypt`, true, `${encryptTime}ms, ${outputData.length}B`);
      recordEngine(eng.name, { ...report.engines[eng.name], encryptTimeMs: encryptTime, encryptWorks: true });
    } catch (e) {
      record(`${eng.name} AES-256 encrypt`, false, e.message);
      recordEngine(eng.name, { ...report.engines[eng.name], encryptWorks: false, encryptError: e.message });
    }

    // Test B: Decryption - remove password from encrypted PDF
    const encryptedPdf = path.join(PDF_DIR, "F-010-encrypted-aes256.pdf");
    const decryptedOut = path.join(OUT_DIR, `${eng.name}-decrypted.pdf`);
    try {
      const t0 = Date.now();
      const inputData = fs.readFileSync(encryptedPdf);
      let outputData;
      
      if (typeof instance.process === "function") {
        outputData = await instance.process([
          "--decrypt", "--password=userpass",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.run === "function") {
        outputData = await instance.run([
          "--decrypt", "--password=userpass",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.exec === "function") {
        outputData = await instance.exec([
          "--decrypt", "--password=userpass",
          "--", "-", "-"
        ], inputData);
      } else {
        throw new Error("No recognized process/run/exec method");
      }
      
      const decryptTime = Date.now() - t0;
      fs.writeFileSync(decryptedOut, Buffer.from(outputData));
      record(`${eng.name} AES-256 decrypt`, true, `${decryptTime}ms, ${outputData.length}B`);
      recordEngine(eng.name, { ...report.engines[eng.name], decryptTimeMs: decryptTime, decryptWorks: true });
    } catch (e) {
      record(`${eng.name} AES-256 decrypt`, false, e.message);
      recordEngine(eng.name, { ...report.engines[eng.name], decryptWorks: false, decryptError: e.message });
    }

    // Test C: Optimization / compression
    const largePdf = path.join(PDF_DIR, "F-002-plain-text-30p.pdf");
    const optimizedOut = path.join(OUT_DIR, `${eng.name}-optimized.pdf`);
    try {
      const t0 = Date.now();
      const inputData = fs.readFileSync(largePdf);
      let outputData;
      
      if (typeof instance.process === "function") {
        outputData = await instance.process([
          "--linearize", "--compress-streams=y", "--object-streams=generate",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.run === "function") {
        outputData = await instance.run([
          "--linearize", "--compress-streams=y", "--object-streams=generate",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.exec === "function") {
        outputData = await instance.exec([
          "--linearize", "--compress-streams=y", "--object-streams=generate",
          "--", "-", "-"
        ], inputData);
      } else {
        throw new Error("No recognized process/run/exec method");
      }
      
      const optTime = Date.now() - t0;
      fs.writeFileSync(optimizedOut, Buffer.from(outputData));
      
      // Verify output is valid and smaller
      const originalSize = inputData.length;
      const optimizedSize = outputData.length;
      const ratio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
      
      const pageCount = await pdfjsPageCount(optimizedOut);
      const pagesOk = pageCount === 30;
      
      record(`${eng.name} optimize (linearize+compress)`, pagesOk, `${optimizedSize}B (${ratio}% reduction), ${optTime}ms, ${pageCount} pages`);
      recordEngine(eng.name, { 
        ...report.engines[eng.name], 
        optimizeTimeMs: optTime, 
        optimizeWorks: pagesOk,
        originalSize,
        optimizedSize,
        reductionPct: ratio,
        optimizedPages: pageCount
      });
    } catch (e) {
      record(`${eng.name} optimize`, false, e.message);
      recordEngine(eng.name, { ...report.engines[eng.name], optimizeWorks: false, optimizeError: e.message });
    }

    // Test D: Password removal (decrypt with known password)
    const encryptedPdf2 = path.join(PDF_DIR, "F-010-encrypted-aes256.pdf");
    const pwdRemovedOut = path.join(OUT_DIR, `${eng.name}-pwd-removed.pdf`);
    try {
      const t0 = Date.now();
      const inputData = fs.readFileSync(encryptedPdf2);
      let outputData;
      
      if (typeof instance.process === "function") {
        outputData = await instance.process([
          "--decrypt", "--password=userpass",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.run === "function") {
        outputData = await instance.run([
          "--decrypt", "--password=userpass",
          "--", "-", "-"
        ], inputData);
      } else if (typeof instance.exec === "function") {
        outputData = await instance.exec([
          "--decrypt", "--password=userpass",
          "--", "-", "-"
        ], inputData);
      } else {
        throw new Error("No recognized process/run/exec method");
      }
      
      const pwdTime = Date.now() - t0;
      fs.writeFileSync(pwdRemovedOut, Buffer.from(outputData));
      
      // Verify decrypted PDF is readable
      const pageCount = await pdfjsPageCount(pwdRemovedOut);
      const pagesOk = pageCount === 3;
      const texts = await extractTextPages(pwdRemovedOut);
      const contentOk = texts.join(" ").includes("PACKING-BOX-0001");
      
      record(`${eng.name} password removal + content verify`, pagesOk && contentOk, `${pageCount} pages, content=${contentOk}, ${pwdTime}ms`);
      recordEngine(eng.name, { 
        ...report.engines[eng.name], 
        pwdRemovalTimeMs: pwdTime, 
        pwdRemovalWorks: pagesOk && contentOk,
        pwdRemovalPages: pageCount,
        pwdRemovalContentOk: contentOk
      });
    } catch (e) {
      record(`${eng.name} password removal`, false, e.message);
      recordEngine(eng.name, { ...report.engines[eng.name], pwdRemovalWorks: false, pwdRemovalError: e.message });
    }
  }
}

// Cross-reader verification of all outputs
async function verifyOutputs() {
  console.log("\n=== Cross-reader verification ===");
  const outFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".pdf"));
  
  for (const file of outFiles) {
    try {
      const fullPath = path.join(OUT_DIR, file);
      const pageCount = await pdfjsPageCount(fullPath);
      const stats = fs.statSync(fullPath);
      record(`Verify ${file}`, pageCount > 0, `${pageCount} pages, ${stats.size}B`);
    } catch (e) {
      record(`Verify ${file}`, false, e.message);
    }
  }
}

// Measure bundle sizes
function measureBundleSizes() {
  console.log("\n=== Bundle size measurement ===");
  const engines = [
    { name: "qpdf-wasm", path: "node_modules/qpdf-wasm" },
    { name: "@neslinesli93/qpdf-wasm", path: "node_modules/@neslinesli93/qpdf-wasm" },
    { name: "qpdf-wasm-esm-embedded", path: "node_modules/qpdf-wasm-esm-embedded" },
  ];

  for (const eng of engines) {
    const fullPath = path.join(HERE, eng.path);
    if (fs.existsSync(fullPath)) {
      let totalSize = 0;
      function calcSize(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) calcSize(p);
          else totalSize += fs.statSync(p).size;
        }
      }
      calcSize(fullPath);
      recordEngine(eng.name, { ...report.engines[eng.name], bundleSizeBytes: totalSize, bundleSizeMB: (totalSize / 1024 / 1024).toFixed(2) });
      console.log(`  ${eng.name}: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    }
  }
}

async function main() {
  const t0 = Date.now();
  await runEngineTests();
  await verifyOutputs();
  measureBundleSizes();
  
  const fails = results.filter((r) => !r.pass).length;
  report.durationMs = Date.now() - t0;
  report.summary = { total: results.length, passed: results.length - fails, failed: fails };
  fs.writeFileSync(path.join(HERE, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\n== ${report.summary.passed}/${report.summary.total} checks passed, ${report.summary.failed} failed (${report.durationMs}ms) ==`);
  process.exit(fails ? 1 : 0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
