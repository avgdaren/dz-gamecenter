/* (C) 2026 Carinoasd. Bounded Stage 2 draft logic checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'source/plugin/gamecenter/games'),S=require(path.join(folder,'_danmaku_stage02_draft/combat.js'));
const rules=JSON.parse(fs.readFileSync(path.join(folder,'_danmaku_proto/rules.json'),'utf8')),chart=JSON.parse(fs.readFileSync(path.join(folder,'_danmaku_stage02_draft/chart.json'),'utf8'));
const old=require(path.join(folder,'_danmaku_proto/stage.js')),idle={dx:0,dy:0,flags:1},before=JSON.stringify(rules),cases=[];
function test(name,fn){fn();cases.push(name);console.log('PASS '+name);}
test('new offline rule remains absent from first-stage ranked and supported registries',()=>{assert.ok(!old.supportedRules.includes(S.rule));assert.ok(!old.rankedRules.includes(S.rule));assert.equal(chart.ranked,false);});
test('invalid input is rejected before clock mutation',()=>{
 const r=new S.Run(rules,chart,'boss',false);
 for(const input of [{dx:999,dy:0,flags:0},{dx:0,dy:0,flags:4},{dx:NaN,dy:0,flags:0},{dx:256,dy:256,flags:0},{dx:0,dy:100,flags:1}]){const t=r.time;assert.throws(()=>r.step(input));assert.equal(r.time,t);}
});
test('boss hold lasts 390 ticks, player can move, then real fire and attacks start',()=>{
 const r=new S.Run(rules,chart,'boss',false);const start=r.sim.player.x;
 for(let i=0;i<390;i++)r.step({dx:i<10?96:0,dy:0,flags:1});assert.equal(r.wait,0);assert.equal(r.sim.tick,0);assert.equal(r.sim.enemies.length,0);assert.ok(r.sim.player.x>start);
 for(let i=0;i<180;i++)r.step(idle);assert.equal(r.sim.tick,180);assert.ok(r.sim.stats.enemySpawned>0);assert.ok(r.sim.shots.length>0||r.sim.stats.shotHits>0);
});
test('all three sample shapes emit moving integer bullets below the live cap',()=>{
 const peaks=[];
 for(let index=0;index<3;index++){
  const r=new S.Run(rules,chart,'sample'+index,true);let peak=0;
  for(let i=0;i<1800;i++){r.step(idle);peak=Math.max(peak,r.sim.enemies.length);}
  assert.ok(peak>10&&peak<360);assert.equal(r.sim.shots.length,0);assert.equal(r.usedTest,true);assert.ok(r.sim.enemies.every(e=>[e.x,e.y,e.vx,e.vy,...e.motion].every(Number.isInteger)));peaks.push(peak);
 }
 console.log('sample peaks',JSON.stringify(peaks));
});
test('all enemy types and authored stage sections have functional attacks and deterministic state',()=>{
 for(const time of [4,44,92,132,172]){
  const a=new S.Sim(rules,chart,-1,{musicTick:Math.round(time*60),invincible:true}),b=new S.Sim(rules,chart,-1,{musicTick:Math.round(time*60),invincible:true});
  for(let i=0;i<900;i++){a.step(idle);b.step(idle);}assert.deepEqual(a.snapshot(),b.snapshot());assert.ok(a.stats.mobSpawned>0);assert.ok(a.stats.enemySpawned>0);
 }
});
test('enemy hit, kill, P/point/B drops and pickup use existing player rules',()=>{
 const s=new S.Sim(rules,chart,-1,{invincible:true});const m={id:700,type:2,hp:600,x:240*64,y:300*64,reward:3};
 s.damageMob(m,599,false);assert.equal(m.hp,1);assert.equal(s.drops.length,0);s.damageMob(m,10,false);assert.equal(s.stats.mobKills,1);assert.equal(s.drops.length,2);assert.deepEqual(s.drops.map(d=>d.kind),[0,1]);
 const prior=s.player.power;s.drops.forEach(d=>s.collect(d));assert.equal(s.player.power,prior+3);
 s.damageMob({id:701,type:0,hp:40,x:120*64,y:160*64,reward:0},40,false);assert.equal(s.drops.at(-1).kind,2);s.collect(s.drops.at(-1));assert.equal(s.stats.pointScore,500);
});
test('swept collision takes a life, replenishes B and supports recovery power',()=>{
 const s=new S.Sim(rules,chart,-1,{power:16});s.player.bombs=0;
 s.spawn(s.player.x,s.player.y,128,0,4,100,20);s.step(idle);assert.equal(s.player.lives,2);assert.equal(s.player.bombs,2);assert.equal(s.player.power,12);assert.equal(s.stats.hitsTaken,1);assert.ok(s.drops.some(d=>d.recovery));
});
test('bomb clears curved bullets and enemy kills do not create duplicate drops',()=>{
 const s=new S.Sim(rules,chart,0,{invincible:true,musicTick:720});for(let i=0;i<180;i++)s.step(idle);assert.ok(s.enemies.length>0);s.step({dx:0,dy:0,flags:3});assert.equal(s.enemies.length,0);assert.equal(s.player.bombs,1);assert.equal(s.stats.bombsUsed,1);
 const d=new S.Sim(rules,chart,-1,{invincible:true});const m={id:9,type:0,hp:10,x:100*64,y:100*64,reward:2};d.damageMob(m,10,false);d.damageMob(m,10,false);assert.equal(d.drops.length,1);
});
test('phase defeat clears attacks, preserves player resources and keeps music clock continuous',()=>{
 const r=new S.Run(rules,chart,'boss',true);for(let i=0;i<420;i++)r.step(idle);const time=r.time;r.sim.hp=1;r.sim.damageBoss(1);r.step(idle);assert.equal(r.index,1);assert.equal(r.wait,120);assert.equal(r.sim.enemies.length,0);assert.equal(r.sim.player.power,16);assert.equal(r.time,time+1);const second=r.time;
 for(let i=0;i<120;i++)r.step(idle);assert.equal(r.wait,0);assert.equal(r.time,second+120);assert.equal(r.sim.musicTick,r.time);r.sim.hp=0;r.step(idle);assert.equal(r.index,2);assert.equal(r.breaks,2);
});
test('terminal state and test marking are stable; stage-end gathers without entering the next scope',()=>{
 const r=new S.Run(rules,chart,'stage',false);r.setTest(true);r.setTest(false);assert.equal(r.usedTest,true);r.sim.tick=chart.tracks.stage.ticks-1;r.sim.musicTick=r.sim.tick;r.time=r.sim.tick;r.step(idle);assert.equal(r.status,'stage_clear');const time=r.time;r.step(idle);assert.equal(r.time,time);assert.equal(r.index,-1);
});
assert.equal(JSON.stringify(rules),before,'existing rules mutated');
const report={status:'PASS',checks:cases,firstStageRulesUnmodified:true,serverVerifierTested:false,naturalFullClearTested:false};
const dest=path.join(root,'tmp/danmaku/stage02-combat-v1');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:cases.length}));
