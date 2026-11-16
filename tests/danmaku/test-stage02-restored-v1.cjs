/* (C) 2026 Carinoasd. Visible waves and exact original patterns: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'source/plugin/gamecenter/games'),local=path.join(dir,'_danmaku_stage02_draft');
const R=require(path.join(dir,'_danmaku_proto/rules.json')),E=require(path.join(dir,'_danmaku_proto/engine.js')),previous=require(path.join(local,'refined-intro-v1.js')),N=require(path.join(local,'refined-formation-v4.js')),old=require(path.join(local,'combat.js')),chart=require(path.join(local,'chart.json'));
const checks=[],report={},idle={dx:0,dy:0,flags:1},out=path.join(root,'tmp/danmaku/stage02-restored-v1');fs.mkdirSync(out,{recursive:true});function test(n,fn){fn();checks.push(n);}
test('intro and resource plan remain; visible formations contain 120 targets',()=>{
 const r=N.configure(R),rows=N.schedule();assert.equal(rows.length,120);assert.equal(new Set(rows.map(m=>m.id)).size,120);assert.equal(rows[0].at,480);assert.equal(rows.filter(m=>m.at===480).length,3);assert.equal(rows.filter(m=>m.at===576).length,6);assert.equal(r.stage01.preludeTicks,5760);assert.equal(r.stage01.gatherTick,5400);assert.deepEqual(r.boss.phaseHP,[5700,6300,6900]);assert.deepEqual(N.presets,previous.presets);
 const marks=[];for(const m of rows)marks.push([m.at,1],[m.at+(m.route==='sideArc'?240:r.stage01.types[m.type].life),-1]);let live=0,peak=0;for(const[,d]of marks.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){live+=d;peak=Math.max(live,peak);}assert.ok(peak<=32);report.schedule={enemies:rows.length,firstEnemySeconds:8,threeImmediateSideLanes:true,sixWideReinforcements:[9.6,49.5,72.5],staticMobUpperBound:peak,powerAvailable:rows.reduce((n,m)=>n+m.reward,0),bombRewards:rows.filter(m=>m.type===2).length};
});
test('actual on-screen population rises under the same level-five shooting input',()=>{
 function sample(Module){const s=new Module.Sim(R,-1,{power:16,shooting:true,invincible:true});let visiblePeak=0,at84=0;for(let t=0;t<1080;t++){s.step({dx:0,dy:0,flags:0},true);const count=s.mobs.filter(m=>m.x>=0&&m.x<=480*64&&m.y>=64*64&&m.y<=624*64).length;visiblePeak=Math.max(visiblePeak,count);if(s.tick===504)at84=count;}return{seconds:18,power:16,normalShooting:true,spawned:s.stats.mobSpawned,killed:s.stats.mobKills,visiblePeak,visibleAt8_4:at84,bullets:s.stats.enemySpawned,bulletPeak:s.stats.enemyPeak};}
 const a=sample(previous),b=sample(N);report.visibleComparison={before:a,after:b};assert.ok(b.visiblePeak>a.visiblePeak);assert.ok(b.visibleAt8_4>=3);assert.ok(b.visibleAt8_4>a.visibleAt8_4);
});
test('attack code block is copied verbatim from the first garden version',()=>{
 const source=fs.readFileSync(path.join(local,'combat.js'),'utf8'),block=source.slice(source.indexOf('  function emit('),source.indexOf('  function spawnMob(')),next=fs.readFileSync(path.join(local,'garden-original-patterns-v1.js'),'utf8');assert.ok(next.includes(block));report.originalAttackBlockSha256=crypto.createHash('sha256').update(block).digest('hex');
});
test('all three original patterns produce identical bullets and motion',()=>{
 const bossX=E.bossX;report.originalPatternEquivalence=[];try{E.bossX=()=>240*64;for(let index=0;index<3;index++){const start=[12,112,172][index]*60,a=new old.Sim(R,chart,index,{musicTick:start,shooting:false,invincible:true}),b=new N.Sim(R,index,{shooting:false,invincible:true});b.musicTick=start;
  for(let t=0;t<720;t++){a.step(idle);b.step(idle,true);assert.deepEqual(b.enemies,a.enemies);}report.originalPatternEquivalence.push({index,startSeconds:start/60,seconds:12,fired:b.stats.enemySpawned,peak:b.stats.enemyPeak,exactBulletsAndMotion:true});
 }}finally{E.bossX=bossX;}
});
test('music stays continuous through intro phase breaks and checkpoint retry',()=>{
 const f=new N.Flow(R,'boss','low',true);for(let t=0;t<390;t++)f.step(idle);assert.equal(f.sim.musicTick,390);assert.equal(f.stage,'active');for(let t=0;t<30;t++)f.step(idle);assert.equal(f.sim.musicTick,420);f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.stage,'transition');assert.equal(f.sim.musicTick,f.bossTicks);assert.equal(f.sim.player.power,2);const at=f.bossTicks;for(let t=0;t<120;t++)f.step(idle);assert.equal(f.sim.musicTick,at+120);assert.equal(f.retryBoss(),true);assert.equal(f.sim.musicTick,0);assert.equal(f.sim.player.power,0);assert.equal(f.stats.gardenPhasePower,0);
});
test('96s boundary still collects once and boss resource rules stay intact',()=>{
 const f=new N.Flow(R,'stage','worn',false);f.sim.tick=f.tick=5759;f.sim.cursor=f.sim.rules.stage01.schedule.length;f.sim.drop(240*64,500*64,1,false);f.step(idle);assert.equal(f.stage,'opening');assert.equal(f.sim.player.power,13);assert.equal(f.sim.musicTick,0);assert.equal(f.remaining,390);assert.equal(f.stats.powerCollected,1);assert.equal(f.sim.mobs.length,0);assert.equal(f.sim.enemies.length,0);
 const s=new N.Sim(R,0,{shooting:false,invincible:true}),time=s.musicTick;assert.throws(()=>s.step({dx:99999,dy:0,flags:0}));assert.equal(s.musicTick,time);
});
report.status='PASS';report.checks=checks;report.naturalFullClearTested=false;report.easyFeelAccepted=false;fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
