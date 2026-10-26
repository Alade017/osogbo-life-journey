// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `party-rewards-${process.pid}.html`);
const dist = resolve(".smoke", `party-rewards-build-${process.pid}`);
const screenshot = resolve(".smoke/party-rewards-375.png");
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
const mock = `window.partyCalls=[];window.partyFailure=false;const eventId='11111111-1111-4111-8111-111111111111';let receipt=null;export const supabase={rpc:async(name,args)=>{window.partyCalls.push({name,args});if(name==='get_party_host_results'){if(window.partyFailure)return {error:{message:'fixture unavailable'}};return {data:{serverTime:'2026-10-26T16:00:00Z',date:'2026-10-26',reward:1,events:[{eventId,title:'Fictional evening gathering',endsAt:'2026-10-26T15:00:00Z',claimUntil:'2026-11-02T15:00:00Z',requirements:2,completed:2,guests:3,reason:receipt?'claimed':'eligible',receipt}]}};}if(name==='claim_party_host_reward')return new Promise(resolve=>{window.partyConfirm=()=>{receipt={eventId,date:'2026-10-26',awardedAt:'2026-10-26T16:00:00Z',reward:1,reputationDelta:1,reputationAfter:11};resolve({data:{...receipt,newlyAwarded:true}});};});throw Error('Unexpected RPC '+name);}};`;
const html = `<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root" style="padding:12px;max-width:375px;box-sizing:border-box"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PartyHostResults} from '/src/components/game/PartyHostResults.tsx';import '/src/styles.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(PartyHostResults,{userId:'fixture-owner'}),React.createElement('p',null,'Existing party remains available')));
const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<100;i++){if(p())return;await pause(30);}throw Error('State did not settle');};const overflow=()=>document.documentElement.scrollWidth>innerWidth;
const button=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Claim reputation');
try{
await wait(()=>button());if(overflow())throw Error('Ready overflow');
Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));await wait(()=>button().disabled);
button().click();if(window.partyCalls.some(c=>c.name==='claim_party_host_reward'))throw Error('Offline claim');
Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));await wait(()=>!button().disabled);
button().click();await wait(()=>window.partyConfirm);if(!document.body.textContent.includes('Confirming'))throw Error('Missing pending');
window.partyConfirm();await wait(()=>document.body.textContent.includes('Reward claimed'));if(overflow())throw Error('Claimed overflow');
window.partyFailure=true;await client.invalidateQueries();await wait(()=>document.body.textContent.includes('Party results are unavailable'));if(!document.body.textContent.includes('Existing party remains available'))throw Error('Failure blocks party');
window.partyFailure=false;[...document.querySelectorAll('button')].find(b=>b.textContent==='Retry results').click();await wait(()=>!document.querySelector('[role="alert"]'));
const claims=window.partyCalls.filter(c=>c.name==='claim_party_host_reward');if(claims.length!==1||claims[0].args.p_date!=='2026-10-26'||claims[0].args.p_event_id!=='11111111-1111-4111-8111-111111111111')throw Error('Incorrect claim command');
document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:overflow(),states:['ready','offline','pending','claimed','unavailable','retry'],claims:claims.length,fixtureOnly:true}));
}catch(error){document.body.dataset.result=btoa(JSON.stringify({status:'failed',message:String(error)}));}
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
        { find: "@/integrations/supabase/client", replacement: "\0party-rewards-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "party-rewards-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/integrations/supabase/client") return "\0party-rewards-fixture-rpc";
        },
        load(id) {
          if (id === "\0party-rewards-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-party-${process.pid}`)}`,
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
