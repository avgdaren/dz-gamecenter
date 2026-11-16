/* (C) 2026 Carinoasd. Actual UI handlers in a browserless DOM harness: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
async function main(){
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8'),elements=new Map(),frames=[];let now=1000,forceEnd=false;
 const gradient={addColorStop(){}},ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{}});
 function element(id){return{id,dataset:{},style:{},attributes:{},listeners:{},classList:{toggle(){},add(){},remove(){}},checked:false,hidden:false,disabled:false,complete:false,naturalWidth:0,textContent:'',value:0,
  setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){(this.listeners[k]??=[]).push(f);},focus(){document.activeElement=this;},getContext:()=>ctx,matches:()=>false,closest:()=>null,querySelector:()=>element('child'),querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:480,height:640}),scrollIntoView(){},click(){for(const f of this.listeners.click??[])f.call(this,{detail:1});}};}
 for(const m of html.matchAll(/\bid="([^"]+)"/g)){assert.ok(!elements.has(m[1]));elements.set(m[1],element(m[1]));}
 const buttons=['easy','normal','hard'].map(name=>{const e=element(name);e.dataset.difficulty=name;return e;});
 const document={body:element('body'),hidden:false,activeElement:null,hasFocus:()=>true,getElementById:id=>{assert.ok(elements.has(id),'Missing DOM ID '+id);return elements.get(id);},querySelectorAll:selector=>selector==='[data-difficulty]'?buttons:[],querySelector:()=>element('intro'),addEventListener(){},createElement:()=>element('new')};
 const sandbox={document,console,Set,Map,Promise,Math,btoa:s=>Buffer.from(s,"binary").toString("base64"),atob:s=>Buffer.from(s,"base64").toString("binary"),performance:{now:()=>now},localStorage:{getItem:key=>key==='danmaku.audio.v1'?'{'+'"muted":true}':null,setItem(){}},Image:class{constructor(){this.complete=false;this.naturalWidth=0;this.naturalHeight=0;}set src(v){if(v.includes('projectile-atlas-v1.png')){this.complete=true;this.naturalWidth=1536;this.naturalHeight=1024;}}},requestAnimationFrame:f=>frames.push(f),setTimeout:()=>0,clearTimeout(){},matchMedia:()=>({matches:false}),addEventListener(){},Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}}};
 sandbox.window=sandbox;const context=vm.createContext(sandbox);
 for(const m of html.matchAll(/<script defer src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(base,m[1]),'utf8'),context,{filename:m[1]});
 await Promise.resolve();await Promise.resolve();assert.equal(sandbox.DanmakuPreview.inspect().mode,'ready');
 const original=sandbox.DanmakuStage01.Stage.prototype.step;
 sandbox.DanmakuStage01.Stage.prototype.step=function(input){const value=original.call(this,input);if(forceEnd){this.status='dead';this.stage='over';}return value;};
 function advance(n=1){for(let i=0;i<n;i++){const fn=frames.shift();assert.ok(fn);now+=17;fn(now);}}
 buttons[2].click();assert.equal(sandbox.DanmakuPreview.inspect().rule,'danmaku-stage01-hard-r3');assert.equal(sandbox.DanmakuPreview.inspect().testMode.enabled,false);
 elements.get('test-invincible').click();assert.equal(elements.get('test-invincible').attributes['aria-pressed'],'true');
 elements.get('start').click();advance();assert.equal(sandbox.DanmakuPreview.inspect().mode,'running');assert.equal(sandbox.DanmakuPreview.inspect().testMode.used,true);assert.equal(elements.get('test-badge').hidden,false);
 elements.get('pause').click();const paused=sandbox.DanmakuPreview.inspect().records;advance(2);assert.equal(sandbox.DanmakuPreview.inspect().records,paused);
 elements.get('test-invincible').click();assert.equal(sandbox.DanmakuPreview.inspect().testMode.enabled,false);assert.equal(sandbox.DanmakuPreview.inspect().testMode.used,true);assert.match(elements.get('test-badge').textContent,/无敌已关/);
 elements.get('start').click();assert.equal(sandbox.DanmakuPreview.inspect().mode,'countdown');for(let i=0;i<95;i++)advance();assert.equal(sandbox.DanmakuPreview.inspect().mode,'running');
 forceEnd=true;advance(2);assert.equal(sandbox.DanmakuPreview.inspect().mode,'over');assert.equal(elements.get('export').disabled,true);assert.equal(elements.get('export').hidden,true);assert.throws(()=>sandbox.DanmakuPreview.exportReplay(),/测试局/);assert.match(elements.get('overlay-footnote').textContent,/测试局/);
 elements.get('restart').click();forceEnd=false;assert.equal(sandbox.DanmakuPreview.inspect().testMode.used,false);elements.get('start').click();advance();forceEnd=true;advance(2);assert.equal(elements.get('export').disabled,false);assert.equal(elements.get('export').hidden,false);assert.equal(sandbox.DanmakuPreview.exportReplay().rule,'danmaku-stage01-hard-r3');
 console.log('PASS actual title/run/pause/resume/test-off/result/reset UI handlers and replay guard (DOM harness; no browser/render/audio verification)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
