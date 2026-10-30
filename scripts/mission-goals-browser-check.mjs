// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `mission-goals-${process.pid}.html`);
const dist = resolve(".smoke", `mission-goals-build-${process.pid}`);
const screenshot = resolve(".smoke/mission-goals-375.png");
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
const mock = `export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'u'},access_token:'fixture'}}})},from:table=>{const result=()=>({error:table==='player_missions'&&window.goalError?{message:'Unavailable'}:null,data:table==='player_missions'?window.goalRows:table==='food_vendors'?[{id:'v'}]:[{vendor_id:'v',price_minor:1800}]});const chain={eq:()=>chain,then:(done)=>Promise.resolve(result()).then(done),maybeSingle:async()=>({data:{id:'c',user_id:'u'},error:null})};return {select:()=>chain};}};`;
const html = `<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {createRouter,createRootRoute,createRoute,RouterProvider,Outlet} from '@tanstack/react-router';
import {HomeDashboard} from '/src/components/game/HomeDashboard.tsx';import '/src/styles.css';import '/src/components/game/housing/house-screen.css';
window.goalRows=[{id:'m',user_id:'u',character_id:'c',status:'in_progress',progress:3500,mission:{id:'m',slug:'earn_10000',title:'Earn your first \u20a610,000',description:'Earn \u20a610,000 in total from job shifts.',target:10000,reward_money:2000,reward_xp:40,sort_order:1}}];
window.fixtureReads=[];window.fetch=async(url,init)=>{window.fixtureReads.push({url,init});return {ok:true,json:async()=>({propertyId:'p',tenure:'rented',weeklyRentMinor:3500,status:'grace',dueAt:'2026-10-25T10:00:00Z',graceEndsAt:'2026-10-26T10:00:00Z'})};};
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const root=createRootRoute({component:Outlet});const auth=createRoute({getParentRoute:()=>root,id:'_authenticated',beforeLoad:()=>({user:{id:'u'}}),component:Outlet});
const home=createRoute({getParentRoute:()=>auth,path:'/',component:()=>React.createElement('div',{className:'city-game navigation-redesign'},React.createElement(HomeDashboard,{player:{id:'c',profileId:'u',level:3,cash:100000},location:'Residential District',unread:2},React.createElement('div',{className:'house-page house-page-fill',style:{background:'#e9e0ce',display:'grid',placeItems:'center'}},React.createElement('button',{id:'room-action',onClick:()=>{window.roomClicks=(window.roomClicks??0)+1;}},'Use room fixture'))))});
const missions=createRoute({getParentRoute:()=>auth,path:'/missions',component:()=>React.createElement('p',null,'Missions destination')});const router=createRouter({routeTree:root.addChildren([auth.addChildren([home,missions])])});
createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(RouterProvider,{router})));
const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<100;i++){if(p())return;await pause(30);}throw Error('State did not settle');};
const overflow=()=>document.documentElement.scrollWidth>innerWidth;
try {
await wait(()=>document.querySelector('[role="meter"]'));document.querySelector('#room-action').click();if(window.roomClicks!==1)throw Error('Room fixture input blocked');
const trigger=document.querySelector('[aria-label="Living costs"]');trigger.click();await wait(()=>document.body.textContent.includes('3,500 per week'));document.querySelector('[role="dialog"] button').click();
document.querySelector('[aria-label="Active goal"]').scrollIntoView({block:'center'});await pause(100);if(overflow())throw Error('375px overflow');if(document.querySelector('[role="meter"]').getAttribute('aria-valuenow')!=='3500')throw Error('Wrong progress');
window.goalRows=[{...window.goalRows[0],status:'completed',progress:10000}];await client.invalidateQueries({queryKey:['missions']});await wait(()=>document.body.textContent.includes('Ready to claim in Missions'));
window.goalError=true;await client.invalidateQueries({queryKey:['missions']});await wait(()=>document.querySelector('[role="alert"]'));if(!document.querySelector('[role="meter"]'))throw Error('Lost cached progress');
Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));await wait(()=>document.body.textContent.includes('showing last confirmed'));if(!document.querySelector('[aria-label="Active goal"] button').disabled)throw Error('Offline retry enabled');
Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));window.goalError=false;await client.invalidateQueries({queryKey:['missions']});
document.querySelector('[aria-label="Active goal"] a').click();await wait(()=>document.body.textContent.includes('Missions destination'));await router.navigate({to:'/'});await wait(()=>document.querySelector('[role="meter"]'));document.querySelector('[aria-label="Active goal"]').scrollIntoView({block:'center'});await pause(200);
if(overflow())throw Error('375px overflow');document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:overflow(),states:['goal-progress','ready-reward','cached-error','offline','missions-navigation','living-costs','room-fixture-input'],fixtureOnly:true}));
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
        { find: "@/integrations/supabase/client", replacement: "\0mission-goals-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "mission-goals-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/integrations/supabase/client") return "\0mission-goals-fixture-rpc";
        },
        load(id) {
          if (id === "\0mission-goals-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-goals-${process.pid}`)}`,
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
