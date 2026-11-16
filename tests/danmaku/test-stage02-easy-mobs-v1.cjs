/* (C) 2026 Carinoasd. Scoped Easy mob density and accepted Boss checks: 小典 / Codex. */
'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'source/plugin/gamecenter/games'),R=require(path.join(dir,'_danmaku_proto/rules.json')),before=require(path.join(dir,'_danmaku_stage02_draft/refined-formation-v4.js')),N=require(path.join(dir,'_danmaku_stage02_draft/refined-easy-v5.js')),A=require(path.join(dir,'_danmaku_proto/audio.js'));
const report={},checks=[],idle={dx:0,dy:0,flags:1};function test(n,f){f();checks.push(n);}
test('formations and all nonattack role properties remain identical',()=>{
 const a=before.configure(R),b=N.configure(R);assert.deepEqual(b.stage01.schedule,a.stage01.schedule);assert.equal(b.stage01.schedule.length,120);assert.deepEqual(b.boss,a.boss);assert.deepEqual(N.presets,before.presets);
 for(let i=0;i<3;i++){const x={...a.stage01.types[i]},y={...b.stage01.types[i]};delete x.attacks;delete y.attacks;assert.deepEqual(y,x);for(let j=0;j<a.stage01.types[i].attacks.length;j++){const c={...a.stage01.types[i].attacks[j]},d={...b.stage01.types[i].attacks[j]};delete c.offsets;delete d.offsets;assert.deepEqual(d,c);}}
 function count(r){return r.stage01.schedule.reduce((sum,m)=>sum+N.mobAttacks({rules:r},m).reduce((n,a)=>n+a.offsets.length,0),0);}
 report.authoredBulletBudget={before:count(a),after:count(b),reductionPercent:(count(a)-count(b))/count(a)*100,noKillTimingAnalysis:true};assert.equal(count(a),594);assert.equal(count(b),412);
});
test('normal level-five fixture keeps every mob state while reducing projectiles',()=>{
 const a=new before.Sim(R,-1,{power:16,shooting:true,invincible:true}),b=new N.Sim(R,-1,{power:16,shooting:true,invincible:true});let peakA=0,peakB=0;
 for(let t=0;t<1080;t++){a.step({dx:0,dy:0,flags:0},true);b.step({dx:0,dy:0,flags:0},true);assert.deepEqual(b.snapshot().mobs,a.snapshot().mobs);assert.deepEqual(b.snapshot().shots,a.snapshot().shots);assert.deepEqual(b.player,a.player);const visible=s=>s.mobs.filter(m=>m.x>=0&&m.x<=480*64&&m.y>=64*64&&m.y<=624*64).length;peakA=Math.max(peakA,visible(a));peakB=Math.max(peakB,visible(b));}
 report.local18s={power:16,normalShooting:true,before:{fired:a.stats.enemySpawned,peak:a.stats.enemyPeak,kills:a.stats.mobKills,visiblePeak:peakA},after:{fired:b.stats.enemySpawned,peak:b.stats.enemyPeak,kills:b.stats.mobKills,visiblePeak:peakB}};assert.ok(b.stats.enemySpawned<a.stats.enemySpawned);assert.ok(b.stats.enemyPeak<a.stats.enemyPeak);assert.equal(peakB,peakA);
});
test('all three accepted Boss snapshots including shots remain identical',()=>{
 for(let index=0;index<3;index++){const a=new before.Sim(R,index,{power:16,shooting:true,invincible:true}),b=new N.Sim(R,index,{power:16,shooting:true,invincible:true});a.musicTick=b.musicTick=[12,112,172][index]*60;for(let t=0;t<240;t++){a.step(idle,true);b.step(idle,true);const snap=b.snapshot();snap.rule=before.rule;assert.deepEqual(snap,a.snapshot());}}
});
test('music starts at zero; only enemies wait eight seconds',()=>{
 const p=A.plan({mode:'running',scene:'stage',stage:'prelude',tick:0,status:'playing'},true);assert.equal(p.key,'stage');assert.equal(p.offset,0);const f=new N.Flow(R,'stage','standard',false);for(let t=0;t<479;t++)f.step(idle);assert.equal(f.stats.mobSpawned,0);f.step(idle);assert.equal(f.stats.mobSpawned,3);assert.equal(f.sim.tick,480);assert.equal(f.remaining,5280);
});
test('stage ending, Boss recovery rewards and retry remain unchanged',()=>{
 const f=new N.Flow(R,'stage','low',true);f.tick=f.sim.tick=5759;f.sim.cursor=f.sim.rules.stage01.schedule.length;f.step(idle);assert.equal(f.stage,'opening');assert.equal(f.sim.musicTick,0);for(let t=0;t<390;t++)f.step(idle);assert.equal(f.sim.musicTick,390);f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.stage,'transition');assert.equal(f.sim.player.power,2);assert.equal(f.sim.hpMax,6300);assert.equal(f.retryBoss(),true);assert.equal(f.sim.player.power,0);assert.equal(f.sim.musicTick,0);
});
report.status='PASS';report.checks=checks;report.bossEasyPatternsAccepted=true;report.naturalFullClearTested=false;const out=path.join(root,'tmp/danmaku/stage02-easy-mobs-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
