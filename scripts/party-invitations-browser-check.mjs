// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `party-invitations-${process.pid}.html`);
const dist = resolve(".smoke", `party-invitations-build-${process.pid}`);
const screenshot = resolve(".smoke/party-invitations-375.png");
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
const mock = String.raw`window.invitationCalls=[];window.invitationFailure=false;window.role='host';window.extraInvite=false;
const host='11111111-1111-4111-8111-111111111111',recipient='22222222-2222-4222-8222-222222222222',target='33333333-3333-4333-8333-333333333333',event='44444444-4444-4444-8444-444444444444',otherEvent='66666666-6666-4666-8666-666666666666';
const stamp='2026-10-28T12:00:00Z';let invited=false,status='pending',otherStatus='pending';
const row=(other=false)=>({id:other?'77777777-7777-4777-8777-777777777777':'55555555-5555-4555-8555-555555555555',eventId:other?otherEvent:event,title:other?'Another gathering':'Lantern gathering',hostName:'Ade',recipientName:'Bisi',recipientCharacterId:target,venue:'Lantern Hall',startsAt:stamp,endsAt:'2026-10-28T15:00:00Z',status:other?otherStatus:status,phase:'live',isGuest:(other?otherStatus:status)==='accepted',canRespond:window.role==='recipient'&&(other?otherStatus:status)==='pending'});
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.role==='host'?host:recipient}}}})},rpc:async(name,args)=>{window.invitationCalls.push({name,args});if(name==='get_party_invitations'){if(window.invitationFailure)return {error:{code:'PGRST202',message:'missing'}};return {data:{serverTime:stamp,items:invited?[row(),...(window.extraInvite&&!args.p_event_id?[row(true)]:[])]:[],nextCursor:null}};}if(name==='search_player_profiles')return {data:[{character_id:target,player_name:'Bisi',gender:'female',appearance:{},level:2,relationship:'none',request_id:null}]};if(name==='party_invitation_action'){const complete=()=>{const other=args.p_invitation_id==='77777777-7777-4777-8777-777777777777';if(args.p_kind==='send')invited=true;else if(other)otherStatus=args.p_decision;else status=args.p_decision;return {data:{requestId:args.p_request_id,invitationId:row(other).id,eventId:other?otherEvent:event,status:other?otherStatus:status,isNew:args.p_kind==='send',confirmedAt:stamp,duplicate:false}};};if(args.p_kind==='send')return new Promise(resolve=>{window.confirmSend=()=>resolve(complete());});if(args.p_decision==='accepted')return new Promise(resolve=>{window.confirmAccept=()=>resolve(complete());});return complete();}throw Error('Unexpected RPC '+name);}};`;
const html = String.raw`<!doctype html><html><head><link rel="icon" href="data:,"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body><div id="root" class="phone-app-view" style="max-width:375px;box-sizing:border-box;padding:12px"></div><script type="module">
import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {PartyExperience} from '/src/routes/_authenticated/_game/party.tsx';import {Toaster} from 'sonner';import '/src/styles.css';import '/src/components/game/phone.css';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});createRoot(document.querySelector('#root')).render(React.createElement(QueryClientProvider,{client},React.createElement(PartyExperience,{compact:true,initialTab:'events'}),React.createElement(Toaster)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<100;i++){if(p())return;await pause(30);}throw Error('State did not settle');};const overflow=()=>document.documentElement.scrollWidth>innerWidth;const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);const input=text=>{const el=document.querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));};
try{
await wait(()=>button('Invite players and view guests'));if(window.invitationCalls.some(c=>c.name==='get_party_invitations'))throw Error('Host list was not lazy');button('Invite players and view guests').click();await wait(()=>document.querySelector('input'));input('Bisi');document.querySelector('input').closest('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await wait(()=>button('Invite Bisi'));button('Invite Bisi').click();await wait(()=>window.confirmSend);if(!document.body.textContent.includes('Confirming invitation'))throw Error('Missing pending send');window.confirmSend();await wait(()=>document.body.textContent.includes('Player: Bisi'));
window.role='recipient';await client.invalidateQueries({queryKey:['character']});await wait(()=>!button('Invite players and view guests'));button('Invitations').click();await wait(()=>button('Accept Lantern gathering'));
Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));await wait(()=>button('Accept Lantern gathering').disabled);const before=window.invitationCalls.filter(c=>c.name==='party_invitation_action').length;button('Accept Lantern gathering').click();if(window.invitationCalls.filter(c=>c.name==='party_invitation_action').length!==before)throw Error('Offline decision');
Object.defineProperty(navigator,'onLine',{configurable:true,value:true});window.dispatchEvent(new Event('online'));await wait(()=>!button('Accept Lantern gathering').disabled);button('Accept Lantern gathering').click();await wait(()=>window.confirmAccept);if(document.body.textContent.includes('Confirmed guest'))throw Error('Optimistic guest');window.confirmAccept();await wait(()=>document.body.textContent.includes('Confirmed guest'));
window.extraInvite=true;await client.invalidateQueries({queryKey:['partyInvitations']});await wait(()=>button('Decline Another gathering'));button('Decline Another gathering').click();await wait(()=>document.body.textContent.includes('declined'));
window.invitationFailure=true;button('Refresh invitations').click();await wait(()=>document.querySelector('[role="alert"]'));button('Clubs').click();await wait(()=>document.body.textContent.includes('No clubs'));window.invitationFailure=false;button('Invitations').click();await wait(()=>!document.querySelector('[role="alert"]'));if(overflow())throw Error('Phone overflow');const actions=window.invitationCalls.filter(c=>c.name==='party_invitation_action');if(actions.length!==3||actions.some(c=>!c.args.p_request_id))throw Error('Wrong invitation actions');
document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,overflow:overflow(),states:['host-search','pending-send','recipient-inbox','offline','pending-accept','accepted-guest','declined','missing-migration','clubs-still-usable'],fixtureOnly:true}));
}catch(error){document.body.dataset.result=btoa(JSON.stringify({status:'failed',message:String(error),text:document.body.textContent.slice(-1800)}));}
</script></body></html>`;
const game = String.raw`export const q={character:()=>({queryKey:['character'],queryFn:async()=>({id:window.role==='host'?'11111111-1111-4111-8111-111111111111':'33333333-3333-4333-8333-333333333333',user_id:window.role==='host'?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222',name:window.role==='host'?'Ade':'Bisi',current_location_id:null})}),wallet:()=>({queryKey:['wallet'],queryFn:async()=>({balance:100})}),locations:()=>({queryKey:['locations'],queryFn:async()=>[]})};export const formatNaira=n=>'NGN '+(n??0);`;
const party = String.raw`export const listPartyVenues=async()=>[];export const listPartyDrinks=async()=>[];export const listPartyClubActivities=async()=>[];export const getPartyMood=async()=>({score:50});export const getActiveClubVisit=async()=>null;export const getDanceCooldown=async()=>null;export const listPartyEvents=async()=>[{id:'44444444-4444-4444-8444-444444444444',host_character_id:'11111111-1111-4111-8111-111111111111',location_id:'fixture-venue',title:'Lantern gathering',starts_at:new Date(Date.now()-60000).toISOString(),ends_at:new Date(Date.now()+3600000).toISOString(),status:'scheduled',requirements:[]}];export const newPartyRequestId=()=>crypto.randomUUID();export const partyRpc={respondToEvent:()=>{throw Error('Unexpected contribution');},hostEvent:()=>{throw Error('Unexpected hosting');}};`;
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
        { find: "@/integrations/supabase/client", replacement: "\0party-invitations-fixture-rpc" },
        { find: "@/lib/game", replacement: "\0directory-game" },
        { find: "@/hooks/use-world-clock", replacement: "\0directory-clock" },
        { find: "@/lib/party-service", replacement: "\0invitation-party" },
        { find: "@/lib/multiplayer-service", replacement: "\0invitation-room" },
        { find: "@/components/game/PartyHostResults", replacement: "\0invitation-rewards" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "party-invitations-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/lib/party-service") return "\0invitation-party";
          if (source === "@/lib/multiplayer-service") return "\0invitation-room";
          if (source === "@/components/game/PartyHostResults") return "\0invitation-rewards";
          if (source === "@/lib/game") return "\0directory-game";
          if (source === "@/hooks/use-world-clock") return "\0directory-clock";
          if (source === "@/integrations/supabase/client") return "\0party-invitations-fixture-rpc";
        },
        load(id) {
          if (id === "\0invitation-party") return party;
          if (id === "\0invitation-room") return "export const joinPartyRoom=()=>{};";
          if (id === "\0invitation-rewards")
            return "import React from 'react';export const PartyHostResults=()=>React.createElement('p',null,'Host rewards stay separate');";
          if (id === "\0directory-game") return game;
          if (id === "\0directory-clock")
            return "export const useWorldClock=()=>({data:{hour:12}});";
          if (id === "\0party-invitations-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-invitations-${process.pid}`)}`,
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
