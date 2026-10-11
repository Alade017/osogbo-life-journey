import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir(".smoke", { recursive: true });
const port = 9400 + Math.floor(Math.random() * 1000);
const browser = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${resolve(`.smoke/app-profile-${process.pid}`)}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let socket;
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (
        await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })
      ).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!tabs) throw new Error("Browser did not start");
  socket = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  const requests = new Map();
  const failures = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text,
      );
    if (message.method === "Network.requestWillBeSent")
      requests.set(message.params.requestId, message.params.request.url.split("?")[0]);
    if (message.method === "Network.loadingFailed")
      failures.push({
        url: requests.get(message.params.requestId),
        error: message.params.errorText,
      });
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400)
      failures.push({
        url: message.params.response.url.split("?")[0],
        status: message.params.response.status,
      });
  });
  const call = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      socket.send(JSON.stringify({ id: n, method, params }));
    });
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Page.navigate", { url: process.argv[2] || "http://127.0.0.1:3002/map" });
  let result;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    result = await call("Runtime.evaluate", {
      expression:
        "JSON.stringify({url:location.origin+location.pathname,text:document.body.innerText.slice(0,2000),canvas:document.querySelectorAll('canvas').length})",
      returnByValue: true,
    });
    const value = result.result?.result?.value;
    if (value && JSON.parse(value).text.trim()) break;
  }
  console.log(result.result?.result?.value);
  console.log(JSON.stringify({ errors, failures }));
  if (
    errors.length ||
    failures.length ||
    !result.result?.result?.value ||
    !JSON.parse(result.result.result.value).text.trim()
  )
    process.exitCode = 1;
} finally {
  socket?.close();
  browser.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1000);
}
