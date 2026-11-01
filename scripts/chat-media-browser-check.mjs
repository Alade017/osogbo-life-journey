// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `chat-media-${process.pid}.html`);
const dist = resolve(".smoke", `chat-media-build-${process.pid}`);
const screenshot = resolve(".smoke/chat-media-375.png");
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
const mock =
  "const uid='11111111-1111-4111-8111-111111111111',me='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',friend='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',thread='cccccccc-cccc-4ccc-8ccc-cccccccccccc';\nconst player={id:thread,character_id:friend,player_name:'Ayo',gender:'female',appearance:{},level:4,created_at:'2026-11-01T10:00:00Z'};\nconst channel=()=>({on(){return this},subscribe(){return this},unsubscribe:async()=>{}});\nexport const supabase={auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{id:uid}}}}),getUser:async()=>({data:{user:{id:uid}}})},channel,removeChannel:async()=>{},rpc:async(name)=>({data:name==='get_player_social_overview'?{friends:[player],incoming:[],outgoing:[],blocked:[],conversations:[player]}:name.startsWith('get_social_messages')?[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',sender_character_id:friend,sender_name:'Ayo',channel:'private',conversation_id:thread,body:'See you at the market!',message_type:'text',created_at:'2026-11-01T10:00:00Z'}]:[]}),from:table=>{let proxy;const data=table==='characters'?{id:me,user_id:uid,current_location_id:null}:[];proxy=new Proxy({},{get:(_,key)=>key==='then'?(done)=>Promise.resolve({data,error:null}).then(done):()=>proxy});return proxy}};";
const html =
  "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><link rel=\"icon\" href=\"data:,\"/></head><body><div id=\"root\"></div><script type=\"module\">\nimport React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{createRootRoute,createRouter,RouterProvider}from'@tanstack/react-router';import{PlayerSocial}from'/src/components/game/PlayerSocial.tsx';import'/src/styles.css';import'/src/components/game/phone.css';\nwindow.MediaRecorder=class{static isTypeSupported(){return true}};window.fixtureUploads=[];\nwindow.fetch=async(url,init)=>{if(String(url).includes('/api/messages/media/')){window.fixtureUploads.push(init);return{ok:true,json:async()=>({ok:true})}};if(String(url).includes('/api/social/profile/'))return{ok:true,json:async()=>({characterId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',name:'Ayo',gender:'female',appearance:{},level:4,isOwn:false,isFriend:true,coverUrl:null,status:{body:'Available for a chat',theme:'leaf',expiresAt:'2026-11-02T00:00:00Z'}})};return{ok:true,json:async()=>String(url)==='/api/threads/'?[]:{ok:true}};};\nconst h=React.createElement;const client=new QueryClient({defaultOptions:{queries:{retry:false}}});const root=createRootRoute({component:()=>h('div',{className:'city-game navigation-redesign'},h('div',{className:'phone-app-body',style:{height:'760px',maxHeight:'100dvh',width:'100%',padding:'0'}},h(PlayerSocial,{initialTab:'messages',phoneMode:true})))});createRoot(document.getElementById('root')).render(h(QueryClientProvider,{client},h(RouterProvider,{router:createRouter({routeTree:root})})));\nconst pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<300;i++){if(p())return;await pause(40)}throw Error('Fixture did not settle: '+document.body.textContent.slice(-400));};const button=name=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===name);const overflow=()=>document.documentElement.scrollWidth>innerWidth;\ntry{await wait(()=>document.querySelector('.phone-conversation-open'));if(document.body.textContent.includes('Public profiles show'))throw Error('Footer still present');\ndocument.querySelector('.chat-avatar-button').click();await wait(()=>document.body.textContent.includes('Available for a chat'));if(!document.body.textContent.includes('Level 4'))throw Error('Profile missing level');[...document.querySelectorAll('[role=dialog] button')].find(x=>x.textContent.includes('Close')).click();await wait(()=>!document.querySelector('[role=dialog]'));\ndocument.querySelector('.phone-conversation-open').click();await wait(()=>document.querySelector('.voice-record-button'));const form=document.querySelector('.phone-chat-composer');if(!form.contains(document.querySelector('.voice-record-button')))throw Error('Recorder outside composer');\nconst controls=[...form.querySelectorAll('.phone-chat-utility,.voice-record-button,.phone-chat-send')];if(controls.length!==5||controls.some(x=>x.disabled&&x.getAttribute('aria-label')!=='Send message'))throw Error('Inactive controls');const rects=controls.map(x=>x.getBoundingClientRect());if(rects.some(x=>x.width<44||x.height<44))throw Error('Small touch target');\ndocument.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,avatarProfile:true,footerRemoved:true,recorderInComposer:true,activeControls:controls.length,overflow:overflow()}));if(overflow())throw Error('Horizontal overflow');\n}catch(e){document.body.dataset.result=btoa(JSON.stringify({status:'failed',viewport:innerWidth,error:String(e)}));}\n</script></body></html>";
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
        // Keep this fixture focused on living costs; goals have their own browser check.
        { find: "@/components/game/ActiveGoalSummary", replacement: "\0cost-goals-stub" },
        { find: "@/integrations/supabase/client", replacement: "\0chat-media-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "chat-media-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/integrations/supabase/client") return "\0chat-media-fixture-rpc";
        },
        load(id) {
          if (id === "\0cost-goals-stub") return "export const ActiveGoalSummary=()=>null;";
          if (id === "\0chat-media-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-chat-media-${process.pid}`)}`,
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
