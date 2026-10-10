import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
const folder = resolve(".smoke");
await mkdir(folder, { recursive: true });
await writeFile(
  resolve(folder, "neighborhood.html"),
  `<!doctype html><html><head><title>Neighborhood smoke</title></head><body style="margin:0;background:#e8eedf"><div id="game" style="width:1024px;height:700px"></div><output id="result">RUNNING</output><script type="module">
import { createNeighborhoodGame } from '/src/game/neighborhood-scene.ts';
let checkpoints=0, interaction='';
const {game,scene}=createNeighborhoodGame(document.getElementById('game'),{origin:{x:7,y:6},spawn:{x:7,y:6},onNearby:()=>{},onCheckpoint:()=>checkpoints++,onInteract:o=>interaction=o.kind,saveCheckpoint:async()=>true});
const fail=e=>document.getElementById('result').textContent='FAIL '+e.message;
window.addEventListener('error',e=>fail(e.error||new Error(e.message)));
const wait=setInterval(()=>{if(!scene.player)return;clearInterval(wait);try{
  game.loop.stop();
  const p=scene.player;
  let time=0;
  const step=()=>{scene.update();time+=1000/60;scene.physics.world.update(time,1000/60+0.001);scene.physics.world.postUpdate()};
  const initial=p.x;
  scene.keys.D.isDown=true; for(let i=0;i<20;i++)step();
  if(!(p.x>initial))throw new Error('Keyboard movement failed');
  const cardinal=Math.hypot(p.body.velocity.x,p.body.velocity.y);
  scene.keys.S.isDown=true; scene.update();
  if(Math.abs(Math.hypot(p.body.velocity.x,p.body.velocity.y)-cardinal)>0.1)throw new Error('Diagonal speed differs');
  scene.keys.D.isDown=false;scene.keys.S.isDown=false;step();
  if(checkpoints!==1)throw new Error('Stopped movement checkpoint failed');
  p.body.reset(170,240);scene.keys.W.isDown=true;for(let i=0;i<90;i++)step();scene.keys.W.isDown=false;step();
  if(p.y<180)throw new Error('Building collision failed');
  p.body.reset(200,420);step();scene.interact();if(interaction!=='npc')throw new Error('NPC proximity interaction failed');
  scene.setTouch('right',true);const touchX=p.x;for(let i=0;i<10;i++)step();scene.setTouch('right',false);step();if(p.x<=touchX)throw new Error('Touch movement failed');
  scene.lock(true);scene.keys.D.isDown=true;step();if(p.body.velocity.x!==0)throw new Error('Paused movement failed');scene.keys.D.isDown=false;scene.lock(false);
  p.body.reset(320,300);scene.update();game.renderer.snapshot(()=>{});
  document.getElementById('result').textContent='PASS movement diagonal collision checkpoint NPC touch pause';
}catch(e){fail(e)}},100);
</script></body></html>`,
);
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--config", "scripts/vite.smoke.config.ts"],
  { stdio: "ignore", windowsHide: true },
);
try {
  let available = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch("http://127.0.0.1:3011/.smoke/neighborhood.html");
      available = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  if (!available) throw new Error("Smoke server did not start");
  const browser = spawn(
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${resolve(folder, "chrome-profile")}`,
      "--virtual-time-budget=12000",
      "--window-size=1024,768",
      `--screenshot=${resolve(folder, "neighborhood.png")}`,
      "--dump-dom",
      "http://127.0.0.1:3011/.smoke/neighborhood.html",
    ],
    { windowsHide: true },
  );
  let output = "";
  browser.stdout.on("data", (chunk) => (output += chunk));
  let diagnostic = "";
  browser.stderr.on("data", (chunk) => {
    diagnostic += chunk;
  });
  const timeout = setTimeout(() => browser.kill(), 60000);
  await new Promise((resolve) => browser.on("exit", resolve));
  clearTimeout(timeout);
  const result = /<output id="result">([^<]+)<\/output>/.exec(output)?.[1];
  console.log(result || "FAIL no browser result");
  if (!result) console.log(diagnostic.slice(-1500));
  if (!result?.startsWith("PASS")) process.exitCode = 1;
} finally {
  vite.kill();
}
