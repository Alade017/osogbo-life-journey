// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `character-studio-${process.pid}.html`);
const dist = resolve(".smoke", `character-studio-build-${process.pid}`);
const screenshot = resolve(".smoke/character-studio.png");
const errors = [];
let browser, server, socket;
let sequence = 0;
const pending = new Map();
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
function call(method, params = {}) {
  return new Promise((done, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`DevTools timeout: ${method}`));
    }, 15000);
    pending.set(id, { done, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const mocks = {
  "@/integrations/supabase/client": "export const supabase={rpc:async()=>({error:null})};",
  "@/lib/game":
    "export const q={character:()=>({queryKey:['character'],queryFn:async()=>null}),jobs:()=>({queryKey:['jobs'],queryFn:async()=>[{slug:'developer',name:'Software developer'}]})};",
  "@tanstack/react-router":
    "export const createFileRoute=()=>config=>config;export const useNavigate=()=>navigate;const navigate=async()=>{};",
};
const html = `<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0"><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {CreateCharacter} from '/src/routes/_authenticated/create-character.tsx';import '/src/styles.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(CreateCharacter)));
</script></body></html>`;

try {
  await mkdir(resolve(".smoke"), { recursive: true });
  if (!dist.startsWith(resolve(".smoke") + sep)) throw new Error("Invalid fixture output");
  await writeFile(fixture, html);
  const result = await build({
    configFile: false,
    publicDir: false,
    logLevel: "error",
    resolve: {
      alias: [
        ...Object.keys(mocks).map((find) => ({ find, replacement: "\0studio:" + find })),
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "character-studio-fixture",
        enforce: "pre",
        resolveId(source) {
          if (source.startsWith("\0studio:")) return source;
        },
        load(id) {
          if (id.startsWith("\0studio:")) return mocks[id.slice(8)];
        },
      },
    ],
    build: { outDir: dist, emptyOutDir: false, rolldownOptions: { input: fixture } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output ?? []);
  const entry = outputs.find((o) => o.fileName.endsWith(".html"))?.fileName;
  if (!entry) throw new Error("Missing fixture entry");
  if (process.env["STUDIO_BUILD_ONLY"] === "1") {
    console.log(JSON.stringify({ status: "built", entry }));
  } else {
    server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, "http://fixture").pathname;
        const file = resolve(dist, pathname === "/" ? entry : pathname.replace(/^\/+/, ""));
        if (!file.startsWith(dist + sep)) throw new Error("Invalid path");
        let bytes = await readFile(file);
        // Only fixture responses omit remote fonts; production styles remain untouched.
        if (extname(file) === ".css")
          bytes = Buffer.from(
            bytes.toString().replace(/@import\s+"https:\/\/fonts\.googleapis\.com\/[^\"]+";/g, ""),
          );
        response.writeHead(200, {
          "Content-Type":
            { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(file)] ??
            "application/octet-stream",
        });
        response.end(bytes);
      } catch {
        errors.push(request.url);
        response.writeHead(404);
        response.end();
      }
    });
    await new Promise((done, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", done);
    });
    let executable;
    for (const candidate of [
      process.env.CHROME_PATH,
      "/usr/bin/chromium",
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ].filter(Boolean)) {
      try {
        await access(candidate);
        executable = candidate;
        break;
      } catch {
        /* Next browser. */
      }
    }
    if (!executable) throw new Error("Set CHROME_PATH to an installed Chrome/Edge executable");
    const port = 11500 + Math.floor(Math.random() * 1000);
    browser = spawn(
      executable,
      [
        "--headless",
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
        "--no-first-run",
        "--disable-extensions",
        "--hide-scrollbars",
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${resolve(tmpdir(), `osogbo-stall-${process.pid}`)}`,
        "about:blank",
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let diagnostics = "";
    browser.stderr.on("data", (data) => {
      diagnostics = (diagnostics + data).slice(-3000);
    });
    browser.on("error", (error) => errors.push(error.message));
    let tab;
    for (let index = 0; index < 40; index++) {
      try {
        const tabs = await (
          await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1000) })
        ).json();
        tab = tabs.find((t) => t.type === "page");
        if (tab) break;
      } catch {
        /* Browser startup. */
      }
      await pause(250);
    }
    if (!tab) throw new Error(`Browser did not start: ${diagnostics}`);
    socket = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error("DevTools did not open")), 10000);
      socket.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          done();
        },
        { once: true },
      );
      socket.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("DevTools failed"));
        },
        { once: true },
      );
    });
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      const item = pending.get(message.id);
      if (item) {
        clearTimeout(item.timer);
        pending.delete(message.id);
        message.error ? item.reject(new Error(message.error.message)) : item.done(message.result);
      }
      if (message.method === "Runtime.exceptionThrown")
        errors.push(message.params.exceptionDetails.text);
      if (
        message.method === "Network.requestWillBeSent" &&
        /^https?:/.test(message.params.request.url) &&
        !message.params.request.url.startsWith(`http://127.0.0.1:${server.address().port}/`)
      )
        errors.push(`External request: ${message.params.request.url}`);
    });
    await call("Runtime.enable");
    await call("Network.enable");
    await call("Emulation.setFocusEmulationEnabled", { enabled: true });
    async function evaluate(expression) {
      const result = await call("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result?.value;
    }
    await call("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 1100,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}` });
    for (let i = 0; i < 120; i++) {
      if (
        await evaluate(
          "!!document.querySelector('canvas') && !!document.querySelector('.cs-primary')",
        )
      )
        break;
      if (i === 119) throw new Error("Studio did not mount");
      await pause(200);
    }
    await pause(1200);
    const reports = [];
    for (const [width, height, mobile] of [
      [1280, 1100, false],
      [375, 1100, true],
    ]) {
      await call("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await evaluate(
        `window.scrollTo(0,0);[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify("Female")}).click()`,
      );
      await pause(700);
      const report = await evaluate(
        `({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,canvasWidth:document.querySelector('canvas').width,stageWidth:document.querySelector('.cs-stage').getBoundingClientRect().width})`,
      );
      if (report.overflow || report.canvasWidth < 100) throw new Error(JSON.stringify(report));
      reports.push(report);
      const shot = await call("Page.captureScreenshot", { format: "png" });
      await writeFile(
        screenshot.replace(/\.png$/, `-${width}.png`),
        Buffer.from(shot.data, "base64"),
      );
    }
    await evaluate(
      "[...document.querySelectorAll('button')].find(b=>b.textContent==='Next: your story').click()",
    );
    await pause(100);
    if (!(await evaluate("!!document.querySelector('#character-name')")))
      throw new Error("Story step missing");
    if (errors.length) throw new Error(JSON.stringify(errors));
    console.log(
      JSON.stringify({
        status: "passed",
        reports,
        screenshot: screenshot.replace(/\.png$/, "-1280.png"),
      }),
    );
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  for (const item of pending.values()) clearTimeout(item.timer);
  socket?.close();
  browser?.kill();
  server?.closeAllConnections();
  server?.close();
  await unlink(fixture).catch(() => {});
}
