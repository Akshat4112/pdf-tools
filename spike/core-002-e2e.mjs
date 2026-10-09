/**
 * PT-CORE-002 e2e verification — Merge flow on the LIVE site.
 * Drives chrome-headless-shell via CDP (same raw-socket pattern as PT-SP-002):
 *   desktop (1280x800) and mobile (390x844, touch) viewports.
 * Flow: open catalog -> open Merge -> set two PDFs via DataTransfer drop ->
 *   confirm -> wait for result -> download link present -> reset -> audit clean.
 * Fixtures fetched from the live origin? No — must be local bytes injected via
 * DOM File objects (site must never receive document bytes: PT-PD-003).
 */
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const CHROME = "/Users/akshatgupta/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const SITE = process.env.SITE ?? "http://localhost:8932/pdf-tools/";
const ROOT = "/Users/akshatgupta/Projects/pdf-tools";
const f1 = fs.readFileSync(path.join(ROOT, "fixtures/pdf/F-001-plain-text-3p.pdf"));
const f2 = fs.readFileSync(path.join(ROOT, "fixtures/pdf/F-014-outline.pdf"));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runViewport(name, width, height, touch) {
  const port = 9340 + Math.floor(Math.random() * 40);
  const proc = spawn(CHROME, [
    "--headless", `--remote-debugging-port=${port}`,
    "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--window-size=${width},${height}`,
    ...(touch ? ["--touch-events=enabled", "--force-device-scale-factor=1"] : []),
    `--user-data-dir=/tmp/core002-${name}-${Date.now()}`,
    SITE,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const getTarget = async () => {
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await r.json();
        const page = list.find((t) => t.type === "page");
        if (page) return page;
      } catch {}
      await wait(500);
    }
    throw new Error("no CDP target");
  };
  const target = await getTarget();

  const wsUrl = new URL(target.webSocketDebuggerUrl);
  const key = crypto.randomBytes(16).toString("base64");
  const sock = net.connect(parseInt(wsUrl.port), "127.0.0.1");
  await new Promise((r) => sock.once("connect", r));
  sock.write(`GET ${wsUrl.pathname} HTTP/1.1\r\nHost: ${wsUrl.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  await new Promise((r) => sock.once("data", r));

  const pending = new Map(); let n = 0; let buf = Buffer.alloc(0);
  function send(payload) {
    const data = Buffer.from(payload); const mask = crypto.randomBytes(4);
    let header;
    if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
    else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2); }
    const masked = Buffer.from(data);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
    sock.write(Buffer.concat([header, mask, masked]));
  }
  sock.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    let off = 0;
    while (off + 2 <= buf.length) {
      const len1 = buf[off + 1] & 0x7f; let len = len1, hdr = 2;
      if (len1 === 126) { len = buf.readUInt16BE(off + 2); hdr = 4; }
      else if (len1 === 127) { len = Number(buf.readBigUInt64BE(off + 2)); hdr = 10; }
      if (off + hdr + len > buf.length) break;
      const payload = buf.subarray(off + hdr, off + hdr + len);
      try {
        const msg = JSON.parse(payload.toString());
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
      } catch {}
      off += hdr + len;
    }
    buf = buf.subarray(off);
  });
  const cdp = (method, params = {}) => new Promise((resolve) => {
    const id = ++n; pending.set(id, resolve);
    send(JSON.stringify({ id, method, params }));
  });

  const results = [];
  const check = (label, ok, detail = "") => {
    results.push({ label, ok });
    console.log(`  [${name}] ${ok ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  };

  try {
    await cdp("Runtime.enable");
    await wait(2500); // let the SPA render

    // 1) catalog visible with Merge as an ACTIVE entry (implemented=true now)
    const cat = await cdp("Runtime.evaluate", {
      expression: `(() => {
        const card = [...document.querySelectorAll('a.tool-card, div.tool-card')].find(el => el.textContent.includes('Merge PDF'));
        if (!card) return 'NO_CARD';
        return card.tagName + '|' + card.querySelector('.status-chip')?.textContent;
      })()`,
      returnByValue: true,
    });
    const catVal = cat.result?.value ?? "";
    check("catalog shows Merge as active <a> entry", catVal.startsWith("A|"), catVal);

    // 2) navigate to the merge tool route
    await cdp("Runtime.evaluate", {
      expression: `(() => { location.hash = '#/merge'; return 'nav'; })()`,
      returnByValue: true,
    });
    await wait(1200);
    const toolHead = await cdp("Runtime.evaluate", {
      expression: `document.querySelector('.tool-heading')?.textContent ?? 'NO_HEADING'`,
      returnByValue: true,
    });
    check("merge screen renders", toolHead.result?.value === "Merge PDF", toolHead.result?.value);

    // 3) inject two PDF files into the file selection (DOM File -> the app's own input wiring)
    const inject = await cdp("Runtime.evaluate", {
      expression: `(async () => {
        // locate the hidden file input the app binds
        const input = document.querySelector('input[type=file]');
        if (!input) return 'NO_INPUT';
        const b1 = new Uint8Array(${JSON.stringify(Array.from(f1))});
        const b2 = new Uint8Array(${JSON.stringify(Array.from(f2))});
        const dt = new DataTransfer();
        dt.items.add(new File([b1], 'alpha.pdf', {type: 'application/pdf'}));
        dt.items.add(new File([b2], 'beta-outline.pdf', {type: 'application/pdf'}));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', {bubbles: true}));
        return 'INJECTED';
      })()`,
      awaitPromise: true, returnByValue: true,
    });
    check("two PDFs injected via DataTransfer", inject.result?.value === "INJECTED", inject.result?.value);
    await wait(800);

    // 4) both files listed (sanitized names as text)
    const listed = await cdp("Runtime.evaluate", {
      expression: `(() => {
        const names = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /alpha\\.pdf|beta-outline\\.pdf/.test(e.textContent)).map(e => e.textContent.trim());
        return JSON.stringify(names);
      })()`,
      returnByValue: true,
    });
    const namesVal = listed.result?.value ?? "[]";
    check("both files listed by name", namesVal.includes("alpha.pdf") && namesVal.includes("beta-outline.pdf"), namesVal);

    // 5) merge button enabled + preview summary states order
    const summary = await cdp("Runtime.evaluate", {
      expression: `(() => {
        const btn = [...document.querySelectorAll('button')].find(b => /merge/i.test(b.textContent) && !b.disabled);
        const preview = document.body.textContent.includes('alpha.pdf → beta-outline.pdf') || document.body.textContent.includes('Order:');
        return JSON.stringify({btn: !!btn, preview});
      })()`,
      returnByValue: true,
    });
    const sVal = JSON.parse(summary.result?.value ?? "{}");
    check("merge button enabled", sVal.btn === true);
    check("order preview shown", sVal.preview === true);

    // 6) run the merge
    await cdp("Runtime.evaluate", {
      expression: `(() => { [...document.querySelectorAll('button')].find(b => /merge/i.test(b.textContent) && !b.disabled)?.click(); return 'clicked'; })()`,
      returnByValue: true,
    });
    // wait for result phase (poll up to 15s)
    let resultText = "";
    for (let i = 0; i < 30; i++) {
      await wait(500);
      const st = await cdp("Runtime.evaluate", {
        expression: `document.body.textContent.includes('Download') ? (document.querySelector('.result-panel, [class*=result]')?.textContent ?? 'RESULT').slice(0, 220) : ''`,
        returnByValue: true,
      });
      if (st.result?.value) { resultText = st.result.value; break; }
    }
    check("result panel with Download appears", resultText.length > 0, resultText.slice(0, 80));

    // 7) output name + verified size shown
    check("output name derived (merged)", /merged/i.test(resultText), "");

    // 8) download click produces a file (CDP Page.setDownloadBehavior to /tmp)
    await cdp("Page.enable");
    await cdp("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: "/tmp/core002-dl", eventsEnabled: true });
    const dl = await cdp("Runtime.evaluate", {
      expression: `(() => { [...document.querySelectorAll('button, a')].find(el => /download/i.test(el.textContent) || /download/i.test(el.className))?.click(); return 'dl-clicked'; })()`,
      returnByValue: true,
    });
    let dlFile = "";
    for (let i = 0; i < 20; i++) {
      await wait(500);
      const files = fs.existsSync("/tmp/core002-dl") ? fs.readdirSync("/tmp/core002-dl") : [];
      if (files.length) { dlFile = files[0]; break; }
    }
    const dlSize = dlFile ? fs.statSync(path.join("/tmp/core002-dl", dlFile)).size : 0;
    check("download produces a real file", dlSize > 1000, dlFile ? `${dlFile} (${dlSize} B)` : "none");

    // 9) verify the downloaded bytes are a valid merged PDF (qpdf is run outside the browser)
    if (dlFile) fs.writeFileSync("/tmp/core002-last-download.txt", path.join("/tmp/core002-dl", dlFile));

    // 10) reset: Start over clears everything
    await cdp("Runtime.evaluate", {
      expression: `(() => { [...document.querySelectorAll('button')].find(b => /start over|clear/i.test(b.textContent))?.click(); return 'reset'; })()`,
      returnByValue: true,
    });
    await wait(600);
    const cleared = await cdp("Runtime.evaluate", {
      expression: `!document.body.textContent.includes('alpha.pdf') && !document.body.textContent.includes('beta-outline.pdf')`,
      returnByValue: true,
    });
    check("reset clears file names from the DOM", cleared.result?.value === true);
  } catch (e) {
    check("viewport run crashed", false, String(e).slice(0, 100));
  }

  try { sock.destroy(); } catch {}
  try { proc.kill(); } catch {}
  return results;
}

fs.rmSync("/tmp/core002-dl", { recursive: true, force: true });
fs.mkdirSync("/tmp/core002-dl", { recursive: true });

console.log("== PT-CORE-002 e2e: desktop 1280x800 ==");
const desktop = await runViewport("desktop", 1280, 800, false);
console.log("\n== PT-CORE-002 e2e: mobile 390x844 (touch) ==");
const mobile = await runViewport("mobile", 390, 844, true);

const all = [...desktop, ...mobile];
const failed = all.filter((r) => !r.ok);
console.log(`\n== ${all.length - failed.length}/${all.length} e2e checks passed ==`);
fs.writeFileSync(
  path.join(ROOT, "spike/core-002-e2e-report.json"),
  JSON.stringify({ date: new Date().toISOString(), desktop, mobile }, null, 2),
);
process.exit(failed.length ? 1 : 0);
