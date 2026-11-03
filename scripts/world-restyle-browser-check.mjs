// Isolated real component/style fixture with synthetic RPC responses, no auth/database.
import { spawn } from "node:child_process";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { build } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

const fixture = resolve(".smoke", `world-restyle-${process.pid}.html`);
const dist = resolve(".smoke", `world-restyle-build-${process.pid}`);
const screenshot = resolve(".smoke/world-restyle-375.png");
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
    }, 45000);
    pending.set(id, { done, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
const html =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><link rel="icon" href="data:,"/><style>html,body,#root{margin:0;width:100%;height:100%;font-family:system-ui}#root .playable-neighborhood-canvas{position:relative;width:100%;height:700px;min-height:700px}.house-3d-scene canvas{width:100%;height:100%}</style></head><body><div id="root"></div><script type="module">\nimport \'/src/styles.css\';import \'/src/components/game/housing/house-screen.css\';import \'/src/components/game/neighborhood.css\';import{HouseEditSheets}from\'/src/components/game/housing/HouseEditSheets.tsx\';import{HomeAccessoryPanel}from\'/src/components/game/housing/HomeAccessoryPanel.tsx\';import React from \'react\';import{createRoot}from\'react-dom/client\';import{_roots}from\'@react-three/fiber\';import{Vector3}from\'three\';\nimport{R3FTownSurface}from\'/src/components/map/R3FTownSurface.tsx\';import{R3FNeighborhoodSurface}from\'/src/components/game/R3FNeighborhoodSurface.tsx\';import{HouseRoom3D}from\'/src/components/game/housing/HouseRoom3D.tsx\';import{playableDistrictForLocation}from\'/src/game/playable-district.ts\';import{toScene,neighborhoodSceneBounds}from\'/src/game/neighborhood-model.ts\';import{WORLD_SCALE,WORLD_PALETTE}from\'/src/components/3d/world-theme.ts\';\nfunction HouseFixture(props){const[selected,setSelected]=React.useState(null);const[editing,setEditing]=React.useState(false);window.fixtureSetEdit=setEditing;const empty=()=>{};return React.createElement(\'div\',{className:\'home-scene\'},React.createElement(\'div\',{className:\'house-page house-page-fill\'+(editing?\' is-editing\':\'\')},React.createElement(\'section\',{className:\'house-room-card\'},React.createElement(HouseRoom3D,{...props,editMode:editing,onSelectPlacement:setSelected})),React.createElement(\'button\',{className:\'house-edit-button house-edit-toggle\',onClick:()=>setEditing(!editing)},editing?\'Done\':\'Shop\'),!editing&&React.createElement(\'section\',{className:\'house-needs-actions\'},React.createElement(\'div\',{className:\'house-presence-actions\'},React.createElement(\'button\',{className:\'house-primary-button\',onClick:empty},\'Go outside\'))),editing&&React.createElement(HouseEditSheets,{open:true,offline:false,pending:false,cash:100000,inventory:props.placements.map(p=>({...p,price_minor:0,quantity:1})),catalog:[],outfit:{head:null,top:null,bottom:null,shoes:null,accessory:null},slots:props.slots,placements:props.placements,selectedSlot:null,selectedPlacement:selected,onClose:()=>setEditing(false),onPlace:empty,onSelectSlot:empty,onRemove:empty,onMove:empty,onEquip:empty,onUnequip:empty,onBuy:empty}),!editing&&selected?React.createElement(HomeAccessoryPanel,{placement:selected,disabledReason:null,pending:false,error:\'\',onClose:()=>setSelected(null),onUse:async()=>{window.usedAccessory=selected.item_id;}}):null))};const root=createRoot(document.getElementById(\'root\'));const pause=ms=>new Promise(r=>setTimeout(r,ms));const wait=async p=>{for(let i=0;i<300;i++){if(p())return;await pause(40)}throw Error(\'Scene timeout\')};const noop=()=>{};let handle;\nconst player={sessionId:\'self\',characterId:\'fixture\',name:\'Player\',gender:\'female\',appearance:JSON.stringify({skin:4,outfit:3,stature:2,build:2}),equipment:\'[]\',x:4.21875,y:4.15625,facing:\'south\',actionAnimation:\'talk\'};\nwindow.showMode=async(mode)=>{root.render(React.createElement(mode===\'map\'?R3FTownSurface:mode===\'neighborhood\'?R3FNeighborhoodSurface:HouseFixture,mode===\'map\'?{places:[{id:\'bank\',label:\'Bank\',category:\'services\',grid:{x:11,z:2}}],properties:[],playerLocation:{x:11,y:2},billboardMarkers:[],onSelectLandmark:id=>window.lastSelected=id,onSelectDistrict:noop,onReady:noop,onUnavailable:()=>{throw Error(\'WebGL unavailable\')}}:mode===\'neighborhood\'?{players:[player],selfSessionId:\'self\',homeTypeId:null,district:playableDistrictForLocation({slug:\'oja-oba\',map_x:0,map_y:0}),onScene:h=>handle=h}:{houseTypeId:\'bungalow\',characterName:\'Player\',appearance:{skin:4,outfit:3,stature:2,build:2},gender:\'female\',accessoryBand:\'basic\',slots:[{"id":"bed","slot_type":"bed","x":70,"y":75},{"id":"seat","slot_type":"sofa","x":30,"y":25},{"id":"cooker","slot_type":"kitchen","x":82,"y":25},{"id":"bath","slot_type":"bathroom","x":12,"y":80},{"id":"toilet","slot_type":"bathroom","x":12,"y":60}],placements:[{"id":"bed","item_id":"starter-bed","slot_type":"bed","art_key":"starter-bed","x":70,"y":75,"slot":"bed","category":"furniture"},{"id":"seat","item_id":"starter-seat","slot_type":"sofa","art_key":"starter-seat","x":30,"y":25,"slot":"seat","category":"furniture"},{"id":"cooker","item_id":"stove","slot_type":"kitchen","art_key":"stove","x":82,"y":25,"slot":"cooker","category":"furniture"},{"id":"bath","item_id":"shower","slot_type":"bathroom","art_key":"shower","x":12,"y":80,"slot":"bath","category":"furniture"},{"id":"toilet","item_id":"toilet","slot_type":"bathroom","art_key":"toilet","x":12,"y":60,"slot":"toilet","category":"furniture"}],editMode:false,moveEnabled:false,onSelectPlacement:noop,onSelectSlot:noop,onMove:noop,onMovePosition:noop}));await pause(1800);await wait(()=>document.querySelector(\'canvas\')&&_roots.get(document.querySelector(\'canvas\'))?.store.getState().scene.children.length>3);await pause(600);return window.inspectScene(mode)};\nwindow.inspectEdit=()=>{const state=_roots.get(document.querySelector(\'canvas\')).store.getState(),walls=state.scene.getObjectByName(\'house-cutaway-walls\');const card=document.querySelector(\'.house-room-card\').getBoundingClientRect(),drawer=document.querySelector(\'.house-edit-panel\').getBoundingClientRect();if(innerWidth>=1024?card.right>drawer.left+1:card.bottom>drawer.top+1)throw Error(\'Editor obscures house\');if(!walls||walls.scale.y>.3)throw Error(\'Edit walls obscure the room\');if(state.camera.getWorldDirection(new Vector3()).y>-.77)throw Error(\'Edit camera not elevated\');return true;};window.projectAccessory=()=>{const canvas=document.querySelector(\'canvas\'),state=_roots.get(canvas).store.getState(),actor=state.scene.getObjectByName(\'accessory:cooker\');if(!actor)throw Error(\'Accessory geometry missing\');const p=actor.getWorldPosition(new Vector3());p.y+=.4;p.project(state.camera);const r=canvas.getBoundingClientRect();return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}};window.projectLandmark=()=>{const canvas=document.querySelector(\'canvas\'),state=_roots.get(canvas).store.getState(),r=canvas.getBoundingClientRect(),p=new Vector3(-.5*WORLD_SCALE.townCell,1.7,-6.5*WORLD_SCALE.townCell).project(state.camera);return{x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}};window.inspectScene=(mode)=>{const canvas=document.querySelector(\'canvas\');const state=_roots.get(canvas).store.getState();let instances=0,key=0,fill=0;const materials=new Set();state.scene.traverse(o=>{if(o.isInstancedMesh)instances++;if(o.isDirectionalLight&&o.castShadow)key++;if(o.isAmbientLight)fill++;let parent=o,isCharacter=false;while(parent){if(parent.name?.startsWith(\'character:\'))isCharacter=true;parent=parent.parent;}if(o.isMesh&&!isCharacter&&o.material?.isMeshStandardMaterial)materials.add(o.material.color.getHexString())});if(key!==1||fill!==1)throw Error(\'Lighting rig mismatch\');if(mode!==\'house\'&&instances<3)throw Error(\'Repeated geometry not instanced\');if(materials.size>(mode===\'house\'?new Set(Object.values(WORLD_PALETTE)).size:8))throw Error(\'Palette exceeded\');if(!state.gl.info.render.calls)throw Error(\'No rendered draw calls\');if(state.camera.position.y<=0)throw Error(\'Camera below ground\');if(mode===\'neighborhood\'){const d=playableDistrictForLocation({slug:\'oja-oba\',map_x:0,map_y:0}),b=neighborhoodSceneBounds(d.origin),p=toScene(player,d.origin);const projected=new Vector3((p.x-b.left-b.width/2)*WORLD_SCALE.neighborhoodUnit,0,(p.y-b.top-b.height/2)*WORLD_SCALE.neighborhoodUnit).project(state.camera);if(Math.abs(projected.x)>.03||Math.abs(projected.y)>.03)throw Error(\'Player camera target drifted: \'+projected.toArray());}if(mode===\'house\'){for(const button of document.querySelectorAll(\'.house-edit-toggle,.house-presence-actions button\'))if(getComputedStyle(button).backgroundColor!==\'rgb(255, 255, 255)\')throw Error(\'House controls not white\');}if(mode===\'house\'&&state.camera.position.x<.1)throw Error(\'House camera not cutaway\');if(mode!==\'map\'){let count=0;state.scene.traverse(o=>{if(o.name?.startsWith(\'character:\'))count++});if(!count)throw Error(\'Shared character missing\');const actor=state.scene.getObjectByName(\'character:Player\');if(!actor)throw Error(\'Saved player missing\');const colors=new Set();actor.traverse(o=>{if(o.isMesh)colors.add(o.material.color.getHexString())});const look=[...colors].sort().join(\',\');if(window.sharedLook&&window.sharedLook!==look)throw Error(\'Indoor/outdoor appearance differs\');window.sharedLook=look;}return {mode,instances,palette:materials.size,drawCalls:state.gl.info.render.calls,camera:state.camera.position.toArray(),canvas:[canvas.width,canvas.height]}};\ntry{const scenes=[];for(const mode of [\'map\',\'neighborhood\',\'house\'])scenes.push(await window.showMode(mode));await window.showMode(\'neighborhood\');if(!handle)throw Error(\'Camera handle missing\');handle.setZoom(50);await pause(250);scenes.push(window.inspectScene(\'neighborhood\'));document.body.dataset.result=btoa(JSON.stringify({status:\'passed\',viewport:innerWidth,scenes,synthetic:true}));}catch(e){document.body.dataset.result=btoa(JSON.stringify({status:\'failed\',error:String(e)}));}\n</script></body></html>';
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
    plugins: [react(), tailwindcss()],
    build: { outDir: dist, emptyOutDir: false, rolldownOptions: { input: fixture } },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output ?? []);
  const entry = outputs.find((o) => o.fileName.endsWith(".html"))?.fileName;
  if (!entry) throw new Error("Missing fixture entry");
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://fixture").pathname;
      const assetRoot = pathname.startsWith("/assets/items/") ? resolve("public") : dist;
      const file = resolve(assetRoot, pathname === "/" ? entry : pathname.replace(/^\/+/, ""));
      if (!file.startsWith(assetRoot + sep)) throw new Error("Invalid path");
      let bytes = await readFile(file);
      // Only fixture responses omit remote fonts; production styles remain untouched.
      if (extname(file) === ".css")
        bytes = Buffer.from(
          bytes
            .toString()
            .replace(/@import\s+(?:url\()?"https:\/\/fonts\.googleapis\.com[^\"]+"\)?;/g, ""),
        );
      response.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".webp": "image/webp",
          }[extname(file)] ?? "application/octet-stream",
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
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${resolve(tmpdir(), `osogbo-world-restyle-${process.pid}`)}`,
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
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error")
      errors.push(message.params.args.map((arg) => arg.description ?? arg.value).join(" "));
    if (message.method === "Runtime.exceptionThrown")
      errors.push(
        message.params.exceptionDetails.exception?.description ??
          message.params.exceptionDetails.text,
      );
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
  for (let index = 0; index < 500; index++) {
    const state = await call("Runtime.evaluate", {
      expression: "document.body?.dataset.result",
      returnByValue: true,
    });
    encoded = state.result?.value;
    if (encoded) break;
    await pause(100);
  }
  if (!encoded) throw new Error(`Browser did not finish fixture: ${diagnostics}`);
  const earlyReport = JSON.parse(Buffer.from(encoded, "base64").toString());
  if (earlyReport.status !== "passed")
    throw new Error(JSON.stringify({ report: earlyReport, errors }));
  for (const width of [375, 1280]) {
    await call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 812,
      deviceScaleFactor: 1,
      mobile: width === 375,
    });
    for (const mode of ["map", "neighborhood", "house"]) {
      const result = await call("Runtime.evaluate", {
        expression: "window.showMode(" + JSON.stringify(mode) + ")",
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      if (mode === "map") {
        const targetResult = await call("Runtime.evaluate", {
          expression: "window.lastSelected=null;window.projectLandmark()",
          returnByValue: true,
        });
        const { x, y } = targetResult.result.value;
        await call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await call("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        await call("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: x + 20,
          y,
          button: "left",
          buttons: 1,
        });
        await call("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x,
          y,
          button: "left",
          buttons: 1,
        });
        await call("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        let selected = await call("Runtime.evaluate", {
          expression: "window.lastSelected",
          returnByValue: true,
        });
        if (selected.result.value) throw Error("Returning camera drag selected a landmark");
        await call("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        await call("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        selected = await call("Runtime.evaluate", {
          expression: "window.lastSelected",
          returnByValue: true,
        });
        if (selected.result.value !== "bank")
          throw Error("Landmark tap callback failed at " + width);
      }
      if (mode === "house") {
        const projected = await call("Runtime.evaluate", {
          expression: "window.projectAccessory()",
          returnByValue: true,
        });
        const { x, y } = projected.result.value;
        await call("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
        await call("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        await call("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1,
        });
        const open = await call("Runtime.evaluate", {
          expression:
            "(async()=>{if(document.querySelector('.house-object-task'))throw Error('Floating accessory label remains');await new Promise(r=>setTimeout(r,250));const dialog=document.querySelector('[role=dialog]');if(!dialog)throw Error('Accessory dialog missing');if(getComputedStyle(dialog).position!=='fixed')throw Error('Dialog styles missing');const r=dialog.getBoundingClientRect();if(r.left<-.5||r.right>innerWidth+.5||r.top<0||Math.abs(r.bottom-innerHeight)>1)throw Error('Dialog overflow '+JSON.stringify({left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:innerHeight}));dialog.querySelector('input[value=noodles]').click();await new Promise(r=>setTimeout(r,50));const start=[...dialog.querySelectorAll('button')].find(b=>b.textContent==='Cook Indomie & egg');if(!start)throw Error('Meal selection failed');start.click();if(window.usedAccessory!=='stove')throw Error('Accessory callback failed');return true;})()",
          awaitPromise: true,
          returnByValue: true,
        });
        if (open.exceptionDetails) throw Error(JSON.stringify(open.exceptionDetails));
        const panelShot = await call("Page.captureScreenshot", { format: "png" });
        await writeFile(
          resolve(".smoke/world-accessory-" + width + ".png"),
          Buffer.from(panelShot.data, "base64"),
        );
        await call("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        await call("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: "Escape",
          code: "Escape",
          windowsVirtualKeyCode: 27,
        });
        await pause(300);
        const edit = await call("Runtime.evaluate", {
          expression:
            "(async()=>{window.fixtureSetEdit(true);await new Promise(r=>setTimeout(r,350));window.inspectEdit();const state=window.inspectScene('house');return state;})()",
          awaitPromise: true,
          returnByValue: true,
        });
        if (edit.exceptionDetails) throw Error(JSON.stringify(edit.exceptionDetails));
        const editShot = await call("Page.captureScreenshot", { format: "png" });
        await writeFile(
          resolve(".smoke/house-edit-" + width + ".png"),
          Buffer.from(editShot.data, "base64"),
        );
        await call("Runtime.evaluate", { expression: "window.fixtureSetEdit(false)" });
        await pause(300);
      }
      const shot = await call("Page.captureScreenshot", { format: "png" });
      await writeFile(
        resolve(".smoke/world-restyle-" + mode + "-" + width + ".png"),
        Buffer.from(shot.data, "base64"),
      );
    }
  }
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
  await writeFile(resolve(".smoke/world-restyle-1280.png"), Buffer.from(desktop.data, "base64"));
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
