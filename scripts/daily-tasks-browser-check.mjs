// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `daily-tasks-${process.pid}.html`);
const dist = resolve(".smoke", `daily-tasks-build-${process.pid}`);
const screenshot = resolve(".smoke/daily-tasks-375.png");
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
const mock = `const tasks=[
 {key:'meal',title:'Complete a meal',action:'eat',rewardXp:5,completed:true,claimed:false},
 {key:'study',title:'Complete a study session',action:'study',rewardXp:5,completed:false,claimed:false},
 {key:'social',title:'Complete a social activity',action:'socialize',rewardXp:5,completed:true,claimed:true}];
 window.dailyCalls=[];export const supabase={rpc:async(name,args)=>{
 window.dailyCalls.push({name,args});
 if(name==='get_daily_tasks')return {data:{date:'2026-10-25',serverTime:'2026-10-25T12:00:00Z',resetsAt:'2026-10-25T23:00:00Z',tasks:structuredClone(tasks)},error:null};
 if(name==='claim_daily_task'){tasks[0].claimed=true;return {data:{key:args.p_task_key,date:args.p_date,rewardXp:5,claimed:true,claimedAt:'2026-10-25T12:00:01Z'},error:null};}
 throw Error('Unexpected RPC '+name);
}};`;
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><main id="root" style="padding:16px;min-width:0"></main><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {DailyTasks} from '/src/components/game/DailyTasks.tsx';
import '/src/styles.css';
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(React.Fragment,null,
React.createElement(DailyTasks,{userId:'fixture-account'}),React.createElement('h2',null,'Lifetime missions'))));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(let i=0;i<100&&!document.querySelector('article');i++)await pause(30);
 const buttons=[...document.querySelectorAll('article button')];
 if(buttons.length!==3||buttons[0].disabled||!buttons[1].disabled||!buttons[2].disabled)throw Error('Eligibility controls incorrect');
 buttons[0].click();buttons[0].click();
 for(let i=0;i<100&&!document.body.textContent.includes('Reward claimed: +5 XP');i++)await pause(30);
 const claims=window.dailyCalls.filter(c=>c.name==='claim_daily_task');
 if(claims.length!==1||claims[0].args.p_date!=='2026-10-25')throw Error('Claim contract incorrect');
 if(!document.body.textContent.includes('Reward claimed: +5 XP'))throw Error('Confirmed reward missing');
 const overflow=document.documentElement.scrollWidth>innerWidth;
 if(overflow||errors.length)throw Error(JSON.stringify({overflow,errors}));
 document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow,cards:3,claims:claims.length,errors,fixtureOnly:true}));
}catch(error){document.body.dataset.result=btoa(JSON.stringify({status:'failed',message:String(error),errors}));}
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
        { find: "@/integrations/supabase/client", replacement: "\0daily-task-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "daily-task-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/integrations/supabase/client") return "\0daily-task-fixture-rpc";
        },
        load(id) {
          if (id === "\0daily-task-fixture-rpc") return mock;
        },
      },
    ],
    build: { outDir: dist, emptyOutDir: false, rolldownOptions: { input: fixture } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output ?? []);
  const entry = outputs.find((o) => o.fileName.endsWith(".html"))?.fileName;
  if (!entry) throw new Error("Missing fixture entry");
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
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${resolve(tmpdir(), `osogbo-daily-${process.pid}`)}`,
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
  await call("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Page.navigate", { url: `http://127.0.0.1:${server.address().port}` });
  let encoded;
  for (let index = 0; index < 100; index++) {
    const state = await call("Runtime.evaluate", {
      expression: "document.body?.dataset.result",
      returnByValue: true,
    });
    encoded = state.result?.value;
    if (encoded) break;
    await pause(100);
  }
  if (!encoded) throw new Error(`Browser did not finish fixture: ${diagnostics}`);
  const shot = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(screenshot, Buffer.from(shot.data, "base64"));
  const report = JSON.parse(Buffer.from(encoded, "base64").toString());
  if (report.status !== "passed" || report.viewport !== 375 || errors.length)
    throw new Error(JSON.stringify({ report, errors }));
  console.log(JSON.stringify(report));
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
