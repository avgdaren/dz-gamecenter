/* (C) 2026 Carinoasd. Read-only acting invariants: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),folder=path.join(root,'source/plugin/gamecenter/games/_danmaku_stage02_draft');
const S=require(path.join(folder,'combat.js')),J=require(path.join(folder,'journey.js')),P=require(path.join(folder,'performance-v2.js'));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),rules=read(path.join(folder,'../_danmaku_proto/rules.json')),chart=read(path.join(folder,'chart.json'));
const checks=[],input={dx:0,dy:0,flags:1};
for(let index=0;index<3;index++){
 const plain=new S.Run(rules,chart,'sample'+index,true),acted=new S.Run(rules,chart,'sample'+index,true);J.trace(acted.sim);
 let predictions=0,casts=0;const expected=new Set();
 for(let i=0;i<720;i++){
  const m=P.boss(acted,'boss',0);if(m.nextCastIn!==null){expected.add(acted.sim.musicTick+m.nextCastIn);predictions++;}
  assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));assert.ok(m.pose>=0&&m.pose<4);
  const before=acted.sim.stats.enemySpawned;plain.step(input);acted.step(input);
  if(acted.sim.stats.enemySpawned>before){casts++;assert.ok(expected.has(acted.sim.musicTick),'actual emission must have an earlier matching anticipation cue');}
 }
 assert.deepEqual(acted.sim.snapshot(),plain.sim.snapshot());assert.ok(predictions>0&&casts>0);
 checks.push({name:'phase '+index+' acting leaves 720-step combat snapshot unchanged and anticipates actual casts',casts,predictions});
}
{
 const a=new S.Run(rules,chart,'boss',true),b=new S.Run(rules,chart,'boss',true);J.trace(b.sim);
 const first=P.boss(b,'boss',0);assert.ok(first.y<0);
 for(let t=0;t<390;t++){P.boss(b,'boss',0);a.step(input);b.step(input);}
 assert.equal(b.wait,0);assert.deepEqual(a.sim.snapshot(),b.sim.snapshot());assert.equal(b.sim.stats.enemySpawned,0);
 assert.equal(P.boss(b,'boss',0).y,88);assert.equal(P.boss(b,'boss',0).x,require(path.join(folder,'../_danmaku_proto/engine.js')).bossX(390)/64);checks.push({name:'entry descent fits the existing 390-tick hold and meets the first combat position'});
 const tick=b.time,state=JSON.stringify(b.sim.snapshot());
 for(const phase of ['boss','victory','epilogue','complete'])for(const v of [0,24,48,75])P.boss(b,phase,v);
 assert.equal(b.time,tick);assert.equal(JSON.stringify(b.sim.snapshot()),state);
 assert.equal(P.boss(b,'victory',75).alpha,0);assert.equal(P.boss(b,'epilogue',75).alpha,0);
 checks.push({name:'casting, transition and departure models do not mutate simulation or extend ending time'});
}
{
 const run=new S.Run(rules,chart,'stage',true);J.trace(run.sim);
 for(let t=0;t<720;t++){for(const m of run.sim.mobs){const saved=JSON.stringify(m);P.mob(run.sim,m);assert.equal(JSON.stringify(m),saved);}run.step(input);}
 checks.push({name:'mob anticipation and pose selection leave mob state untouched'});
}
const report={status:'PASS',checks,presentationOnly:true,naturalFullClearTested:false,serverVerifierTested:false};
const out=path.join(root,'tmp/danmaku/stage02-performance-v2');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
