// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `city-events-${process.pid}.html`);
const dist = resolve(".smoke", `city-events-build-${process.pid}`);
const screenshot = resolve(".smoke/city-events-375.png");
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
const hook =
  "import {useQuery} from '@tanstack/react-query';import {cityEventOptions} from '/src/lib/city-event-service.ts';export function useCityEvents(){return useQuery(cityEventOptions('fixture-account','fixture-character'));}";
const mock = `const event={occurrenceId:'11111111-1111-4111-8111-111111111111',id:'market-day',title:'Town Market Day',description:'Meet fictional stallholders and neighbours.',locationSlug:'town-market',locationName:'Town Market',landmarkId:'town-market',districtId:'market-quarter',startsAt:'2026-10-28T08:00:00Z',endsAt:'2026-10-28T15:00:00Z',status:'active',joined:false};
window.eventFixture=event;window.eventCalls=[];export const supabase={rpc:async(name,args)=>{window.eventCalls.push({name,args});
if(name==='get_city_events')return {data:{serverTime:'2026-10-28T08:00:00Z',events:[structuredClone(event)]},error:null};
if(name==='join_city_event_occurrence'){if(args.p_occurrence_id!==event.occurrenceId)throw Error('Incorrect occurrence');event.joined=true;return {data:{joined:true,duplicate:false},error:null};}
throw Error('Unexpected RPC '+name);}};`;
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"></head><body><main id="root" style="padding:16px;min-width:0"></main><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {CityEventParticipation} from '/src/components/game/CityEventParticipation.tsx';import '/src/styles.css';
const errors=[];window.addEventListener('error',e=>errors.push(e.message));
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(CityEventParticipation,{slug:'town-market',isHere:true})));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(predicate)=>{for(let i=0;i<100;i++){if(predicate())return;await pause(30);}throw Error('Fixture state did not settle');};
try{
await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Join event'));
const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Join event');button.click();button.click();
await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Joined'));
const joins=window.eventCalls.filter(c=>c.name==='join_city_event_occurrence');if(joins.length!==1)throw Error('Duplicate join');
for(const [status,label] of [['upcoming','UPCOMING'],['unavailable','VENUE UNAVAILABLE'],['cancelled','CANCELLED']]){
window.eventFixture.status=status;window.eventFixture.startsAt=status==='upcoming'?'2026-10-28T09:00:00Z':'2026-10-28T08:00:00Z';
await client.invalidateQueries({queryKey:['cityEvents']});await wait(()=>document.body.textContent.includes(label));
if([...document.querySelectorAll('button')].some(b=>b.textContent==='Join event'))throw Error('Ineligible join button');
if(document.documentElement.scrollWidth>innerWidth)throw Error('Viewport overflow');}
window.eventFixture.status='active';window.eventFixture.startsAt='2026-10-28T08:00:00Z';await client.invalidateQueries({queryKey:['cityEvents']});
await wait(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Joined'));
if(errors.length)throw Error(JSON.stringify(errors));
document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,joins:joins.length,states:['active','joined','upcoming','unavailable','cancelled'],errors,fixtureOnly:true}));
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
        { find: "@/hooks/use-city-events", replacement: "\0city-event-fixture-hook" },
        { find: "@/integrations/supabase/client", replacement: "\0city-event-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "city-event-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/integrations/supabase/client") return "\0city-event-fixture-rpc";
        },
        load(id) {
          if (id === "\0city-event-fixture-hook") return hook;
          if (id === "\0city-event-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-events-${process.pid}`)}`,
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
