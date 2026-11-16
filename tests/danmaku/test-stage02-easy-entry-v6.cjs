/* (C) 2026 Carinoasd. Scoped enemy entry timing checks: 小典 / Codex. */
'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'source/plugin/gamecenter/games'),R=require(path.join(dir,'_danmaku_proto/rules.json')),before=require(path.join(dir,'_danmaku_stage02_draft/refined-easy-v5.js')),N=require(path.join(dir,'_danmaku_stage02_draft/refined-easy-entry-v6.js'));
const report={},checks=[],idle={dx:0,dy:0,flags:1};function test(n,f){f();checks.push(n);}
test('only mob attack and warning times change; formations, counts and player rules stay',()=>{
 const a=before.configure(R),b=N.configure(R),plain=r=>({...r,stage01:{...r.stage01,types:r.stage01.types.map(t=>({...t,attacks:t.attacks.map(x=>{const y={...x};delete y.at;delete y.warning;return y;})}))}});
 assert.deepEqual(plain(b),plain(a));assert.equal(b.stage01.schedule.length,120);assert.deepEqual(N.presets,before.presets);
 report.attackAges=b.stage01.types.map((type,i)=>({name:type.name,before:a.stage01.types[i].attacks.map(x=>x.at),after:type.attacks.map(x=>x.at),warnings:type.attacks.map(x=>x.warning)}));
 b.stage01.types.forEach((type,i)=>type.attacks.forEach((x,j)=>{const old=a.stage01.types[i].attacks[j];assert.equal(x.at-x.warning,old.at-old.warning);assert.equal(x.at-type.attacks[0].at,old.at-a.stage01.types[i].attacks[0].at);assert.ok(x.at<type.life);}));
 assert.deepEqual(report.attackAges.map(x=>x.after),[[120,192],[120,210],[120,228,336,444]]);
});
test('every route has no bullets until age 120, then fires with the full warning',()=>{
 report.singleEnemy=[];
 for(const [type,route] of [[0,'sideArc'],[0,'column'],[1,'hold'],[2,'hold']]){
  const sim=new N.Sim(R,-1,{power:0,shooting:false,invincible:true});sim.rules.stage01.schedule=[{id:1,type,at:1,x:240*64,mirror:false,reward:0,route,lane:0}];
  const attacks=N.mobAttacks(sim,{type,route});const last=attacks[attacks.length-1].at;let fired=0;const actual=[];
  for(let tick=1;tick<=last+1;tick++){
   sim.step(idle,true);const age=tick-1,m=sim.mobs.find(x=>x.id===1);assert.ok(m,'mob stays present for all scheduled volleys');
   if(age<120)assert.equal(sim.stats.enemySpawned,0);
   for(const attack of attacks)if(age>=attack.warning&&age<attack.at){assert.equal(m.warningUntil,1+attack.at);assert.ok(m.warningUntil>sim.tick);}
   if(sim.stats.enemySpawned!==fired){actual.push({age,count:sim.stats.enemySpawned-fired});fired=sim.stats.enemySpawned;}
  }
  assert.deepEqual(actual,attacks.map(x=>({age:x.at,count:x.offsets.length})));report.singleEnemy.push({type,route,actual});
 }
});
test('normal level-five local play keeps the same mob and player states',()=>{
 const a=new before.Sim(R,-1,{power:16,shooting:true,invincible:true}),b=new N.Sim(R,-1,{power:16,shooting:true,invincible:true});
 for(let t=0;t<1080;t++){
  const input={dx:0,dy:0,flags:0};a.step(input,true);b.step(input,true);
  const strip=s=>s.mobs.map(({aim,warningUntil,warningKind,cast,...physical})=>physical);assert.deepEqual(strip(b),strip(a));assert.deepEqual(b.snapshot().shots,a.snapshot().shots);assert.deepEqual(b.player,a.player);
 }
 report.local18s={power:16,normalShooting:true,before:{fired:a.stats.enemySpawned,peak:a.stats.enemyPeak,kills:a.stats.mobKills},after:{fired:b.stats.enemySpawned,peak:b.stats.enemyPeak,kills:b.stats.mobKills}};
});
test('all three accepted Boss snapshots including player shots stay identical',()=>{
 for(let index=0;index<3;index++){const a=new before.Sim(R,index,{power:16,shooting:true,invincible:true}),b=new N.Sim(R,index,{power:16,shooting:true,invincible:true});a.musicTick=b.musicTick=[12,112,172][index]*60;for(let t=0;t<240;t++){a.step(idle,true);b.step(idle,true);const snap=b.snapshot();snap.rule=before.rule;assert.deepEqual(snap,a.snapshot());}}
});
test('Flow applies the same grace once, keeps eight-second entry and Boss retry',()=>{
 const f=new N.Flow(R,'stage','standard',true);assert.equal(f.sim.rules.stage01.types[0].attacks[0].at,120);assert.equal(f.rules.stage01.types[0].attacks[0].at,120);
 for(let t=0;t<479;t++)f.step(idle);assert.equal(f.stats.mobSpawned,0);f.step(idle);assert.equal(f.stats.mobSpawned,3);
 for(let t=480;t<599;t++)f.step(idle);assert.equal(f.sim.tick,599);assert.equal(f.stats.enemySpawned,0);
 f.tick=f.sim.tick=5759;f.sim.cursor=f.sim.rules.stage01.schedule.length;f.step(idle);assert.equal(f.stage,'opening');assert.equal(f.sim.rules.stage01.types[0].attacks[0].at,120);assert.equal(f.sim.musicTick,0);
 for(let t=0;t<390;t++)f.step(idle);f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.stage,'transition');assert.equal(f.sim.rules.stage01.types[1].attacks[1].at,210);assert.equal(f.retryBoss(),true);assert.equal(f.sim.musicTick,0);assert.equal(f.sim.rules.stage01.types[1].attacks[1].at,210);
});
report.status='PASS';report.checks=checks;report.bossEasyPatternsUnchanged=true;report.naturalFullClearTested=false;const out=path.join(root,'tmp/danmaku/stage02-easy-entry-v6');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
