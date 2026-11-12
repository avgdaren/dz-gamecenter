/* (C) 2026 Carinoasd. Short isolated visual checks, no complete run: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tmp/danmaku/boss-r3/browser');fs.mkdirSync(out,{recursive:true});
const profile=path.join(out,'chrome-'+Date.now());fs.mkdirSync(profile);const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,ws,session,id=0;const pending=new Map(),events=[];
function send(method,params={},sid=session){return new Promise((resolve,reject)=>{const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error(method+' timeout'));},12000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params,...(sid?{sessionId:sid}:{})}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,limit=12000){const start=Date.now();while(Date.now()-start<limit){if(await evaluate(expression))return;await sleep(40);}throw Error('Timed out '+expression);}
async function screenshot(name,clip){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});fs.writeFileSync(path.join(out,name),Buffer.from(r.data,'base64'));return r.data;}
async function click(name){
 const ancestors=await evaluate('(()=>{const a=[],e=document.getElementById('+JSON.stringify(name)+');for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS"&&!p.open&&!p.querySelector(":scope>summary").contains(e))a.unshift(p.querySelector(":scope>summary").id);return a;})()');for(const parent of ancestors)await click(parent);
 const r=await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(name)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',clickCount:1});
}
async function run(){
 const log=fs.openSync(path.join(profile,'stderr.log'),'w');chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--disable-gpu','--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check',
 '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore',log]});fs.closeSync(log);
 const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<200&&!fs.existsSync(portFile);i++)await sleep(50);assert.ok(fs.existsSync(portFile));
 const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);ws=new WebSocket('ws://127.0.0.1:'+port+endpoint);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 ws.addEventListener('message',e=>{const d=JSON.parse(String(e.data));if(d.id){const p=pending.get(d.id);if(p){pending.delete(d.id);clearTimeout(p.timer);d.error?p.reject(Error(JSON.stringify(d.error))):p.resolve(d.result||{});}}else events.push(d);});
 const target=(await send('Target.getTargets',{},null)).targetInfos.find(t=>t.type==='page');session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await send('Emulation.setDeviceMetricsOverride',{width:1120,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(root,'docs/danmaku/review/BOSS-r3.html')).href});await until('window.BossR3Review&&BossR3Review.inspect().ready');
 const phaseCounts=[];
 for(const [i,t]of [[0,300],[1,280],[2,290]]){
  await evaluate('BossR3Review.seek('+i+','+t+')');phaseCounts.push((await evaluate('BossR3Review.inspect()')).live);await screenshot('phase-'+(i+1)+'.png');
 }
 await evaluate('BossR3Review.seek(0,300);BossR3Review.motion(0)');
 const clip=await evaluate('(()=>{const r=document.getElementById("zoom").getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()');
 const a=await screenshot('body-at-0.png',clip);await evaluate('BossR3Review.motion(60)');const b=await screenshot('body-at-60.png',clip);assert.notEqual(a,b,'Only ring may be moving; isolated body must change');
 await sleep(180);const frozen=await screenshot('body-paused.png',clip);assert.equal(frozen,b,'Paused mesh must freeze');
 await click('reduced');assert.equal(await evaluate('document.getElementById("reduced").checked'),true);
 await evaluate('BossR3Review.motion(0)');const r0=await screenshot('body-reduced-0.png',clip);await evaluate('BossR3Review.motion(100)');const r1=await screenshot('body-reduced-100.png',clip);assert.equal(r0,r1,'Reduced body must be static');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await screenshot('preview-320.png');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(root,'../output/danmaku-stage01-boss-r3-offline.html')).href});
 await until('window.DanmakuPreview&&DanmakuPreview.inspect()?.bossArtReady&&DanmakuPreview.inspect()?.presentationReady');assert.equal(await evaluate('DanmakuPreview.inspect().rule'),'danmaku-stage01-r3');
 await click('scene-battle');assert.equal(await evaluate('DanmakuPreview.inspect().rule'),'danmaku-p1-r3');await click('audio-music');assert.equal(await evaluate('document.getElementById("audio-music").checked'),false);
 await click('start');await until('DanmakuPreview.inspect().snapshot.stage==="active"&&DanmakuPreview.inspect().snapshot.sim.tick>=135');
 await click('pause');const paused=await evaluate('DanmakuPreview.inspect()'),pixels=await evaluate('document.getElementById("arena").toDataURL()');await sleep(200);
 assert.deepEqual((await evaluate('DanmakuPreview.inspect()')).snapshot,paused.snapshot);assert.equal(await evaluate('document.getElementById("arena").toDataURL()'),pixels);
 await screenshot('actual-practice.png');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.querySelector(".arena-controls").getBoundingClientRect().bottom<=570'));await screenshot('actual-320.png');
 const exceptions=events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0,JSON.stringify(exceptions));const http=events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));assert.equal(http.length,0);
 const times=paused.frameTimes.slice().sort((a,b)=>a-b),p95=times[Math.ceil(times.length*.95)-1];assert.ok(p95<12,'Mesh rendering budget exceeded on this desktop');
 const report={status:'PASS',threePatternCaptures:true,phaseCounts,isolatedBodyActuallyMoves:true,pausedBodyPixelsFrozen:true,reducedBodyStatic:true,actualPracticeTicks:paused.snapshot.tick,
 actualRule:paused.rule,desktopP95DrawUpdateMs:p95,narrowControlsFit:true,httpRequests:0,jsExceptions:0,fullGameAutoPlay:false};
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
(async()=>{try{await run();}catch(e){fs.writeFileSync(path.join(out,'failed-'+Date.now()+'.json'),JSON.stringify({message:e.message,exceptions:events.filter(e=>e.method==='Runtime.exceptionThrown')},null,2));console.error(e.stack);process.exitCode=1;}finally{if(ws){try{await send('Browser.close',{},null);}catch{}ws.close();}if(chrome&&chrome.exitCode===null){await sleep(400);chrome.kill();}}})();
