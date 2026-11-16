/* (C) 2026 Carinoasd. Bounded compact-Stage-2 checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'source/plugin/gamecenter/games');
const R=require(path.join(dir,'_danmaku_proto/rules.json')),S=require(path.join(dir,'_danmaku_proto/stage.js')),N=require(path.join(dir,'_danmaku_stage02_draft/refined-combat-v1.js')),sample=require(path.join(dir,'_danmaku_stage02_draft/unity-sample-v1.js'));
const idle={dx:0,dy:0,flags:1},checks=[],report={};const original=JSON.stringify(R);
function test(name,fn){fn();checks.push(name);}
test('90-second authored formations preserve approved opening',()=>{
 const rows=N.schedule();assert.equal(rows.length,50);assert.equal(new Set(rows.map(m=>m.id)).size,50);assert.deepEqual(rows.filter(m=>m.at<1440),sample.schedule());assert.equal(N.duration,5400);assert.ok(rows.at(-1).at+R.stage01.types[rows.at(-1).type].life<5040);
 const r=N.configure(R);assert.deepEqual(r.boss.phaseHP,R.boss.phaseHP);assert.deepEqual(r.stage01.types.map(t=>t.hp),[32,96,360]);assert.deepEqual(r.collect08.extraPowerIds,[]);
 // Static interval envelope, not full-stage gameplay or automatic clearing.
 const marks=[],bullets=[];for(const m of rows){const t=r.stage01.types[m.type];marks.push([m.at,1],[m.at+t.life,-1]);for(const a of t.attacks){const at=m.at+a.at;bullets.push([at,a.offsets.length],[at+t.ttl,-a.offsets.length]);}}
 function peak(events){events.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let count=0,max=0;for(const [,delta]of events){count+=delta;max=Math.max(max,count);}return max;}
 report.schedule={seconds:90,enemies:rows.length,types:[0,1,2].map(t=>rows.filter(m=>m.type===t).length),staticLiveMobUpperBound:peak(marks),staticLiveBulletUpperBound:peak(bullets),powerAvailable:rows.reduce((n,m)=>n+m.reward,0),bombRewards:rows.filter(m=>m.type===2).length,lastBirth:rows.at(-1).at/60};assert.ok(report.schedule.staticLiveMobUpperBound<=r.stage01.mobCap);assert.ok(report.schedule.staticLiveBulletUpperBound<=r.stage01.enemyCap);
});
test('shared movement weapons recovery and bomb behavior',()=>{
 const a=new S.Sim(R,-1,false,S.cornerRule),b=new N.Sim(R,-1,{power:0});a.pattern=b.pattern=function(){};
 for(let i=0;i<240;i++){const input={dx:i<30?128:0,dy:0,flags:i===45?3:1};a.step(input,true);b.step(input,true);for(const key of ['player','power','shots','bomb'])assert.deepEqual(b.snapshot()[key],a.snapshot()[key]);}
 a.player.power=b.player.power=12;a.losePower();b.losePower();assert.deepEqual(b.player,a.player);assert.deepEqual(b.drops,a.drops);assert.equal(b.player.bombs,a.player.bombs);
});
test('local first-four-team pressure and determinism',()=>{
 const a=new N.Sim(R,-1,{shooting:false,invincible:true}),b=new N.Sim(R,-1,{shooting:false,invincible:true});for(let t=0;t<1440;t++){a.step(idle,true);b.step(idle,true);}assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.stats.mobSpawned,18);assert.equal(a.enemies.length,0);report.opening={mobPeak:a.stats.mobPeak,bulletPeak:a.stats.enemyPeak,bullets:a.stats.enemySpawned};
});
test('stage boundary gathers once and preserves real arrival resources',()=>{
 const f=new N.Flow(R,'stage','low',false);f.tick=f.sim.tick=5399;f.sim.cursor=f.sim.rules.stage01.schedule.length;f.sim.stats.mobKills=9;f.sim.player.power=3;f.sim.player.invulUntil=5500;f.sim.bombCooldownUntil=5480;f.sim.drop(240*64,500*64,2,false);f.step(idle);
 assert.equal(f.stage,'opening');assert.equal(f.sim.player.power,5);assert.equal(f.sim.stats.powerCollected,2);assert.equal(f.sim.player.lives,2);assert.equal(f.sim.player.bombs,1);assert.equal(f.remaining,390);assert.equal(f.sim.enemies.length,0);assert.equal(f.sim.shots.length,0);assert.equal(f.sim.drops.length,0);assert.equal(f.sim.player.invulUntil,100);assert.equal(f.sim.bombCooldownUntil,80);
 for(let t=0;t<390;t++)f.step(idle);assert.equal(f.stage,'active');assert.equal(f.sim.tick,0);assert.equal(f.sim.player.invulUntil,0);assert.equal(f.sim.bombCooldownUntil,0);assert.equal(f.sim.stats.powerCollected,2);
 f.sim.player.lives=1;f.sim.player.power=0;f.stats.mobKills=90;f.phaseBreaks=2;assert.equal(f.retryBoss(),true);assert.equal(f.phaseBreaks,0);assert.equal(f.sim.player.lives,2);assert.equal(f.sim.player.power,5);assert.equal(f.stats.mobKills,9);assert.equal(f.stats.powerCollected,2);assert.equal(f.bossTicks,0);assert.equal(f.retryBoss(),true);assert.equal(f.stats.powerCollected,2);
});
test('phase carry transition and defeat clean boundaries',()=>{
 const f=new N.Flow(R,'boss','standard',true);f.stage='active';f.sim.tick=100;f.sim.player.invulUntil=250;f.sim.bombCooldownUntil=190;f.sim.bombActiveUntil=130;f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);
 assert.equal(f.stage,'transition');assert.equal(f.phaseIndex,1);assert.equal(f.remaining,120);assert.equal(f.sim.player.power,8);assert.equal(f.sim.bombCooldownUntil,89);assert.equal(f.sim.player.invulUntil,149);assert.equal(f.sim.enemies.length,0);
 for(let t=0;t<120;t++)f.step(idle);assert.equal(f.stage,'active');assert.equal(f.sim.player.invulUntil,29);assert.equal(f.sim.bombCooldownUntil,0);assert.equal(f.sim.bombActiveUntil,0);
 const e=new N.Flow(R,'phase2','low',false);e.stage='active';e.sim.hp=1;e.sim.fire=function(){this.damageBoss(1);};e.step(idle);assert.equal(e.stage,'ending');assert.equal(e.sim.enemies.length,0);assert.equal(e.sim.shots.length,0);for(let t=0;t<100;t++)e.step(idle);assert.equal(e.status,'clear');assert.equal(e.step(idle),'clear');
 const dead=new N.Flow(R,'boss','low',false);dead.stage='active';dead.sim.player.lives=1;dead.sim.pattern=function(){this.spawn(this.player.x,this.player.y,128,0,4,10,22);};dead.step(idle);assert.equal(dead.status,'dead');assert.equal(dead.stage,'over');
 const timeout=new N.Flow(R,'phase0','low',true);timeout.stage='active';timeout.sim.tick=4199;timeout.sim.shooting=false;timeout.step(idle);assert.equal(timeout.status,'timeout');
});
test('three bounded boss samples use finite common-speed attacks',()=>{
 report.bossSamples=[];for(let index=0;index<3;index++){
  const old=new S.Sim(R,index,false,S.cornerRule),a=new N.Sim(R,index,{shooting:false,invincible:true});old.testInvincible=true;old.fire=function(){};
  for(let i=0;i<720;i++){old.step(idle,true);a.step(idle,true);}assert.equal(a.hp,R.boss.phaseHP[index]);assert.equal(a.status,'playing');assert.ok(a.stats.enemyPeak<=old.rules.limits.enemyLiveCap);assert.ok(a.enemies.every(e=>Number.isInteger(e.x)&&Number.isInteger(e.vx)));assert.ok(a.emitters.length<=24);
  report.bossSamples.push({index,seconds:12,first:{fired:old.stats.enemySpawned,peak:old.stats.enemyPeak},second:{fired:a.stats.enemySpawned,peak:a.stats.enemyPeak}});
 }
});
test('HP and fire packets give same ideal damage budget at levels 1/3/5',()=>{
 report.idealFireBudget=[];for(const level of[1,3,5])for(const index of[0,1,2]){
  function budget(sim){let damage=0,t=0;sim.player.power=R.power05.thresholds[level-1];while(damage<R.boss.phaseHP[index]&&t<5000){sim.tick=++t;sim.shots=[];sim.fire(idle);damage+=sim.shots.reduce((sum,s)=>sum+s.damage,0);}return t;}
  const a=budget(new S.Sim(R,index,false,S.cornerRule)),b=budget(new N.Sim(R,index,{}));assert.equal(a,b);report.idealFireBudget.push({level,index,first:a,second:b});
 }
});
test('cast cues and validation remain bounded',()=>{
 const aimed=new N.Sim(R,1,{shooting:false,invincible:true});for(let t=0;t<62;t++)aimed.step(idle,true);assert.equal(aimed.warningUntil-aimed.tick,36);const lock=aimed.aimAngle;for(let t=0;t<36;t++)aimed.step(idle,true);assert.equal(aimed.lastCast,98);assert.equal(aimed.aimAngle,lock);
 for(let index=0;index<3;index++)for(let t=1;t<720;t++){const d=N.nextCast(index,t);if(d!==null){assert.ok(d>=1&&d<=36);assert.equal(N.castAt(index,t+d),true);}}
 assert.throws(()=>new N.Flow(R,'normal','standard',false));assert.throws(()=>new N.Flow(R,'stage','unknown',false));assert.throws(()=>new N.Flow(R,'stage','low',false).step({dx:99999,dy:0,flags:0}));assert.equal(JSON.stringify(R),original);
});
report.status='PASS';report.checks=checks;report.fullNaturalClearTested=false;report.easyFeelAccepted=false;const out=path.join(root,'tmp/danmaku/stage02-refined-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
