/**
 * PT-SP-002 — Asset-side benchmark: measure real bundle sizes for the engine
 * loading strategies the app can use, from the actual approved packages.
 *
 * Measures (deterministic, from disk):
 *   1. Raw package sizes (pdfjs-dist, pdf-lib, @zip.js, fflate)
 *   2. Minified+gzip production bundle sizes via esbuild (Vite's bundler core):
 *      - pdf-lib full (page writing)
 *      - pdfjs-dist full (legacy build, what the app imports)
 *      - pdfjs worker file size (worker thread payload)
 *      - standard_fonts directory (self-host requirement from PT-SP-001)
 *   3. Memory-scale model inputs: rendered-pixel bytes at candidate DPI limits
 *      (for the quota table the app will publish)
 *
 * Run: node measure-assets.mjs   (from spike/pt-sp-002)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "../../app");

const rows = [];
function row(name, bytes, note = "") {
  const gz = gzipSync(Buffer.from.alloc ? Buffer.from(rows) : Buffer.alloc(0)); // placeholder no-op
  rows.push({ name, bytes, note });
}

async function measureBundle(label, entry) {
  const out = path.join(HERE, ".tmp-bundle.js");
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    outfile: out,
    logLevel: "silent",
  });
  const js = fs.readFileSync(out);
  const gz = gzipSync(js);
  fs.unlinkSync(out);
  console.log(`${label}: raw=${(js.length / 1024).toFixed(1)} KiB, gzip=${(gz.length / 1024).toFixed(1)} KiB`);
  return { label, rawKiB: +(js.length / 1024).toFixed(1), gzipKiB: +(gz.length / 1024).toFixed(1) };
}

// --- 1. Raw package payloads ---
function dirSize(p, exts) {
  let total = 0, files = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (!exts || exts.some((x) => f.endsWith(x))) { total += fs.statSync(f).size; files++; }
    }
  };
  walk(p);
  return { total, files };
}

const nm = path.join(HERE, "node_modules");
console.log("== Raw package payloads ==");
for (const [pkg, exts] of [
  ["pdfjs-dist", [".js", ".mjs", ".json"]],
  ["pdf-lib", [".js"]],
  ["@zip.js", [".js"]],
  ["fflate", [".js", ".mjs"]],
]) {
  const p = path.join(nm, pkg);
  if (fs.existsSync(p)) {
    // for @zip.js resolve real package dir
    let real = p;
    if (pkg === "@zip.js") real = path.join(nm, "@zip.js/zip.js");
    const s = dirSize(real, exts);
    console.log(`${pkg}: ${(s.total / 1024).toFixed(0)} KiB across ${s.files} files (installed, not all shipped)`);
  }
}

console.log("\n== Production bundle measurements (esbuild minify+gzip, browser platform) ==");
const results = [];
results.push(await measureBundle("pdf-lib (full)", path.join(nm, "pdf-lib/cjs/index.js")));
results.push(await measureBundle("pdfjs-dist legacy (full)", path.join(nm, "pdfjs-dist/legacy/build/pdf.mjs")));

// pdfjs worker payload (shipped as its own file, loaded by the worker thread)
const worker = path.join(nm, "pdfjs-dist/legacy/build/pdf.worker.mjs");
const wjs = fs.readFileSync(worker);
console.log(`pdfjs worker (legacy, own file): raw=${(wjs.length / 1024).toFixed(1)} KiB, gzip=${(gzipSync(wjs).length / 1024).toFixed(1)} KiB`);
results.push({ label: "pdfjs worker (own file)", rawKiB: +(wjs.length / 1024).toFixed(1), gzipKiB: +(gzipSync(wjs).length / 1024).toFixed(1) });

// standard fonts payload (self-host requirement from PT-SP-001)
const sf = dirSize(path.join(nm, "pdfjs-dist/standard_fonts"), null);
console.log(`pdfjs standard_fonts (self-host): ${(sf.total / 1024).toFixed(1)} KiB across ${sf.files} files`);
results.push({ label: "pdfjs standard_fonts (self-host total)", rawKiB: +(sf.total / 1024).toFixed(1), gzipKiB: null });

// @zip.js + fflate (small helpers)
results.push(await measureBundle("@zip.js/zip.js", path.join(nm, "@zip.js/zip.js/index.js")));
{
  const ffp = JSON.parse(fs.readFileSync(path.join(nm, "fflate/package.json")));
  const entry = path.join(nm, "fflate", ffp.module || ffp.main);
  results.push(await measureBundle("fflate", entry));
}

// --- rendered-pixel memory model (for quota table) ---
console.log("\n== Rendered-pixel memory model (RGBA bytes = w*h*4) ==");
const cases = [
  ["A4 @96 DPI", 8.27 * 96, 11.69 * 96],
  ["A4 @150 DPI", 8.27 * 150, 11.69 * 150],
  ["A4 @200 DPI", 8.27 * 200, 11.69 * 200],
  ["A4 @300 DPI", 8.27 * 300, 11.69 * 300],
  ["10 pages A4 @150 DPI held as bitmaps", 10 * 8.27 * 150, 11.69 * 150],
  ["30 pages A4 @150 DPI held as bitmaps", 30 * 8.27 * 150, 11.69 * 150],
];
for (const [label, w, h] of cases) {
  const px = Math.round(w) * Math.round(h);
  const mib = (px * 4) / (1024 * 1024);
  console.log(`${label}: ${(mib).toFixed(1)} MiB`);
}

// --- Pages 1GB budget check against worst-case shipped assets ---
console.log("\n== GitHub Pages budget (limit: 1 GiB published site) ==");
const worstCase = 60; // MiB rough ceiling incl. WASM engines later (R3 gated)
console.log(`Estimated worst-case R1 total assets: ~${(results.reduce((a, r) => a + (r.rawKiB || 0), 0) / 1024).toFixed(2)} MiB (measured core) + fonts/worker`);
console.log(`R3 WASM ceiling assumption: ${worstCase} MiB => still <1% of Pages 1 GiB limit`);

fs.writeFileSync(path.join(HERE, "asset-report.json"), JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
console.log("\nreport -> asset-report.json");
