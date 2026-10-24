import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile, unlink, access } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";

const width = Number(process.argv[2] || 375);
if (!Number.isInteger(width) || width < 320 || width > 1920)
  throw new Error("Use a viewport width from 320 to 1920.");
await mkdir(".smoke", { recursive: true });
const fixture = `home-renderer-benchmark-${process.pid}.html`;
let origin;
let bundle;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#room{width:100%;height:520px;position:relative}canvas{width:100%;height:100%;display:block;touch-action:none}#overlay{display:none;position:absolute;width:80px;height:80px;background:#fff;z-index:10}</style><div id="room"><canvas aria-label="Benchmark room"></canvas><div id="overlay">Room controls</div></div><script type="module">
window.homeBenchmark={stage:'loading'};
const started=performance.now();
try {
 const {createHomePlayCanvas}=await import('/src/components/game/housing/house-playcanvas-runtime.ts');
 const canvas=document.querySelector('canvas'); const abort=new AbortController(); const events={selected:[],moves:[],slots:[]};
 const tracked=new Set(['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture','wheel']);
 const listeners=new Map();const add=canvas.addEventListener.bind(canvas),remove=canvas.removeEventListener.bind(canvas);
 const key=(type,options)=>type+':'+(typeof options==='boolean'?options:!!options?.capture);
 canvas.addEventListener=(type,callback,options)=>{if(tracked.has(type)){const k=key(type,options);if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(callback);}add(type,callback,options);};
 canvas.removeEventListener=(type,callback,options)=>{if(tracked.has(type))listeners.get(key(type,options))?.delete(callback);remove(type,callback,options);};
 let observers=0;const NativeObserver=window.ResizeObserver;window.ResizeObserver=class extends NativeObserver{constructor(callback){super(callback);this.active=true;observers++;}disconnect(){if(this.active){this.active=false;observers--;}super.disconnect();}};
 let props={houseTypeId:'development-room',accessoryBand:'basic',editMode:true,moveEnabled:true,slots:[{id:'bed-1',slot_type:'bed',x:25,y:50},{id:'bed-2',slot_type:'bed',x:75,y:50}],placements:[{id:'fixture-bed',item_id:'bed',art_key:'bed',slot_type:'bed',category:'furniture',slot:'bed-1'}],onSelectPlacement:p=>events.selected.push(p.id),onSelectSlot:s=>events.slots.push(s.id),onMove:(p,s)=>events.moves.push({from:p.slot,to:s.id})};
 const runtime=await createHomePlayCanvas(canvas,props,{signal:abort.signal,labels:()=>{},fatal:e=>{window.homeBenchmark.stage='error';window.homeBenchmark.error=e.message;}});
 window.homeBenchmark={stage:'ready',startedAt:started,initializationMs:performance.now()-started,events,point:id=>runtime.screenPointForSlot(id),metrics:()=>runtime.metrics(),confirm:()=>{props={...props,placements:[{...props.placements[0],slot:'bed-2'}]};runtime.update(props);},block:()=>runtime.update(props,true),unblock:()=>runtime.update(props,false),overlay:point=>{const el=document.querySelector('#overlay');el.style.display='block';el.style.left=(point.x-40)+'px';el.style.top=(point.y-40)+'px';},hideOverlay:()=>{document.querySelector('#overlay').style.display='none';},destroy:()=>{runtime.destroy();runtime.destroy();abort.abort();},finish:()=>({events,metrics:runtime.metrics(),initializationMs:window.homeBenchmark.initializationMs,observedReadyMs:window.homeBenchmark.observedReadyMs,overflow:document.documentElement.scrollWidth>innerWidth,width:innerWidth,dpr:devicePixelRatio,canvasPixels:[canvas.width,canvas.height]})};
 window.homeBenchmark.canonicalSlot=()=>props.placements[0].slot;
 window.homeBenchmark.resources=()=>({inputListeners:[...listeners.values()].reduce((sum,set)=>sum+set.size,0),observers});
} catch(error) {window.homeBenchmark={stage:'error',error:String(error)};}
</script>`;

let server, browser, socket;
const pending = new Map();
const errors = [],
  failures = [];
const requests = new Map();
const responseStatuses = new Map();
let browserDiagnostics = "";
let tearingDown = false;
const canceledDuringTeardown = [];
let sequence = 0;
const call = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`DevTools timeout: ${method}`));
    }, 20000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
};
const mouse = (type, point, down = false) =>
  call("Input.dispatchMouseEvent", {
    type,
    x: point.x,
    y: point.y,
    button: type === "mouseMoved" ? "none" : "left",
    buttons: down ? 1 : 0,
    clickCount: type === "mouseMoved" ? 0 : 1,
  });
const touch = (type, points) =>
  call("Input.dispatchTouchEvent", {
    type,
    touchPoints: points.map((point, id) => ({
      x: point.x,
      y: point.y,
      id,
      radiusX: 4,
      radiusY: 4,
    })),
  });
const drag = async (from, to, beforeRelease) => {
  await mouse("mouseMoved", from);
  await mouse("mousePressed", from, true);
  await mouse(
    "mouseMoved",
    { x: from.x + (to.x - from.x) / 2, y: from.y + (to.y - from.y) / 2 },
    true,
  );
  await mouse("mouseMoved", to, true);
  if (beforeRelease) await beforeRelease();
  await mouse("mouseReleased", to);
};
try {
  const source = resolve(".smoke", fixture);
  const dist = resolve(".smoke", `home-renderer-build-${process.pid}`);
  if (!dist.startsWith(resolve(".smoke") + sep)) throw new Error("Invalid benchmark output path.");
  await writeFile(source, html);
  const { build } = await import("vite");
  const built = await build({
    configFile: resolve("scripts/vite.home-benchmark.config.ts"),
    build: { outDir: dist, emptyOutDir: false, rolldownOptions: { input: source } },
  });
  const outputs = (Array.isArray(built) ? built : [built]).flatMap((result) => result.output ?? []);
  const entry = outputs.find((output) => output.fileName.endsWith(".html"))?.fileName;
  if (!entry) throw new Error("The benchmark build did not emit an HTML entry.");
  const chunks = outputs.filter((output) => output.type === "chunk");
  bundle = {
    rawJsBytes: chunks.reduce((sum, output) => sum + Buffer.byteLength(output.code), 0),
    gzipJsBytes: chunks.reduce((sum, output) => sum + gzipSync(output.code).length, 0),
  };
  await mkdir(resolve(dist, "models/rooms"), { recursive: true });
  await writeFile(
    resolve(dist, "models/rooms/development-room.glb"),
    await readFile("public/models/rooms/development-room.glb"),
  );
  const mime = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".css": "text/css",
    ".glb": "model/gltf-binary",
  };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://fixture").pathname);
      const file = resolve(dist, pathname === "/" ? entry : pathname.replace(/^\/+/, ""));
      if (!file.startsWith(dist + sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const bytes = await readFile(file);
      response.writeHead(200, {
        "Content-Type": mime[extname(file)] ?? "application/octet-stream",
        "Content-Length": bytes.length,
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  let executable;
  for (const path of candidates) {
    try {
      await access(path);
      executable = path;
      break;
    } catch {
      /* Next installed browser. */
    }
  }
  if (!executable) throw new Error("No Chrome/Edge executable found; set CHROME_PATH.");
  const port = 10500 + Math.floor(Math.random() * 1000);
  browser = spawn(
    executable,
    [
      "--headless",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--no-first-run",
      "--disable-extensions",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${resolve(tmpdir(), `osogbo-home-${process.pid}`)}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
  );
  browser.stderr.on("data", (data) => {
    browserDiagnostics = (browserDiagnostics + data.toString()).slice(-5000);
  });
  browser.on("error", (error) => errors.push(`Browser: ${error.message}`));
  let tabs;
  for (let i = 0; i < 40; i++) {
    try {
      tabs = await (
        await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(2000) })
      ).json();
      break;
    } catch {
      await pause(250);
    }
  }
  const tab = tabs?.find((tab) => tab.type === "page");
  if (!tab) throw new Error("Browser did not expose a DevTools page.");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("DevTools socket did not open.")), 10000);
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("DevTools socket failed."));
      },
      { once: true },
    );
  });
  socket.addEventListener("close", () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error("DevTools disconnected."));
    }
    pending.clear();
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      clearTimeout(item.timer);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
    }
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ||
          message.params.exceptionDetails.text,
      );
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      errors.push(message.params.args.map((arg) => arg.value || arg.description).join(" "));
    if (message.method === "Network.requestWillBeSent")
      requests.set(message.params.requestId, {
        url: message.params.request.url,
        method: message.params.request.method,
      });
    if (message.method === "Network.loadingFinished") requests.delete(message.params.requestId);
    if (message.method === "Network.loadingFailed") {
      const failure = {
        ...requests.get(message.params.requestId),
        error: message.params.errorText,
        canceled: message.params.canceled,
        status: responseStatuses.get(message.params.requestId),
        phase: tearingDown ? "teardown" : "active",
      };
      if (tearingDown && failure.error === "net::ERR_ABORTED") canceledDuringTeardown.push(failure);
      else failures.push(failure);
      requests.delete(message.params.requestId);
    }
    if (message.method === "Network.responseReceived")
      responseStatuses.set(message.params.requestId, message.params.response.status);
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
      const { url, status } = message.params.response;
      if (!(status === 404 && url.startsWith(`${origin}/models/furniture/`)))
        failures.push({ url, status });
    }
  });
  await call("Runtime.enable");
  await call("Page.enable");
  await call("Network.enable");
  await call("Emulation.setDeviceMetricsOverride", {
    width,
    height: 740,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 2 });
  const navigation = await call("Page.navigate", { url: `${origin}/` });
  if (navigation.errorText) throw new Error(`Fixture navigation: ${navigation.errorText}`);
  await call("Page.bringToFront");
  let ready = false;
  for (let i = 0; i < 90; i++) {
    const stage = await evaluate("window.homeBenchmark?.stage");
    if (stage === "error") throw new Error(await evaluate("window.homeBenchmark.error"));
    if (
      stage === "ready" &&
      (await evaluate(
        "window.homeBenchmark.metrics().modelInstanceCount >= 1 && window.homeBenchmark.metrics().frameCount >= 2",
      ))
    ) {
      ready = true;
      break;
    }
    await pause(1000);
  }
  if (!ready) {
    const state = await evaluate(
      "({stage:window.homeBenchmark?.stage,metrics:window.homeBenchmark?.metrics?.(),readyState:document.readyState,visibility:document.visibilityState,url:location.href})",
    );
    throw new Error(
      `Renderer or development GLB did not become ready: ${JSON.stringify({ state, pending: [...requests.values()].slice(0, 8) })}`,
    );
  }
  await evaluate(
    "window.homeBenchmark.observedReadyMs=performance.now()-window.homeBenchmark.startedAt",
  );
  const point = (id) => evaluate(`window.homeBenchmark.point(${JSON.stringify(id)})`);
  const first = await point("bed-1"),
    second = await point("bed-2");
  if (!first || !second) throw new Error("No projected fixture slots.");
  await mouse("mouseMoved", first);
  await mouse("mousePressed", first, true);
  await mouse("mouseReleased", first);
  await drag(first, second);
  await pause(100);
  let events = await evaluate("window.homeBenchmark.events");
  if (
    events.selected.length !== 1 ||
    events.moves.length !== 1 ||
    events.moves[0].from !== "bed-1" ||
    events.moves[0].to !== "bed-2"
  )
    throw new Error(`Selection/move contract failed: ${JSON.stringify(events)}`);
  await evaluate("window.homeBenchmark.confirm()");
  await drag(await point("bed-2"), await point("bed-1"), () =>
    evaluate(`window.homeBenchmark.overlay(${JSON.stringify(first)})`),
  );
  await evaluate("window.homeBenchmark.hideOverlay()");
  await drag(await point("bed-2"), await point("bed-1"), () =>
    evaluate("window.homeBenchmark.block()"),
  );
  await evaluate("window.homeBenchmark.unblock()");
  events = await evaluate("window.homeBenchmark.events");
  if (events.moves.length !== 1)
    throw new Error("Overlay or pending-state gesture submitted another move.");
  const touchFrom = await point("bed-2"),
    touchTo = await point("bed-1");
  await touch("touchStart", [touchFrom]);
  await touch("touchMove", [touchTo]);
  await touch("touchEnd", []);
  await touch("touchStart", [touchFrom, touchTo]);
  await touch("touchEnd", []);
  events = await evaluate("window.homeBenchmark.events");
  if (
    events.moves.length !== 2 ||
    events.selected.length !== 1 ||
    events.moves[1].from !== "bed-2" ||
    events.moves[1].to !== "bed-1"
  )
    throw new Error(`Touch contract failed: ${JSON.stringify(events)}`);
  const result = await evaluate("window.homeBenchmark.finish()");
  result.canonicalSlot = await evaluate("window.homeBenchmark.canonicalSlot()");
  if (result.canonicalSlot !== "bed-2")
    throw new Error("The renderer overwrote the authoritative placement fixture.");
  if (result.overflow) throw new Error("Fixture overflows the viewport.");
  const shot = await call("Page.captureScreenshot", { format: "png" });
  await writeFile(`.smoke/home-renderer-${width}.png`, Buffer.from(shot.data, "base64"));
  tearingDown = true;
  await evaluate("window.homeBenchmark.destroy()");
  await mouse("mouseMoved", first);
  await mouse("mousePressed", first, true);
  await mouse("mouseReleased", first);
  const after = await evaluate("window.homeBenchmark.finish()");
  const resourcesAfter = await evaluate("window.homeBenchmark.resources()");
  if (
    !after.metrics.disposed ||
    after.events.moves.length !== 2 ||
    after.events.selected.length !== 1
  )
    throw new Error("Runtime listeners survived disposal.");
  if (resourcesAfter.inputListeners || resourcesAfter.observers)
    throw new Error(`Runtime resources survived disposal: ${JSON.stringify(resourcesAfter)}`);
  if (errors.length || failures.length) throw new Error(JSON.stringify({ errors, failures }));
  console.log(
    JSON.stringify({
      status: "passed",
      viewport: width,
      bundle,
      softwareBrowser: true,
      result,
      disposed: after.metrics.disposed,
      resourcesAfter,
      errors,
      failures,
      canceledDuringTeardown,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      status: "failed",
      message: String(error),
      errors,
      failures,
      browserDiagnostics,
    }),
  );
  process.exitCode = 1;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try {
      await call("Browser.close");
    } catch {
      /* Already closed. */
    }
  }
  for (const { timer } of pending.values()) clearTimeout(timer);
  pending.clear();
  socket?.close();
  browser?.kill();
  server?.closeAllConnections();
  server?.close();
  await unlink(resolve(".smoke", fixture)).catch(() => {});
}
