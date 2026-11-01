/* Author: GPT / Codex. Original plugin (C) 2026 Carinoasd.
 * Asset/renderer contract check using a DOM/canvas simulation; not live acceptance. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const repo=path.resolve(__dirname,'../../..'),entries=JSON.parse(fs.readFileSync(path.join(__dirname,'new-entries.json')));
 const sheets=Object.fromEntries(entries.map(e=>[e.file,{naturalWidth:e.grid[0]*e.frame_size[0],naturalHeight:e.grid[1]*e.frame_size[1]}]));
 const draws=[],clears=[],loads={};let reduced=false;const handlers={};
 const document={hidden:false,addEventListener:(n,f)=>handlers[n]=f,createElement(type){return {style:{},setAttribute(){},getContext(){return {clearRect(...a){clears.push(a)},drawImage(...a){draws.push(a.slice(1))}}}}}};
 class Image{set src(v){loads[v]=(loads[v]||0)+1;Object.assign(this,sheets[v]);queueMicrotask(()=>this.onload())}}
 const media={get matches(){return reduced},addEventListener:(n,f)=>handlers.media=f};
 const window={matchMedia:()=>media,requestAnimationFrame:()=>1,cancelAnimationFrame(){}};
 const context={window,document,Image,Set,Map,Promise,Math,Number,Array,TypeError,RangeError,Error};
 vm.runInNewContext(fs.readFileSync(path.join(repo,'source/plugin/gamecenter/games/aquarium/fish-sprites.js'),'utf8'),context);
 const api=window.AquariumFishSprites,players=[];
 function host(){return {children:[],get firstChild(){return this.children[0]},appendChild(n){this.children.push(n);n.parentNode=this},removeChild(n){this.children.splice(this.children.indexOf(n),1);n.parentNode=null}}}
 for(const e of entries){
  const h=host(),p=api.mount(h,{sheetUrl:e.file,size:e.frame_size[0],columns:e.grid[0],frames:e.frame_count,cycleMs:e.cycle_ms,phaseMs:0});await p.ready;assert(p.loaded,e.id);assert.equal(h.children.length,1);
  for(let i=0;i<e.frame_count;i++){p.drawFrame(i);assert.deepEqual(draws.at(-1),[i*256,0,256,256,0,0,256,256],e.id+' frame '+i)}
  p.drawFrame(e.frame_count);assert.deepEqual(draws.at(-1),[0,0,256,256,0,0,256,256]);players.push(p);
  for(let j=0;j<2;j++){const q=api.mount(host(),{sheetUrl:e.file,size:256,columns:e.grid[0],frames:e.frame_count,cycleMs:e.cycle_ms});await q.ready;assert(q.loaded);players.push(q)}
 }
 assert.equal(players.length,12);assert.equal(Object.keys(loads).length,4);assert(Object.values(loads).every(n=>n===1));assert.equal(draws.length,clears.length);
 reduced=true;handlers.media();assert(players.every(p=>p.frame===0));players.forEach(p=>p.dispose());assert(players.every(p=>p.disposed));api.clearCache();
 console.log('PASS: 4 sheet geometries, all 20 frame rectangles and wrap, clear-before-draw, 12 simulated mounts sharing 4 loads, reduced-motion and disposal. Simulation only.');
})().catch(e=>{console.error(e);process.exitCode=1});
