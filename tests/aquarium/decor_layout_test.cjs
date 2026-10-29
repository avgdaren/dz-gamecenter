/* Author: GPT / Codex; original plugin (C) 2026 Carinoasd. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'source/plugin/gamecenter/games/aquarium/assets/layout/decor-layout-v1.json'),'utf8'));
const geometry=require(path.join(root,'source/plugin/gamecenter/games/aquarium/decor-layout.js'));
let checks=0;function check(v,m){assert.ok(v,m);checks++;}
check(data.items.length===24&&new Set(data.items.map(x=>x.id)).size===24,'all IDs');
for(const x of data.items){
 check(x.allowed_layers.includes(x.default_layer),'existing layer '+x.id);
 check(!x.must_pair&&!x.position_is_hard_constraint,'soft placement '+x.id);
 check(!x.atmosphere.desaturate,'preserve warm colors '+x.id);
 const range=data.depth_bands[x.depth_band].ground_y_range;
 check(x.ground_y_ratio>=range[0]&&x.ground_y_ratio<=range[1],'ground band '+x.id);
 for(const [w,h] of [[960,600],[960,720],[390,243.75]])for(const pos of x.preferred_x){
  const r=geometry.rect(x,w,h,pos);
  check(Math.abs(r.visible.width/w-x.visible_width_ratio)<1e-10,'visible width '+x.id);
  check(Math.abs(r.ground.y/h-x.ground_y_ratio)<1e-10,'ground '+x.id);
  check(r.visible.left>=0&&r.visible.top>=0&&r.visible.left+r.visible.width<=w+1e-6&&r.visible.top+r.visible.height<=h+1e-6,'in viewport '+x.id);
  check(Math.abs(r.sprite.width/r.sprite.height-x.source_size[0]/x.source_size[1])<1e-10,'aspect '+x.id);
 }
}
check(geometry.overlaps({left:0,top:0,width:10,height:10},{left:5,top:5,width:10,height:10}),'overlap');
check(!geometry.overlaps({left:0,top:0,width:10,height:10},{left:10,top:0,width:10,height:10}),'touching');
assert.throws(()=>geometry.rect(data.items[0],NaN,600));checks++;
console.log(JSON.stringify({status:'PASS',checks,decor:24,viewports:3,scope:'numeric geometry, not visual or live-site acceptance'}));
