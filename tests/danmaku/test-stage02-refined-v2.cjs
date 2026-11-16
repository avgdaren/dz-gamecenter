/* (C) 2026 Carinoasd. Inherited resources and bounded garden combat: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'source/plugin/gamecenter/games'),R=require(path.join(dir,'_danmaku_proto/rules.json')),S=require(path.join(dir,'_danmaku_proto/stage.js')),V1=require(path.join(dir,'_danmaku_stage02_draft/refined-combat-v1.js')),N=require(path.join(dir,'_danmaku_stage02_draft/refined-combat-v2.js'));
const checks=[],report={},idle={dx:0,dy:0,flags:1},original=JSON.stringify(R),out=path.join(root,'tmp/danmaku/stage02-refined-v2');fs.mkdirSync(out,{recursive:true});
function test(name,fn){fn();checks.push(name);}
function sim(index,power=16,shooting=false){return new N.Sim(R,index,{power,shooting,invincible:true});}
function fixture(at,seconds,power,focused,version=N){const s=new version.Sim(R,-1,{power,shooting:true,invincible:true});s.tick=at;s.cursor=s.rules.stage01.schedule.findIndex(m=>m.at>at);if(s.cursor<0)s.cursor=s.rules.stage01.schedule.length;for(let i=0;i<seconds*60;i++)s.step({dx:0,dy:0,flags:focused?1:0},true);return s;}
test('arrival models use actual first-stage growth and death rules',()=>{
 const a=new S.Sim(R,-1,false,S.cornerRule),available=a.rules.stage01.schedule.reduce((sum,m)=>sum+m.reward,0);
 for(const m of a.rules.stage01.schedule)if(m.reward)a.collect({value:m.reward,recovery:false,kind:0});assert.equal(a.player.power,16);assert.equal(S.level(a.player.power,a.rules),5);
 const states=[{name:'all marked power collected',power:a.player.power,level:5,lives:a.player.lives}];a.player.lives--;a.losePower();a.replenishOnRespawn();states.push({name:'one unrecovered loss',power:a.player.power,level:S.level(a.player.power,a.rules),lives:a.player.lives,bombsBeforeFurtherUse:a.player.bombs});assert.equal(a.player.power,12);
 const recovery=a.drops[0];a.collect(recovery);assert.equal(a.player.power,16);
 const b=new S.Sim(R,-1,false,S.cornerRule);b.player.power=16;for(let i=0;i<2;i++){b.player.lives--;b.losePower();b.replenishOnRespawn();}assert.equal(b.player.power,8);states.push({name:'two unrecovered losses',power:b.player.power,level:S.level(b.player.power,b.rules),lives:b.player.lives});
 report.arrival={sourceRule:S.cornerRule,availableMarkedPower:available,thresholds:a.rules.stage01.growth.thresholds,states,recoveredLossPower:a.player.power,observedFullClear:false,note:'Rule-derived representative models; lives/B presets are explicit practice choices, not measured arrival statistics.'};
 fs.writeFileSync(path.join(out,'arrival-models.json'),JSON.stringify(report.arrival,null,2)+'\n');
});
test('independent formations and static resource/capacity budget',()=>{
 const r=N.configure(R),rows=r.stage01.schedule;assert.equal(rows.length,102);assert.equal(new Set(rows.map(m=>m.id)).size,102);assert.equal(r.stage01.preludeTicks,5400);assert.deepEqual(r.boss.phaseHP,[5700,6300,6900]);assert.deepEqual(r.stage01.types.map(t=>t.hp),[32,128,420]);
 const marks=[],bullets=[];for(const m of rows){const type=r.stage01.types[m.type];marks.push([m.at,1],[m.at+type.life,-1]);for(const a of N.mobAttacks({rules:r},m)){bullets.push([m.at+a.at,a.offsets.length],[m.at+a.at+type.ttl,-a.offsets.length]);}assert.ok(m.at+type.life<5040);}
 function peak(list){let n=0,p=0;for(const [,d]of list.sort((a,b)=>a[0]-b[0]||a[1]-b[1])){n+=d;p=Math.max(n,p);}return p;}
 report.formations={enemies:rows.length,types:[0,1,2].map(t=>rows.filter(m=>m.type===t).length),routes:[...new Set(rows.map(m=>m.route))],staticMobUpperBound:peak(marks),staticBulletUpperBound:peak(bullets),powerAvailable:rows.reduce((a,m)=>a+m.reward,0),bombRewards:rows.filter(m=>m.type===2).length,lastBirth:rows.at(-1).at/60,wholeStagePlayed:false};assert.ok(report.formations.staticMobUpperBound<=24);assert.ok(report.formations.staticBulletUpperBound<=192);
});
test('new paths end off-field and warnings precede role-specific attacks',()=>{
 const s=sim(-1),types=s.rules.stage01.types;for(const row of N.schedule()){const m={type:row.type,route:row.route,baseX:row.x,mirror:row.mirror};const last=N.position(s,m,types[m.type].life-1);assert.ok(last.y<0||last.y>640*64);for(const a of N.mobAttacks(s,m)){assert.ok(a.at>a.warning&&a.at<types[m.type].life);}}
 const a=sim(-1);a.tick=389;a.cursor=a.rules.stage01.schedule.findIndex(m=>m.at>=390);for(let i=0;i<67;i++)a.step(idle,true);assert.ok(a.mobs.some(m=>m.type===1&&m.cast!==undefined));assert.ok(a.stats.castMobs>0);
});
test('growth keeps shared movement weapons bombs and recovery',()=>{
 const a=new S.Sim(R,-1,false,S.cornerRule),b=sim(-1,12,true);a.player.power=12;a.pattern=b.pattern=function(){};a.testInvincible=b.testInvincible=false;
 for(let t=0;t<180;t++){const input={dx:t<20?128:0,dy:0,flags:t===40?3:1};a.step(input,true);b.step(input,true);for(const key of ['player','power','shots','bomb'])assert.deepEqual(b.snapshot()[key],a.snapshot()[key]);}
 a.losePower();b.losePower();assert.deepEqual(a.player,b.player);assert.deepEqual(a.drops,b.drops);
});
test('late formation stays active later and clears before final gathering',()=>{
 const s=sim(-1);s.tick=4649;s.cursor=s.rules.stage01.schedule.findIndex(m=>m.at>4649);for(let t=0;t<390;t++)s.step(idle,true);assert.equal(s.tick,5039);assert.equal(s.stats.mobSpawned,6);assert.equal(s.mobs.length,0);assert.equal(s.enemies.length,0);report.tail={fixtureStartSeconds:4649/60,seconds:6.5,spawned:s.stats.mobSpawned,remainingMobs:s.mobs.length,remainingBullets:s.enemies.length,gatherAt:84};
});
test('bounded high-power and recovery wave fixtures retain growth benefit',()=>{
 report.waveSamples=[];for(const power of[0,8,12,16])for(const focused of[false,true]){const s=fixture(0,12,power,focused);report.waveSamples.push({seconds:12,power,focused,spawned:s.stats.mobSpawned,killed:s.stats.mobKills,fired:s.stats.enemySpawned,peak:s.stats.enemyPeak,castersUsed:s.stats.castMobs,remaining:s.mobs.length,endPower:s.player.power});}
 const low=report.waveSamples.find(v=>v.power===0&&!v.focused),high=report.waveSamples.find(v=>v.power===16&&!v.focused);assert.ok(high.killed>low.killed);assert.ok(high.fired>0);assert.ok(high.killed<high.spawned);
 const mid=fixture(1799,10,16,false);report.waveSamples.push({at:1799/60,seconds:10,power:16,focused:false,spawned:mid.stats.mobSpawned,killed:mid.stats.mobKills,fired:mid.stats.enemySpawned,peak:mid.stats.enemyPeak,castersUsed:mid.stats.castMobs,remaining:mid.mobs.length,endPower:mid.player.power});assert.ok(mid.stats.enemySpawned>0);
 const prior=fixture(0,12,16,false,V1);report.previousOpening={seconds:12,power:16,spawned:prior.stats.mobSpawned,killed:prior.stats.mobKills,fired:prior.stats.enemySpawned};
});
test('three independent boss mechanisms and integer motion are deterministic',()=>{
 report.bossSamples=[];for(let index=0;index<3;index++){const a=sim(index),b=sim(index);const sourceSet=new Set();for(let i=0;i<720;i++){a.step(idle,true);b.step(idle,true);for(const e of a.emitters)sourceSet.add(e.x.toFixed(1)+','+e.y.toFixed(1));}assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.hp,a.hpMax);assert.equal(a.status,'playing');assert.ok(a.enemies.every(e=>!e.motion||e.motion.every(Number.isInteger)));assert.ok(a.stats.enemyPeak<=360);report.bossSamples.push({index,seconds:12,fired:a.stats.enemySpawned,peak:a.stats.enemyPeak,distinctActualSources:sourceSet.size});}
 const f=sim(1);for(let t=0;t<192;t++)f.step(idle,true);assert.equal(f.lastCue.kind,'bloom');assert.ok(f.emitters.some(e=>e.x===240&&e.y===184));
 const bell=sim(2);for(let t=0;t<108;t++)bell.step(idle,true);assert.equal(bell.lastCue.kind,'echo');const echo=bell.enemies.filter(e=>e.born===108);assert.ok(echo.length>0&&echo.every(e=>e.motion&&e.motion[4]===72));const before=Math.max(...echo.map(e=>Math.abs(e.vx)+Math.abs(e.vy)));for(let t=0;t<73;t++)bell.step(idle,true);assert.ok(echo.some(e=>e.motion[9]===1));assert.ok(Math.max(...echo.map(e=>Math.abs(e.vx)+Math.abs(e.vy)))>before);
});
test('aligned focus can suppress a caster before it fires',()=>{
 report.priorityTarget=[];for(const power of[0,8,12,16]){const s=sim(-1,power,true);s.cursor=s.rules.stage01.schedule.length;s.player.x=s.player.px=128*64;const m={id:900,type:1,born:0,baseX:128*64,mirror:false,reward:1,route:'hold',hp:128,aim:128,warningUntil:0,warningKind:0,x:128*64,y:-40*64,px:128*64,py:-40*64};s.mobs=[m];let t=0;while(m.hp>0&&t<180){s.step(idle,true);t++;}report.priorityTarget.push({power,killTick:t,firstAttackTick:66,attackSuppressed:s.stats.enemySpawned===0});assert.equal(m.hp,0);}
 assert.equal(report.priorityTarget.at(-1).attackSuppressed,true);assert.ok(report.priorityTarget.at(-1).killTick<report.priorityTarget[0].killTick);
});
test('boss phases support recovery and retry cannot farm rewards',()=>{
 const f=new N.Flow(R,'boss','low',false);f.stage='active';f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.stage,'transition');assert.equal(f.sim.player.power,2);assert.equal(f.stats.gardenPhasePower,2);assert.equal(f.sim.hpMax,6300);for(let t=0;t<120;t++)f.step(idle);f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.sim.player.power,4);assert.equal(S.level(f.sim.player.power,f.sim.rules),2);assert.equal(f.stats.gardenPhasePower,4);assert.equal(f.sim.hpMax,6900);
 assert.equal(f.retryBoss(),true);assert.equal(f.sim.player.power,0);assert.equal(f.stats.gardenPhasePower,0);assert.equal(f.phaseBreaks,0);assert.equal(f.sim.hpMax,5700);f.stage='active';f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.stats.gardenPhasePower,2);assert.equal(f.sim.player.power,2);
});
test('stage boundary carries actual resources cooldown and one-time collection',()=>{
 const f=new N.Flow(R,'stage','worn',false);f.tick=f.sim.tick=5399;f.sim.cursor=f.sim.rules.stage01.schedule.length;f.sim.player.power=13;f.sim.player.invulUntil=5499;f.sim.bombCooldownUntil=5469;f.sim.drop(240*64,500*64,1,false);f.step(idle);assert.equal(f.stage,'opening');assert.equal(f.sim.player.power,14);assert.equal(f.stats.powerCollected,1);assert.equal(f.sim.player.lives,2);assert.equal(f.sim.player.bombs,1);assert.equal(f.stats.gardenPhasePower,0);assert.equal(f.sim.hpMax,5700);for(let t=0;t<390;t++)f.step(idle);assert.equal(f.stage,'active');assert.equal(f.sim.tick,0);assert.equal(f.sim.player.invulUntil,0);assert.equal(f.sim.bombCooldownUntil,0);
});
test('ideal damage budget allows growth benefits without dynamic HP scaling',()=>{
 report.idealFireBudget=[];for(const power of[0,8,12,16])for(let index=0;index<3;index++){const a=sim(index,power,true);let total=0,t=0;while(total<a.hpMax&&t<5000){a.tick=++t;a.shots=[];a.fire(idle);total+=a.shots.reduce((n,s)=>n+s.damage,0);}report.idealFireBudget.push({power,index,ticks:t,seconds:t/60});assert.equal(a.hpMax,[5700,6300,6900][index]);assert.ok(t<4200);}
 for(let i=0;i<3;i++)assert.ok(report.idealFireBudget.find(v=>v.power===16&&v.index===i).ticks<report.idealFireBudget.find(v=>v.power===8&&v.index===i).ticks);
});
test('cue forecasts correspond to actual sources and no close-range births',()=>{
 for(let index=0;index<3;index++){for(let t=0;t<720;t++){const c=N.cue(index,t);if(c){assert.ok(c.inTicks>=1&&c.inTicks<=36);assert.equal(N.castAt(index,t+c.inTicks),true);}}const s=sim(index);s.player.x=240*64;s.player.y=184*64;for(let t=0;t<200;t++)s.step(idle,true);assert.ok(s.enemies.filter(e=>e.born===192).every(e=>(e.x-s.player.x)**2+(e.y-s.player.y)**2>60*60*64*64));}
 assert.equal(JSON.stringify(R),original);assert.throws(()=>new N.Flow(R,'stage','bad',false));assert.throws(()=>new N.Flow(R,'stage','standard',false).step({dx:9999,dy:0,flags:0}));
});
report.status='PASS';report.checks=checks;report.fullNaturalClearTested=false;report.easyFeelAccepted=false;fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
