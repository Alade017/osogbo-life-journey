// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `career-promotion-${process.pid}.html`);
const dist = resolve(".smoke", `career-promotion-build-${process.pid}`);
const screenshot = resolve(".smoke/career-promotion-375.png");
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
const mock = `const id='11111111-1111-4111-8111-111111111111';window.careerCalls=[];window.careerState={level:1,active:true};
const ranks=[{path_slug:'banking',level:1,title:'Banking Assistant',salary:3500,required_shifts:0,required_skill_level:0,steps:['Prepare','Help','Report']},{path_slug:'banking',level:2,title:'Customer Service Officer',salary:5000,required_shifts:5,required_skill_level:1,steps:['Review','Resolve','Report']},{path_slug:'banking',level:3,title:'Branch Supervisor',salary:7000,required_shifts:15,required_skill_level:3,steps:['Plan','Support','Report']}];
export const supabase={from:table=>{const builder={select:()=>builder,order:()=>builder,limit:()=>builder,then:ok=>Promise.resolve({data:table==='career_paths'?[{slug:'banking',name:'Banking',description:'Banking',mood_reward:2}]:table==='career_ranks'?ranks:window.careerState.active?[{id,character_job_id:id,location_id:id,path_slug:'banking',rank_level:1,step_count:0,status:'active',started_at:'2026-10-26T12:00:00Z',completed_at:null,paid_amount:0,next_step_at:'2026-10-26T12:00:15Z'}]:[],error:null}).then(ok)};return builder;},rpc:async(name,args)=>{window.careerCalls.push({name,args});if(name!=='promote_career')throw Error('Unexpected RPC '+name);return new Promise(resolve=>{window.careerConfirm=()=>{window.careerState.level=2;resolve({data:{career_level:2,title:'Customer Service Officer',salary:5000},error:null});};});}};`;
const gameMock = `export * from '/src/lib/game.ts';const id='11111111-1111-4111-8111-111111111111';export const q={character:()=>({queryKey:['character'],queryFn:async()=>({id,current_location_id:id,level:1})}),jobs:()=>({queryKey:['jobs'],queryFn:async()=>[{id,slug:'career_cedar_banking',name:'Cedar Bank',description:'Banking',location_id:id,is_available:true,required_level:1,skill_reward_slug:'financial_literacy'}]}),myJobs:()=>({queryKey:['myJobs'],queryFn:async()=>[{is_current:true,job_id:id,career_level:window.careerState.level,times_performed:5}]}),locations:()=>({queryKey:['locations'],queryFn:async()=>[{id,slug:'cedar-bank',name:'Cedar Bank'}]}),playerSkills:()=>({queryKey:['skills'],queryFn:async()=>[{skill_slug:'financial_literacy',level:1}]})};`;
const html = `<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root" style="padding:12px;max-width:375px;box-sizing:border-box"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {createRouter,createRootRoute,RouterProvider} from '@tanstack/react-router';import {CareerPanel} from '/src/components/game/CareerPanel.tsx';import '/src/styles.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});const route=createRootRoute({component:()=>React.createElement(CareerPanel)});createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(RouterProvider,{router:createRouter({routeTree:route})})));
const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<100;i++){if(p())return;await pause(30);}throw Error('State did not settle');};const overflow=()=>document.documentElement.scrollWidth>innerWidth;const button=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Claim promotion');
try{
await wait(()=>button());if(!button().disabled||!document.body.textContent.includes('Finish or cancel your active shift'))throw Error('Active shift did not block promotion');button().click();if(window.careerCalls.length||overflow())throw Error('Blocked action submitted or overflowed');
window.careerState.active=false;await client.invalidateQueries();await wait(()=>button()&&!button().disabled);if(overflow())throw Error('Ready overflow');button().click();await wait(()=>window.careerConfirm);if(!document.body.textContent.includes('Promoting')||!document.body.textContent.includes('Your career · Level 1/3'))throw Error('Optimistic or missing pending state');
window.careerConfirm();await wait(()=>document.body.textContent.includes('Your career · Level 2/3'));if(overflow()||!document.body.textContent.includes('5,000 per completed shift'))throw Error('Confirmed state wrong');
if(window.careerCalls.length!==1||window.careerCalls[0].name!=='promote_career'||window.careerCalls[0].args!==undefined)throw Error('Incorrect promotion command');
document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:overflow(),states:['active-shift-blocked','ready','pending','confirmed'],promotions:window.careerCalls.length,fixtureOnly:true}));
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
        { find: "@/lib/game", replacement: "\0career-fixture-game" },
        { find: "@/integrations/supabase/client", replacement: "\0career-promotion-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "career-promotion-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/lib/game") return "\0career-fixture-game";
          if (source === "@/integrations/supabase/client") return "\0career-promotion-fixture-rpc";
        },
        load(id) {
          if (id === "\0career-fixture-game") return gameMock;
          if (id === "\0career-promotion-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-career-${process.pid}`)}`,
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
