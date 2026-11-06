/** 作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。
 * Offline DOM model + file/geometry checks; explicitly not a browser or forum test.
 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root = new URL('../../', import.meta.url);
const art = new URL('docs/aquarium/art/firefly-v1/', root);
const page = readFileSync(new URL('index.html', art), 'utf8');
const blocks = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
const embedded = id => JSON.parse(blocks.find(x => x[1].includes(`id="${id}"`))[2]);
const readJSON = name => JSON.parse(readFileSync(new URL(name, art), 'utf8'));
assert.deepEqual(embedded('art-data'), readJSON('manifest.json'));
assert.deepEqual(embedded('export-data'), readJSON('runtime-candidate/manifest.json'));
assert.deepEqual(embedded('commerce-data'), readJSON('commerce-proposal.json'));
for (const match of page.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  assert.ok(!/^https?:/.test(match[1]), 'preview must stay offline');
  assert.ok(existsSync(new URL(match[1], art)), match[1]);
}
const script = blocks.filter(x => !/application\/json|\bsrc=/.test(x[1])).map(x => x[2]).join('\n');
new vm.Script(script);
assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(script));

class El {
  constructor(tag) {
    this.tag=tag;this.children=[];this.handlers={};this.dataset={};this.className='';this.checked=false;
    this.style={setProperty(k,v){this[k]=v;}};
    this.classList={contains:k=>this.className.split(' ').includes(k),
      add:k=>this.classList.toggle(k,true),remove:k=>this.classList.toggle(k,false),
      toggle:(k,on)=>{const s=new Set(this.className.split(' ').filter(Boolean));
        const next=on??!s.has(k);if(next)s.add(k);else s.delete(k);this.className=[...s].join(' ');return next;}};
  }
  appendChild(x){this.children.push(x);x.parent=this;return x;}
  remove(){this.parent.children.splice(this.parent.children.indexOf(this),1);}
  setAttribute(k,v){this[k]=v;}
  addEventListener(k,f){this.handlers[k]=f;}
  getBoundingClientRect(){return {width:viewport,height:viewport*10/16};}
  querySelectorAll(sel){
    const nodes=this.children.flatMap(x=>[x,...x.querySelectorAll('*')]);
    if(sel==='.sprite img')return nodes.filter(x=>x.tag==='img'&&x.parent.classList.contains('sprite'));
    return nodes.filter(x=>sel==='*'||(sel==='input:checked'?x.tag==='input'&&x.checked:
      sel.startsWith('.')?x.classList.contains(sel.slice(1)):
      sel.startsWith('[data-id=')?x.dataset.id===sel.match(/"([^"]+)"/)[1]:x.tag===sel));
  }
  querySelector(sel){return this.querySelectorAll(sel)[0]??null;}
}
let viewport=880;
const elements=new Map();
for(const match of page.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
  const e=new El(match[1]);e.className=match[2].match(/class="([^"]+)"/)?.[1]??'';elements.set(match[3],e);
}
for(const [id,value] of Object.entries({placement:'recommended','fish-count':'3',background:'green',thumb:'128'}))elements.get(id).value=value;
const doc={getElementById:id=>elements.get(id),createElement:tag=>new El(tag),
  createTextNode:text=>Object.assign(new El('#text'),{textContent:text})};
for(const block of blocks.filter(x=>/application\/json/.test(x[1])))elements.get(block[1].match(/id="([^"]+)"/)[1]).textContent=block[2];
const layout=createRequire(import.meta.url)(fileURLToPath(new URL('source/plugin/gamecenter/games/aquarium/decor-layout.js',root)));
const ctx=vm.createContext({document:doc,AquariumDecorLayout:layout,addEventListener(){},requestAnimationFrame:f=>f()});
vm.runInContext(script,ctx);
const event=(id,type,value)=>{const e=elements.get(id);if(value!==undefined)e.value=value;e.handlers[type].call(e,{target:e});};
const buildings=readJSON('runtime-candidate/manifest.json').items.filter(x=>x.kind==='building');
const scene=elements.get('scene');
assert.equal(scene.querySelectorAll('.building').length,4);
assert.equal(scene.querySelectorAll('.fish').length,3);
for(const b of scene.querySelectorAll('.building'))assert.equal(b.children[0].src,`runtime-candidate/decor/${b.dataset.id}.webp`);
const cardImages=elements.get('cards').querySelectorAll('.sprite img');
assert.equal(cardImages.length,4);
for(const value of ['64','large','128']){
  event('thumb','change',value);
  for(const img of cardImages)assert.equal(img.src,`runtime-candidate/${value==='large'?'decor':'thumbs/decor'}/${img.dataset.id}.webp`);
}
for(const value of ['warm','day','moon','green']){
  const select=elements.get('background');select.options=[{text:value}];select.selectedIndex=0;
  event('background','change',value);
  const bg=elements.get('backdrop');assert.equal(Boolean(bg.srcset),value==='green');
  assert.ok(existsSync(new URL(bg.src,art)));
}
for(const value of ['0','12','3']){event('fish-count','change',value);assert.equal(scene.querySelectorAll('.fish').length,+value);}
for(const [id,cls] of [['skin','no-frame'],['buildings','no-buildings'],['guides','guides']]){
  const target=id==='skin'?elements.get('frame-wrap'):scene;const before=target.classList.contains(cls);
  event(id,'click');assert.notEqual(target.classList.contains(cls),before);event(id,'click');assert.equal(target.classList.contains(cls),before);
}
const inputs=elements.get('owned-items').querySelectorAll('input');assert.equal(inputs.length,5);
const study=readJSON('pricing-study.json');
for(const row of study.ownership_scenarios){
  for(const input of inputs)input.checked=row.owned.includes(input.value);
  event('owned-items','change');
  const text=elements.get('quote').textContent;
  assert.ok(text.includes(row.bundle_pay.toLocaleString('en-US')+' 金币'),text);
}
for(viewport of [360,880,1144])for(const mode of ['recommended','current']){
  event('placement','change',mode);
  for(const item of buildings){
    const box=scene.querySelector(`[data-id="${item.id}"]`),g=item.preview_geometry;
    const left=parseFloat(box.style.left),top=parseFloat(box.style.top),width=parseFloat(box.style.width),height=parseFloat(box.style.height);
    const [l,t,r,b]=g.source_visible_bbox,[sw,sh]=g.source_size;
    assert.ok(left+l/sw*width>=-1&&left+r/sw*width<=viewport+1,item.id+' horizontal fit');
    assert.ok(top+t/sh*height>=-1&&top+b/sh*height<=viewport*10/16+1,item.id+' vertical fit');
    assert.ok(Math.abs(top+g.anchor[1]*height-g.ground_y_ratio*viewport*10/16)<.001,item.id+' ground');
  }
}
console.log('PASS: JSON/link/JS checks; actual WebP paths; 32 offline quotes; controls; 360/880/1144 geometry. DOM model only, not browser.');
