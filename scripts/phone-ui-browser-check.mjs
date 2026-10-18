import { spawn } from "node:child_process";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir(".smoke", { recursive: true });
await writeFile(
  "public/phone-ui-check.html",
  "<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><div id=\"fixture\"></div>\n<script type=\"module\">\nimport React from '/node_modules/.vite-game/deps/react.js';\nimport ReactDOM from '/node_modules/.vite-game/deps/react-dom_client.js';\nimport RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{}; window.$RefreshSig$=()=>type=>type; window.__vite_plugin_react_preamble_installed__=true; const {MessageList,ChatComposer}=await import('/src/components/game/PlayerSocial.tsx');\nimport '/src/styles.css'; import '/src/components/game/phone.css'; import '/src/components/game/game-navigation.css';\nconst h=React.createElement;\nconst messages=Array.from({length:200},(_,i)=>({id:'m'+i,sender_character_id:i%2?'me':'friend',sender_name:'Ayo',channel:'private',body:'Message '+i+' *hello*',message_type:'text',created_at:'2026-10-18T10:00:00Z',reply:i===199?{senderName:'Ayo',body:'See you soon',messageType:'text'}:null}));\nReactDOM.createRoot(document.getElementById('fixture')).render(h('div',{className:'city-game navigation-redesign'},h('section',{className:'phone-messenger','data-message-theme':'ink',style:{height:'550px',width:'100%',display:'flex',flexDirection:'column'}},h(MessageList,{messages,phoneMode:true,ownCharacterId:'me',onReply:()=>{},onReport:()=>{}}),h(ChatComposer,{label:'Message Ayo',phoneMode:true,onSend:async()=>{}})),h('nav',{className:'game-mobile-nav game-floating-nav'},...['Home','City','Jobs'].map((label,i)=>h('a',{key:label,href:'#',className:'mobile-nav-link '+(i===0?'mobile-nav-active':'')},label.slice(0,1),h('span',null,label)))),h('div',{className:'game-phone-fab'},h('button',{className:'game-phone-fab-trigger'},'P'))));\nwindow.checkPhone=()=>{ const rect=s=>document.querySelector(s).getBoundingClientRect(); const nav=rect('.game-floating-nav'),fab=rect('.game-phone-fab-trigger');const input=rect('.phone-chat-input');const controls=[...document.querySelectorAll('.phone-chat-utility,.phone-chat-send')].map(x=>({w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height}));return {width:innerWidth,noOverlap:nav.right+8<=fab.left,aligned:Math.abs((nav.top+nav.height/2)-(fab.top+fab.height/2))<1,inputWidth:input.width,controls,overflow:document.documentElement.scrollWidth>innerWidth,mounted:document.querySelectorAll('[data-message-id]').length,text:document.body.innerText.slice(0,150),darkText:getComputedStyle(document.querySelector('.phone-message-bubble')).color};};\n</script>",
);
const port = 9400 + Math.floor(Math.random() * 1000);
const browser = spawn(
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${resolve(`.smoke/app-profile-${process.pid}`)}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: "ignore" },
);
let socket;
try {
  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (
        await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })
      ).json();
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!tabs) throw new Error("Browser did not start");
  socket = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => socket.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  const requests = new Map();
  const failures = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      errors.push(message.params.args.map((a) => a.value || a.description).join(" "));
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text,
      );
    if (message.method === "Network.requestWillBeSent")
      requests.set(message.params.requestId, message.params.request.url.split("?")[0]);
    if (message.method === "Network.loadingFailed")
      failures.push({
        url: requests.get(message.params.requestId),
        error: message.params.errorText,
      });
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400)
      failures.push({
        url: message.params.response.url.split("?")[0],
        status: message.params.response.status,
      });
  });
  const call = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pending.set(n, r);
      socket.send(JSON.stringify({ id: n, method, params }));
    });
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width: Number(process.argv[2] || 360),
    height: 740,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await call("Page.navigate", { url: "http://127.0.0.1:3002/phone-ui-check.html" });
  let result;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((r) => setTimeout(r, 2000));
    result = await call("Runtime.evaluate", {
      expression: "window.checkPhone && JSON.stringify(window.checkPhone())",
      returnByValue: true,
    });
    const value = result.result?.result?.value;
    if (value && JSON.parse(value).text.trim()) break;
  }
  console.log(result.result?.result?.value);
  console.log(JSON.stringify({ errors, failures }));
  const layout = JSON.parse(result.result?.result?.value || "null");
  if (
    !layout ||
    !layout.noOverlap ||
    !layout.aligned ||
    layout.overflow ||
    layout.inputWidth < 64 ||
    layout.mounted >= 50 ||
    layout.controls.some((c) => c.w < 44 || c.h < 44)
  )
    process.exitCode = 1;
  if (
    errors.length ||
    failures.length ||
    !result.result?.result?.value ||
    !JSON.parse(result.result.result.value).text.trim()
  )
    process.exitCode = 1;
} finally {
  await unlink("public/phone-ui-check.html").catch(() => {});
  socket?.close();
  browser.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1000);
}
