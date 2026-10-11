/**
 * PT-UX-004 e2e probe — deep links, refresh, meta accuracy, 404 behavior.
 *
 * Drives the built site (app/dist served at /pdf-tools/ on 127.0.0.1:4173 by
 * serve-base.py — mirrors GitHub Pages) in headless Chrome via raw-CDP
 * (pattern proven in spike/pt-sp-002). Verifies tracker acceptance:
 *   1. Direct/deep URLs boot the SPA on the right screen.
 *   2. document.title + canonical match the route on load AND after SPA nav.
 *   3. In-app navigation works via history API (no reload).
 *   4. 404 screen renders on unknown paths; 404.html serves not-found meta.
 *   5. sitemap.xml + robots.txt are served and well-formed.
 *
 * Usage: node verify-routes.mjs   (serve-base.py must run on :4173)
 * Exit 0 = all checks pass.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";

const CHROME = "/Users/akshatgupta/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const PORT = 9334;
const BASE = "http://127.0.0.1:4173/pdf-tools";

const results = [];
function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getFirstTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === "page");
      if (page) return page;
    } catch { /* retry */ }
    await sleep(200);
  }
  throw new Error("chrome did not expose a page target");
}

async function main() {
  const proc = spawn(CHROME, [
    "--headless", `--remote-debugging-port=${PORT}`,
    "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=/tmp/ptux004-profile",
    `${BASE}/merge/`,
  ], { stdio: ["ignore", "ignore", "ignore"] });

  const target = await getFirstTarget();
  const wsUrl = new URL(target.webSocketDebuggerUrl);

  // ---- ws connect: buffer EVERYTHING from byte 0; parse after handshake ----
  const cdp = { n: 0, pending: {}, buffer: Buffer.alloc(0), ready: null };
  const key = crypto.randomBytes(16).toString("base64");
  const sock = net.connect(parseInt(wsUrl.port), "127.0.0.1");
  await new Promise((r) => sock.once("connect", r));

  let handshakeDone = false;
  let preHandshake = Buffer.alloc(0);

  function parseFrames() {
    let offset = 0;
    const buf = cdp.buffer;
    while (offset + 2 <= buf.length) {
      const len1 = buf[offset + 1] & 0x7f;
      let len = len1, hdr = 2;
      if (len1 === 126) { len = buf.readUInt16BE(offset + 2); hdr = 4; }
      else if (len1 === 127) { len = Number(buf.readBigUInt64BE(offset + 2)); hdr = 10; }
      if (offset + hdr + len > buf.length) break;
      const payload = buf.subarray(offset + hdr, offset + hdr + len);
      try {
        const msg = JSON.parse(payload.toString());
        if (msg.id && cdp.pending[msg.id]) { cdp.pending[msg.id](msg.result); delete cdp.pending[msg.id]; }
      } catch { /* ignore */ }
      offset += hdr + len;
    }
    cdp.buffer = buf.subarray(offset);
  }

  sock.on("data", (chunk) => {
    if (!handshakeDone) {
      const all = Buffer.concat([preHandshake, chunk]);
      const idx = all.indexOf("\r\n\r\n");
      if (idx === -1) { preHandshake = all; return; }
      handshakeDone = true;
      cdp.buffer = all.subarray(idx + 4);
      cdp.ready?.();
      cdp.ready = null;
      parseFrames();
      return;
    }
    cdp.buffer = Buffer.concat([cdp.buffer, chunk]);
    parseFrames();
  });

  sock.write(`GET ${wsUrl.pathname}${wsUrl.search} HTTP/1.1\r\nHost: ${wsUrl.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  await new Promise((r) => { cdp.ready = r; });

  function cdpSend(method, params = {}) {
    const id = ++cdp.n;
    const data = Buffer.from(JSON.stringify({ id, method, params }));
    const mask = crypto.randomBytes(4);
    let header;
    if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
    else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2); }
    const masked = Buffer.from(data);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
    sock.write(Buffer.concat([header, mask, masked]));
    return new Promise((resolve) => { cdp.pending[id] = resolve; });
  }

  async function evalJs(expr, timeoutMs = 8000) {
    const r = await Promise.race([
      cdpSend("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), timeoutMs)),
    ]);
    if (r && r.__timeout) return undefined;
    return r?.result?.value;
  }

  // wait for document load, then React mount
  for (let i = 0; i < 40; i++) {
    const st = await evalJs("document.readyState");
    if (st === "complete" || st === "interactive") break;
    await sleep(250);
  }
  await sleep(1000);

  // 1. deep link boots the merge workspace
  const mergeHeading = (await evalJs(`document.querySelector('.tool-heading')?.textContent || document.querySelector('h1')?.textContent || ''`)) ?? "";
  record("deep link /merge/ boots SPA with merge screen", mergeHeading.includes("Merge PDF"), `h1="${mergeHeading}"`);

  // 2. metadata accuracy on deep-linked load
  const title = (await evalJs(`document.title`)) ?? "";
  const canonical = (await evalJs(`document.querySelector('link[rel="canonical"]')?.href`)) ?? "";
  record("deep link title accurate", title === "Merge PDF — PDF Tools", `title="${title}"`);
  record("deep link canonical accurate", canonical === "https://akshat4112.github.io/pdf-tools/merge/", `canonical=${canonical}`);

  // 3. SPA navigation: history API -> catalog (no reload)
  const navDone = await evalJs(`(function(){ history.pushState({}, '', '/pdf-tools/'); dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
  await sleep(600);
  const afterTitle = (await evalJs(`document.title`)) ?? "";
  const heroText = (await evalJs(`document.querySelector('.hero h1')?.textContent || ''`)) ?? "";
  const toolCards = (await evalJs(`document.querySelectorAll('.tool-card').length`)) ?? 0;
  record("SPA nav executes", navDone === true);
  record("SPA nav to catalog updates title", afterTitle.includes("PDF Tools") && !afterTitle.includes("Merge"), `title="${afterTitle}"`);
  record("catalog renders 14 tool cards", Number(toolCards) === 14, `${toolCards} cards`);
  record("catalog hero copy present", heroText.includes("browser"), heroText.slice(0, 50));

  // 4. catalog canonical after SPA nav
  const catCanonical = (await evalJs(`document.querySelector('link[rel="canonical"]')?.href`)) ?? "";
  record("catalog canonical after SPA nav", catCanonical === "https://akshat4112.github.io/pdf-tools/", `canonical=${catCanonical}`);

  // 5. 404 behavior
  // static 404.html is a prerendered SPA shell: its <head> carries the
  // not-found metadata; the .nf-code screen itself is client-rendered
  // (proven by the SPA-404 checks below)
  const nfFetch = await evalJs(`fetch('${BASE}/404.html').then(r => r.text()).then(t => t.includes('<title>Page not found — PDF Tools</title>') && t.includes('canonical" href="https://akshat4112.github.io/pdf-tools/404.html"'))`);
  record("404.html served with not-found metadata", nfFetch === true);

  const spa404 = await evalJs(`(function(){ history.pushState({}, '', '/pdf-tools/does-not-exist'); dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
  await sleep(500);
  const nfCode = (await evalJs(`document.querySelector('.nf-code')?.textContent || ''`)) ?? "";
  const nfTitle = (await evalJs(`document.title`)) ?? "";
  record("SPA 404 screen renders on unknown path", spa404 === true && nfCode.trim() === "404", `code="${nfCode.trim()}"`);
  record("SPA 404 title updates", nfTitle.includes("not found"), `title="${nfTitle}"`);

  // 6. not-yet tool entry (split): honest in-progress page, no file picker
  const splitNav = await evalJs(`(function(){ history.pushState({}, '', '/pdf-tools/split'); dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
  await sleep(500);
  const splitTitle = (await evalJs(`document.title`)) ?? "";
  const splitPanel = (await evalJs(`document.querySelector('.panel-title')?.textContent || ''`)) ?? "";
  const splitHasMount = await evalJs(`Boolean(document.querySelector('input[type="file"]'))`);
  record("not-yet tool route title", splitNav === true && splitTitle === "Split PDF — PDF Tools", `title="${splitTitle}"`);
  record("not-yet tool shows honest entry (no picker)", splitPanel.toLowerCase().includes("in progress") && splitHasMount !== true, `panel="${splitPanel}"`);

  // 7. sitemap + robots served and well-formed
  const sitemapOk = await evalJs(`fetch('/pdf-tools/sitemap.xml').then(r => r.text()).then(t => t.startsWith('<?xml') && t.includes('/merge/') && (t.match(/<loc>/g)||[]).length === 15)`);
  const robotsOk = await evalJs(`fetch('/pdf-tools/robots.txt').then(r => r.text()).then(t => t.includes('User-agent: *') && t.includes('Sitemap:'))`);
  record("sitemap.xml served with 15 locs", sitemapOk === true);
  record("robots.txt served", robotsOk === true);

  proc.kill("SIGTERM");
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n== ${results.length - fails}/${results.length} e2e checks passed ==`);
  fs.writeFileSync(new URL("./e2e-report.json", import.meta.url), JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error("probe error:", e); process.exit(1); });
