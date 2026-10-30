/* Author GPT / Codex; original plugin (C) 2026 Carinoasd.
 * Static candidate validation, not a live-server or visual composition test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('source/plugin/gamecenter/games/aquarium/assets/layout/decor-presets-v1.json');
const art=read('source/plugin/gamecenter/games/aquarium/assets/layout/decor-layout-v1.json');
const server=read('tests/aquarium/fixtures/decor-layer-constraints-v1.json');
const specs=new Map(art.items.map(x=>[x.id,x]));let checks=0;
function ok(value,message){assert.ok(value,message);checks++;}
function validate(c){
 ok(c.items.length===12 && c.items.filter(x=>x.group==='new').length===9 && c.items.filter(x=>x.group==='legacy-corrected').length===3,'9 new + 3 corrected');
 ok(c.preserve_fish===true && JSON.stringify(c.apply_scope)===JSON.stringify(['layout.decor','layout.background']),'application never changes fish');
 const ids=new Set(),names=new Set(),newUsed=new Set();
 for(const p of c.items){
  ok(typeof p.id==='string' && /^[a-z][a-z0-9_]+$/.test(p.id) && !ids.has(p.id),'unique stable id');ids.add(p.id);
  ok(typeof p.name==='string' && [...p.name].length>=4 && [...p.name].length<=6 && !names.has(p.name),'unique 4-6 character name');names.add(p.name);
  ok(['tank_day','tank_moon'].includes(p.background),'supported free background');
  ok(p.cost===0 && p.auto_purchase_missing===false,'presets do not charge or auto buy');
  ok(typeof p.concept==='string' && p.concept.length>10 && p.composition_note.length>10,'concept and composition');
  const seen=new Set();
  for(const layer of ['back','front']){
   ok(Array.isArray(p[layer]) && p[layer].length<=3,'per-layer limit');
   for(const id of p[layer]){
    const s=specs.get(id);ok(s && server.layers[id],'known independent art and server id');
    ok(server.layers[id].includes(layer) && s.allowed_layers.includes(layer),'server/art layer match');
    ok(!seen.has(id),'no same or cross-layer duplicates');seen.add(id);
    if(p.group==='new')newUsed.add(id);
    const h=p.placement_hints[id];ok(h && h.soft===true && Number.isFinite(h.anchor_x) && h.anchor_x>=0 && h.anchor_x<=1,'soft anchor');
    for(const [width,height] of [[960,600],[390,243.75],[960,720]]){
     const [sw,sh]=s.source_size,[l,t,r,b]=s.source_visible_bbox;
     const scale=s.visible_width_ratio*width/(r-l);
     const x=h.anchor_x*width-s.anchor[0]*sw*scale;
     const y=s.ground_y_ratio*height-s.anchor[1]*sh*scale;
     ok(x+l*scale>=-1e-8 && x+r*scale<=width+1e-8 && y+t*scale>=-1e-8 && y+b*scale<=height+1e-8,'visible shape stays in viewport');
    }
   }
  }
  ok(seen.size>0 && seen.has(p.main),'one existing hero');
  ok(JSON.stringify([...seen].filter(id=>id!==p.main).sort())===JSON.stringify([...p.supporting].sort()),'support covers remainder');
  ok(Object.keys(p.placement_hints).length===seen.size,'no extra placement keys');
 }
 ok(newUsed.size===24 && [...specs.keys()].every(id=>newUsed.has(id)),'9 new presets cover all 24 existing assets');
}
validate(catalog);
const validChecks=checks;
function rejects(mutator,label){const c=structuredClone(catalog);mutator(c);let rejected=false;try{validate(c);}catch(e){if(!(e instanceof assert.AssertionError))throw e;rejected=true;}assert.ok(rejected,label);}
rejects(c=>{c.items[3].front.push('plant_ribbon');c.items[3].placement_hints.plant_ribbon={anchor_x:.1,soft:true};},'back-only leaf rejected in front');
rejects(c=>{c.items[4].back.push('scape_pebbles');},'front-only pebbles rejected in back');
rejects(c=>{c.items[3].front[0]='scape_wood';},'cross-layer duplicate rejected');
rejects(c=>{c.items[3].front.push('trinket_shell');},'four front items rejected');
rejects(c=>{c.items[3].id=c.items[0].id;},'duplicate id rejected');
rejects(c=>{c.items[3].name=c.items[0].name;},'duplicate name rejected');
rejects(c=>{c.items[3].main='not_a_decor';},'missing hero rejected');
rejects(c=>{c.items[3].background='tank_sakura';},'paid/future background not silently enabled');
rejects(c=>{c.items[3].placement_hints.scape_wood.anchor_x=1;},'out of bounds candidate rejected');
rejects(c=>{c.preserve_fish=false;},'fish destructive policy rejected');
rejects(c=>{c.items[3].cost=600;},'preset price rejected');
console.log(JSON.stringify({status:'PASS',valid_checks:validChecks,negative_cases:11,new_presets:9,legacy_corrected:3,scope:'static catalog/independent server fixture/three viewport geometry; not live or visual acceptance'}));
