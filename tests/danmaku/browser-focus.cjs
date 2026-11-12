/* (C) 2026 Carinoasd. Isolated local Chrome UI verification: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const {fileURLToPath}=require('node:url');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const uiOnly=process.argv.includes('--ui-only');
const expectBootError=process.argv.includes('--expect-boot-error'),offline=process.argv.includes('--offline');
let url=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
const outputArg=process.argv.find(arg=>arg.startsWith('--out='));
const out=outputArg?path.resolve(root,outputArg.slice(6)):path.join(root,'tmp/danmaku/focus/browser');fs.mkdirSync(out,{recursive:true});
const profile=path.join(out,'chrome-'+Date.now());fs.mkdirSync(profile);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class Protocol{
 constructor(socket){this.socket=socket;this.next=1;this.pending=new Map();this.events=[];
  socket.addEventListener('message',e=>{const data=JSON.parse(String(e.data));
   if(data.id){const pending=this.pending.get(data.id);if(pending){clearTimeout(pending.timer);this.pending.delete(data.id);data.error?pending.reject(Error(JSON.stringify(data.error))):pending.resolve(data.result||{});}}
   else this.events.push(data);
  });
 }
 send(method,params={},sessionId){return new Promise((resolve,reject)=>{
  const id=this.next++,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout: '+method));},15000);
  this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });}
}
let chrome,protocol,session,previewServer;
async function run(){
 if(!url){
  previewServer=spawn(process.env.DANMAKU_PYTHON||'python',[path.join(__dirname,'serve.py'),'--port','0'],
   {cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  url=await new Promise((resolve,reject)=>{
   let text='',errorText='';const timer=setTimeout(()=>reject(Error('Local preview startup timed out: '+errorText)),15000);
   previewServer.stdout.on('data',chunk=>{text+=chunk;const match=text.match(/http:\/\/127\.0\.0\.1:\d+\//);if(match){clearTimeout(timer);resolve(match[0]);}});
   previewServer.stderr.on('data',chunk=>{errorText+=chunk;});
   previewServer.on('error',error=>{clearTimeout(timer);reject(error);});
   previewServer.on('exit',code=>{clearTimeout(timer);reject(Error('Local preview exited '+code+': '+errorText));});
  });
 }
 const parsed=new URL(url);assert.ok(['http:','file:'].includes(parsed.protocol));
 if(parsed.protocol==='file:'){
  assert.equal(parsed.hostname,'');assert.ok(fs.statSync(fileURLToPath(parsed)).isFile());
 }else{
 assert.equal(parsed.hostname,'127.0.0.1');
 for(const [name,type]of [['rules-data.js','javascript'],['player-view.js','javascript'],['assets/player-motion-v1.png','image/png'],['assets/player-front-display-v1.png','image/png']]){
  const result=await fetch(new URL(name,url));assert.equal(result.status,200,name);assert.ok(result.headers.get('content-type').includes(type));
  assert.deepEqual(Buffer.from(await result.arrayBuffer()),fs.readFileSync(path.join(base,name)));
 }
 assert.equal((await fetch(new URL('assets/README.md',url))).status,404);
 }
 const stderr=fs.openSync(path.join(profile,'stderr.log'),'w');
 chrome=spawn(process.env.DANMAKU_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--window-size=1280,900',
  '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
 ],{windowsHide:true,stdio:['ignore','ignore',stderr]});fs.closeSync(stderr);
 let launchError;chrome.on('error',error=>{launchError=error;});
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<200&&!fs.existsSync(portFile);i++){if(launchError)throw launchError;if(chrome.exitCode!==null)throw Error('Chrome exited before startup: '+chrome.exitCode);await sleep(50);}
 assert.ok(fs.existsSync(portFile),'Chrome debugging endpoint not ready');
 const [port,browserPath]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
 const socket=new WebSocket('ws://127.0.0.1:'+port+browserPath);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 protocol=new Protocol(socket);
 const {targetId}=await protocol.send('Target.createTarget',{url:'about:blank'});
 session=(await protocol.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
 const send=(method,params)=>protocol.send(method,params,session);
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Page.bringToFront');
 if(offline)await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url});
 async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
 async function until(expression,timeout=12000){const started=Date.now();while(Date.now()-started<timeout){const value=await evaluate(expression);if(value)return value;await sleep(60);}const detail=await evaluate('({state:window.DanmakuPreview&&window.DanmakuPreview.inspect(),active:document.activeElement&&document.activeElement.id,focused:document.hasFocus(),status:document.getElementById("status").textContent})');throw Error('Browser condition timed out: '+expression+' '+JSON.stringify(detail));}
 const state=()=>evaluate('window.DanmakuPreview.inspect()');
 async function click(id){
  const summaries=await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+'),a=[];for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS"&&!p.open&&!p.querySelector(":scope>summary").contains(e))a.unshift(p.querySelector(":scope>summary").id);return a;})()');
  for(const summary of summaries){assert.ok(summary);await click(summary);}
  const r=await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.scrollIntoView({block:"nearest"});return e.getBoundingClientRect().toJSON()})()'),x=r.x+r.width/2,y=r.y+r.height/2;await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
 const screenshotPauses=[];
 async function resumeAfterCapture(){
  const current=await state();
  if(current.mode==='paused'){
   screenshotPauses.push(await evaluate('document.getElementById("status").textContent'));
   await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');
  }
  await send('Page.bringToFront');await evaluate('document.getElementById("arena").focus()');
 }
 async function screenshot(name,full=false){
  const current=await evaluate('window.DanmakuPreview&&window.DanmakuPreview.inspect&&window.DanmakuPreview.inspect()');
  if(current&&current.mode==='running')await click('pause');
  const options={format:'png',fromSurface:true};
  if(full){const metrics=await send('Page.getLayoutMetrics');const size=metrics.cssContentSize;options.captureBeyondViewport=true;options.clip={x:0,y:0,width:size.width,height:Math.min(2200,size.height),scale:1};}
  const result=await send('Page.captureScreenshot',options);fs.writeFileSync(path.join(out,name),Buffer.from(result.data,'base64'));
 }
 const mapping={ShiftLeft:['Shift',16],ShiftRight:['Shift',16],ArrowRight:['ArrowRight',39],ArrowLeft:['ArrowLeft',37]};
 async function key(code,type,modifiers=0){const [key,virtual]=mapping[code];await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:virtual,nativeVirtualKeyCode:virtual,modifiers});}
 if(expectBootError){
  await until('document.getElementById("overlay-title").textContent.includes("尚未就绪")');
  await screenshot('startup-error.png');
  const report=await evaluate('({title:document.getElementById("overlay-title").textContent,text:document.getElementById("overlay-text").textContent,status:document.getElementById("status").textContent,startDisabled:document.getElementById("start").disabled})');
  assert.equal(report.startDisabled,true);fs.writeFileSync(path.join(out,'startup-error.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 await until('window.DanmakuPreview && window.DanmakuPreview.inspect() && window.DanmakuPreview.inspect().spriteReady && document.getElementById("player-portrait").complete && document.getElementById("player-portrait").naturalWidth===160');
 await click('scene-battle');
 assert.equal((await state()).rule,'danmaku-p1-r2');
 await click('start');await until('window.DanmakuPreview.inspect().snapshot.stage==="active"');
 await until('window.DanmakuPreview.inspect().snapshot.sim.shots.length>=3');
 const normal=await state();assert.equal(normal.focused,false);assert.equal(normal.hitpointVisible,false);
 assert.ok(normal.snapshot.sim.shots.some(s=>s[4]!==0&&s[7]===0));
 await screenshot('normal-desktop.png',true);
 await resumeAfterCapture();
 await key('ShiftLeft','keyDown',8);await until('window.DanmakuPreview.inspect().focused');
 const focusStart=(await state()).snapshot.sim.tick;
 await until('window.DanmakuPreview.inspect().snapshot.sim.tick>='+ (focusStart+15));
 const focused=await state();assert.equal(focused.hitpointVisible,true);
 assert.ok(focused.snapshot.sim.shots.filter(s=>s[3]>focusStart).length>=3);
 assert.ok(focused.snapshot.sim.shots.filter(s=>s[3]>focusStart).every(s=>s[4]===0&&s[7]===1));
 assert.equal(await evaluate('document.getElementById("slow").getAttribute("aria-pressed")'),'true');
 await screenshot('focus-desktop.png',true);
 await resumeAfterCapture();await key('ShiftLeft','keyDown',8);
 async function move(){const before=await state();await key('ArrowRight','keyDown',before.focused?8:0);await until('window.DanmakuPreview.inspect().snapshot.sim.tick>='+ (before.snapshot.sim.tick+15));await key('ArrowRight','keyUp',before.focused?8:0);const after=await state();return{ticks:after.snapshot.sim.tick-before.snapshot.sim.tick,dxQ:after.snapshot.sim.player[0]-before.snapshot.sim.player[0]};}
 const focusMove=await move();assert.ok(focusMove.dxQ/focusMove.ticks<=96&&focusMove.dxQ/focusMove.ticks>=60);
 await key('ShiftRight','keyDown',8);await key('ShiftLeft','keyUp',8);assert.equal((await state()).focused,true);
 await key('ShiftRight','keyUp');await until('!window.DanmakuPreview.inspect().focused');
 assert.equal((await state()).hitpointVisible,false);const normalMove=await move();assert.ok(normalMove.dxQ/normalMove.ticks>180);
 await key('ShiftLeft','keyDown',8);
 const other=await protocol.send('Target.createTarget',{url:'about:blank'});
 await protocol.send('Target.activateTarget',{targetId:other.targetId});
 await until('window.DanmakuPreview.inspect().mode==="paused"');
 const blurred=await state();assert.equal(blurred.focused,false);assert.equal(blurred.hitpointVisible,false);
 await protocol.send('Target.closeTarget',{targetId:other.targetId});await send('Page.bringToFront');
 await key('ShiftLeft','keyUp');await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');
 assert.equal(await evaluate('document.getElementById("status").textContent.includes("已暂停")'),false);
 await click('slow');assert.equal((await state()).focused,true);await click('slow');assert.equal((await state()).focused,false);
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await click('scene-flower');await click('start');await click('slow');await until('window.DanmakuPreview.inspect().records>=6');
 assert.equal((await state()).rule,'danmaku-p0-r2');assert.equal((await state()).focused,true);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
 const narrowPortrait=await evaluate('({image:document.getElementById("player-portrait").getBoundingClientRect().toJSON(),arena:document.getElementById("arena").getBoundingClientRect().toJSON(),width:innerWidth})');
 assert.ok(narrowPortrait.image.y>=narrowPortrait.arena.bottom);assert.ok(narrowPortrait.image.right<=360);
 await screenshot('focus-narrow.png',true);
 await resumeAfterCapture();
 const touchBox=await evaluate('document.getElementById("arena").getBoundingClientRect().toJSON()');
 const touch={x:touchBox.x+touchBox.width*.5,y:touchBox.y+touchBox.height*.6,id:1};
 const dragBefore=await state();
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
 await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch,x:touch.x+20}]});
 await until('window.DanmakuPreview.inspect().records>='+ (dragBefore.records+15));
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(80);
 const dragAfter=await state();assert.equal(dragAfter.mode,'running');assert.ok(dragAfter.snapshot.player[0]>dragBefore.snapshot.player[0]);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});
 await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await until('window.DanmakuPreview.inspect().mode==="paused"');
 await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');
 await click('slow');assert.equal((await state()).hitpointVisible,false);
 const httpRequests=protocol.events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));
 if(parsed.protocol==='file:')assert.equal(httpRequests.length,0,'Direct-file preview must not request HTTP resources');
 const uiReport={status:'PASS',entryProtocol:parsed.protocol,offline,httpRequests:httpRequests.length,desktop:[1280,900],narrow:[360,800],spriteReady:true,
  normalHitpointHidden:true,shiftHitpointVisible:true,releaseRestoresNormal:true,bothShiftKeys:true,blurClearsHeldShift:true,
  mobileButtonEquivalent:true,touchReleaseKeepsRunning:true,touchCancelPauses:true,focusMove,normalMove,
  narrowPortraitBelowArena:true,screenshotPauses,fullBattleHumanClear:false,physicalPhoneTouchVerified:false};
 if(uiOnly){
  const errors=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0,JSON.stringify(errors));
  const report={...uiReport,uiOnly:true,consoleExceptions:0};
  fs.writeFileSync(path.join(out,'ui-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 await click('scene-aim');await click('start');await key('ShiftLeft','keyDown',8);
 await until('window.DanmakuPreview.inspect().records>=30');await key('ShiftLeft','keyUp');
 console.log('Browser mode, movement, blur and narrow-layout checks passed; waiting for natural practice terminal…');
 await until('window.DanmakuPreview.inspect().mode==="over"',65000);
 const actual=await state(),payload=await evaluate('window.DanmakuPreview.exportReplay()');
 assert.equal(payload.rule,'danmaku-p0-r2');fs.writeFileSync(path.join(out,'actual-browser-practice-r2.json'),JSON.stringify(payload));
 const rules=require(path.join(base,'rules.json')),replay=require(path.join(base,'replay.js'));
 const records=replay.decode(payload,rules);assert.ok(records.some(v=>v.flags&1));assert.ok(records.some(v=>!(v.flags&1)));
 const result=replay.run(payload,rules,false);assert.deepEqual(result.snapshot,actual.snapshot);
 const php=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli.php')],{input:JSON.stringify(payload),encoding:'utf8',maxBuffer:32*1024*1024});
 assert.equal(php.status,0,php.stderr);assert.deepEqual(JSON.parse(php.stdout).data,result);
 const errors=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0,JSON.stringify(errors));
 const report={...uiReport,
  actualReplay:{rule:payload.rule,ticks:payload.ticks,status:actual.snapshot.status,jsPhpFullTraceMatch:true},
  consoleExceptions:errors.length};
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
(async()=>{try{await run();}catch(error){fs.writeFileSync(path.join(out,'failed-checks-'+Date.now()+'.json'),JSON.stringify({message:error.message},null,2));console.error(error.stack);process.exitCode=1;}finally{
 if(protocol){try{await protocol.send('Browser.close');}catch{}protocol.socket.close();}
 if(chrome&&chrome.exitCode===null){await sleep(1000);if(chrome.exitCode===null)chrome.kill();}
 if(previewServer&&previewServer.exitCode===null)previewServer.kill();
}})();
