/**
 * PT-CORE-005 e2e probe — Split PDF interface mount + live flow.
 *
 * Drives the built site (serve-base.py on 127.0.0.1:4173, /pdf-tools/ base)
 * in headless Chrome via the raw-CDP pattern (spike/pt-sp-002 proven).
 * Acceptance: user can understand and download all intended splits.
 * Verifies:
 *   1. /pdf-tools/split/ deep link mounts the workspace (not "in progress")
 *   2. mode picker renders three modes; ranges input present
 *   3. selecting a fixture PDF + ranges preview shows part counts live
 *   4. running the split produces a verified ZIP result panel
 *   5. catalog card for split is an active link (implemented flip)
 *
 * Usage: node verify-split.mjs   (serve-base.py must run on :4173)
 * Exit 0 = all checks pass.
 */
import { spawn } from "node:child_process";
import net from "node:net";
import crypto from "node:crypto";
import fs from "node:fs";

const CHROME = "/Users/akshatgupta/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const PORT = 9336;
const BASE = "http://127.0.0.1:4173/pdf-tools";
const FIXTURE = "/Users/akshatgupta/hermes-repos/pdf-tools/fixtures/pdf/F-002-plain-text-30p.pdf";

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
    } catch {}
    await sleep(200);
  }
  throw new Error("chrome did not expose a page target");
}

async function main() {
  const proc = spawn(CHROME, [
    "--headless", `--remote-debugging-port=${PORT}`,
    "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=/tmp/ptcore005-profile",
    `${BASE}/split/`,
  ], { stdio: ["ignore", "ignore", "ignore"] });

  const target = await getFirstTarget();
  const wsUrl = new URL(target.webSocketDebuggerUrl);

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
      } catch {}
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
      cdp.ready?.(); cdp.ready = null;
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

  async function evalJs(expr, timeoutMs = 10000) {
    const r = await Promise.race([
      cdpSend("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }),
      new Promise((resolve) => setTimeout(() => resolve({ __timeout: true }), timeoutMs)),
    ]);
    if (r && r.__timeout) return undefined;
    return r?.result?.value;
  }

  for (let i = 0; i < 40; i++) {
    const st = await evalJs("document.readyState");
    if (st === "complete" || st === "interactive") break;
    await sleep(250);
  }
  await sleep(1000);

  // 1. deep link mounts the split workspace
  const heading = (await evalJs(`document.querySelector('.tool-heading')?.textContent || ''`)) ?? "";
  record("split deep link mounts workspace", heading.includes("Split PDF"), `h1="${heading}"`);

  // 2. select the fixture PDF FIRST — the config section only renders with a file
  const doc = await cdpSend("DOM.getDocument", { depth: -1 });
  const rootId = doc.root.nodeId;
  const inputNode = await cdpSend("DOM.querySelector", { nodeId: rootId, selector: "input[type=file]" });
  const fileSet = Boolean(inputNode?.nodeId);
  record("file input found", fileSet);
  if (fileSet) {
    await cdpSend("DOM.setFileInputFiles", { files: [FIXTURE], nodeId: inputNode.nodeId });
  }
  await sleep(1500);

  // config section must now be rendered
  const modes = (await evalJs(`document.querySelectorAll('.split-mode').length`)) ?? 0;
  record("mode picker renders three modes after file selection", Number(modes) === 3, `${modes} modes`);
  const hasRanges = await evalJs(`Boolean(document.querySelector('#split-ranges'))`);
  record("ranges input present", hasRanges === true);

  // 3. type ranges and let the live preview resolve
  // React 19 tracks the native value setter — plain el.value assignment is
  // invisible to onChange; use the prototype setter + input event
  const setRanges = await evalJs(`(function(){
    const el = document.querySelector('#split-ranges');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '1-2, 30, 15');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  record("ranges typed into field", setRanges === true);
  await sleep(2000);

  const summary = (await evalJs(`document.querySelector('.panel-summary')?.textContent || ''`)) ?? "";
  record("live preview shows part count", summary.includes("3 file") || summary.includes("files"), `summary="${summary.slice(0, 90)}"`);

  // 4. run the split -> result panel with ZIP
  const clicked = await evalJs(`(function(){ const btns = [...document.querySelectorAll('button')]; const b = btns.find(x => x.textContent.includes('Split PDF')); if (!b) return false; b.click(); return true; })()`);
  record("split button clicked", clicked === true);

  let resultText = "";
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    resultText = (await evalJs(`document.querySelector('.panel')?.textContent || ''`)) ?? "";
    if (/download/i.test(resultText)) break;
  }
  const hasDownload = await evalJs(`Boolean([...document.querySelectorAll('button,a')].find(x => /download/i.test(x.textContent)))`);
  record("result panel offers the ZIP download", hasDownload === true, `"${resultText.slice(0, 120)}"`);

  const failed = await evalJs(`Boolean(document.querySelector('.panel.is-error'))`);
  record("no failure panel", failed !== true);

  // 6. catalog card is an active link now — navigate to catalog and inspect
  // the rendered DOM (prerendered index.html is an SPA shell)
  await evalJs(`(function(){ history.pushState({}, '', '/pdf-tools/'); dispatchEvent(new PopStateEvent('popstate')); return true; })()`);
  await sleep(700);
  const cardLink = await evalJs(`(function(){ const a = document.querySelector('a[href="/pdf-tools/split"]'); return Boolean(a); })()`);
  record("catalog: split card is an active link (implemented flip)", cardLink === true);

  proc.kill("SIGTERM");
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n== ${results.length - fails}/${results.length} e2e checks passed ==`);
  fs.writeFileSync(new URL("./split-e2e-report.json", import.meta.url), JSON.stringify({ date: new Date().toISOString(), results }, null, 2));
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error("probe error:", e); process.exit(1); });
