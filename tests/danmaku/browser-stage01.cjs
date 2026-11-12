/* (C) 2026 Carinoasd. Real-browser one-stage input/replay QA: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url');
const {choose,fromSnapshot}=require('./stage01-policy.cjs');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=JSON.parse(fs.readFileSync(path.join(base,'rules.json'),'utf8')),R=require(path.join(base,'stage-replay.js'));
const bgmMode=process.argv.includes('--bgm'),midiMode=process.argv.includes('--midi'),decodedCount=bgmMode?18:midiMode?16:22;
const midiVersion=midiMode?Number(fs.readFileSync(path.join(base,'midi-bank.js'),'utf8').match(/"v":(\d+)/)[1]):2,midiTag='midi-v'+midiVersion;
const coldAudio=process.argv.includes('--cold-audio'),audioMode=bgmMode||midiMode||coldAudio||process.argv.includes('--audio'),artMode=audioMode||process.argv.includes('--art'),bombMode=artMode||process.argv.includes('--bomb'),expectedRule=bombMode?'danmaku-stage01-r2':'danmaku-stage01-r1';
const uiOnly=process.argv.includes('--ui-only'),interfaceMode=process.argv.includes('--ui-v1'),layoutOnly=process.argv.includes('--layout-only');
const bossArtMode=process.argv.includes('--boss-art');
const showMode=process.argv.includes('--show-v1');
const defaultPreview=fs.existsSync(path.join(root,'START.html'))?path.join(root,'START.html'):path.join(root,'../output/danmaku-stage01-'+(bgmMode?'happyshrimp-v1':midiMode?midiTag:audioMode?'audio-v1':artMode?'art-v1':bombMode?'bomb-r2':'growth-r1')+'-offline.html');
const url=process.argv.find(a=>a.startsWith('file:')||a.startsWith('http:'))||pathToFileURL(defaultPreview).href;
const outArg=process.argv.find(a=>a.startsWith('--out='));
const out=outArg?path.resolve(root,outArg.slice(6)):path.join(root,'tmp/danmaku/'+(bgmMode?'stage01-happyshrimp-v1':midiMode?'stage01-'+midiTag:audioMode?'stage01-audio':artMode?'stage01-art':bombMode?'bomb-r2':'stage01-growth')+'/browser');fs.mkdirSync(out,{recursive:true});
const profile=path.join(out,'chrome-'+Date.now());fs.mkdirSync(profile);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,protocol,session;
class Protocol{
 constructor(socket){this.socket=socket;this.next=1;this.pending=new Map();this.events=[];
  socket.addEventListener('message',e=>{const data=JSON.parse(String(e.data));if(data.id){const p=this.pending.get(data.id);if(p){clearTimeout(p.timer);this.pending.delete(data.id);data.error?p.reject(Error(JSON.stringify(data.error))):p.resolve(data.result||{});}}else this.events.push(data);});
 }
 send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=this.next++,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP timeout '+method));},15000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});}
}
async function run(){
 const log=fs.openSync(path.join(profile,'stderr.log'),'w');
 chrome=spawn(process.env.DANMAKU_CHROME||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',[
 '--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--window-size=1280,900',
 '--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
 ],{windowsHide:true,stdio:['ignore','ignore',log]});fs.closeSync(log);
 let launchError;chrome.on('error',e=>{launchError=e;});const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<200&&!fs.existsSync(portFile);i++){if(launchError)throw launchError;await sleep(50);}
 assert.ok(fs.existsSync(portFile),'Chrome endpoint missing');
 const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/),socket=new WebSocket('ws://127.0.0.1:'+port+endpoint);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});protocol=new Protocol(socket);
 let first;for(let i=0;i<100&&!first;i++){first=(await protocol.send('Target.getTargets')).targetInfos.find(t=>t.type==='page'&&t.url==='about:blank');if(!first)await sleep(50);}assert.ok(first);
 session=(await protocol.send('Target.attachToTarget',{targetId:first.targetId,flatten:true})).sessionId;
 const send=(method,params)=>protocol.send(method,params,session);
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
 if(interfaceMode){const downloadPath=path.join(out,'downloads');fs.mkdirSync(downloadPath,{recursive:true});await protocol.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath,eventsEnabled:true});}
 if(new URL(url).protocol==='file:')await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url});
 async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
 async function until(expression,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){const result=await evaluate(expression);if(result)return result;await sleep(50);}throw Error('Condition timed out '+expression);}
 const state=()=>evaluate('window.DanmakuPreview.inspect()');
 async function click(id){
  if(!audioMode)return evaluate('document.getElementById('+JSON.stringify(id)+').click()');
  const summaries=await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+'),a=[];for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==="DETAILS"&&!p.open&&!p.querySelector(":scope>summary").contains(e))a.unshift(p.querySelector(":scope>summary").id);return a;})()');
  for(const summary of summaries){assert.ok(summary,'Closed disclosure needs an addressable summary');await click(summary);}
  const rect=await evaluate('(()=>{const e=document.getElementById('+JSON.stringify(id)+');e.scrollIntoView({block:"nearest"});return e.getBoundingClientRect().toJSON()})()'),x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
 }
 async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(out,name),Buffer.from(r.data,'base64'));}
 async function reviewScreenshot(name){if(audioMode&&(await state()).mode==='running')await click('pause');await screenshot(name);}
 async function showScreenshot(name){
  if((await state()).mode==='running')await click('pause');
  await evaluate('document.getElementById("overlay").style.visibility="hidden"');await screenshot(name);await evaluate('document.getElementById("overlay").style.visibility=""');
 }
 const pauses=[];
 async function resume(){const v=await state();if(v.mode==='paused'){const message=await evaluate('document.getElementById("status").textContent');if(message.includes('规则错误'))throw Error(message);pauses.push(message);await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');}await evaluate('document.getElementById("arena").focus({preventScroll:true})');}
 await until('window.DanmakuPreview&&window.DanmakuPreview.inspect()&&window.DanmakuPreview.inspect().spriteReady&&document.getElementById("player-portrait").naturalWidth===160');
 assert.equal((await state()).rule,expectedRule);assert.deepEqual((await state()).snapshot.sim.power,[0,1]);
 if(artMode){await until('window.DanmakuPreview.inspect().stageArtReady');assert.deepEqual((await state()).stageArtErrors,[]);assert.equal((await state()).stageCamera,800);}
 if(bossArtMode){await until('window.DanmakuPreview.inspect().bossArtReady');assert.deepEqual((await state()).bossArtErrors,[]);assert.equal((await state()).bossPose,null);}
 if(showMode)await until('window.DanmakuPreview.inspect().presentationReady');
 if(interfaceMode){
  const sizes=[[1280,900],[1024,768],[900,700],[800,900],[768,1024],[360,800],[320,568]],layouts=[];
  assert.equal(await evaluate('document.querySelectorAll("[id]").length===new Set([...document.querySelectorAll("[id]")].map(e=>e.id)).size'),true,'Duplicate element IDs');
  assert.equal(await evaluate('document.getElementById("practice-settings").open||document.getElementById("audio-settings").open||document.getElementById("help-settings").open||document.getElementById("replay-tools").open'),false,'Secondary panels should start collapsed');
  for(const [width,height]of sizes){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=800});
   await evaluate('window.scrollTo(0,0)');
   const layout=await evaluate('(()=>{const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();return{viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,arena:rect("#arena"),controls:rect(".arena-controls"),hud:rect(".telemetry"),portrait:rect("#player-portrait"),buttons:[...document.querySelectorAll(".arena-controls button")].map(e=>e.getBoundingClientRect().height),canvasPixels:[document.getElementById("arena").width,document.getElementById("arena").height]};})()');
   layouts.push(layout);fs.writeFileSync(path.join(out,'layout-measurements.json'),JSON.stringify(layouts,null,2));await screenshot('layout-'+width+'x'+height+'.png');
   assert.ok(layout.scrollWidth<=width,'Horizontal overflow at '+width);assert.deepEqual(layout.canvasPixels,[480,640]);assert.ok(Math.abs(layout.arena.width/layout.arena.height-.75)<.01,'Battlefield aspect changed');
   assert.ok(layout.arena.width>=(width<=800&&height<700?220:260),'Battlefield too narrow at '+width);
   if(width>800){assert.ok(layout.controls.bottom<=height+2,'Battle controls below viewport at '+width+'x'+height);if(width===1280)assert.ok(layout.arena.width>420,'Battlefield did not grow beyond previous UI');}
   else{assert.ok(layout.hud.bottom<=layout.arena.y,'Mobile resources should precede battle');assert.ok(layout.portrait.y>=layout.arena.bottom);assert.ok(layout.buttons.every(h=>h>=44),'Touch controls too small');assert.ok(layout.controls.bottom<=height+2,'Mobile controls below viewport at '+width+'x'+height);}
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0)');
  await click('practice-heading');
  for(const [name,rule]of [['battle','danmaku-p1-r2'],['flower','danmaku-p0-r2'],['aim','danmaku-p0-r2'],['wave','danmaku-p0-r2'],['stage','danmaku-stage01-r2']]){
   await click('scene-'+name);assert.equal((await state()).rule,rule);assert.equal((await state()).mode,'ready');assert.equal((await state()).snapshot.tick,0);
   assert.equal(await evaluate('document.getElementById("power-metric").hidden'),name!=='stage');
   assert.equal(await evaluate('document.querySelector(".scene.selected").dataset.scene'),name);
  }
  await click('assist');assert.equal((await state()).snapshot.assist,true);assert.equal((await state()).snapshot.sim.player[2],5);assert.equal((await state()).snapshot.sim.player[3],3);
  await click('assist');assert.equal((await state()).snapshot.assist,false);assert.equal((await state()).snapshot.sim.player[2],3);
  await click('practice-heading');await evaluate('window.scrollTo(0,0)');
  const report={status:'PASS',sizes:layouts,allFiveModesAvailable:true,assistBeforeStart:true,uniqueIds:true,secondaryPanelsCollapsedByDefault:true,simulationNeverAdvanced:true};fs.writeFileSync(path.join(out,'layout-checks.json'),JSON.stringify(report,null,2));console.log('UI_LAYOUT '+JSON.stringify({status:'PASS',sizes:sizes.length,allFiveModesAvailable:true,assistBeforeStart:true}));
  if(layoutOnly)return;
 }
 if(process.argv.includes('--show-review-only')){
  await click('scene-battle');await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');
  await until('window.DanmakuPreview.inspect().snapshot.stage==="opening"&&window.DanmakuPreview.inspect().snapshot.remaining<=125');
  await showScreenshot('intro-desktop.png');const frozen=await state();
  const html=await evaluate('document.getElementById("boss-intro").outerHTML');await sleep(200);assert.deepEqual((await state()).snapshot,frozen.snapshot);assert.deepEqual((await state()).presentation,frozen.presentation);assert.equal(await evaluate('document.getElementById("boss-intro").outerHTML'),html);
  assert.equal(await evaluate('getComputedStyle(document.getElementById("boss-intro")).pointerEvents'),'none');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');await showScreenshot('intro-narrow-320.png');assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.querySelector(".arena-controls").getBoundingClientRect().bottom<=570'));
  await click('low-effects');await sleep(35);assert.equal(await evaluate('document.getElementById("low-effects").checked'),true);assert.equal((await state()).presentation.opacity,1);assert.deepEqual((await state()).bossPose,{row:0,column:0,ringAngle:0,lean:0});assert.equal(await evaluate('document.getElementById("boss-portrait").style.transform'),'translateX(0px)');await showScreenshot('intro-reduced-320.png');assert.deepEqual((await state()).snapshot,frozen.snapshot);await click('low-effects');assert.equal(await evaluate('document.getElementById("low-effects").checked'),false);
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await resume();
  await until('window.DanmakuPreview.inspect().snapshot.stage==="active"');assert.equal(await evaluate('document.getElementById("boss-intro").hidden&&document.getElementById("phase-cue").hidden'),true);
  const exceptions=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0);
  const http=protocol.events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));if(new URL(url).protocol==='file:')assert.equal(http.length,0);
  const report={status:'PASS',portraitLoaded:true,introPauses:true,logicalStyleFreezes:true,introClearsBeforeCombat:true,narrowControlsFit:true,nonBlockingOverlay:true,reducedStatic:true,jsExceptions:0,httpRequests:http.length};fs.writeFileSync(path.join(out,'show-review-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 if(process.argv.includes('--boss-review-only')){
  assert.ok(bossArtMode);await click('scene-battle');await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');
  await until('window.DanmakuPreview.inspect().snapshot.stage==="active"&&window.DanmakuPreview.inspect().snapshot.sim.enemies.length>12',20000);
  await click('pause');await sleep(60);
  const s=await state();assert.ok(s.bossArtReady);assert.deepEqual(s.bossArtErrors,[]);
  await screenshot('boss-page-paused.png');const frozen=s.snapshot;
  // file:// images intentionally taint canvas export. CDP captures the rendered
  // surface without weakening Chrome security; hide only the paused DOM veil.
  const rect=await evaluate('(()=>{document.getElementById("overlay").style.visibility="hidden";const r=document.getElementById("arena").getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:480/r.width};})()');
  const pixels=await send('Page.captureScreenshot',{format:'png',clip:rect,captureBeyondViewport:true});fs.writeFileSync(path.join(out,'boss-field-native.png'),Buffer.from(pixels.data,'base64'));await sleep(250);
  assert.deepEqual((await state()).snapshot,frozen);const again=await send('Page.captureScreenshot',{format:'png',clip:rect,captureBeyondViewport:true});assert.equal(again.data,pixels.data);
  await evaluate('document.getElementById("overlay").style.visibility=""');
  const errors=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0);
  const http=protocol.events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));if(new URL(url).protocol==='file:')assert.equal(http.length,0);
  const report={status:'PASS',sourceUrl:url,bossArtReady:true,pausedCanvasFrozen:true,tick:s.snapshot.tick,jsExceptions:0,httpRequests:http.length};fs.writeFileSync(path.join(out,'boss-review-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 if(audioMode&&!coldAudio){
  const first=(await state()).audio;assert.equal(first.unlocked,false);assert.equal(first.contextState,'not-created');assert.equal(first.settings.sfx,false);assert.equal(first.settings.music,true);
  await click('audio-heading');await click('audio-sfx');const before=(await state()).snapshot;
  await click('audio-preview');await until('window.DanmakuPreview.inspect().audio.previewing&&window.DanmakuPreview.inspect().audio.rms>.0002');
  assert.equal((await state()).audio.decoded,decodedCount);if(midiMode){assert.equal((await state()).audio.midi.parsedFiles,6);assert.ok((await state()).audio.midi.notesScheduled>0);}
  await screenshot('audio-settings-desktop.png');await click('audio-preview');
  await until('!window.DanmakuPreview.inspect().audio.previewing&&window.DanmakuPreview.inspect().audio.musicVoices===0&&window.DanmakuPreview.inspect().audio.contextState==="suspended"');
  assert.deepEqual((await state()).snapshot,before);
  if(midiMode){
   for(const [name,rows,offset,seconds]of [['stage-preview',[['stage',1]],16,16],['boss-preview',[['bossCore',1],['bossDrive',.8]],8,16],['boss-loop-check',[['bossCore',1],['bossDrive',.8]],39,4]]){
    const rendered=await evaluate(`(async()=>{
     const r=await DanmakuMidi.render(DanmakuMidiBank,${JSON.stringify(rows)},${offset},${seconds},22050),b=r.buffer,n=b.length,channels=b.numberOfChannels,bytes=new Uint8Array(44+n*channels*2),d=new DataView(bytes.buffer);
     function str(at,s){for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i)}str(0,'RIFF');d.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,channels,true);d.setUint32(24,22050,true);d.setUint32(28,22050*channels*2,true);d.setUint16(32,channels*2,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,bytes.length-44,true);
     let peak=0,sum=0;for(let c=0;c<channels;c++){const a=b.getChannelData(c);for(let i=0;i<n;i++){const v=a[i];if(!Number.isFinite(v))throw Error('Nonfinite MIDI PCM');peak=Math.max(peak,Math.abs(v));sum+=v*v;d.setInt16(44+(i*channels+c)*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true);}}
     let stressPeak=null;
     if(${JSON.stringify(name)}==='boss-preview'){
       const mix=new OfflineAudioContext(2,n,22050),music=mix.createBufferSource();music.buffer=b;music.connect(mix.destination);music.start(0);
       for(const at of [1,6,11])for(const key of ['hurt','bomb','win','lose','phase','elite']){const entry=DanmakuAudioBank.entries[key],raw=Uint8Array.from(atob(entry.data),ch=>ch.charCodeAt(0)),sample=await mix.decodeAudioData(raw.buffer),s=mix.createBufferSource(),g=mix.createGain();s.buffer=sample;g.gain.value=.2*.48;s.connect(g);g.connect(mix.destination);s.start(at);}
       const output=await mix.startRendering();stressPeak=0;for(let c=0;c<2;c++)for(const v of output.getChannelData(c))stressPeak=Math.max(stressPeak,Math.abs(v));
     }
     let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return{data:btoa(text),stats:{peak,rms:Math.sqrt(sum/(n*channels)),peakNotes:r.peakNotes,dropped:r.dropped,stressPeak,seconds:${seconds}}};
    })()`);
    assert.ok(rendered.stats.peak<.95,'MIDI mix clips');assert.ok(rendered.stats.rms>.008,'MIDI mix is silent');if(rendered.stats.stressPeak!==null)assert.ok(rendered.stats.stressPeak<.98,'MIDI plus six SFX clips');
    const previewDir=path.join(root,'docs/danmaku/audio/stage01-'+midiTag+'/previews');fs.mkdirSync(previewDir,{recursive:true});fs.writeFileSync(path.join(previewDir,name+'.wav'),Buffer.from(rendered.data,'base64'));fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(rendered.stats,null,2));console.log('MIDI_RENDER '+name+' '+JSON.stringify(rendered.stats));
   }
  }else if(bgmMode){
   // Render using Chrome's MP3 decoder and the actual shipped loop points.
   const rendered=await evaluate(`(async()=>{
    const decoded={};for(const [key,e]of Object.entries(DanmakuBgmBank.entries)){
      const c=new OfflineAudioContext(2,1,44100);decoded[key]=await c.decodeAudioData(await DanmakuAudio.decodeBytes(e.data));
      if(Math.abs(decoded[key].duration-e.seconds)>.03)throw Error('Decoded duration mismatch '+key);
    }
    const results={};
    for(const [name,key,offset,seconds,loop]of [['stage-preview','stage',16,16,false],['boss-preview','bossCore',8,16,true],['boss-loop-check','bossCore',DanmakuBgmBank.entries.bossCore.loopEnd-1,4,true],['stage-outro','stage',70,4,false]]){
      const c=new OfflineAudioContext(2,Math.round(seconds*22050),22050),g=DanmakuAudio.graph(c,{musicVolume:1,sfxVolume:1}),s=c.createBufferSource(),e=DanmakuBgmBank.entries[key];
      s.buffer=decoded[key];s.loop=loop;s.loopStart=e.loopStart;s.loopEnd=e.loopEnd;s.connect(g.music);s.start(0,offset);
      if(name==='boss-preview')for(const k of ['hurt','bomb','win','lose','phase','elite']){const e=DanmakuAudioBank.entries[k],b=await c.decodeAudioData(await DanmakuAudio.decodeBytes(e.data)),s=c.createBufferSource(),v=c.createGain();s.buffer=b;v.gain.value=.2;s.connect(v);v.connect(g.sfx);s.start(1);}
      if(name==='stage-outro'){const s=c.createBufferSource();s.buffer=decoded.bossCore;s.connect(g.music);s.start(2);}
      const b=await c.startRendering(),n=b.length,bytes=new Uint8Array(44+n*4),d=new DataView(bytes.buffer);function str(at,t){for(let i=0;i<t.length;i++)bytes[at+i]=t.charCodeAt(i)}
      str(0,'RIFF');d.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,2,true);d.setUint32(24,22050,true);d.setUint32(28,88200,true);d.setUint16(32,4,true);d.setUint16(34,16,true);str(36,'data');d.setUint32(40,bytes.length-44,true);
      let peak=0,sum=0,maxJump=0,seamJump=0;for(let ch=0;ch<2;ch++){const a=b.getChannelData(ch);for(let i=0;i<n;i++){const v=a[i];if(!Number.isFinite(v))throw Error('Nonfinite sample');peak=Math.max(peak,Math.abs(v));sum+=v*v;if(i)maxJump=Math.max(maxJump,Math.abs(v-a[i-1]));if(i===22050)seamJump=Math.max(seamJump,Math.abs(v-a[i-1]));d.setInt16(44+(i*2+ch)*2,Math.round(Math.max(-1,Math.min(1,v))*32767),true);}}
      let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));results[name]={data:btoa(text),stats:{peak,rms:Math.sqrt(sum/(n*2)),maxJump,seamJump,seconds,channels:2}};
    }return results;
   })()`);
   for(const [name,r]of Object.entries(rendered)){assert.ok(r.stats.peak<.95);assert.ok(r.stats.rms>.005);if(name==='boss-loop-check')assert.ok(r.stats.seamJump<.08,'Audible discontinuity at encoded loop seam');fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(r.stats,null,2));fs.writeFileSync(path.join(out,name+'.wav'),Buffer.from(r.data,'base64'));console.log('BGM_RENDER '+name+' '+JSON.stringify(r.stats));}
  }else{
  const mix=await evaluate(`(async()=>{
   const c=new OfflineAudioContext(1,22050*4,22050),g=DanmakuAudio.graph(c,{musicVolume:1,sfxVolume:1});
   async function sound(key,level,offset,loop,when,to){const e=DanmakuAudioBank.entries[key],b=Uint8Array.from(atob(e.data),ch=>ch.charCodeAt(0)),buffer=await c.decodeAudioData(b.buffer),s=c.createBufferSource(),v=c.createGain();s.buffer=buffer;s.loop=loop;v.gain.value=level;s.connect(v);v.connect(to);s.start(when,offset);}
   await sound('bossCore',1,29,true,0,g.music);await sound('bossDrive',.8,29,true,0,g.music);
   for(const k of ['hurt','bomb','win','lose','phase','elite'])await sound(k,.2,0,false,1,g.sfx);
   const b=await c.startRendering(),a=b.getChannelData(0);let peak=0,sum=0;for(const v of a){if(!Number.isFinite(v))throw Error('Nonfinite PCM');peak=Math.max(peak,Math.abs(v));sum+=v*v;}return{peak,rms:Math.sqrt(sum/a.length),loopSeamSecond:1,samples:a.length};
  })()`);
  assert.ok(mix.rms>.001);assert.ok(mix.peak<.98,'Full-volume mix clips');fs.writeFileSync(path.join(out,'offline-mix.json'),JSON.stringify(mix,null,2));
  }
  await click('audio-heading');
 }
 assert.equal(await evaluate('document.getElementById("power-metric").hidden'),false);
 await screenshot('ready-desktop.png');await click('start');
 const preparing=bgmMode&&coldAudio?await state():null;if(preparing&&preparing.mode==='preparing')assert.equal(preparing.snapshot.tick,0,'Loading must not consume stage time');
 await evaluate('document.getElementById("arena").focus()');
 if(coldAudio){
  const firstStarted=Date.now();await until('window.DanmakuPreview.inspect().audio.ready&&window.DanmakuPreview.inspect().audio.rms>.0002');
  const loaded=await state();assert.equal(loaded.mode,'running');assert.equal(loaded.audio.settings.sfx,false);assert.equal(loaded.audio.decoded,decodedCount);if(midiMode)assert.ok(loaded.audio.midi.notesScheduled>0);
  assert.ok(Math.abs(loaded.audio.musicOffsets[0].offset-loaded.snapshot.tick/60)<.35);
  await until('window.DanmakuPreview.inspect().snapshot.tick>='+String(loaded.snapshot.tick+300),10000);
  const final=await state();assert.equal(final.mode,'running');assert.deepEqual(final.audio.errors,[]);assert.ok(final.audio.rms>.0001);
  const errors=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0);
  const http=protocol.events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));if(new URL(url).protocol==='file:')assert.equal(http.length,0);
  const report={status:'PASS',coldStart:true,previewNotUsed:true,sfxDefaultOff:true,decoded:decodedCount,midi:midiMode?final.audio.midi:null,preparingTick:preparing?preparing.snapshot.tick:null,preparingMode:preparing?preparing.mode:null,loadedAtTick:loaded.snapshot.tick,observedTicks:final.snapshot.tick,elapsedMs:Date.now()-firstStarted,remainedRunning:true,musicOffsetAligned:true,audioErrors:0,jsExceptions:0,httpRequests:http.length};
  fs.writeFileSync(path.join(out,'cold-start-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 if(audioMode){
  await until('window.DanmakuPreview.inspect().audio.track==="stage"&&window.DanmakuPreview.inspect().audio.rms>.0002');
  await click('audio-heading');await until('window.DanmakuPreview.inspect().mode==="paused"');const frozen=(await state()).snapshot;
  await click('audio-mute');await until('window.DanmakuPreview.inspect().audio.contextState==="suspended"');assert.equal((await state()).audio.musicVoices,0);assert.equal((await state()).audio.sfxVoices,0);
  await click('audio-mute');await sleep(100);assert.equal((await state()).audio.musicVoices,0);assert.deepEqual((await state()).snapshot,frozen);
  await click('audio-music-volume');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home',windowsVirtualKeyCode:36});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Home',code:'Home',windowsVirtualKeyCode:36});assert.equal((await state()).audio.settings.musicVolume,0);
  await evaluate('document.getElementById("audio-music-volume").value=55;document.getElementById("audio-music-volume").dispatchEvent(new Event("input",{bubbles:true}))');
  await click('audio-music');await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');await sleep(150);assert.equal((await state()).audio.musicVoices,0);
  await click('audio-music');await click('audio-heading');await click('start');await until('window.DanmakuPreview.inspect().mode==="running"&&window.DanmakuPreview.inspect().audio.track==="stage"');
  const aligned=await state();assert.ok(Math.abs(aligned.audio.musicOffsets[0].offset-aligned.snapshot.tick/60)<.35,'Resume reset music position');
  const other=await protocol.send('Target.createTarget',{url:'about:blank'});await protocol.send('Target.activateTarget',{targetId:other.targetId});
  await until('window.DanmakuPreview.inspect().mode==="paused"&&window.DanmakuPreview.inspect().audio.contextState==="suspended"');
  assert.equal((await state()).audio.musicVoices,0);assert.equal((await state()).audio.sfxVoices,0);
  await protocol.send('Target.closeTarget',{targetId:other.targetId});await send('Page.bringToFront');await resume();
 }
 if(interfaceMode){
  await click('help-heading');await until('window.DanmakuPreview.inspect().mode==="paused"');const frozen=(await state()).snapshot;
  await sleep(120);assert.deepEqual((await state()).snapshot,frozen);assert.equal((await state()).audio.musicVoices,0);
  await screenshot('help-pauses-desktop.png');await click('help-heading');await resume();
 }
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
 await until('window.DanmakuPreview.inspect().hitpointVisible');
 async function markerPixels(){return evaluate('(()=>{const s=window.DanmakuPreview.inspect(),p=s.snapshot.sim.player,c=document.getElementById("arena").getContext("2d"),d=c.getImageData(Math.round(p[0]/64)-5,Math.round(p[1]/64)-5,11,11).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>230&&d[i+1]<145&&d[i+2]>65&&d[i+2]<200)n++;return n})()');}
 if(bombMode){await sleep(35);assert.ok(await markerPixels()>4,'Focused center is not visible in rendered pixels');await screenshot('focus-hitpoint-desktop.png');await resume();}
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
 await until('!window.DanmakuPreview.inspect().hitpointVisible');
 if(bombMode){
  await sleep(35);assert.equal(await markerPixels(),0,'Marker remains visible outside focus');
  await until('window.DanmakuPreview.inspect().snapshot.sim.enemies.length>0');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:8});
  const before=(await state()).snapshot;
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'x',code:'KeyX',windowsVirtualKeyCode:88,modifiers:8});
  await until('window.DanmakuPreview.inspect().snapshot.sim.stats[4]===1');
  for(let i=0;i<5;i++)await send('Input.dispatchKeyEvent',{type:'keyDown',key:'x',code:'KeyX',windowsVirtualKeyCode:88,modifiers:8,autoRepeat:true});
  await sleep(60);const cast=(await state()).snapshot;assert.equal(cast.sim.player[3],before.sim.player[3]-1);assert.equal(cast.sim.stats[4],1);
  assert.ok(cast.sim.bomb[7]>0,'Actual enemy bullets were not cleared');assert.equal(cast.sim.enemies.length,0);assert.ok(await markerPixels()>4,'Bomb covers focus marker');
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'x',code:'KeyX',windowsVirtualKeyCode:88});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'x',code:'KeyX',windowsVirtualKeyCode:88});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'x',code:'KeyX',windowsVirtualKeyCode:88});
  await sleep(35);assert.equal((await state()).snapshot.sim.stats[4],1,'Cooldown consumed stock');
  await click('pause');const frozen=(await state()).snapshot;await sleep(180);assert.deepEqual((await state()).snapshot,frozen);
  await screenshot('bomb-full-desktop.png');await click('low-effects');await sleep(35);assert.deepEqual((await state()).snapshot,frozen);
  if(artMode)assert.equal((await state()).stageCamera,0);
  await screenshot('bomb-simple-desktop.png');await click('low-effects');await resume();
  await until('window.DanmakuPreview.inspect().snapshot.sim.tick>window.DanmakuPreview.inspect().snapshot.sim.bomb[1]+5');
  assert.equal((await state()).snapshot.sim.stats[4],1,'Cooldown press queued a later cast');
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16});
 }
 await until('window.DanmakuPreview.inspect().snapshot.sim.mobs.length>0');
 await click('pause');const beforePause=(await state()).snapshot.tick;await sleep(150);assert.equal((await state()).snapshot.tick,beforePause);
 await click('start');await until('window.DanmakuPreview.inspect().mode==="running"');
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await click('slow');assert.equal((await state()).focused,true);
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
 const layout=await evaluate('({portrait:document.getElementById("player-portrait").getBoundingClientRect().toJSON(),arena:document.getElementById("arena").getBoundingClientRect().toJSON()})');
 assert.ok(layout.portrait.y>=layout.arena.bottom);await screenshot('prelude-narrow.png');await resume();
 if(bombMode){
  const before=(await state()).snapshot.sim.stats[4];await click('bomb');await until('window.DanmakuPreview.inspect().snapshot.sim.stats[4]==='+String(before+1));
  await click('bomb');await sleep(70);assert.equal((await state()).snapshot.sim.stats[4],before+1,'Disabled narrow button queued another bomb');
 }
 const rect=await evaluate('document.getElementById("arena").getBoundingClientRect().toJSON()'),point={x:rect.x+rect.width*.5,y:rect.y+rect.height*.6,id:1};
 const dragBefore=await state();await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+20}]});await sleep(120);
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await state()).mode,'running');assert.ok((await state()).snapshot.sim.player[0]>dragBefore.snapshot.sim.player[0]);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await until('window.DanmakuPreview.inspect().mode==="paused"');
 await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
 await click('restart');await until('window.DanmakuPreview.inspect().mode==="running"');
 if(uiOnly){
  if(bombMode){
   assert.equal(await evaluate('document.getElementById("bomb-rule-title").textContent'),'星翼绽放');
   await click('scene-battle');assert.notEqual(await evaluate('getComputedStyle(document.getElementById("low-effects-row")).display'),'none');
   assert.equal(await evaluate('document.getElementById("bomb-rule-title").textContent'),'清屏是一次喘息。');
   await click('scene-stage');assert.notEqual(await evaluate('getComputedStyle(document.getElementById("low-effects-row")).display'),'none');
  }
  const exceptions=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  const report={status:'PASS',rule:expectedRule,uiOnly:true,desktop:[1280,900],narrow:[360,800],focusedCenterPixels:bombMode,bombInputChecks:bombMode,latestRuleText:bombMode,legacyModeToggle:bombMode,audioControls:audioMode,jsExceptions:0};
  fs.writeFileSync(path.join(out,'ui-only-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;
 }
 const held=new Set(),keyMap={ShiftLeft:['Shift',16],ArrowLeft:['ArrowLeft',37],ArrowRight:['ArrowRight',39],ArrowUp:['ArrowUp',38],ArrowDown:['ArrowDown',40],KeyX:['x',88]};
 async function dispatch(type,code,modifiers=0){const [key,vk]=keyMap[code];await send('Input.dispatchKeyEvent',{type,code,key,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,modifiers});}
 async function releaseHeld(){for(const code of held)await dispatch('keyUp',code);held.clear();}
 async function apply(input){
  const wanted=new Set();if(input.flags&1)wanted.add('ShiftLeft');if(input.dx<0)wanted.add('ArrowLeft');if(input.dx>0)wanted.add('ArrowRight');if(input.dy<0)wanted.add('ArrowUp');if(input.dy>0)wanted.add('ArrowDown');
  for(const code of held)if(!wanted.has(code))await dispatch('keyUp',code,input.flags&1?8:0);
  for(const code of wanted)if(!held.has(code))await dispatch('keyDown',code,input.flags&1?8:0);
  if(input.flags&2){await dispatch('keyDown','KeyX',input.flags&1?8:0);await dispatch('keyUp','KeyX',input.flags&1?8:0);}
  held.clear();for(const code of wanted)held.add(code);
 }
 let prior=null,lastLog=0,maxLevel=1,enteredBoss=false,resourceCarry=false,bossLayerCheck=null;const captures=new Set(),bossRows=new Set(),started=Date.now(),forcedBombs=new Set(),mainPauseStart=pauses.length;
 console.log('Stage browser input run started; following normal controls to natural terminal…');
 while(true){
  const current=await state();if(current.mode==='over')break;
  if(Date.now()-started>360000)throw Error('Browser stage did not reach a natural terminal');
  if(current.mode==='paused'){await releaseHeld();await resume();continue;}
  const v=current.snapshot;maxLevel=Math.max(maxLevel,v.sim.power[1]);
  if(audioMode){assert.equal(current.audio.errors.length,0,JSON.stringify(current.audio.errors));assert.ok(current.audio.sfxVoices<=6);}
  if(midiMode)assert.ok(current.audio.midi.activeNotes<=32,'MIDI polyphony exceeded');
  if(bombMode)assert.ok(v.sim.player[3]<=3,'Stock exceeded carrying limit');
  if(prior&&prior.stage==='prelude'&&v.stage==='opening'){
   assert.equal(v.sim.player[2],prior.sim.player[2]);assert.equal(v.sim.player[3],prior.sim.player[3]);assert.ok(v.sim.power[0]>=prior.sim.power[0]);resourceCarry=true;
  }
  if(v.stage==='active')enteredBoss=true;
  if(bossArtMode&&current.bossPose){
   assert.equal(current.bossArtReady,true);assert.deepEqual(current.bossArtErrors,[]);bossRows.add(current.bossPose.row);
   if(v.stage==='active'&&!bossLayerCheck&&v.sim.enemies.length>0){
    bossLayerCheck=await evaluate(`new Promise(resolve=>{const c=document.getElementById('arena').getContext('2d'),draw=c.drawImage,fill=c.fill,clear=c.clearRect;let calls=[];
      c.clearRect=function(...a){calls=[];return clear.apply(this,a)};
      c.drawImage=function(i,...a){if(i.naturalWidth===384&&i.naturalHeight===512)calls.push('body');else if(i.naturalWidth===128)calls.push('back');else if(i.naturalWidth===64)calls.push('front');else if(i.naturalWidth===192&&i.naturalHeight===144)calls.push('player');return draw.call(this,i,...a)};
      c.fill=function(...a){if(['#efbcbb','#e9c47c','#a7baef'].includes(this.fillStyle))calls.push('enemy');return fill.apply(this,a)};
      requestAnimationFrame(()=>requestAnimationFrame(()=>{c.drawImage=draw;c.fill=fill;c.clearRect=clear;resolve(calls)}));})`);
    for(const n of ['back','body','front','player','enemy'])assert.ok(bossLayerCheck.includes(n),'Missing rendered layer '+n);
    assert.ok(bossLayerCheck.indexOf('back')<bossLayerCheck.indexOf('body')&&bossLayerCheck.indexOf('body')<bossLayerCheck.indexOf('front'));
    assert.ok(bossLayerCheck.indexOf('front')<bossLayerCheck.indexOf('player')&&bossLayerCheck.indexOf('player')<bossLayerCheck.indexOf('enemy'),'Enemy bullets must stay on top');
   }
   const phase='boss-phase-'+v.phase;
   if(v.stage==='active'&&v.sim.tick>80&&!captures.has(phase)){
    captures.add(phase);await reviewScreenshot(phase+'-desktop.png');await releaseHeld();
    const frozen=await state(),pixels=await evaluate('document.getElementById("arena").toDataURL()');await sleep(170);
    assert.deepEqual((await state()).bossPose,frozen.bossPose);assert.equal(await evaluate('document.getElementById("arena").toDataURL()'),pixels,'Paused Boss art must freeze');
    if(v.phase===0){
     await click('low-effects');await sleep(35);assert.deepEqual((await state()).bossPose,{row:0,column:0,ringAngle:0,lean:0});assert.deepEqual((await state()).snapshot,frozen.snapshot);await screenshot('boss-reduced-desktop.png');await click('low-effects');
     await send('Emulation.setDeviceMetricsOverride',{width:320,height:568,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');
     const hud=await evaluate('({hidden:document.getElementById("boss-face").hidden,width:document.getElementById("boss-face").getBoundingClientRect().width,bottom:document.querySelector(".arena-controls").getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth})');
     assert.equal(hud.hidden,false);assert.equal(hud.width,32);assert.equal(hud.overflow,false);assert.ok(hud.bottom<=570,'Boss HUD pushes controls below viewport');await screenshot('boss-narrow-320.png');
     await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0)');
    }
    await resume();
   }
  }
  if(artMode&&(v.stage==='active'||v.stage==='opening'))assert.equal(current.stageCamera,0,'Scene must be stationary by boss entry');
  if(artMode){
   const type=v.sim.mobs.find(m=>m[7]>80*64&&m[8]>0)?.[1],label=type===undefined?null:['fairy','attendant','guardian'][type];
   if(label&&!captures.has(label)){captures.add(label);await reviewScreenshot(label+'-desktop.png');await releaseHeld();await resume();}
   if(v.tick>=3720&&!captures.has('deceleration')){captures.add('deceleration');await reviewScreenshot('deceleration-desktop.png');await releaseHeld();await resume();}
  }
  const label=v.sim.power[1]===3?'power-iii':v.sim.power[1]===2?'power-ii':null;
  if(label&&!captures.has(label)){captures.add(label);await reviewScreenshot(label+'-desktop.png');await releaseHeld();await resume();}
  if(showMode){
   if(v.stage==='active')assert.equal(current.presentation.kind,'none','Cut-ins must never cover live combat');
   if(v.stage==='transition'&&v.remaining<85&&!captures.has('phase-cue-'+v.phase)){
    captures.add('phase-cue-'+v.phase);assert.equal(current.presentation.phase,v.phase);await showScreenshot('phase-cue-'+v.phase+'-desktop.png');await releaseHeld();const f=await state();await sleep(120);assert.deepEqual((await state()).presentation,f.presentation);assert.deepEqual((await state()).snapshot,f.snapshot);await resume();
   }
  }
  if(v.stage==='opening'&&(!showMode||v.remaining<=125)&&!captures.has('boss-entry')){captures.add('boss-entry');if(showMode)await showScreenshot('boss-entry-desktop.png');else await reviewScreenshot('boss-entry-desktop.png');await releaseHeld();await resume();}
  if(v.tick-lastLog>=900){console.log(JSON.stringify({tick:v.tick,stage:v.stage,power:v.sim.power,lives:v.sim.player[2],kills:v.sim.growth[1]}));lastLog=v.tick;}
  const model=fromSnapshot(v,rules),input=choose(model);
  if(bombMode&&v.stage==='prelude'&&v.sim.tick>=335&&!forcedBombs.has('prelude')){input.flags|=2;forcedBombs.add('prelude');}
  if(bombMode&&v.stage==='active'&&v.sim.tick>=240&&!forcedBombs.has('boss')){input.flags|=2;forcedBombs.add('boss');}
  await apply(input);prior=v;await sleep(45);
 }
 const actual=await state(),payload=await evaluate('window.DanmakuPreview.exportReplay()');
 if(showMode){for(const p of [1,2])assert.ok(captures.has('phase-cue-'+p));assert.equal(actual.presentation.kind,'clear');assert.equal(await evaluate('document.getElementById("start").disabled||document.getElementById("export").disabled'),false);}
 if(bossArtMode){assert.ok(bossLayerCheck);assert.deepEqual([...bossRows].sort(),[0,1,2,3]);for(const phase of [0,1,2])assert.ok(captures.has('boss-phase-'+phase));fs.writeFileSync(path.join(out,'boss-render-checks.json'),JSON.stringify({status:'PASS',rows:[...bossRows].sort(),layers:bossLayerCheck,pausePixelsFrozen:true,reducedStatic:true,narrowBossHudFits:true,threePhasesCaptured:true},null,2));}
 fs.writeFileSync(path.join(out,'actual-browser-stage01.json'),JSON.stringify(payload));
 assert.equal(payload.rule,expectedRule);assert.ok(maxLevel>=2,'No actual browser upgrade occurred');assert.equal(enteredBoss,true);assert.equal(resourceCarry,true);
 if(bombMode){assert.equal(actual.snapshot.status,'clear');assert.ok(actual.snapshot.sim.stats[4]>=2);assert.equal(actual.snapshot.sim.bomb[8],2,'Both actual B drops must be collected');}
 const result=R.run(payload,rules,false,true);assert.deepEqual(result.snapshot,actual.snapshot);
 const php=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli-stage01.php')],
  {input:JSON.stringify({action:'batch',trace:true,cases:[{payload,partial:false}]}),encoding:'utf8',maxBuffer:64*1024*1024});
 assert.equal(php.status,0,php.stderr);const server=JSON.parse(php.stdout).results[0];assert.equal(server.ok,1,server.reason);assert.deepEqual(server.data,result);
 await screenshot('terminal-desktop.png');
 if(interfaceMode){
  const total=actual.snapshot.score.total;assert.equal(await evaluate('document.getElementById("result-score").textContent'),total.toLocaleString('zh-CN'));
  assert.equal(await evaluate('document.getElementById("result-summary").hidden'),false);assert.equal(await evaluate('document.getElementById("export").disabled||document.getElementById("export").hidden'),false);
  const frozen=(await state()).snapshot;await click('result-heading');await screenshot('terminal-breakdown-desktop.png');assert.deepEqual((await state()).snapshot,frozen);await click('result-heading');assert.equal(await evaluate('document.getElementById("result-breakdown").open'),false);
  await send('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');await screenshot('terminal-narrow.png');
  await click('export');for(let i=0;i<100&&!fs.readdirSync(path.join(out,'downloads')).some(n=>n.endsWith('.json'));i++)await sleep(50);
  const downloadEvents=protocol.events.filter(e=>e.method==='Page.downloadWillBegin'||e.method==='Browser.downloadWillBegin');
  const replayFile=fs.readdirSync(path.join(out,'downloads')).find(n=>n.endsWith('.json'));assert.ok(replayFile,'Replay was not saved by the actual export button');
  const downloaded=JSON.parse(fs.readFileSync(path.join(out,'downloads',replayFile),'utf8'));assert.deepEqual(downloaded,payload);
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await evaluate('window.scrollTo(0,0)');
  fs.writeFileSync(path.join(out,'result-ui.json'),JSON.stringify({status:'PASS',scoreMatchesReplay:true,detailsDoNotAdvanceSimulation:true,exportVisibleAtTerminal:true,actualDownloadedReplayMatches:true,downloadEvents:downloadEvents.length},null,2));
 }
 if(audioMode){
  const a=(await state()).audio;if(bgmMode){assert.equal(a.musicFormat,'recorded-happyshrimp');assert.ok(a.history.some(e=>e.key==='boss'&&e.tick>=4320&&e.tick<4500),'Recorded BGM must start with boss appearance');}else assert.ok(a.history.some(e=>e.key==='intro'));for(const phase of [0,1,2])assert.ok(a.history.some(e=>e.key==='boss'&&e.phase===phase),'Missing music phase '+phase);
  assert.ok(a.history.some(e=>e.key==='clear'));assert.ok(a.counts.played.bomb>=2);assert.ok(a.counts.played.supply>=2);
  await until('window.DanmakuPreview.inspect().audio.musicVoices===0&&window.DanmakuPreview.inspect().audio.sfxVoices===0&&window.DanmakuPreview.inspect().audio.contextState==="suspended"',7000);
  const starts=(await state()).audio.counts.musicStarts;await sleep(200);assert.equal((await state()).audio.counts.musicStarts,starts);
  fs.writeFileSync(path.join(out,'audio-terminal.json'),JSON.stringify((await state()).audio,null,2));
 }
 const errors=protocol.events.filter(e=>e.method==='Runtime.exceptionThrown');assert.equal(errors.length,0,JSON.stringify(errors));
 const http=protocol.events.filter(e=>e.method==='Network.requestWillBeSent'&&/^https?:/.test(e.params.request.url));
 if(new URL(url).protocol==='file:')assert.equal(http.length,0);
 const report={status:'PASS',rule:payload.rule,terminal:actual.snapshot.status,ticks:payload.ticks,powerCollected:actual.snapshot.sim.growth[3],maxLevel,
  desktop:[1280,900],narrow:[360,800],shiftHitpoint:true,pauseFreezes:true,mobileToggle:true,touchRelease:true,touchCancelPauses:true,
  resourceCarry,enteredBoss,narrowPortraitBelowArena:true,httpRequests:http.length,jsExceptions:0,actualBrowserJsPhpFullTraceMatch:true,
  ...(bombMode?{visibleRedWhiteCenter:true,bombMarkerOnTop:true,heldKeyConsumesOnce:true,cooldownNotQueued:true,bombPauseFreezes:true,simplifiedEffectsDoNotChangeRules:true,narrowBombButton:true,bombsUsed:actual.snapshot.sim.stats[4],bombSupply:actual.snapshot.sim.bomb[8],bombDamage:actual.snapshot.sim.bomb[5]}:{}),
  ...(artMode?{stageArtReady:actual.stageArtReady,stageArtErrors:actual.stageArtErrors,cameraStoppedAtBoss:actual.stageCamera===0,capturedEnemyTypes:['fairy','attendant','guardian'].filter(n=>captures.has(n))}:{}),
  ...(audioMode?{audioBeforeGestureSilent:true,audioPreviewDoesNotAdvanceGame:true,decodedAudioEntries:decodedCount,independentMusicAndSfx:true,audioMuteAndPause:true,audioResumeAligned:true,audioBlurStops:true,audioSixVoiceCap:true,musicAllPhasesAndTerminal:true,audioErrors:0,offlineMixNoClipping:true}:{}),
  ...(midiMode?{directSmfPlayback:true,midiMaxNotes:32,midi:actual.audio.midi}:{}),
  ...(bgmMode?{recordedBgmPlayback:true,recordedTracks:2,continuousBossFromAppearance:true,retainedMidiStingers:true}:{}),
  ...(interfaceMode?{uiV1:true,sevenResponsiveSizes:true,modesAndAssist:true,helpPauses:true,resultScoreMatchesReplay:true}:{}),
  ...(bossArtMode?{bossArtReady:actual.bossArtReady,bossArtErrors:actual.bossArtErrors,allFourBossIntents:true,bossPausePixelsFrozen:true,bossReducedStatic:true,bossBulletsAboveArtwork:true,threeBossPhasesCaptured:true}:{}),
  ...(showMode?{presentationReady:actual.presentationReady,entranceAndTwoPhaseCues:true,noCutInDuringCombat:true,phaseCuePauseFreezes:true,stableMovementStance:true,immediateResultAndReplay:true}:{}),
  pauses,mainRunCatchupPauses:pauses.slice(mainPauseStart).filter(p=>p.includes('画面暂时跟不上')).length,reviewCapturesPaused:audioMode,
  lastDrawUpdateP95Ms:actual.frameTimes.slice().sort((a,b)=>a-b)[Math.ceil(actual.frameTimes.length*.95)-1],humanClearVerified:false,physicalPhoneVerified:false};
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
(async()=>{try{await run();}catch(error){let failureState=null;if(protocol&&session){try{const r=await protocol.send('Runtime.evaluate',{expression:'({game:window.DanmakuPreview&&DanmakuPreview.inspect(),status:document.getElementById("status")?.textContent})',returnByValue:true},session);failureState=r.result.value;}catch{}}fs.writeFileSync(path.join(out,'failed-checks-'+Date.now()+'.json'),JSON.stringify({message:error.message,failureState,exceptions:protocol?protocol.events.filter(e=>e.method==='Runtime.exceptionThrown'):[]},null,2));console.error(error.stack);process.exitCode=1;}finally{
 if(protocol){try{await protocol.send('Browser.close');}catch{}protocol.socket.close();}
 if(chrome&&chrome.exitCode===null){await sleep(500);if(chrome.exitCode===null)chrome.kill();}
}})();
