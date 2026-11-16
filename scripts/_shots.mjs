import { chromium } from "playwright"; import { spawn } from "node:child_process";
const srv = spawn("npx", ["vite","preview","--host","127.0.0.1","--port","4175","--strictPort"],{stdio:"ignore"});
await new Promise(r=>setTimeout(r,2500));
const b = await chromium.launch({executablePath:"/usr/bin/google-chrome",args:["--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"]});
const p = await b.newPage({viewport:{width:900,height:900}});
await p.goto("http://127.0.0.1:4175/#/r/maison/ar/maison-vieiras");
await p.waitForFunction(()=>document.querySelector("model-viewer")?.loaded,null,{timeout:60000});
let i=0;
for (const orbit of ["20deg 50deg 105%","90deg 80deg 105%","200deg 65deg 105%","0deg 5deg 105%"]) {
  await p.evaluate((o)=>{const m=document.querySelector("model-viewer");m.removeAttribute("auto-rotate");m.setAttribute("camera-orbit",o);m.jumpCameraToGoal();},orbit);
  await p.waitForTimeout(1500);
  await p.locator(".ar-stage").screenshot({path:`/tmp/lab/v${i++}.png`});
}
console.log(await p.evaluate(()=>{const d=document.querySelector("model-viewer").getDimensions();return [d.x,d.y,d.z].map(v=>(v*100).toFixed(1)).join(" x ")}));
await b.close(); srv.kill();
