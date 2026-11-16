/* (C) 2026 Carinoasd. Focused intro timing checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'source/plugin/gamecenter/games'),R=require(path.join(dir,'_danmaku_proto/rules.json')),old=require(path.join(dir,'_danmaku_stage02_draft/refined-combat-v2.js')),N=require(path.join(dir,'_danmaku_stage02_draft/refined-intro-v1.js'));
const idle={dx:0,dy:0,flags:1},checks=[];function test(name,fn){fn();checks.push(name);}
test('all formations shift six seconds with identical composition and spacing',()=>{
 assert.equal(N.duration,5760);assert.equal(N.firstEnemyTick,480);assert.deepEqual(N.schedule().map(m=>({...m,at:m.at-360})),old.schedule());assert.equal(N.schedule().length,102);
 const a=old.configure(R),b=N.configure(R);for(const key of['types','paths','bomb','growth'])assert.deepEqual(b.stage01[key],a.stage01[key]);assert.deepEqual(b.boss,a.boss);assert.equal(b.stage01.gatherTick,5400);assert.equal(b.stage01.maxTicks,a.stage01.maxTicks+360);
});
test('first 479 steps have no enemies and movement remains available',()=>{
 const f=new N.Flow(R,'stage','standard',false),x=f.sim.player.x,dx=f.sim.rules.player.slowStepQ;for(let i=0;i<479;i++)f.step(i<10?{dx,dy:0,flags:1}:idle);assert.equal(f.sim.mobs.length,0);assert.equal(f.sim.enemies.length,0);assert.equal(f.stats.mobSpawned,0);assert.equal(f.sim.player.x,x+10*dx);assert.equal(f.remaining,5281);f.step(idle);assert.equal(f.stats.mobSpawned,1);assert.equal(f.sim.mobs[0].born,480);assert.equal(f.remaining,5280);
});
test('bounded relative-time mob states remain identical',()=>{
 const a=new old.Sim(R,-1,{power:16,shooting:false,invincible:true}),b=new N.Sim(R,-1,{power:16,shooting:false,invincible:true});b.tick=360;
 for(let i=0;i<720;i++){a.step(idle,true);b.step(idle,true);}
 function normalize(s,shift){return{mobs:s.mobs.map(m=>[m.id,m.type,m.x,m.y,m.hp,m.born-shift,m.warningUntil?m.warningUntil-shift:0]),enemies:s.enemies.map(e=>[e.id,e.x,e.y,e.vx,e.vy,e.born-shift,e.kind,e.radius]),stats:s.stats};}
 assert.deepEqual(normalize(b,360),normalize(a,0));
});
test('ninety seconds is no longer the end and 96s carries resources once',()=>{
 const f=new N.Flow(R,'stage','worn',false);f.tick=f.sim.tick=5399;f.sim.cursor=f.sim.rules.stage01.schedule.length;f.step(idle);assert.equal(f.stage,'prelude');assert.equal(f.remaining,360);f.tick=f.sim.tick=5759;f.sim.drop(240*64,500*64,1,false);f.step(idle);assert.equal(f.stage,'opening');assert.equal(f.remaining,390);assert.equal(f.sim.player.power,13);assert.equal(f.stats.powerCollected,1);assert.equal(f.sim.hpMax,5700);assert.equal(f.checkpoint.player.power,13);
 for(let i=0;i<390;i++)f.step(idle);assert.equal(f.stage,'active');assert.equal(f.sim.tick,0);assert.equal(f.stats.powerCollected,1);assert.equal(f.retryBoss(),true);assert.equal(f.sim.player.power,13);assert.equal(f.remaining,390);
});
test('three boss simulations and rule data are unchanged',()=>{
 for(let index=0;index<3;index++){const a=new old.Sim(R,index,{shooting:false,invincible:true}),b=new N.Sim(R,index,{shooting:false,invincible:true});for(let i=0;i<240;i++){a.step(idle,true);b.step(idle,true);}const snap=b.snapshot();snap.rule=old.rule;assert.deepEqual(snap,a.snapshot());}
 assert.deepEqual(N.presets,old.presets);assert.deepEqual(N.names,old.names);
});
const report={status:'PASS',checks,firstEnemySeconds:8,scheduleShiftSeconds:6,preludeSeconds:96,gatherSeconds:90,enemies:102,naturalFullClearTested:false,bossRetestedOnlyBoundedEquivalence:true};const out=path.join(root,'tmp/danmaku/stage02-intro-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
