// 用法: node scripts/shoot.mjs <url> <out.png> [width] [height] [waitMs]
// 用 CDP 驱动本机 Chrome 截图，等待真实时间后再拍，避免 headless 动画冻结问题。
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [url, out, width = "1440", height = "900", waitMs = "2500", evalJs = "", media = ""] =
  process.argv.slice(2);
const CHROME =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9222 + Math.floor(Math.random() * 500);

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--window-size=${width},${height}`,
  "about:blank",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getTarget() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const list = await fetch(
        `http://127.0.0.1:${port}/json/list`,
      ).then((r) => r.json());
      const page = list.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await sleep(200);
  }
  throw new Error("chrome CDP not ready");
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg.result);
    pending.delete(msg.id);
  }
};
await new Promise((resolve) => (ws.onopen = resolve));

await send("Page.enable");
if (media) {
  await send("Emulation.setEmulatedMedia", { media });
}
await send("Emulation.setDeviceMetricsOverride", {
  width: Number(width),
  height: Number(height),
  deviceScaleFactor: 1,
  mobile: Number(width) < 500,
});
await send("Page.navigate", { url });
await sleep(Number(waitMs));
if (evalJs) {
  const evaluated = await send("Runtime.evaluate", {
    expression: evalJs,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log("eval:", JSON.stringify(evaluated?.result?.value));
  await sleep(900);
}
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("saved", out);

ws.close();
chrome.kill();
process.exit(0);
