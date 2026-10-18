import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

await mkdir(".smoke", { recursive: true });
const fixtureName = `map-runtime-check-${process.pid}.html`;
await writeFile(
  `public/${fixtureName}`,
  "<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><div id=\"fixture\" style=\"height:700px\"></div>\n<script type=\"module\">\nimport React from '/node_modules/.vite-game/deps/react.js';\nimport ReactDOM from '/node_modules/.vite-game/deps/react-dom_client.js';\nimport RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;\nconst {MapCanvas}=await import('/src/components/map/MapCanvas.tsx');\nimport '/src/styles.css';\nconst h=React.createElement;const root=ReactDOM.createRoot(document.getElementById('fixture'));const draw=(filter='all')=>root.render(h(React.StrictMode,null,h(MapCanvas,{activeFilter:filter,onSelectDistrict:()=>{},onSelectLandmark:()=>{}})));\ndraw();let run;\nwindow.checkMap=()=>run??=(async()=>{\n for(let i=0;i<30&&!document.querySelector('.town-place-bubble');i++) await new Promise(r=>setTimeout(r,500));\n const before=document.querySelector('.town-place-bubble');before?.focus();\n const started=performance.now();\n for(let i=0;i<6;i++){draw(i%2?'all':'food');await new Promise(r=>setTimeout(r,100));}\n const retained=before===document.querySelector('.town-place-bubble');\n const overlays=document.querySelectorAll('.town-place-bubble').length;\n const moved=document.querySelector('[data-scene-overlay]');if(moved){const other=document.createElement('div');document.body.append(other);other.append(moved);}root.unmount();await new Promise(r=>setTimeout(r,1500));\n return JSON.stringify({text:'Map lifecycle check completed',overlays,retained,duration:performance.now()-started,remainingCanvas:document.querySelectorAll('canvas').length});\n})();\n</script>",
);
const port = 9400 + Math.floor(Math.random() * 1000);
const browser = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--disable-extensions",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${resolve(tmpdir(), `osun-map-check-${process.pid}`)}`,
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
  const warnings = [];
  const requests = new Map();
  const failures = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      errors.push(message.params.args.map((a) => a.value || a.description).join(" "));
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "warning")
      warnings.push(message.params.args.map((a) => a.value || a.description).join(" "));
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
  await call("Emulation.setDeviceMetricsOverride", {
    width: Number(process.argv[2] || 360),
    height: 740,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Page.navigate", { url: `http://127.0.0.1:3002/${fixtureName}` });
  let result;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    result = await call("Runtime.evaluate", {
      expression: "(async () => window.checkMap ? await window.checkMap() : undefined)()",
      awaitPromise: true,
      returnByValue: true,
    });
    const value = result.result?.result?.value;
    if (value && JSON.parse(value).text.trim()) break;
  }
  console.log(result.result?.result?.value);
  console.log(
    JSON.stringify({ errorCount: errors.length, errors: errors.slice(0, 6), warnings, failures }),
  );
  const check = JSON.parse(result.result?.result?.value || "null");
  if (
    !check ||
    !check.retained ||
    !check.overlays ||
    check.remainingCanvas ||
    warnings.some((w) => w.includes("THREE.Clock"))
  )
    process.exitCode = 1;
  if (
    errors.length ||
    failures.length ||
    !result.result?.result?.value ||
    !JSON.parse(result.result.result.value).text.trim()
  )
    process.exitCode = 1;
} finally {
  await unlink(`public/${fixtureName}`).catch(() => {});
  socket?.close();
  browser.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1000);
}
