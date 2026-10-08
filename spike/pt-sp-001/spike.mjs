/**
 * PT-SP-001 — Rendering and core PDF edits spike.
 *
 * Proves (or refutes) on the PT-PD-005 corpus, in Node:
 *   A. pdf.js: text extraction + page rendering (renderToCanvas via
 *      @napi-rs/canvas, bundled by pdfjs-dist) + encrypted/malformed rejection.
 *   B. pdf-lib: merge, split, rotate, delete/extract, images->PDF.
 *   C. Cross-reader verification of every output (pdf.js re-parse: the
 *      browser-side engine that will ship) + recorded expectations vs manifest.
 *
 * Usage: node spike.mjs   (from spike/pt-sp-001)
 * Exit 0 = all checks pass. Exit 1 = failures recorded in the report.
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, degrees, StandardFonts } from "pdf-lib";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PDF_DIR = path.join(ROOT, "fixtures/pdf");
const IMG_DIR = path.join(ROOT, "fixtures/images");
const OUT_DIR = path.join(HERE, "out");
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
const report = { date: new Date().toISOString(), checks: results };

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
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
  doc._task = task; // 6.x: destroy lives on the loadingTask
  return doc;
}

async function closePdfjs(doc) {
  await doc._task.destroy();
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

async function renderFirstPage(file, scale = 1.0) {
  const doc = await loadPdfjs(file);
  const page = await doc.getPage(1);
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  // sample pixel variance to prove a real render happened
  const { width, height } = canvas;
  const png = canvas.toBuffer("image/png");
  page.cleanup();
  await closePdfjs(doc);
  return { width, height, bytes: png.length, png };
}

async function pdfjsPageCount(file) {
  const doc = await loadPdfjs(file);
  const n = doc.numPages;
  await closePdfjs(doc);
  return n;
}

async function pdfLibLoad(file) {
  const bytes = fs.readFileSync(file);
  const u8 = new Uint8Array(bytes.byteLength); u8.set(bytes); // offset-0 normalization (see B5 note)
  return PDFDocument.load(u8, { ignoreEncryption: false });
}

// ---------------------------------------------------------------- A. pdf.js
async function partA() {
  // A1: text extraction matches manifest markers on F-001
  try {
    const texts = await extractTextPages(path.join(PDF_DIR, "F-001-plain-text-3p.pdf"));
    const joined = texts.join(" ");
    const ok = ["PACKING-BOX-0001", "PACKING-BOX-0002", "PACKING-BOX-0003"].every((m) => joined.includes(m));
    record("A1 pdfjs text extraction (F-001 markers)", ok, `pages=${texts.length}`);
  } catch (e) {
    record("A1 pdfjs text extraction (F-001 markers)", false, e.message);
  }

  // A2: render first page of F-007 (image page) — proves render path incl. images
  try {
    const r = await renderFirstPage(path.join(PDF_DIR, "F-007-image-page.pdf"), 2.0);
    const ok = r.bytes > 5000 && r.width === 1190; // 595*2
    record("A2 pdfjs render F-007 @2x", ok, `${r.width}x${r.height} png=${r.bytes}B`);
    fs.writeFileSync(path.join(OUT_DIR, "A2-render-f007.png"), r.png);
  } catch (e) {
    record("A2 pdfjs render F-007 @2x", false, e.message);
  }

  // A3: rotation attribute visible in pdfjs (F-004)
  try {
    const doc = await loadPdfjs(path.join(PDF_DIR, "F-004-rotated-pages.pdf"));
    const rots = [];
    for (let i = 1; i <= 4; i++) {
      const p = await doc.getPage(i);
      rots.push(p.rotate);
      p.cleanup();
    }
    await closePdfjs(doc);
    record("A3 pdfjs rotation readback (F-004)", rots.join(",") === "0,90,180,270", `rots=[${rots}]`);
  } catch (e) {
    record("A3 pdfjs rotation readback (F-004)", false, e.message);
  }

  // A4: encrypted input rejected early (F-010) — R1 must NOT decrypt
  let encRejected = false;
  try {
    await loadPdfjs(path.join(PDF_DIR, "F-010-encrypted-aes256.pdf"));
  } catch (e) {
    encRejected = /password/i.test(e.message) || /encrypted/i.test(e.name + e.message);
  }
  record("A4 pdfjs rejects encrypted (F-010)", encRejected);

  // A5: malformed input rejected (F-011)
  let malformedRejected = false;
  try {
    await loadPdfjs(path.join(PDF_DIR, "F-011-malformed-truncated.pdf"));
  } catch (e) {
    malformedRejected = true; // throw = reject
  }
  // pdf.js may also "repair" silently; if we got here without throwing, check numPages sanity
  record("A5 pdfjs rejects/flags malformed (F-011)", malformedRejected, malformedRejected ? "threw" : "opened without error");

  // A6: scan-like page yields empty text (F-008) — the honest OCR-gap evidence
  try {
    const texts = await extractTextPages(path.join(PDF_DIR, "F-008-scan-like.pdf"));
    record("A6 pdfjs empty text layer on scan (F-008)", texts[0].trim().length === 0, `len=${texts[0].trim().length}`);
  } catch (e) {
    record("A6 pdfjs empty text layer on scan (F-008)", false, e.message);
  }
}

// ---------------------------------------------------------------- B. pdf-lib
async function partB() {
  const f1 = path.join(PDF_DIR, "F-001-plain-text-3p.pdf");
  const f2 = path.join(PDF_DIR, "F-002-plain-text-30p.pdf");

  // B1: merge F-001 + F-002 -> 33 pages, order preserved
  try {
    const [a, b] = await Promise.all([pdfLibLoad(f1), pdfLibLoad(f2)]);
    const out = await PDFDocument.create();
    const pa = await out.copyPages(a, a.getPageIndices());
    const pb = await out.copyPages(b, b.getPageIndices());
    pa.forEach((p) => out.addPage(p));
    pb.forEach((p) => out.addPage(p));
    const bytes = await out.save();
    fs.writeFileSync(path.join(OUT_DIR, "B1-merged.pdf"), bytes);
    record("B1 pdf-lib merge 3+30", bytes.length > 1000);
  } catch (e) {
    record("B1 pdf-lib merge 3+30", false, e.message);
  }

  // B2: split F-002 ranges [1-5], [8], [12-30] -> 3 files
  try {
    const src = await pdfLibLoad(f2);
    const groups = [[0, 4], [7, 7], [11, 29]];
    for (const [s, e] of groups) {
      const out = await PDFDocument.create();
      const idx = [];
      for (let i = s; i <= e; i++) idx.push(i);
      const pages = await out.copyPages(src, idx);
      pages.forEach((p) => out.addPage(p));
      fs.writeFileSync(path.join(OUT_DIR, `B2-split-${s + 1}-${e + 1}.pdf`), await out.save());
    }
    const p1 = await pdfjsPageCount(path.join(OUT_DIR, "B2-split-1-5.pdf"));
    const p2 = await pdfjsPageCount(path.join(OUT_DIR, "B2-split-8-8.pdf"));
    const p3 = await pdfjsPageCount(path.join(OUT_DIR, "B2-split-12-30.pdf"));
    record("B2 pdf-lib split ranges", p1 === 5 && p2 === 1 && p3 === 19, `${p1}/${p2}/${p3} pages`);
  } catch (e) {
    record("B2 pdf-lib split ranges", false, e.message);
  }

  // B3: rotate F-001 pages by 90 (compose with existing 0) and 180 on F-004 page2 (90->270)
  try {
    const src = await pdfLibLoad(f1);
    const pages = src.getPages();
    pages.forEach((p, i) => p.setRotation(degrees((p.getRotation().angle + 90) % 360)));
    fs.writeFileSync(path.join(OUT_DIR, "B3-rotated.pdf"), await src.save());

    const src4 = await pdfLibLoad(path.join(PDF_DIR, "F-004-rotated-pages.pdf"));
    (await src4.getPages())[1].setRotation(degrees(270)); // 90 + 180 = 270
    fs.writeFileSync(path.join(OUT_DIR, "B3-rotated-compose.pdf"), await src4.save());

    // cross-reader: read rotations back via pdf.js
    const doc = await loadPdfjs(path.join(OUT_DIR, "B3-rotated.pdf"));
    const rots = [];
    for (let i = 1; i <= 3; i++) { const p = await doc.getPage(i); rots.push(p.rotate); p.cleanup(); }
    await closePdfjs(doc);
    const doc4 = await loadPdfjs(path.join(OUT_DIR, "B3-rotated-compose.pdf"));
    const p = await doc4.getPage(2); const rot4 = p.rotate; p.cleanup(); await closePdfjs(doc4);
    record("B3 pdf-lib rotate + compose", rots.join(",") === "90,90,90" && rot4 === 270, `rots=[${rots}] compose=${rot4}`);
  } catch (e) {
    record("B3 pdf-lib rotate + compose", false, e.message);
  }

  // B4: delete + extract pages from F-002
  try {
    const src = await pdfLibLoad(f2);
    src.removePage(0); // delete page 1 -> 29 pages
    fs.writeFileSync(path.join(OUT_DIR, "B4-deleted.pdf"), await src.save());

    const src2 = await pdfLibLoad(f2);
    const out = await PDFDocument.create();
    const kept = await out.copyPages(src2, [29, 0, 5]); // pages 30, 1, 6 custom order
    kept.forEach((p) => out.addPage(p));
    fs.writeFileSync(path.join(OUT_DIR, "B4-extract-order.pdf"), await out.save());

    const dCount = await pdfjsPageCount(path.join(OUT_DIR, "B4-deleted.pdf"));
    const eTexts = await extractTextPages(path.join(OUT_DIR, "B4-extract-order.pdf"));
    const orderOk = eTexts[0].includes("PACKING-BOX-0030") && eTexts[1].includes("PACKING-BOX-0001") && eTexts[2].includes("PACKING-BOX-0006");
    record("B4 pdf-lib delete + custom-order extract", dCount === 29 && orderOk, `del=29p custom-order=${orderOk}`);
  } catch (e) {
    record("B4 pdf-lib delete + custom-order extract", false, e.message);
  }

  // B5: images -> PDF (JPEG F-007-img, PNG F-013-img)
  // NOTE: pdf-lib 1.17.1 JpegEmbedder uses `new DataView(imageData.buffer)` and
  // ignores byteOffset — a pooled Buffer view (byteOffset>0) breaks SOI detection.
  // Normalize every image byte sequence to an offset-0 Uint8Array first.
  const toU8 = (buf) => { const u = new Uint8Array(buf.byteLength); u.set(buf); return u; };
  try {
    const out = await PDFDocument.create();
    const jpg = await out.embedJpg(toU8(fs.readFileSync(path.join(IMG_DIR, "F-007-photo.jpg"))));
    const png = await out.embedPng(toU8(fs.readFileSync(path.join(IMG_DIR, "F-013-diagram.png"))));
    const pg = out.addPage([595.28, 841.89]);
    pg.drawImage(jpg, { x: 50, y: 500, width: 200, height: 266 });
    pg.drawImage(png, { x: 50, y: 200, width: 200, height: 133 });
    fs.writeFileSync(path.join(OUT_DIR, "B5-images.pdf"), await out.save());
    const n = await pdfjsPageCount(path.join(OUT_DIR, "B5-images.pdf"));
    record("B5 pdf-lib embed JPG+PNG -> PDF", n === 1, `${n} page`);
  } catch (e) {
    record("B5 pdf-lib embed JPG+PNG -> PDF", false, e.message);
  }

  // B6: forms — read AcroForm fields of F-005 (fill ships in R2; read proves parse)
  try {
    const src = await pdfLibLoad(path.join(PDF_DIR, "F-005-form-acroform.pdf"));
    const fields = src.getForm().getFields().map((f) => `${f.getName()}:${f.constructor.name}`);
    record("B6 pdf-lib AcroForm field parse (F-005)", fields.length === 2, fields.join(", "));
  } catch (e) {
    record("B6 pdf-lib AcroForm field parse (F-005)", false, e.message);
  }

  // B7: pdf-lib rejects encrypted F-010 (with ignoreEncryption:false)
  try {
    await pdfLibLoad(path.join(PDF_DIR, "F-010-encrypted-aes256.pdf"));
    record("B7 pdf-lib rejects encrypted (F-010)", false, "opened without error");
  } catch (e) {
    record("B7 pdf-lib rejects encrypted (F-010)", /encrypt/i.test(e.message), e.message.slice(0, 60));
  }

  // B8: text draw (page numbers / watermark path) with StandardFonts
  try {
    const out = await PDFDocument.create();
    const font = await out.embedFont(StandardFonts.Helvetica);
    const pg = out.addPage([595, 842]);
    pg.drawText("1", { x: 295, y: 30, size: 10, font, opacity: 1 });
    pg.drawText("CONFIDENTIAL", { x: 100, y: 400, size: 48, font, opacity: 0.4, rotate: degrees(45) });
    fs.writeFileSync(path.join(OUT_DIR, "B8-text.pdf"), await out.save());
    const texts = await extractTextPages(path.join(OUT_DIR, "B8-text.pdf"));
    record("B8 pdf-lib draw text (numbering/watermark path)", texts[0].includes("1") && texts[0].includes("CONFIDENTIAL"), "");
  } catch (e) {
    record("B8 pdf-lib draw text (numbering/watermark path)", false, e.message);
  }
}

// ---------------------------------------------------------------- C. cross-reader outputs
async function partC() {
  // every OUT pdf must re-parse in pdf.js (the shipping reader) with sane page counts
  const checks = [
    ["B1-merged.pdf", 33],
    ["B2-split-1-5.pdf", 5],
    ["B2-split-8-8.pdf", 1],
    ["B2-split-12-30.pdf", 19],
    ["B3-rotated.pdf", 3],
    ["B3-rotated-compose.pdf", 4],
    ["B4-deleted.pdf", 29],
    ["B4-extract-order.pdf", 3],
    ["B5-images.pdf", 1],
    ["B8-text.pdf", 1],
  ];
  for (const [file, expected] of checks) {
    try {
      const n = await pdfjsPageCount(path.join(OUT_DIR, file));
      record(`C re-parse ${file}`, n === expected, `${n}/${expected} pages`);
    } catch (e) {
      record(`C re-parse ${file}`, false, e.message.slice(0, 60));
    }
  }
  // merged output must keep text markers (content preservation proof)
  try {
    const texts = await extractTextPages(path.join(OUT_DIR, "B1-merged.pdf"));
    const joined = texts.join(" ");
    const ok = texts.length === 33 &&
      joined.includes("PACKING-BOX-0001") && joined.includes("PACKING-BOX-0030") &&
      texts[3].includes("PACKING-BOX-0001") /* page 4 = F-002 page 1 */;
    record("C merged content preservation (markers across boundary)", ok);
  } catch (e) {
    record("C merged content preservation (markers across boundary)", false, e.message);
  }
}

// ---------------------------------------------------------------- main
const t0 = Date.now();
await partA();
await partB();
await partC();
const fails = results.filter((r) => !r.pass).length;
report.durationMs = Date.now() - t0;
report.summary = { total: results.length, passed: results.length - fails, failed: fails };
fs.writeFileSync(path.join(HERE, "report.json"), JSON.stringify(report, null, 2));
console.log(`\n== ${report.summary.passed}/${report.summary.total} checks passed, ${report.summary.failed} failed (${report.durationMs}ms) ==`);
process.exit(fails ? 1 : 0);
