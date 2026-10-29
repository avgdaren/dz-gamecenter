/* Author: GPT / Codex. Original plugin (C) 2026 Carinoasd.
 * Node + preinstalled test-only @napi-rs/canvas; no npm/package.json changes.
 * This is a Canvas/DOM harness, not a browser or live-forum acceptance run.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Canvas=require(require.resolve('@napi-rs/canvas',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));
const root=path.resolve(__dirname,'../..');
const game=path.join(root,'source/plugin/gamecenter/games/aquarium');
const motion=path.join(game,'assets/fish-motion/v1');
const manifest=JSON.parse(fs.readFileSync(path.join(motion,'manifest.json'),'utf8'));
const warp=require(path.join(game,'fish-warp.js'));
let checks=0;
function check(test,message){assert.ok(test,message);checks++;}
class Host{
 constructor(){this.children=[];this.style={};}
 get firstChild(){return this.children[0]||null;}
 appendChild(n){this.children.push(n);n.parentNode=this;return n;}
 removeChild(n){const i=this.children.indexOf(n);assert.ok(i>=0);this.children.splice(i,1);n.parentNode=null;return n;}
}
const events={},media={matches:false,addEventListener(_,fn){this.change=fn;}};
const pending=new Map();let nextRaf=0;
const doc={hidden:false,addEventListener(name,fn){events[name]=fn;},createElement(tag){
 if(tag==='canvas'){
  const c=Canvas.createCanvas(256,256);c.style={};c.setAttribute=()=>{};c.tagName='CANVAS';return c;
 }
 if(tag==='img')return {tagName:'IMG',style:{},setAttribute(){}};
 throw Error('Unexpected tag '+tag);
}};
const nativeSetter=Object.getOwnPropertyDescriptor(Canvas.Image.prototype,'src').set;
function Image(){
 const image=new Canvas.Image();
 Object.defineProperty(image,'naturalWidth',{get(){return image.width;}});
 Object.defineProperty(image,'naturalHeight',{get(){return image.height;}});
 Object.defineProperty(image,'src',{set(url){setTimeout(()=>{
  if(url==='missing'){if(image.onerror)image.onerror(new Error('missing'));return;}
  try{nativeSetter.call(image,fs.readFileSync(url));}catch(e){if(image.onerror)image.onerror(e);}
 },0);}});
 return image;
}
const sandbox={document:doc,Image,Map,Set,Promise,Number,Math,Array,Error,TypeError,RangeError,
 requestAnimationFrame(fn){const n=++nextRaf;pending.set(n,fn);return n;},
 cancelAnimationFrame(n){pending.delete(n);},matchMedia(){return media;}};
sandbox.window=sandbox;
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(game,'fish-sprites.js'),'utf8'),sandbox);
const sprites=sandbox.AquariumFishSprites;
function advance(time){const list=Array.from(pending.values());pending.clear();for(const f of list)f(time);}
function options(item){return {sheetUrl:path.join(motion,item.file),size:256,columns:4,frames:12,cycleMs:item.cycle_ms,phaseMs:0};}
async function main(){
 const all=[];
 for(const item of manifest.items){
  const img=await Canvas.loadImage(path.join(motion,item.file));
  const atlas=Canvas.createCanvas(img.width,img.height),at=atlas.getContext('2d');at.drawImage(img,0,0);
  check(img.width===1024&&img.height===768,'atlas geometry '+item.id);
  const neutral=at.getImageData(0,0,256,256).data;
  for(let frame=0;frame<12;frame++){
   const actual=at.getImageData(frame%4*256,Math.floor(frame/4)*256,256,256).data;
   check(actual.some((x,i)=>x!==neutral[i])||frame===0||frame===6,'non-neutral movement '+item.id+'/'+frame);
   let headStable=true;
   for(let y=0;y<256&&headStable;y++)for(let x=Math.ceil(item.warp.headLock*256);x<256&&headStable;x++){
    const i=(y*256+x)*4;
    for(let k=0;k<4;k++)if(actual[i+k]!==neutral[i+k]){headStable=false;break;}
   }
   check(headStable,'pixel-identical locked head '+item.id+'/'+frame);
   let monotonic=true;
   for(let x=0;x<256&&monotonic;x++){
    const c=warp.column(x,256,256,2*Math.PI*frame/12,warp.config(item.warp));
    let previous=warp.sourceY(0,c);
    for(let y=1;y<256;y++){const current=warp.sourceY(y,c);if(current-previous<=.7){monotonic=false;break;}previous=current;}
   }
   check(monotonic,'no fold/duplicate sampling '+item.id+'/'+frame);
  }
  const host=new Host();host.appendChild({tagName:'IMG',name:'old-body'});host.appendChild({tagName:'IMG',name:'old-tail'});
  const player=sprites.mount(host,options(item));await player.ready;
  check(player.loaded&&host.children.length===1&&host.firstChild.tagName==='CANVAS','one artwork child '+item.id);
  player.setPaused(true);
  for(let frame=0;frame<12;frame++){
   player.drawFrame(frame);
   const actual=host.firstChild.getContext('2d').getImageData(0,0,256,256).data;
   const expected=at.getImageData(frame%4*256,Math.floor(frame/4)*256,256,256).data;
   check(Buffer.from(actual).equals(Buffer.from(expected)),'clear + one exact full frame '+item.id+'/'+frame);
  }
  all.push({host,player});
 }
 for(const x of all)x.player.setPaused(false);
 check(pending.size===1,'one shared animation scheduler for 12 fish');advance(170);
 check(all.some(x=>x.player.frame!==0),'animation advances');
 doc.hidden=true;events.visibilitychange();check(pending.size===0,'hidden pauses');
 doc.hidden=false;events.visibilitychange();check(pending.size===1,'visible resumes');
 media.matches=true;media.change();check(pending.size===0&&all.every(x=>x.player.frame===0),'reduced motion neutral frame');
 media.matches=false;media.change();check(pending.size===1,'motion resumes');
 const first=all[0];const old=first.player;
 const replacement=sprites.mount(first.host,options(manifest.items[0]));await replacement.ready;
 check(old.disposed&&first.host.children.length===1,'remount disposes old player');first.player=replacement;
 const brokenHost=new Host();let errors=0;
 const broken=sprites.mount(brokenHost,{sheetUrl:'missing',fallbackUrl:'original.webp',onError(){errors++;}});await broken.ready;
 check(!broken.loaded&&errors===1&&brokenHost.children.length===1&&brokenHost.firstChild.tagName==='IMG','single static fallback');broken.dispose();
 const slowHost=new Host(),slow=sprites.mount(slowHost,options(manifest.items[1]));slow.dispose();await slow.ready;
 check(slowHost.children.length===0&&!slow.loaded,'disposed load cannot resurrect');
 for(const x of all)x.player.dispose();check(pending.size===0,'last dispose stops animation');sprites.clearCache();
 console.log(JSON.stringify({status:'PASS',checks,fish:manifest.items.length,frames:144,
  harness:'Node VM + native Canvas 2D; not a browser/live-site test',
  coverage:['RGBA head lock','injective warp','12 frame draws per species','one artwork child',
    'shared scheduler','hidden/reduced motion','remount','fallback','dispose']}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
