/* (C) 2026 Carinoasd. Targeted offline preview checks: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..'),file=path.resolve(root,process.argv[2]||'../output/天使弹幕祭/演出短样/Boss符卡演出短样.html');
const out=path.join(root,'tmp/danmaku/boss-spell-preview-v1/browser'),profile=path.join(out,'chrome-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),hash=s=>crypto.createHash('sha256').update(s).digest('hex');let chrome,socket;
async function main(){
 const log=fs.openSync(path.join(profile,'stderr.log'),'w');chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:['ignore','ignore',log]});fs.closeSync(log);
 const portFile=path.join(profile,'DevToolsActivePort');let launchError;chrome.on('error',e=>launchError=e);for(let i=0;i<180&&!fs.existsSync(portFile);i++){if(launchError)throw launchError;await sleep(50);}assert.ok(fs.existsSync(portFile),'Chrome endpoint missing');
 const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);socket=new WebSocket('ws://127.0.0.1:'+port+endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 const waiting=new Map(),events=[];let next=1;socket.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id){const p=waiting.get(m.id);if(p){waiting.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result||{});}}else events.push(m);});
 function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=next++,timer=setTimeout(()=>{waiting.delete(id);reject(Error('CDP timeout '+method));},18000);waiting.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
 const target=(await call('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url==='about:blank'),session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId,send=(m,p)=>call(m,p,session);
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
 async function until(expression,max=16000){for(let t=0;t<max;t+=50){if(await evaluate(expression))return;await sleep(50);}throw Error('Condition timed out '+expression);}
 async function click(selector){const box=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');e.scrollIntoView({block:"nearest"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');await send('Input.dispatchMouseEvent',{type:'mousePressed',...box,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...box,button:'left',clickCount:1});}
 async function screenshot(name,id){const clip=id?await evaluate('(()=>{const r=document.getElementById('+JSON.stringify(id)+').getBoundingClientRect();return{x:Math.floor(r.x+scrollX),y:Math.floor(r.y+scrollY),width:Math.ceil(r.width),height:Math.ceil(r.height),scale:1}})()'):undefined;const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,...(clip?{clip}:{})});fs.writeFileSync(path.join(out,name),Buffer.from(result.data,'base64'));}
 const inspect=()=>evaluate('SpellPreview.inspect()'),pixels=()=>evaluate('document.getElementById("field").toDataURL()');
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});await send('Emulation.setDeviceMetricsOverride',{width:1160,height:1040,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(file).href});await send('Page.bringToFront');await until('window.SpellPreview&&SpellPreview.inspect().ready');
 assert.equal((await inspect()).frame,62);assert.equal((await inspect()).playing,false);assert.ok(await evaluate('Array.from(document.fonts).some(f=>f.family==="Danmaku Spell Serif"&&f.status==="loaded")'));
 await screenshot('page-observer.png');
 const snapshots={};
 for(const theme of ['observer','lingyu']){
  await evaluate('SpellPreview.seek(62)');
  await click('[data-theme="'+theme+'"]');assert.equal((await inspect()).frame,62);
  await screenshot(theme+'-peak.png','field');
  for(let spell=0;spell<3;spell++){
   await evaluate('(()=>{const e=document.getElementById("spell");e.value="'+spell+'";e.dispatchEvent(new Event("change"));})()');
   assert.equal((await inspect()).spell,spell);
   assert.ok(await evaluate('(()=>{const m=SpellPreview.inspect().model,c=document.getElementById("field").getContext("2d");c.save();c.font="500 "+m.titleSize+"px Danmaku Spell Serif";const ok=c.font.includes("Danmaku")&&c.measureText(m.main).width<420;c.restore();return ok})()'));
  }
  await evaluate('document.getElementById("spell").value="1";document.getElementById("spell").dispatchEvent(new Event("change"))');
  snapshots[theme]=[];
  for(const f of [12,30,62,100,120,150,240]){
   await evaluate('SpellPreview.seek('+f+')');const first=hash(await pixels());await evaluate('SpellPreview.seek('+f+')');assert.equal(hash(await pixels()),first);
   const m=(await inspect()).model;if(f>=120){assert.equal(m.portraitAlpha,0);assert.equal(m.bandAlpha,0);assert.equal(m.titleAlpha,1);assert.equal(m.settle,1);}
   snapshots[theme].push({frame:f,sha256:first});
   await screenshot(theme+'-'+f+'.png','field');
  }
  // One compact storyboard image per character; draw from the actual preview, no re-rendering approximation.
  await evaluate('window.__strip=document.createElement("canvas");__strip.width=1200;__strip.height=354;window.__sc=__strip.getContext("2d");__sc.fillStyle="#0b1424";__sc.fillRect(0,0,1200,354)');
  let index=0;for(const f of [12,30,62,100,150]){await evaluate('SpellPreview.seek('+f+');__sc.drawImage(document.getElementById("field"),'+index*240+',0,240,320);__sc.fillStyle="#d4ba83";__sc.font="13px sans-serif";__sc.fillText('+JSON.stringify(f+'f · '+(f/60).toFixed(2)+'s')+','+(index*240+12)+',343)');index++;}
  fs.writeFileSync(path.join(out,theme+'-storyboard.png'),Buffer.from((await evaluate('__strip.toDataURL()')).split(',')[1],'base64'));
 }
 await evaluate('window.__comparison=document.createElement("canvas");__comparison.width=960;__comparison.height=640;window.__cc=__comparison.getContext("2d")');
 for(const [i,theme] of ['observer','lingyu'].entries())await evaluate('SpellPreview.setTheme('+JSON.stringify(theme)+');SpellPreview.seek(62);__cc.drawImage(document.getElementById("field"),'+i*480+',0)');
 fs.writeFileSync(path.join(out,'boss-comparison.png'),Buffer.from((await evaluate('__comparison.toDataURL()')).split(',')[1],'base64'));
 await click('[data-frame="62"]');const held=hash(await pixels());await sleep(160);assert.equal(hash(await pixels()),held);
 await click('#next');assert.equal((await inspect()).frame,63);await click('#previous');assert.equal((await inspect()).frame,62);
 await click('#timeline');assert.ok(Math.abs((await inspect()).frame-120)<=2);assert.equal((await inspect()).playing,false);
 await click('#replay');await until('SpellPreview.inspect().frame>12');await click('#toggle');const paused=(await inspect()).frame;await sleep(130);assert.equal((await inspect()).frame,paused);
 const speeds={};for(const speed of [1,.5,.25]){await evaluate('document.getElementById("rate").value="'+speed+'";document.getElementById("rate").dispatchEvent(new Event("change"))');await click('#replay');await until('SpellPreview.inspect().frame>0');const before=(await inspect()).frame;await sleep(400);await click('#toggle');speeds[speed]=(await inspect()).frame-before;assert.ok(speeds[speed]>speed*12&&speeds[speed]<speed*50,'Playback speed '+speed);}
 await click('#toggle');await evaluate('window.dispatchEvent(new Event("blur"))');assert.equal((await inspect()).playing,false);
 await evaluate('SpellPreview.seek(238);document.getElementById("rate").value="1";document.getElementById("rate").dispatchEvent(new Event("change"))');await click('#toggle');await until('SpellPreview.inspect().frame===240&&!SpellPreview.inspect().playing');
 await click('#reduced');await click('[data-frame="62"]');assert.equal((await inspect()).model.rotation,0);assert.equal((await inspect()).model.flash,0);await screenshot('lingyu-reduced.png','field');await click('#reduced');
 for(const width of [390,320]){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');assert.ok(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'));await screenshot('mobile-'+width+'.png');}
 await send('Emulation.setDeviceMetricsOverride',{width:1160,height:1040,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0);SpellPreview.seek(62)');await screenshot('page-lingyu.png');
 assert.deepEqual(events.filter(e=>e.method==='Runtime.exceptionThrown'),[]);const requests=events.filter(e=>e.method==='Network.requestWillBeSent').map(e=>e.params.request.url).filter(u=>!u.startsWith('file:')&&!u.startsWith('data:'));assert.deepEqual(requests,[]);
 assert.ok(await evaluate('!window.CampaignReview&&!window.DanmakuEngine'));
 const model=require('../../source/plugin/gamecenter/games/_danmaku_campaign_draft/spell-preview-v1.js');for(const theme of ['observer','lingyu'])for(const f of [0,18,36,62,80,119,120,240]){const a=model.model(theme,1,f,false);assert.deepEqual(a,model.model(theme,1,f,false));assert.ok(Object.isFrozen(a));}
 const baseline=[
  ['../output/天使弹幕祭/当前试玩/danmaku-campaign-easy-v7-offline.html','9ec0d3a08535be7387d363611a2739baa68aa83afa44cc5be137cb4ebc801758'],
  ['source/plugin/gamecenter/games/_danmaku_campaign_draft/notice-frames-v7.js','fbfb989f900e3773362061249e02cbb81a9cb111da0873afa65be2477b83f3f7'],
  ['source/plugin/gamecenter/games/_danmaku_campaign_draft/bomb-view-v6.js','0d4d5e4bc3a279e780453329e82c5198a3654b987b9892427d1062a79744b508']
 ];for(const [name,digest] of baseline){let source=path.resolve(root,name);if(!fs.existsSync(source)&&name.includes('当前试玩'))source=path.join(root,'../output/天使弹幕祭/历史版本/danmaku-campaign-easy-v7/danmaku-campaign-easy-v7-offline.html');assert.equal(hash(fs.readFileSync(source)),digest);}
 const report={status:'PASS',file:path.basename(file),sha256:hash(fs.readFileSync(file)),bytes:fs.statSync(file).size,defaultPausedAtPeak:true,bothThemesAndSixSpellNames:true,introFits120Frames:true,portraitAndBandsGoneBy120:true,titleRemainsAfter120:true,transportPauseStepScrubReplayEnd:true,playbackFramesPer400ms:speeds,blurEventPauses:true,pausePixelsFrozen:true,repeatedRenderingDeterministic:true,reducedMotion:true,widthsChecked:[390,320],embeddedFontLoadedOffline:true,externalRequests:requests.length,consoleErrors:0,currentGameAndAcceptedBombSourcesUnchanged:true,battleIntegrated:false,realFullStageTested:false,snapshots};
 report.protectedInputs=Object.fromEntries(baseline);fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,snapshots:'14 frame hashes retained in checks.json'}));await call('Browser.close');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();if(chrome&&!chrome.killed)chrome.kill();});
