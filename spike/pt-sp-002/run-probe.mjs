// Drives probe.html in headless Chrome via CDP; prints JSON results.
import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME = "/Users/akshatgupta/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell";
const port = 9333;
const files = JSON.stringify([
  "fixtures/pdf/F-001-plain-text-3p.pdf",
  "fixtures/pdf/F-002-plain-text-30p.pdf",
  "fixtures/pdf/F-008-scan-like.pdf",
  "fixtures/pdf/F-015-pages-60p.pdf",
]);
const url = `http://localhost:8931/spike/pt-sp-002/probe.html?files=${encodeURIComponent(files)}&dpis=${encodeURIComponent("[96,150]")}`;

const proc = spawn(CHROME, [
  "--headless", `--remote-debugging-port=${port}`,
  "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--js-flags=--expose-gc", "--enable-precise-memory-info",
  "--user-data-dir=/tmp/ptsp002-profile",
  url,
], { stdio: ["ignore", "pipe", "pipe"] });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(method, params = {}, sessionId) {
  const id = ++cdp.n;
  const target = { method, params, id };
  if (sessionId) target.sessionId = sessionId;
  cdp.ws.send(JSON.stringify(target));
  return new Promise((resolve) => { cdp.pending[id] = resolve; });
}
cdp.n = 0; cdp.pending = {};

// minimal ws client (no deps)
import net from "node:net";
import crypto from "node:crypto";

async function getFirstTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await r.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await wait(500);
  }
  throw new Error("no CDP target");
}

const target = await getFirstTarget();

// raw websocket handshake (RFC6455 client)
const wsUrl = new URL(target.webSocketDebuggerUrl);
const key = crypto.randomBytes(16).toString("base64");
const sock = net.connect(parseInt(wsUrl.port), "127.0.0.1");
await new Promise((r) => sock.once("connect", r));
sock.write(
  `GET ${wsUrl.pathname}${wsUrl.search} HTTP/1.1\r\nHost: ${wsUrl.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
);
await new Promise((r) => sock.once("data", r)); // consume handshake response

// ws frame helpers (masked client frames)
function wsSend(payload) {
  const data = Buffer.from(payload);
  const mask = crypto.randomBytes(4);
  let header;
  if (data.length < 126) header = Buffer.from([0x81, 0x80 | data.length]);
  else if (data.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(data.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(data.length), 2); }
  const masked = Buffer.from(data);
  for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
  sock.write(Buffer.concat([header, mask, masked]));
}

sock.on("data", (chunk) => {
  // naive frame parse (single small text frames only)
  let buf = cdp.buffer ? Buffer.concat([cdp.buffer, chunk]) : chunk;
  cdp.buffer = Buffer.alloc(0);
  let offset = 0;
  while (offset + 2 <= buf.length) {
    const len1 = buf[offset + 1] & 0x7f;
    let len = len1, hdr = 2;
    if (len1 === 126) { len = buf.readUInt16BE(offset + 2); hdr = 4; }
    else if (len1 === 127) { len = Number(buf.readBigUInt64BE(offset + 2)); hdr = 10; }
    if (offset + hdr + len > buf.length) { cdp.buffer = buf.subarray(offset); break; }
    const payload = buf.subarray(offset + hdr, offset + hdr + len);
    try {
      const msg = JSON.parse(payload.toString());
      if (msg.id && cdp.pending[msg.id]) { cdp.pending[msg.id](msg.result); delete cdp.pending[msg.id]; }
    } catch {}
    offset += hdr + len;
  }
});
cdp.ws = { send: wsSend };
cdp.buffer = Buffer.alloc(0);

await wait(3500); // let the module load

// capture console + worker errors
await cdp("Runtime.enable");
await cdp("Log.enable");
const logs = [];
const origPending = cdp.pending;
// hook: intercept events by watching raw messages — simplest: add Runtime.consoleAPICalled listener via a second socket... 
// Instead: use Log.entryAdded by polling after. Keep simple: evaluate worker-less parse as fallback diag.
const diag = await cdp("Runtime.evaluate", {
  expression: `(async () => {
    const r = await fetch("http://localhost:8931/fixtures/pdf/F-001-plain-text-3p.pdf");
    const buf = await r.arrayBuffer();
    const u8 = new Uint8Array(buf);
    const pdfjs = await import("/spike/pt-sp-002/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
    try {
      const task = pdfjs.getDocument({ data: u8 });
      const doc = await task.promise;
      return "OK pages=" + doc.numPages;
    } catch (e) { return "ERR " + e.name + ": " + e.message; }
  })()`,
  awaitPromise: true, returnByValue: true,
});
console.log("DIAG(worker):", JSON.stringify(diag.result?.value));
const diag2 = await cdp("Runtime.evaluate", {
  expression: `(async () => {
    const r = await fetch("http://localhost:8931/fixtures/pdf/F-001-plain-text-3p.pdf");
    const u8 = new Uint8Array(await r.arrayBuffer());
    const pdfjs = await import("/spike/pt-sp-002/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerPort = null;
    try {
      const task = pdfjs.getDocument({ data: u8, disableWorker: true });
      const doc = await task.promise;
      return "no-worker OK pages=" + doc.numPages;
    } catch (e) { return "no-worker ERR " + e.name + ": " + e.message; }
  })()`,
  awaitPromise: true, returnByValue: true,
});
console.log("DIAG(no-worker):", JSON.stringify(diag2.result?.value));
const diag3 = await cdp("Runtime.evaluate", {
  expression: "(async () => { const r = await fetch('fixtures/pdf/F-001-plain-text-3p.pdf'); const u8 = new Uint8Array(await r.arrayBuffer()); const h = Array.from(u8.subarray(0,8)).map(b=>b.toString(16).padStart(2,'0')).join(' '); return 'len='+u8.length+' head='+h+' hasEOF='+new TextDecoder().decode(u8.subarray(u8.length-32)).includes('EOF'); })()",
  awaitPromise: true, returnByValue: true,
});
console.log("DIAG(bytes):", JSON.stringify(diag3.result?.value));

const evalRes = await cdp("Runtime.evaluate", {
  expression: "window.__run ? window.__run() : 'NO_RUN'",
  awaitPromise: true, returnByValue: true, timeout: 180000,
});
fs.writeFileSync("browser-report.json", JSON.stringify(evalRes.result?.value ?? evalRes, null, 2));
console.log(JSON.stringify(evalRes.result?.value ?? evalRes, null, 2));
sock.destroy();
proc.kill();
process.exit(0);
