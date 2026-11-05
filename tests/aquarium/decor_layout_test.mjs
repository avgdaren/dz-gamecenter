/** 作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。实际素材可见边界布局回归。 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const geometry=require('../../source/plugin/gamecenter/games/aquarium/decor-layout.js');
const base=new URL('../../source/plugin/gamecenter/games/aquarium/assets/layout/',import.meta.url);
const specs=JSON.parse(readFileSync(new URL('decor-layout-v1.json',base),'utf8')).items;
const presets=JSON.parse(readFileSync(new URL('decor-presets-v1.json',base),'utf8')).items;
let checks=0,combinations=0;
function check(value,message){checks++;assert.ok(value,message);}
function exercise(items,width){
 const height=width*10/16, before=JSON.stringify(items);
 const layout=geometry.arrange(items,width,height);
 check(JSON.stringify(items)===before,'source metadata stays frozen');
 check(layout.length===items.length,'all items placed');
 layout.forEach((entry,i)=>{
  const b=entry.rect.visible;
  check(b.left>=-1e-7&&b.left+b.width<=width+1e-7,'visible artwork stays inside tank');
  check(b.top>=-1e-7&&b.top+b.height<=height+1e-7,'ground and top stay inside tank');
  check(entry.scale>0&&entry.scale<=1,'fit only scales down');
  if(i){
   const previous=layout[i-1].rect.visible;
   check(previous.left+previous.width+width*.0179<=b.left+1e-7,'saved order has positive visible gap');
   check(!geometry.overlaps(previous,b),'same-layer visible bboxes never overlap');
  }
 });
 check(JSON.stringify(geometry.arrange(items,width,height))===JSON.stringify(layout),'resize/reload deterministic');
 combinations++;
 return layout;
}
for(const width of [323,360,880]){
 for(const layer of ['back','front']){
  const items=specs.filter(s=>s.allowed_layers.includes(layer));
  for(let a=0;a<items.length;a++){
   exercise([items[a]],width);
   for(let b=a+1;b<items.length;b++){
    exercise([items[a],items[b]],width);
    for(let c=b+1;c<items.length;c++)exercise([items[a],items[b],items[c]],width);
   }
  }
 }
 for(const p of presets)for(const layer of ['back','front'])exercise(p[layer].map(id=>specs.find(s=>s.id===id)),width);
}
const crescent=specs.find(s=>s.id==='trinket_crescent'), crystal=specs.find(s=>s.id==='trinket_crystal');
const oldOrder=exercise([crescent,crystal],323), moved=exercise([crystal,crescent],323);
check(oldOrder[0].rect.visible.left<moved[1].rect.visible.left,'moving array order moves the selected decor right');
assert.throws(()=>geometry.arrange([crescent],0,100),RangeError);checks++;
console.log(JSON.stringify({status:'PASS',checks,combinations,scope:'actual 24 item bboxes, singles/pairs/triples per allowed layer; static geometry, not browser'}));
