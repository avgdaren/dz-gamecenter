/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。局部表情资源生命周期与固定时间窗。 */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../source/plugin/gamecenter/games/raid/feedback.js',import.meta.url),'utf8');
let checks=0;const check=(yes,label)=>{assert.ok(yes,label);checks++;};
function setup(){
 const images=[],timers=new Map();let time=0,next=0,reduced=false;
 const node=()=>{const classes=new Set(),handlers={};return {classes,decoding:'',classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},addEventListener:(n,f)=>handlers[n]=f,fire:n=>handlers[n]?.()};};
 const art=node(),layer=node(),ctx={document:{createElement(){const image=node();images.push(image);return image;}},URL};
 vm.runInNewContext(source,ctx);
 const face=new ctx.RaidFaceLayer({art,layer,assetBase:'https://test.local/raid/',reduced:()=>reduced,now:()=>time,setTimer:(fn,delay)=>{const id=++next;timers.set(id,{fn,at:time+delay});return id;},clearTimer:id=>timers.delete(id)});
 return {face,art,layer,images,timers,reduce(v){reduced=v;},at(v){time=v;for(const [id,timer]of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}}};
}
{
 const e=setup();e.face.update(1,'room');check(e.images.length===3&&e.images.every(i=>i.decoding==='async'),'phase one preloads three layers');
 check(!e.face.show(10)&&!e.art.classes.has('show-face'),'uncached image falls back without exception');e.at(200);
 e.images.forEach(i=>i.fire('load'));check(e.face.show(10)&&e.layer.src.endsWith('p1-hit1.webp'),'ready light hit appears synchronously');
 check([...e.timers.values()][0].at===400,'one 200ms window');e.at(300);e.face.show(30);check(e.layer.src.endsWith('hit3.webp'),'stronger hit upgrades');
 e.at(350);e.face.show(10);check(e.layer.src.endsWith('hit3.webp'),'weaker hit cannot downgrade active strongest layer');
 check([...e.timers.values()][0].at===400&&e.timers.size===1,'combo does not extend or accumulate reset timers');e.at(400);
 check(!e.art.classes.has('show-face')&&e.face.level===0,'window resets at 200ms');
 e.face.update(2,'room');check(e.images.length===6,'phase two preloads its own set');e.images.slice(3).forEach(i=>i.fire('load'));e.face.show(20);
 check(e.layer.src.endsWith('p2-hit2.webp'),'phase two uses correct set');e.layer.fire('error');check(!e.art.classes.has('show-face'),'decode error is silent fallback');
 e.face.show(30);e.face.update(1,'new-room');check(!e.art.classes.has('show-face')&&e.face.level===0,'new room clears old face');
}
{
 const e=setup();e.reduce(true);e.face.update(2,'room');check(e.images.length===0&&!e.face.show(30),'reduced motion fetches and flashes no face');
 e.reduce(false);e.face.update(2,'room');e.images.forEach(i=>i.fire('load'));e.face.show(30);e.reduce(true);e.face.show(10);check(!e.art.classes.has('show-face')&&e.timers.size===0,'reduced mode cancels an active face');
}
// Exercise constructor defaults, including receiver-sensitive browser host semantics.
// Node timers alone accept an arbitrary receiver and would miss the Chrome regression.
function defaultTimers(strictReceiver=false,script=source) {
 const classes=new Set(),images=[];
 const node=()=>({classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},addEventListener(){}});
 const art=node(),layer=node();
 const ctx=vm.createContext({URL,document:{createElement(){const image=node();images.push(image);return image;}},setTimeout,clearTimeout});
 if(strictReceiver)vm.runInContext(`
  const hostSet=setTimeout,hostClear=clearTimeout;
  globalThis.timerCalls={set:0,clear:0};
  globalThis.setTimeout=function(fn,ms){'use strict';if(this!==globalThis)throw new TypeError('Illegal invocation: setTimeout');timerCalls.set++;return hostSet(fn,ms);};
  globalThis.clearTimeout=function(id){'use strict';if(this!==globalThis)throw new TypeError('Illegal invocation: clearTimeout');timerCalls.clear++;return hostClear(id);};
 `,ctx);
 vm.runInContext(script,ctx);
 const face=new ctx.RaidFaceLayer({art,layer,assetBase:'https://test.local/raid/',reduced:()=>false});
 face.update(1,'default-timers');for(const entry of face.cache.values())entry.ready=true;
 return {face,classes,layer,ctx};
}
{
 const e=defaultTimers();
 try {
  check(e.face.show(10)&&e.classes.has('show-face'),'default native timers show without throwing');
  e.face.reset();check(e.face.timer===null&&!e.classes.has('show-face'),'default native clear cancels an active timer');
  e.face.show(30);await new Promise(resolve=>setTimeout(resolve,240));
  check(e.face.timer===null&&!e.classes.has('show-face'),'default native timeout automatically resets');
 } finally {e.face.reset();}
}
{
 const e=defaultTimers(true);
 try {
  check(e.face.show(10),'default path sets receiver-sensitive host timer');
  e.face.reset();check(e.ctx.timerCalls.clear===1,'default path clears receiver-sensitive host timer');
  check(e.face.show(30)&&e.layer.src.endsWith('hit3.webp'),'second hit works after explicit reset');
  await new Promise(resolve=>setTimeout(resolve,240));
  check(!e.classes.has('show-face')&&e.face.timer===null&&e.ctx.timerCalls.set===2&&e.ctx.timerCalls.clear===2,'automatic reset also uses global receiver');
 } finally {e.face.reset();}
 // Mutation guards prove these tests reject either of the two old defaults.
 for(const [fixed,broken,operation] of [
  ['setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms)','setTimer=setTimeout','set'],
  ['clearTimer=id=>globalThis.clearTimeout(id)','clearTimer=clearTimeout','clear']
 ]) {
  const bad=defaultTimers(true,source.replace(fixed,broken));
  try {
   if(operation==='clear')bad.face.show(10);
   assert.throws(()=>operation==='set'?bad.face.show(10):bad.face.reset(),/Illegal invocation/);checks++;
  } finally {if(bad.face.timer!==null)clearTimeout(bad.face.timer);}
 }
}
console.log(JSON.stringify({status:'PASS',checks,scope:'DOM substitute, real Node timers and receiver-sensitive host simulation; no browser latency claim'}));
