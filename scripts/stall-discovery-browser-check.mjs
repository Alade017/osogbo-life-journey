// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `stall-discovery-${process.pid}.html`);
const dist = resolve(".smoke", `stall-discovery-build-${process.pid}`);
const screenshot = resolve(".smoke/stall-discovery-375.png");
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
const mock = String.raw`window.directoryCalls=[];window.directoryFailure=false;window.directoryEmpty=false;
const owner='11111111-1111-4111-8111-111111111111';
const rows=Array.from({length:25},(_,i)=>({id:(i+1).toString(16).padStart(8,'0')+'-2222-4222-8222-222222222222',ownerName:'Owner '+(i+1),name:i===0?'L'.repeat(64):'Sign '+(i+1),goods:i===0?'G'.repeat(200):'Crafts'}));
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:owner}}}})},from:()=>({select:()=>({data:[],eq:()=>({maybeSingle:async()=>({data:null})})})}),rpc:async(name,args)=>{window.directoryCalls.push({name,args});if(name==='get_public_player_stalls'){if(window.directoryFailure)return {error:{code:'PGRST202'}};const available=window.directoryEmpty?[]:rows.filter(r=>!args.p_after||r.id>args.p_after);const items=available.slice(0,args.p_limit);return {data:{items,nextCursor:available.length>args.p_limit?items.at(-1).id:null}};}if(name==='get_stall_income')return {data:{serverTime:'2026-10-28T12:00:00Z',asOf:'2026-10-28T12:00:00Z',date:'2026-10-28',ratePerHour:10,dailyCap:100,retainedDates:7,policyVersion:1,hasStall:false,enrolled:false,isOpen:false,claimable:0,todayEarned:0,todayPaid:0,lastReceipt:null}};throw Error('Unexpected RPC '+name);}};`;
const html = String.raw`<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root" class="phone-app-view" style="height:100dvh;max-width:375px;box-sizing:border-box;display:flex;flex-direction:column"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PhoneMarketApp} from '/src/components/game/phone/PhoneMarketApp.tsx';import '/src/components/game/phone.css';import '/src/styles.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(PhoneMarketApp)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<100;i++){if(p())return;await pause(30);}throw Error('State did not settle');};const overflow=()=>document.documentElement.scrollWidth>innerWidth;const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);const listing=()=>document.querySelector('[aria-label="Open player stalls"]');
try{
await wait(()=>button('Save stall details'));if(window.directoryCalls.some(c=>c.name==='get_public_player_stalls'))throw Error('Inactive directory fetched');button('Player stalls').click();await wait(()=>listing()?.children.length===20);if(overflow())throw Error('Long text overflow');if([...document.querySelectorAll('section[aria-label="Player stall directory"] button')].some(b=>/save|claim|buy|open|close/i.test(b.textContent)))throw Error('Visitor owner action');
button('Load more stalls').click();await wait(()=>listing().children.length===25);
Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));await wait(()=>button('Refresh stalls').disabled);if(!document.body.textContent.includes('cached listings'))throw Error('Offline cache missing');
Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));await wait(()=>!button('Refresh stalls').disabled);window.directoryFailure=true;button('Refresh stalls').click();await wait(()=>document.querySelector('[role="alert"]'));button('City Shops').click();await wait(()=>document.body.textContent.includes('No shops currently open'));window.directoryFailure=false;button('Player stalls').click();await wait(()=>listing()?.children.length);await wait(()=>!button('Refresh stalls').disabled);window.directoryEmpty=true;button('Refresh stalls').click();await wait(()=>document.body.textContent.includes('No other player stalls are open'));
window.directoryEmpty=false;button('Refresh stalls').click();await wait(()=>listing()?.children.length===20);if(overflow())throw Error('Directory overflow');if(window.directoryCalls.some(c=>!['get_stall_income','get_public_player_stalls'].includes(c.name)))throw Error('Directory mutation');
document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:overflow(),states:['lazy-tab','public-projection','pagination','offline-cache','error','shops-still-usable','empty','refresh','long-sign'],fixtureOnly:true}));
}catch(error){document.body.dataset.result=btoa(JSON.stringify({status:'failed',message:String(error),text:document.body.textContent.slice(-1400)}));}
</script></body></html>`;
const game = String.raw`export const q={character:()=>({queryKey:['character'],queryFn:async()=>({id:'fixture-character',user_id:'11111111-1111-4111-8111-111111111111',name:'Ade'})}),wallet:()=>({queryKey:['wallet'],queryFn:async()=>({balance:100})}),inventory:()=>({queryKey:['inventory'],queryFn:async()=>[]}),shopItems:()=>({queryKey:['shopItems'],queryFn:async()=>[]}),locations:()=>({queryKey:['locations'],queryFn:async()=>[]})};export const rpc={purchaseShopItem:()=>{},sellInventoryItem:()=>{}};export const useGameAction=()=>({mutate:()=>{throw Error('Unexpected purchase');},isPending:false});export const formatNaira=n=>'NGN '+(n??0);`;
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
        { find: "@/integrations/supabase/client", replacement: "\0stall-discovery-fixture-rpc" },
        { find: "@/lib/game", replacement: "\0directory-game" },
        { find: "@/hooks/use-world-clock", replacement: "\0directory-clock" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "stall-discovery-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/lib/game") return "\0directory-game";
          if (source === "@/hooks/use-world-clock") return "\0directory-clock";
          if (source === "@/integrations/supabase/client") return "\0stall-discovery-fixture-rpc";
        },
        load(id) {
          if (id === "\0directory-game") return game;
          if (id === "\0directory-clock")
            return "export const useWorldClock=()=>({data:{hour:12}});";
          if (id === "\0stall-discovery-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-directory-${process.pid}`)}`,
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
