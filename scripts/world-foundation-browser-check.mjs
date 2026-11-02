// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";

const fixture = resolve(".smoke", `world-foundation-${process.pid}.html`);
const dist = resolve(".smoke", `world-foundation-build-${process.pid}`);
const screenshot = resolve(".smoke/world-foundation-375.png");
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
const html =
  "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><link rel=\"icon\" href=\"data:,\"/><style>body{margin:0;background:#f6f1e7;font-family:system-ui;color:#263c31}h1{font-size:18px;margin:12px}p{font-size:12px;margin:12px}#world{height:700px;width:100%}canvas{display:block}</style></head><body><h1>Olaiya ? world foundation</h1><p>Residential compound, connected crossing and local shopfronts.</p><div id=\"world\"></div><script type=\"module\">\nimport{createPhaserTownMap}from'/src/components/map/phaser-town-map.ts';import{createPhaserNeighborhood}from'/src/game/phaser-neighborhood.ts';import{neighborhoodAreaForSlug}from'/src/game/neighborhood-model.ts';\nconst pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async(p)=>{for(let i=0;i<300;i++){if(p())return;await pause(40)}throw Error('Scene failed to settle');};let map,scene,game;const host=document.getElementById('world');const data={places:[{id:'cedar-bank',label:'Cedar Bank',category:'services',grid:{x:11,z:2}}],properties:[],playerLocation:{x:11,y:2},billboardMarkers:[]};\ntry{let ready=false;createPhaserTownMap({host,dataRef:{current:data},callbacksRef:{current:{onSelectLandmark:()=>{},onSelectDistrict:()=>{},onSelectBillboard:undefined}},onReady:()=>ready=true,onGame:(g,s)=>{map=g;scene=s}});await wait(()=>ready);const terrain=scene.children.list[0],markers=scene.children.list[1],marker=markers.list[0];for(let i=0;i<20;i++)scene.drawMap({...data,playerLocation:{x:11+i/100,y:2}});if(scene.children.list[0]!==terrain||markers.list[0]!==marker)throw Error('Static terrain or unchanged markers recreated');let taps=0;const zone=markers.list.find(x=>x.type==='Zone');zone.on('pointerup',()=>{});const original=scene.callbacksRef.current.onSelectLandmark;scene.callbacksRef.current.onSelectLandmark=()=>taps++;zone.emit('pointerup',{downX:0,downY:0,downTime:0,x:20,y:0,upTime:100});if(taps)throw Error('Drag activated place');zone.emit('pointerup',{downX:0,downY:0,downTime:0,x:1,y:0,upTime:100});if(taps!==1)throw Error('Tap did not activate place');scene.input.emit('pointerdown',{id:1,x:0,y:0});scene.input.emit('pointermove',{id:1,isDown:true,x:20,y:0,downX:0,downY:0});zone.emit('pointerup',{id:1,downX:0,downY:0,downTime:0,x:0,y:0,upTime:100});if(taps!==1)throw Error('Returning drag activated place');map.destroy(true);await pause(100);if(host.querySelector('canvas'))throw Error('Overview canvas leaked');\nlet neighborhoodReady=false,handle;const player={sessionId:'self',characterId:'fixture',name:'Player',gender:'female',appearance:'{}',equipment:'[]',x:7,y:6,facing:'south'};game=createPhaserNeighborhood({host,area:neighborhoodAreaForSlug('city-centre'),selfSessionId:'self',homeTypeId:'bungalow',playersRef:{current:[player]},onReady:()=>neighborhoodReady=true,onScene:s=>handle=s});await wait(()=>neighborhoodReady);await pause(800);for(let i=0;i<8;i++){handle.setPlayers([{...player,x:7+i*.01,y:6+i*.01}]);await pause(40)}if(!game.scene.getScenes(true)[0].cameras.main._follow)throw Error('Camera is not following player');handle.setZoom(1.2);handle.setZoom(1/1.2);if(Math.abs(game.canvas.getBoundingClientRect().height-host.clientHeight)>2)throw Error('Pooled canvas retained overview FIT sizing');if(document.documentElement.scrollWidth>innerWidth)throw Error('Horizontal overflow');const times=[];let previous=performance.now();for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const now=performance.now();times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);document.body.dataset.result=btoa(JSON.stringify({status:'passed',viewport:innerWidth,staticTerrainRetained:true,markersRetained:true,dragSuppressed:true,canvasCleanup:true,playerFollow:true,frameMedianMs:times[30],frameP95Ms:times[57],canvasWidth:game.canvas.width,canvasHeight:game.canvas.height,canvasStyle:game.canvas.style.cssText,hostStyle:host.style.cssText,cameraZoom:game.scene.getScenes(true)[0].cameras.main.zoom,sceneObjects:game.scene.getScenes(true)[0].children.length,synthetic:true}));window.fixtureGame=game;\n}catch(e){document.body.dataset.result=btoa(JSON.stringify({status:'failed',viewport:innerWidth,error:String(e)}));}\n</script></body></html>";
try {
  await mkdir(resolve(".smoke"), { recursive: true });
  if (!dist.startsWith(resolve(".smoke") + sep)) throw new Error("Invalid fixture output");
  await writeFile(fixture, html);
  const result = await build({
    configFile: false,
    publicDir: false,
    logLevel: "error",
    resolve: {
      alias: [{ find: "@", replacement: resolve("src") }],
    },
    plugins: [tailwindcss()],
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
      `--user-data-dir=${resolve(tmpdir(), `osogbo-world-foundation-${process.pid}`)}`,
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
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await pause(400);
  const wide = await call("Runtime.evaluate", {
    expression:
      "document.documentElement.scrollWidth <= innerWidth && document.querySelectorAll('canvas').length === 1",
    returnByValue: true,
  });
  if (!wide.result?.value) throw new Error("Desktop scene layout failed");
  const desktop = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(resolve(".smoke/world-foundation-1280.png"), Buffer.from(desktop.data, "base64"));
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
