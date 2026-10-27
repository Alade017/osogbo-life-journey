// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `messaging-${process.pid}.html`);
const dist = resolve(".smoke", `messaging-build-${process.pid}`);
const screenshot = resolve(".smoke/messaging-375.png");
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
const mock = String.raw`window.messageCalls=[];window.messageReject=false;
const owner='11111111-1111-4111-8111-111111111111', thread='33333333-3333-4333-8333-333333333333', peer='22222222-2222-4222-8222-222222222222';
const person={id:thread,character_id:peer,player_name:'Ayo',gender:'female',appearance:{},level:2,created_at:'2026-10-27T12:00:00Z',last_activity:'2026-10-27T12:00:00Z',preview:'See you soon',unread_count:0,pinned_at:null,muted_until:null};
const messages=[{id:'44444444-4444-4444-8444-444444444444',sender_character_id:peer,sender_name:'Ayo',channel:'private',conversation_id:thread,location_id:null,body:'See you soon',message_type:'text',created_at:'2026-10-27T12:00:00Z'}];
window.fetch=async(url,options={})=>{window.messageCalls.push({url,options});if(url==='/api/threads/')return Response.json([{...person}]);if(url==='/api/messages/send'){const data=JSON.parse(options.body);if(window.messageReject)return Response.json({error:{code:'MESSAGE_RATE_LIMIT'}},{status:429});messages.push({...messages[0],...data,id:crypto.randomUUID(),sender_character_id:owner,sender_name:'Ade',reply_to_message_id:data.replyToMessageId,reply_body:'See you soon',reply_sender_name:'Ayo'});return Response.json({id:messages.at(-1).id});}if(url.endsWith('/pin'))person.pinned_at=new Date().toISOString();if(url.endsWith('/mute'))person.muted_until='2099-01-01T00:00:00Z';return Response.json({ok:true});};
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'fixture-token'}}}),getUser:async()=>({data:{user:{id:owner}}})},channel:()=>{const c={on:()=>c,subscribe:()=>c};return c;},removeChannel:async()=>{},rpc:async(name)=>{if(name==='get_player_social_overview')return {data:{friends:[],incoming:[],outgoing:[],blocked:[],conversations:[person]}};if(name==='get_social_messages')return {data:[...messages]};if(name==='get_friend_status_posts')return {data:[]};throw Error('Unexpected RPC '+name);}};`;
const html = String.raw`<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root" class="phone-app-view" style="height:100dvh;max-width:375px;box-sizing:border-box;display:flex;flex-direction:column"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PlayerSocial} from '/src/components/game/PlayerSocial.tsx';import '/src/styles.css';import '/src/components/game/phone.css';import {Toaster} from 'sonner';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(PlayerSocial,{phoneMode:true,initialTab:'messages'}),React.createElement(Toaster)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<100;i++){if(p())return;await pause(30);}throw Error('State did not settle');};const overflow=()=>document.documentElement.scrollWidth>innerWidth;const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);const row=()=>document.querySelector('.phone-conversation');const menu=()=>row().dispatchEvent(new MouseEvent('contextmenu',{bubbles:true}));
const input=text=>{const el=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));};
try{
await wait(()=>row());if(overflow())throw Error('Inbox overflow');menu();await wait(()=>button('Pin chat'));button('Pin chat').click();await wait(()=>window.messageCalls.some(c=>c.url.endsWith('/pin')));await wait(()=>!document.querySelector('[role="menu"]'));menu();await wait(()=>button('8 hours'));button('8 hours').click();await wait(()=>window.messageCalls.some(c=>c.url.endsWith('/mute')));await wait(()=>!document.querySelector('[role="menu"]'));
row().click();await wait(()=>button('Reply'));button('Reply').click();await wait(()=>document.body.textContent.includes('Reply to Ayo'));input('I will be there');document.querySelector('textarea').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait(()=>window.messageCalls.some(c=>c.url==='/api/messages/send'));await wait(()=>document.querySelector('textarea').value==='');
const sent=window.messageCalls.find(c=>c.url==='/api/messages/send');if(!JSON.parse(sent.options.body).replyToMessageId)throw Error('Reply metadata missing');
window.messageReject=true;input('Keep this draft');document.querySelector('textarea').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait(()=>document.body.textContent.includes('MESSAGE_RATE_LIMIT'));if(document.querySelector('textarea').value!=='Keep this draft')throw Error('Draft lost');if(overflow())throw Error('Thread overflow');
document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:overflow(),states:['inbox','pin','mute','thread','quoted-reply','rate-error-draft-retained'],fixtureOnly:true}));
}catch(error){document.body.dataset.result=btoa(JSON.stringify({status:'failed',message:String(error),text:document.body.textContent.slice(-1500)}));}
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
        { find: "@/integrations/supabase/client", replacement: "\0messaging-fixture-rpc" },
        { find: "@/lib/game", replacement: "\0messaging-game" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "messaging-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/lib/game") return "\0messaging-game";
          if (source === "@/integrations/supabase/client") return "\0messaging-fixture-rpc";
        },
        load(id) {
          if (id === "\0messaging-game")
            return `export const q={character:()=>({queryKey:["character"],queryFn:async()=>({id:"11111111-1111-4111-8111-111111111111",current_location_id:null})}),locations:()=>({queryKey:["locations"],queryFn:async()=>[]})};`;
          if (id === "\0messaging-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-messaging-${process.pid}`)}`,
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
