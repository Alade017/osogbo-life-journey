// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `career-learning-${process.pid}.html`);
const dist = resolve(".smoke", `career-learning-build-${process.pid}`);
const screenshot = resolve(".smoke/career-learning-375.png");
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
  "\nconst uid='11111111-1111-4111-8111-111111111111',cid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';let saved=[];\nconst course={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',slug:'finance',name:'Finance basics',provider:'Osun Tech Hub',description:'Build practical money skills for your next career step.',tuition:1000,energy_cost:15,intelligence_gain:2,career_gain:3};\nexport const supabase={auth:{getSession:async()=>({data:{session:{user:{id:uid}}}})},rpc:async(name,args)=>{let data=[];if(name==='get_career_life_summary')data={earned:140000,shifts:42,employments:[{id:'employment',name:'Cedar Bank',current:true,level:2,shifts:42,hiredAt:'2026-10-01',lastWorkedAt:null,location:'City Centre',requiredCourse:'Finance basics'}]};if(name==='get_career_life_history')data=[{id:'pay-1',at:'2026-11-01',kind:'payment',label:'Shift at Cedar Bank',amount:5000,level:null}];if(name==='set_saved_course'){saved=args.p_saved?[{course_id:course.id,planned_at:'2026-11-01'}]:[];data={};}return{data,error:null}},from:table=>{let proxy;const data=()=>table==='characters'?{id:cid,user_id:uid,energy:100,level:2}:table==='wallets'?{balance:10000}:table==='education_courses'?[course]:table==='player_course_plans'?saved:table==='locations'?[{id:'campus',slug:'student-district',name:'Student District'}]:[];proxy=new Proxy({},{get:(_,key)=>key==='then'?(done)=>Promise.resolve({data:data(),error:null}).then(done):()=>proxy});return proxy}};";
const html =
  "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><link rel=\"icon\" href=\"data:,\"/></head><body><div id=\"root\"></div><script type=\"module\">\nimport React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{createRootRoute,createRouter,RouterProvider}from'@tanstack/react-router';import{CareerLifeApp}from'/src/components/game/CareerLifeApp.tsx';import'/src/styles.css';import'/src/components/game/phone.css';\nconst h=React.createElement;const root=createRootRoute({component:()=>h('div',{className:'city-game navigation-redesign'},h('div',{className:'phone-app-body',style:{width:'100%',padding:'12px'}},h(CareerLifeApp,{opportunities:h('p',{},'Existing workplace controls')})))});createRoot(document.getElementById('root')).render(h(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},h(RouterProvider,{router:createRouter({routeTree:root})})));\nconst pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<300;i++){if(p())return;await pause(40)}throw Error('Fixture did not settle: '+document.body.textContent.slice(-400));};const button=name=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===name);const overflow=()=>document.documentElement.scrollWidth>innerWidth;\ntry{await wait(()=>document.body.textContent.includes('140,000'));if(overflow())throw Error('Overview overflow');button('Work history').click();await wait(()=>document.body.textContent.includes('Shift at Cedar Bank'));if(overflow())throw Error('History overflow');button('Opportunities').click();await wait(()=>document.body.textContent.includes('Existing workplace controls'));button('Learning').click();await wait(()=>document.querySelector('[aria-label=\"Save Finance basics\"]'));const save=document.querySelector('[aria-label=\"Save Finance basics\"]');await wait(()=>!save.disabled);save.click();await wait(()=>document.querySelector('[aria-label=\"Unsave Finance basics\"]'));button('Saved').click();await wait(()=>document.body.textContent.includes('Finance basics'));if(overflow())throw Error('Education overflow');const rect=document.querySelector('.learning-save').getBoundingClientRect();if(rect.width<44||rect.height<44)throw Error('Small save control');window.scrollTo(0,0);document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,careerMetrics:true,history:true,savedCourses:true,overflow:false}));}catch(e){document.body.dataset.result=btoa(JSON.stringify({status:'failed',viewport:innerWidth,error:String(e)}));}\n</script></body></html>";
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
        { find: "@/integrations/supabase/client", replacement: "\0career-learning-fixture-rpc" },
        { find: "@", replacement: resolve("src") },
      ],
    },
    plugins: [
      tailwindcss(),
      {
        name: "career-learning-fixture-rpc",
        enforce: "pre",
        resolveId(source) {
          if (source === "@/integrations/supabase/client") return "\0career-learning-fixture-rpc";
        },
        load(id) {
          if (id === "\0cost-goals-stub") return "export const ActiveGoalSummary=()=>null;";
          if (id === "\0career-learning-fixture-rpc") return mock;
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-career-learning-${process.pid}`)}`,
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
