/* (C) 2026 Carinoasd. Bounded flow/transition checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'source/plugin/gamecenter/games'),J=require(path.join(folder,'_danmaku_stage02_draft/journey.js')),S=require(path.join(folder,'_danmaku_stage02_draft/combat.js'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),rules=read(path.join(folder,'_danmaku_proto/rules.json')),chart=read(path.join(folder,'_danmaku_stage02_draft/chart.json')),script=read(path.join(folder,'_danmaku_stage02_draft/dialogue-v1.json'));
const idle={dx:0,dy:0,flags:1},checks=[];
function test(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function make(){return new J.Flow(rules,chart,script);}
function atBoss(test=false){const f=make();f.start(test);f.skip();f.run.sim.player.power=8;f.run.sim.player.lives=2;f.run.sim.player.bombs=1;f.run.time=chart.tracks.stage.ticks-1;f.run.sim.tick=f.run.time;f.run.sim.musicTick=f.run.time;f.step(idle);return f;}
test('opening dialogue gates the first encounter and consumes no battle time',()=>{const f=make();assert.equal(f.phase,'title');f.start(false);for(let i=0;i<120;i++)f.step(idle);assert.equal(f.run.time,0);assert.equal(f.clock,0);f.advance();assert.equal(f.phase,'prologue');f.advance();assert.equal(f.phase,'stage');f.step(idle);assert.equal(f.run.time,1);});
test('stage finish carries life, power, bombs and settles last drops once',()=>{
 const f=make();f.start(false);f.skip();const s=f.run.sim;s.player.lives=2;s.player.power=8;s.player.bombs=1;f.run.time=chart.tracks.stage.ticks-1;s.tick=f.run.time;s.musicTick=f.run.time;s.drop(100*64,100*64,2,false,0);s.drop(120*64,100*64,1,false,1);f.step(idle);
 assert.equal(f.phase,'bossTalk');assert.equal(f.run.sim.player.lives,2);assert.equal(f.run.sim.player.power,10);assert.equal(f.run.sim.player.bombs,2);const state=JSON.stringify(f.snapshot());f.step(idle);assert.equal(JSON.stringify(f.snapshot()),state);assert.equal(f.run.time,0);assert.equal(f.run.wait,390);
});
test('boss dialogue freezes resources and 390 active intro ticks keep the confirmed stop',()=>{const f=atBoss();for(let i=0;i<120;i++)f.step(idle);assert.equal(f.run.time,0);f.skip();assert.equal(f.phase,'boss');for(let i=0;i<390;i++)f.step(idle);assert.equal(f.run.wait,0);assert.equal(f.run.sim.tick,0);assert.equal(f.run.sim.enemies.length,0);for(let i=0;i<180;i++)f.step(idle);assert.ok(f.run.sim.stats.enemySpawned>0);assert.ok(f.run.sim.emitters.length>0);});
test('presentation trace keeps the three legacy combat snapshots identical',()=>{for(let phase=0;phase<3;phase++){const a=new S.Run(rules,chart,'sample'+phase,true),b=new S.Run(rules,chart,'sample'+phase,true);J.trace(b.sim);for(let t=0;t<720;t++){a.step(idle);b.step(idle);}assert.deepEqual(a.sim.snapshot(),b.sim.snapshot());assert.ok(b.sim.emitters.length<=24);assert.ok(b.sim.enemies.every(e=>Number.isInteger(e.originX)&&Number.isInteger(e.originY)));}});
test('three boss defeats advance into victory then epilogue, with a music fade',()=>{
 const f=atBoss(true);f.skip();for(let i=0;i<390;i++)f.step(idle);
 for(let phase=0;phase<3;phase++){f.run.sim.hp=0;f.step(idle);if(phase<2){assert.equal(f.run.index,phase+1);for(let i=0;i<120;i++)f.step(idle);}}
 assert.equal(f.phase,'victory');assert.equal(f.run.sim.enemies.length,0);assert.equal(f.audio().fade,1);const tick=f.run.sim.tick;for(let i=0;i<48;i++)f.step(idle);assert.equal(f.audio().fade,0);for(let i=0;i<27;i++)f.step(idle);assert.equal(f.phase,'epilogue');assert.equal(f.run.sim.tick,tick);assert.equal(f.audio().active,false);f.skip();assert.equal(f.phase,'complete');
});
test('boss retry restores the entry checkpoint rather than full-power practice defaults',()=>{
 const f=atBoss();f.skip();const entry=Object.assign({},f.run.sim.player);f.run.wait=0;f.run.sim.player.lives=1;f.run.sim.player.power=0;f.run.sim.player.bombs=0;f.run.sim.player.invulUntil=0;f.run.sim.spawn(f.run.sim.player.x,f.run.sim.player.y,128,0,4,30,20);f.step(idle);assert.equal(f.phase,'dead');assert.equal(f.retryBoss(),true);assert.equal(f.phase,'boss');assert.equal(f.run.time,0);for(const k of ['lives','power','bombs'])assert.equal(f.run.sim.player[k],entry[k]);assert.equal(f.run.wait,390);
});
test('test flag stays marked across stage transition, retries and terminal screens',()=>{const f=atBoss(true);f.setTest(false);assert.equal(f.usedTest,true);f.skip();f.retryBoss();assert.equal(f.usedTest,true);assert.equal(f.run.usedTest,true);});
test('invalid movement cannot advance the flow or intro clock',()=>{const f=atBoss();f.skip();const before=JSON.stringify(f.snapshot());for(const input of [{dx:999,dy:0,flags:0},{dx:0,dy:0,flags:4},{dx:NaN,dy:0,flags:1}])assert.throws(()=>f.step(input));assert.equal(JSON.stringify(f.snapshot()),before);});
test('whole-run restart resets the checkpoint and run resources',()=>{const f=atBoss(true);f.skip();f.start(false);assert.equal(f.phase,'prologue');assert.equal(f.checkpoint,null);assert.equal(f.run.sim.player.power,0);assert.equal(f.run.sim.player.lives,3);assert.equal(f.run.sim.player.bombs,2);assert.equal(f.usedTest,false);});
const report={status:'PASS',checks,naturalFullClearTested:false,serverVerifierTested:false};const dest=path.join(root,'tmp/danmaku/stage02-journey-v1');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length}));
