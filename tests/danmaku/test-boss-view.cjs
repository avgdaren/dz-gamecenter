/* (C) 2026 Carinoasd. Boss presentation contract checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict');
const view=require('../../source/plugin/gamecenter/games/_danmaku_proto/boss-view.js');
const sim={tick:100,warningUntil:0,boss:{x:240*64,y:88*64,px:240*64,py:88*64}};
assert.equal(view.frame(sim,10,false,'active').row,0);
assert.deepEqual([0,10,20,30,40].map(t=>view.frame(sim,t,false,'active').column),[0,0,0,0,0]);
sim.boss.px+=64;assert.equal(view.frame(sim,24,false,'active').row,1);
sim.boss.px-=128;assert.equal(view.frame(sim,24,false,'active').row,2);
sim.warningUntil=101;assert.equal(view.frame(sim,24,false,'active').row,3);
assert.equal(view.frame(sim,24,false,'opening').row,0);
assert.equal(view.frame(sim,24,false,'transition').row,0);
assert.deepEqual(view.frame(sim,24,true,'active'),{row:0,column:0,ringAngle:0,lean:0});
assert.deepEqual(view.frame(sim,999,true,'active'),{row:0,column:0,ringAngle:0,lean:0});
const frozen=view.frame(sim,24,false,'active');assert.deepEqual(view.frame(sim,24,false,'active'),frozen);
const images=Object.fromEntries(Object.entries(view.assets).map(([k,[w,h]])=>[k,{name:k,complete:true,naturalWidth:w,naturalHeight:h}]));
const calls=[],ctx={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},transform(){},drawImage(i,...args){calls.push([i.name,...args]);}};
const immutable=JSON.stringify(sim);assert.ok(view.sprite(ctx,images,sim,24,false,'active'));
assert.equal(JSON.stringify(sim),immutable,'Renderer must not mutate simulation');
assert.equal(calls[0][0],'back');assert.equal(calls.at(-1)[0],'front');assert.ok(calls.slice(1,-1).every(c=>c[0]==='body'));
assert.equal(calls.filter(c=>c[0]==='body').length,128);
assert.deepEqual(calls[1].slice(1),[0,0,96,128,0,0,96,128],'Local deformation keeps the original registered source');
for(let t=0;t<240;t++)assert.deepEqual(view.deform(48,48,t,false),{x:48,y:48});
assert.deepEqual(view.deform(48,22,40,false),{x:48,y:22});
for(const [x,y]of [[20,70],[76,70],[20,54],[76,54],[32,102],[64,102]]){
 const a=view.deform(x,y,0,false),b=view.deform(x,y,60,false);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.4,'Cloth must actually move');
 assert.deepEqual(view.deform(x,y,60,true),{x,y});
}
let previous=0,maxDelta=0,maxLean=0;
for(let t=0;t<=960;t++){sim.tick=t;const f=view.frame(sim,t,false,'active');maxLean=Math.max(maxLean,Math.abs(f.lean));maxDelta=Math.max(maxDelta,Math.abs(f.lean-previous));previous=f.lean;}
assert.ok(maxLean<=.012);assert.ok(maxDelta<.0008,'Turning must not jump between opposite poses');
assert.equal(view.frame(sim,100,false,'transition').lean,0);
images.body.naturalWidth=385;calls.length=0;assert.equal(view.sprite(ctx,images,sim,24,false,'active'),false);assert.equal(calls.length,0);
console.log(JSON.stringify({status:'PASS',checks:18,logicalClock:true,localHairSleeveHemMotion:true,faceAndWaistPinned:true,maxLeanDegrees:maxLean*180/Math.PI,maxLeanDelta:maxDelta,reducedStatic:true,layersAndAnchor:true,noStateMutation:true}));
