/* (C) 2026 Carinoasd. Bounded two-stage state and retry checks: 小典 / Codex. */
'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),games=path.join(root,'source/plugin/gamecenter/games'),R=require(path.join(games,'_danmaku_proto/rules.json')),F=require(path.join(games,'_danmaku_proto/stage.js')),S=require(path.join(games,'_danmaku_stage02_draft/refined-easy-entry-v6.js')),C=require(path.join(games,'_danmaku_campaign_draft/flow-v1.js'));
const idle={dx:0,dy:0,flags:0},checks=[],report={};function test(name,fn){fn();checks.push(name);}
function finalFirst(c){const f=c.current;f.replace(2);f.phaseBreaks=2;f.stage='active';f.tick=5000;f.sim.tick=500;f.sim.hp=1;f.stats.damage=14399;f.sim.fire=function(){this.damageBoss(1);};return f;}
function second(c){finalFirst(c);c.step(idle);for(let t=0;t<C.handoffTicks;t++)c.step(idle);assert.equal(c.stageNumber,2);return c;}
function bossSecond(c){const f=c.current;f.tick=f.sim.tick=5759;f.sim.cursor=f.sim.rules.stage01.schedule.length;c.step(idle);assert.equal(f.stage,'opening');return f;}
test('campaign starts with genuine first-stage Easy resources and rules',()=>{
 const c=new C.Session(R),f=new F.Stage(R,false,F.cornerRule);assert.deepEqual(c.current.snapshot(),f.snapshot());assert.deepEqual(C.resources(c.sim),{lives:3,bombs:2,power:0});assert.equal(c.assisted,false);
 assert.throws(()=>new C.Session(R,'normal'));assert.throws(()=>new C.Session(R,'campaign','missing'));
});
test('first-stage 12-second snapshots remain identical to the existing simulation',()=>{
 const c=new C.Session(R),f=new F.Stage(R,false,F.cornerRule);for(let t=0;t<720;t++){const input={dx:t%120<60?96:-96,dy:0,flags:t%90<45?0:1};c.step(input);f.step(input);assert.deepEqual(c.current.snapshot(),f.snapshot());}
});
test('final drops settle once, raw resources survive handoff and timers rebase',()=>{
 const c=new C.Session(R),f=finalFirst(c),s=f.sim;Object.assign(s.player,{lives:2,bombs:2,power:11,invulUntil:680});s.bombCooldownUntil=700;
 s.drop(s.player.x,s.player.y-25*64,2,false);s.drop(s.player.x,s.player.y-25*64,1,false,1);s.drop(s.player.x,s.player.y-25*64,1,false,2);
 c.step(idle);assert.equal(c.state,'handoff');assert.equal(c.status,'playing');assert.deepEqual(C.resources(c.sim),{lives:2,bombs:3,power:13});assert.equal(c.sim.drops.length,0);const archived=JSON.stringify(c.records[1]);assert.deepEqual(c.records[1].score,f.score());
 for(let t=0;t<99;t++)c.step(idle);assert.equal(c.stageNumber,1);assert.equal(JSON.stringify(c.records[1]),archived);c.step(idle);
 assert.equal(c.stageNumber,2);assert.equal(c.sim.tick,0);assert.equal(c.current.tick,0);assert.equal(c.sim.player.invulUntil,79);assert.equal(c.sim.bombCooldownUntil,99);assert.equal(c.sim.bombActiveUntil,0);assert.equal(c.sim.lastBomb,-999);
 assert.deepEqual(C.resources(c.sim),{lives:2,bombs:3,power:13});assert.equal(c.sim.stats.mobKills,0);assert.equal(c.sim.stats.damage,0);assert.equal(c.sim.stats.pointCollected,0);assert.deepEqual(c.sim.enemies,[]);assert.deepEqual(c.sim.shots,[]);assert.deepEqual(c.sim.drops,[]);assert.equal(c.events.filter(e=>e.type==='stageComplete').length,1);
 report.arrival={resources:C.resources(c.sim),invulTicks:c.sim.player.invulUntil,cooldownTicks:c.sim.bombCooldownUntil,statisticsReset:true,firstStageArchivedExactlyOnce:true};
});
test('second-stage v6 local rules and snapshots remain identical after arrival',()=>{
 const c=second(new C.Session(R)),f=new S.Flow(R,'stage','standard',false);f.sim.player={...c.sim.player};f.sim.bombCooldownUntil=c.sim.bombCooldownUntil;f.sim.bombActiveUntil=0;f.sim.lastBomb=-999;f.sim.lastHit=-999;
 for(let t=0;t<660;t++){c.step(idle);f.step(idle);assert.deepEqual(c.current.inspect(),f.inspect());}assert.equal(c.sim.rules.stage01.types[0].attacks[0].at,120);
});
test('stage retry restores arrival and replaces its subtotal without repeating stage-one awards',()=>{
 const c=second(new C.Session(R));const score=c.records[1].score.total,checkpoint=JSON.stringify(c.stageCheckpoint);c.sim.player.power=0;c.sim.player.bombs=0;c.sim.player.lives=1;c.sim.stats.mobScore=9999;c.status='dead';c.state='over';
 assert.equal(c.retryStage2(),true);assert.equal(c.current.tick,0);assert.equal(c.sim.stats.mobScore,0);assert.equal(c.sim.player.power,0);assert.equal(c.records[1].score.total,score);assert.equal(JSON.stringify(c.stageCheckpoint),checkpoint);assert.equal(c.summary().rows.length,2);assert.equal(c.assisted,true);
 c.sim.player.power=8;assert.equal(c.retryStage2(),true);assert.equal(c.sim.player.power,0);assert.equal(c.events.filter(e=>e.type==='stageComplete').length,1);
});
test('first Boss checkpoint restores actual arrival resources, stats and IDs',()=>{
 const c=new C.Session(R),f=c.current;f.tick=f.sim.tick=4319;f.sim.cursor=f.sim.rules.stage01.schedule.length;Object.assign(f.sim.player,{power:11,bombs:1,lives:2});f.stats.mobScore=555;c.step(idle);const snap=c.current.snapshot();
 c.sim.player.power=0;c.sim.player.bombs=0;c.sim.stats.mobScore=999;c.current.phaseBreaks=2;assert.equal(c.retryBoss(),true);assert.deepEqual(c.current.snapshot(),snap);assert.equal(c.assisted,true);
});
test('garden Boss retries cannot farm phase power or preserve failed-attempt stats',()=>{
 const c=second(new C.Session(R)),f=bossSecond(c);const power=c.sim.player.power,checkpoint=JSON.stringify(f.checkpoint);f.replace(1);f.phaseBreaks=1;assert.equal(c.sim.stats.gardenPhasePower,2);c.sim.stats.mobScore+=999;
 assert.equal(c.retryBoss(),true);assert.equal(c.sim.player.power,power);assert.equal(c.sim.stats.gardenPhasePower,0);assert.equal(c.sim.stats.mobScore,0);assert.equal(c.current.phaseBreaks,0);assert.equal(c.current.sim.musicTick,0);assert.equal(JSON.stringify(c.current.checkpoint),checkpoint);assert.equal(c.sim.rules.stage01.types[1].attacks[1].at,210);
});
test('both stages settle once and return immutable per-stage and cumulative results',()=>{
 const c=second(new C.Session(R)),f=bossSecond(c);f.replace(2);f.phaseBreaks=2;f.stage='active';f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.stats.damage=18899;c.step(idle);assert.equal(c.status,'playing');
 for(let t=0;t<100;t++)c.step(idle);assert.equal(c.status,'clear');assert.equal(c.summary().completedStages,2);const summary=c.summary();assert.equal(summary.total,summary.rows.reduce((n,row)=>n+row.score.total,0));assert.equal(summary.rows[1].score.damage,18900);assert.equal('clear' in summary.rows[1].score,false);
 const serialized=JSON.stringify(c.inspect());for(let i=0;i<3;i++)c.step(idle);assert.equal(JSON.stringify(c.inspect()),serialized);summary.rows[0].score.total=0;assert.notEqual(c.summary().rows[0].score.total,0);assert.equal(c.events.filter(e=>e.type==='stageComplete').length,2);report.finalSummary=c.summary();
});
test('single-stage and Boss practices remain separate from continuous clears',()=>{
 const a=new C.Session(R,'stage1');finalFirst(a);a.step(idle);for(let t=0;t<100;t++)a.step(idle);assert.equal(a.status,'clear');assert.equal(a.stageNumber,1);assert.equal(a.summary().continuous,false);
 for(const selection of ['stage2','boss1','boss2']){const c=new C.Session(R,selection,'worn');assert.equal(c.assisted,true);assert.equal(c.summary().expectedStages,1);if(selection!=='stage2')assert.equal(c.current.stage,'opening');assert.equal(c.sim.player.power,12);}
 const fresh=new C.Session(R);assert.deepEqual(C.resources(fresh.sim),{lives:3,bombs:2,power:0});assert.equal(fresh.events.length,0);assert.equal(fresh.summary().total,0);
});
report.status='PASS';report.checks=checks;report.naturalFullClearTested=false;const out=path.join(root,'tmp/danmaku/campaign-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,finalSummary:undefined}));
