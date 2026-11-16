/* (C) 2026 Carinoasd. Bounded difficulty, inheritance and attack lifecycle checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),games=path.join(root,'source/plugin/gamecenter/games');
const R=require(path.join(games,'_danmaku_proto/rules.json'));
const First=require(path.join(games,'_danmaku_proto/stage.js'));
const Motion=require(path.join(games,'_danmaku_proto/hard-choreography.js'));
const Engine=require(path.join(games,'_danmaku_proto/engine.js'));
const Easy=require(path.join(games,'_danmaku_campaign_draft/story-flow-v5.js'));
const EasySecond=require(path.join(games,'_danmaku_stage02_draft/refined-easy-entry-v6.js'));
const Stage2=require(path.join(games,'_danmaku_stage02_draft/difficulties-v10.js'));
const Campaign=require(path.join(games,'_danmaku_campaign_draft/difficulty-flow-v10.js'));
const out=path.join(root,'tmp/danmaku/campaign-v10');
const idle={dx:0,dy:0,flags:0},focus={dx:0,dy:0,flags:1};
const checks=[],failures=[],report={naturalFullClearTested:false,humanDifficultyAccepted:false,serverReplayTested:false};
const copy=v=>JSON.parse(JSON.stringify(v));
function test(name,fn){try{fn();checks.push(name);console.log('PASS '+name);}catch(error){failures.push({name,error:error.stack});console.error('FAIL '+name+'\n'+error.message);}}
function session(difficulty,selection='campaign',preset='standard',story=false){return new Campaign.Session(R,selection,preset,false,story,difficulty);}
function drain(c){while(c.dialogue)c.skipStory();}
function firstFinal(c){
 drain(c);const f=c.current;f.replace(2);f.phaseBreaks=2;f.stage='active';f.tick=5000;f.sim.tick=500;f.sim.hp=1;
 f.sim.fire=function(){this.damageBoss(1);};return f;
}
function enterSecond(c){firstFinal(c);c.step(idle);drain(c);for(let i=0;i<100;i++)c.step(idle);drain(c);assert.equal(c.stageNumber,2);return c;}
function enterBoss(c){drain(c);const f=c.current;f.tick=f.sim.tick=f.sim.rules.stage01.preludeTicks-1;f.sim.cursor=f.sim.rules.stage01.schedule.length;c.step(idle);return f;}
function checkIntegers(s){
 for(const e of s.enemies)assert.ok([e.x,e.y,e.px,e.py,e.vx,e.vy,e.radius,e.born,e.ttl,...(e.motion||[])].every(Number.isInteger),'all enemy motion words must be integers');
}
function moveAndCull(s){
 const margin=s.rules.field.enemyCullMargin*64;
 s.enemies=s.enemies.filter(e=>{e.px=e.x;e.py=e.y;e.x+=e.vx;e.y+=e.vy;return s.tick-e.born+1<e.ttl&&e.x>=-margin&&e.x<=480*64+margin&&e.y>=-margin&&e.y<=640*64+margin;});
}
function main(){
 test('difficulty is validated and independent rules preserve current Easy',()=>{
  for(const difficulty of ['NORMAL','nightmare','toString','__proto__'])assert.throws(()=>session(difficulty));
  assert.throws(()=>new Stage2.Flow(R,'stage','standard',false,'nightmare'));
  assert.throws(()=>new Stage2.Sim(R,0,{difficulty:'nightmare'}));
  assert.notEqual(Campaign.ruleFor('normal'),Campaign.ruleFor('hard'));
  assert.notEqual(Stage2.ruleFor('normal'),Stage2.ruleFor('hard'));
  assert.equal(Campaign.ruleFor('easy'),'danmaku-campaign-easy-v5');
  const a=session('easy'),b=new Easy.Session(R,'campaign','standard',false,false);
  assert.deepEqual(a.inspect(),b.inspect());
  for(let i=0;i<720;i++){const input={dx:i%120<60?64:-64,dy:0,flags:i%90<45?1:0};a.step(input);b.step(input);assert.deepEqual(a.inspect(),b.inspect());}
 });
 test('Normal and Hard first-stage snapshots match their existing accepted rule implementations',()=>{
  report.stage01Rules={};
  for(const difficulty of ['normal','hard']){
   const rule=difficulty==='normal'?First.normalCornerRule:First.hardV3Rule,c=session(difficulty),f=new First.Stage(R,false,rule);
   assert.deepEqual(c.current.snapshot(),f.snapshot());
   for(let i=0;i<720;i++){const input={dx:i%120<60?64:-64,dy:0,flags:i%90<45?1:0};c.step(input);f.step(input);assert.deepEqual(c.current.snapshot(),f.snapshot());}
   report.stage01Rules[difficulty]=rule;
  }
 });
 test('story freezes the complete session; prayer lasts exactly 100 steps before actual raw-resource inheritance',()=>{
  report.inheritance=[];
  for(const difficulty of ['normal','hard']){
   const c=session(difficulty,'campaign','standard',true),initial=copy(c.current.snapshot()),initialTick=c.tick;
   assert.equal(c.dialogue.id,'s1-open');for(let i=0;i<60;i++)c.step({dx:256,dy:0,flags:2});assert.deepEqual(c.current.snapshot(),initial);assert.equal(c.tick,initialTick);
   const f=firstFinal(c);Object.assign(f.sim.player,{lives:2,bombs:1,power:13,invulUntil:680});f.sim.bombCooldownUntil=700;
   c.step(idle);assert.equal(c.dialogue.id,'s1-after');assert.equal(c.handoffAge,0);const frozen=copy(c.inspect());for(let i=0;i<60;i++)c.step(idle);assert.deepEqual(c.inspect(),frozen);
   assert.equal(c.retryBoss(),false);assert.equal(c.retryStage2(),false);c.skipStory();
   for(let i=0;i<99;i++)c.step(idle);assert.equal(c.stageNumber,1);assert.equal(c.handoffAge,99);c.step(idle);
   assert.equal(c.stageNumber,2);assert.equal(c.dialogue.id,'s2-open');assert.equal(c.inspect().difficulty,difficulty);
   assert.deepEqual(c.inspect().resources,{lives:2,bombs:1,power:13});assert.equal(c.sim.tick,0);assert.equal(c.current.tick,0);
   assert.equal(First.level(c.sim.player.power,c.sim.rules),4);assert.deepEqual(c.sim.rules.stage01.growth,new EasySecond.Sim(R,-1).rules.stage01.growth);
   assert.equal(c.sim.player.invulUntil,79);assert.equal(c.sim.bombCooldownUntil,99);assert.equal(c.sim.bombActiveUntil,0);
   assert.equal(c.sim.stats.mobKills,0);assert.equal(c.sim.stats.damage,0);assert.equal(c.sim.enemies.length,0);assert.equal(c.sim.shots.length,0);assert.equal(c.sim.drops.length,0);
   assert.equal(c.events.filter(e=>e.type==='stageComplete').length,1);report.inheritance.push({difficulty,resources:copy(c.inspect().resources),invulnerability:79,cooldown:99,prayerTicks:100});
  }
 });
 test('first Boss checkpoint retry retains each difficulty and the exact pre-Boss state',()=>{
  for(const difficulty of ['normal','hard']){
   const c=session(difficulty),f=enterBoss(c);assert.equal(f.stage,'opening');const before=copy(f.snapshot());
   Object.assign(c.sim.player,{power:0,bombs:0,lives:1});f.phaseBreaks=2;f.stats.mobScore+=999;
   assert.equal(c.retryBoss(),true);assert.deepEqual(c.current.snapshot(),before);assert.equal(c.inspect().difficulty,difficulty);assert.equal(c.assisted,true);
  }
 });
 test('second-stage and Boss retries restore their checkpoints without repeating rewards or changing difficulty',()=>{
  for(const difficulty of ['normal','hard']){
   const c=enterSecond(session(difficulty)),score=c.records[1].score.total,arrival=copy(c.inspect().resources),f=enterBoss(c);drain(c);
   const bossPower=c.sim.player.power;f.replace(1);f.phaseBreaks=1;assert.equal(c.sim.stats.gardenPhasePower,2);c.sim.stats.mobScore+=999;
   assert.equal(c.retryBoss(),true);assert.equal(c.sim.player.power,bossPower);assert.equal(c.sim.stats.gardenPhasePower,0);assert.equal(c.current.phaseBreaks,0);assert.equal(c.sim.musicTick,0);assert.equal(c.inspect().difficulty,difficulty);
   c.sim.player.lives=1;c.sim.player.bombs=0;c.sim.player.power=0;c.sim.stats.mobScore+=999;assert.equal(c.retryStage2(),true);
   assert.deepEqual(c.inspect().resources,arrival);assert.equal(c.sim.stats.mobScore,0);assert.equal(c.current.tick,0);assert.equal(c.records[1].score.total,score);assert.equal(c.events.filter(e=>e.type==='stageComplete').length,1);assert.equal(c.inspect().difficulty,difficulty);
  }
 });
 test('second-stage three-phase completion archives each subtotal once and freezes after the final story',()=>{
  for(const difficulty of ['normal','hard']){
   const c=enterSecond(session(difficulty,'campaign','standard',true));enterBoss(c);drain(c);
   const f=c.current;f.replace(2);f.phaseBreaks=2;f.stage='active';f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};c.step(idle);
   for(let i=0;i<100;i++)c.step(idle);assert.equal(c.dialogue.id,'s2-after');assert.equal(c.status,'playing');assert.equal(c.summary().completedStages,2);const points=c.summary().total;
   drain(c);assert.equal(c.status,'clear');assert.equal(c.state,'over');assert.equal(c.summary().total,points);assert.equal(c.events.filter(e=>e.type==='stageComplete').length,2);
   assert.equal(points,c.summary().rows.reduce((sum,row)=>sum+row.score.total,0));const before=copy(c.inspect());for(let i=0;i<5;i++)c.step(idle);assert.deepEqual(c.inspect(),before);
  }
 });
 test('all six Boss attacks are deterministic integer simulations with a first-release recognition window',()=>{
  report.bossSlices=[];
  for(const difficulty of ['normal','hard'])for(let index=0;index<3;index++){
   const a=new Stage2.Sim(R,index,{difficulty,shooting:false,invincible:true}),b=new Stage2.Sim(R,index,{difficulty,shooting:false,invincible:true});
   a.musicTick=b.musicTick=[390,6700,10900][index];let firstRelease=null;
   for(let i=0;i<720;i++){const input={dx:i%120<60?64:-64,dy:0,flags:i%90<45?1:0};a.step(input);b.step(input);assert.deepEqual(a.snapshot(),b.snapshot());checkIntegers(a);if(a.stats.enemySpawned&&firstRelease===null)firstRelease=a.tick;if(a.tick<36)assert.equal(a.stats.enemySpawned,0);}
   assert.ok(a.stats.enemySpawned>0,difficulty+' phase '+index+' must actually fire');report.bossSlices.push({difficulty,phase:index+1,ticks:720,firstRelease,spawned:a.stats.enemySpawned,peak:a.stats.enemyPeak});
  }
 });
 test('Hard bell warnings lock exactly once, retain their source and release toward the captured position',()=>{
  const hard=Stage2.forDifficulty('hard'),calls=[];
  for(let time=1200;time<6000;time++){const next=hard.cue(2,time);if(next&&next.kind==='call'&&next.inTicks===36)calls.push(copy(next));}
  assert.ok(calls.length>=2);const warning=calls[0],captureTime=warning.musicTick-36,bell=hard.presentationNodes(2,captureTime,{x:240*64,y:100*64})[warning.node];
  const s=new Stage2.Sim(R,2,{difficulty:'hard',shooting:false,invincible:true});s.tick=98;s.musicTick=captureTime-2;s.player.x=80*64;
  const sandbox={window:{DanmakuStageShow:{},Stage02Refined:EasySecond,Stage02Difficulty:Stage2}};
  vm.runInNewContext(fs.readFileSync(path.join(games,'_danmaku_campaign_draft/stage02-view-v10.js'),'utf8'),sandbox);
  const view=sandbox.window.Stage02RefinedView,flow={sim:s,stage:'active'},expectedAngle=Motion.direction(s,bell[0]*64,bell[1]*64,s.player.x,s.player.y);
  s.step(idle);assert.equal(s.musicTick,captureTime-1);assert.equal(s.hardBellLock,undefined);
  s.step(idle);assert.equal(s.musicTick,captureTime);const locked=copy(s.hardBellLock);assert.deepEqual(locked,{time:warning.musicTick,node:warning.node,angle:expectedAngle});
  const act=view.bossAct(flow,false);assert.equal(act.nextCastIn,36);assert.equal(act.cue.musicTick,locked.time);assert.equal(act.cue.node,locked.node);
  assert.deepEqual(hard.sources(2,s.musicTick,s.boss).map(p=>[p.x,p.y,p.node,p.kind]),[[bell[0],bell[1],locked.node,'call']]);
  const snapshot=s.snapshot();assert.deepEqual(snapshot.hardBellLock,locked);snapshot.hardBellLock.angle=-1;assert.deepEqual(s.hardBellLock,locked);
  for(let i=0;i<35;i++){s.step({dx:256,dy:0,flags:0});assert.deepEqual(s.hardBellLock,locked);}
  const before=view.bossAct(flow,false);assert.equal(before.nextCastIn,1);assert.equal(before.cue.musicTick,locked.time);assert.equal(before.cue.node,locked.node);
  const currentAim=Motion.direction(s,bell[0]*64,bell[1]*64,s.player.x,s.player.y);assert.notEqual(currentAim,locked.angle,'the player must have moved far enough to distinguish lock from tracking');
  s.step({dx:256,dy:0,flags:0});assert.equal(s.musicTick,locked.time);const born=s.enemies.filter(e=>e.born===s.tick&&e.kind===24);assert.equal(born.length,13);
  const full=512*256,launchAngles=born.map(e=>((e.motion[0]-e.motion[2]+full)%full)/256);
  assert.deepEqual(launchAngles,Array.from({length:13},(_,i)=>(locked.angle+(i-6)*8+512)%512));assert.ok(launchAngles.includes(locked.angle));assert.deepEqual(s.hardBellLock,locked);assert.equal(s.lastCast,s.tick);
  report.hardBellLock={captureMusicTick:captureTime,releaseMusicTick:locked.time,node:locked.node,warningTicks:36,lockedAngle:locked.angle,playerAimBeforeRelease:currentAim,centerBulletRetained:true,warningSourceMatchesRelease:true,snapshotContainsIndependentLock:true};
 });
 test('Hard bell locks recover after B and do not leak into replacement phases or checkpoint retries',()=>{
  const hard=Stage2.forDifficulty('hard'),calls=[];
  for(let time=1200;time<6000;time++){const next=hard.cue(2,time);if(next&&next.kind==='call'&&next.inTicks===36)calls.push(copy(next));}
  const first=calls[0],next=calls.find(c=>c.musicTick>first.musicTick+R.stage01.bomb.clearTicks+36);assert.ok(next);
  const s=new Stage2.Sim(R,2,{difficulty:'hard',shooting:false,invincible:true});s.tick=98;s.musicTick=first.musicTick-38;
  for(let i=0;i<2;i++)s.step(idle);assert.equal(s.hardBellLock.time,first.musicTick);s.step({dx:0,dy:0,flags:2});assert.equal(s.stats.bombsUsed,1);
  let firstCallCleared=false,nextCaptured=false;
  while(s.musicTick<next.musicTick){s.step(idle);if(s.musicTick===first.musicTick){assert.equal(s.enemies.length,0);assert.ok(s.stats.bombCleared>=13);firstCallCleared=true;}if(s.musicTick===next.musicTick-36){assert.equal(s.hardBellLock.time,next.musicTick);assert.equal(s.hardBellLock.node,next.node);nextCaptured=true;}}
  assert.ok(firstCallCleared&&nextCaptured);assert.ok(s.tick>=s.bombActiveUntil);assert.equal(s.enemies.filter(e=>e.born===s.tick&&e.kind===24).length,13);assert.equal(s.stats.bombsUsed,1);
  const f=new Stage2.Flow(R,'boss','standard',true,'hard');f.replace(2);f.sim.hardBellLock=copy(s.hardBellLock);assert.ok(f.sim.snapshot().hardBellLock);f.replace(1);assert.equal(f.sim.hardBellLock,undefined);assert.equal('hardBellLock' in f.sim.snapshot(),false);f.replace(2);assert.equal(f.sim.hardBellLock,undefined);assert.equal(f.retryBoss(),true);assert.equal(f.sim.hardBellLock,undefined);
  report.hardBellLock.bombClearsCurrentCallButNextCallWorks=true;report.hardBellLock.nextReleaseMusicTick=next.musicTick;report.hardBellLock.phaseAndRetryDiscardOldLock=true;
 });
 test('clearing delayed motion with B leaves no ghosts; close births and transition state are bounded',()=>{
  for(const difficulty of ['normal','hard']){
   const s=new Stage2.Sim(R,1,{difficulty,shooting:false,invincible:true});s.pattern=()=>{};
   Motion.emit(s,240*64,160*64,128,160,6,102,24,{accel:-3,changeAge:100,mode:4});
   for(let i=0;i<110;i++)s.step({dx:0,dy:0,flags:i===79?2:0});assert.equal(s.enemies.length,0);assert.equal(s.stats.enemySpawned,1);assert.equal(s.stats.bombsUsed,1);
   const point=new Stage2.Sim(R,0,{difficulty,shooting:false,invincible:true});for(const dx of [0,31*64,32*64])Motion.emit(point,point.player.x+dx,point.player.y,128,160,3,120,22);assert.equal(point.enemies.length,1);
   const f=new Stage2.Flow(R,'boss','low',true,difficulty);for(let i=0;i<390;i++)f.step(idle);const before=f.bossTicks;assert.equal(f.stage,'active');f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};f.step(idle);assert.equal(f.stage,'transition');assert.equal(f.sim.enemies.length,0);assert.equal(f.sim.player.power,2);for(let i=0;i<120;i++)f.step(idle);assert.equal(f.stage,'active');assert.equal(f.bossTicks,before+121);assert.equal(f.sim.musicTick,f.bossTicks);
  }
 });
 test('Normal and Hard share one-life damage, bomb-stock reset and recoverable power rules',()=>{
  for(const difficulty of ['normal','hard'])for(const index of [-1,0,1,2]){
   const s=new Stage2.Sim(R,index,{difficulty,power:16,shooting:false,invincible:false});s.pattern=()=>{};Object.assign(s.player,{lives:2,bombs:0,invulUntil:0});
   s.spawn(s.player.x,s.player.y,128,0,3,120,22);s.spawn(s.player.x,s.player.y,128,0,3,120,23);s.step(idle);
   assert.equal(s.player.lives,1);assert.equal(s.player.bombs,s.initialBombStock());assert.equal(s.stats.hitsTaken,1);assert.equal(s.stats.bombsUsed,0);assert.ok(s.player.power<16);assert.ok(s.drops.some(d=>d.recovery));
   const power=s.player.power,before=copy(s.player);s.spawn(s.player.x,s.player.y,128,0,3,120,22);s.step(idle);assert.equal(s.player.lives,before.lives);assert.equal(s.player.power,power);assert.equal(s.stats.hitsTaken,1);
   for(const drop of s.drops)if(drop.recovery)s.collect(drop);assert.equal(s.player.power,16);
  }
 });
 test('enemy warnings precede firing and light enemies retain one-hit defeat and useful recovery drops',()=>{
  report.resourceWindows=[];
  for(const difficulty of ['normal','hard']){
   const s=new Stage2.Sim(R,-1,{difficulty,power:0,shooting:false,invincible:true});const r=s.rules,baseline=new EasySecond.Sim(R,-1).rules;
   assert.deepEqual(r.stage01.growth,baseline.stage01.growth);assert.equal(r.stage01.shotCap,baseline.stage01.shotCap);assert.equal(r.stage01.dropCap,baseline.stage01.dropCap);
   assert.equal(r.stage01.preludeTicks,5760);assert.equal(Math.min(...r.stage01.schedule.map(m=>m.at)),480);assert.equal(r.stage01.types[0].hp,1);
   for(const type of r.stage01.types)for(const attack of type.attacks){assert.ok(attack.warning>=0);assert.ok(attack.warning<attack.at);assert.ok(attack.at-attack.warning>=18);}
   const row=r.stage01.schedule.find(m=>m.type===0&&m.reward>0);assert.ok(row);s.tick=row.at;s.pattern();const mob=s.mobs.find(m=>m.id===row.id);assert.ok(mob);const initial=s.player.power;s.damageMob(mob,1,false);assert.equal(mob.hp,0);assert.equal(s.stats.mobKills,1);assert.ok(s.drops.length>0);for(const drop of s.drops)s.collect(drop);assert.ok(s.player.power>initial);
   for(const power of [0,8,12,16]){
    const window=new Stage2.Sim(R,-1,{difficulty,power,shooting:true,invincible:true});let visiblePeak=0;
    for(let i=0;i<1260;i++){window.step(idle);visiblePeak=Math.max(visiblePeak,window.mobs.filter(m=>m.x>=0&&m.x<=480*64&&m.y>=64*64&&m.y<=624*64).length);}
    assert.ok(window.stats.mobSpawned>0);report.resourceWindows.push({difficulty,startPower:power,ticks:1260,kills:window.stats.mobKills,spawned:window.stats.mobSpawned,castMobs:window.stats.castMobs,visiblePeak,enemyPeak:window.stats.enemyPeak,endPower:window.player.power});
   }
   for(const at of [36*60,60*60])for(const power of [0,8,12,16]){
    const window=new Stage2.Sim(R,-1,{difficulty,power,shooting:true,invincible:true});window.tick=at;window.cursor=window.rules.stage01.schedule.findIndex(m=>m.at>at);if(window.cursor<0)window.cursor=window.rules.stage01.schedule.length;let visiblePeak=0;
    for(let i=0;i<720;i++){window.step({dx:i%240<120?64:-64,dy:0,flags:i%240<120?0:1});visiblePeak=Math.max(visiblePeak,window.mobs.filter(m=>m.x>=0&&m.x<=480*64&&m.y>=64*64&&m.y<=624*64).length);}
    assert.ok(window.stats.mobSpawned>0);report.resourceWindows.push({difficulty,startPower:power,isolatedWaveSlice:true,startTick:at,ticks:720,kills:window.stats.mobKills,spawned:window.stats.mobSpawned,castMobs:window.stats.castMobs,visiblePeak,enemyPeak:window.stats.enemyPeak,endPower:window.player.power});
   }
  }
 });
 test('separate no-kill emission scans stay within declared live caps throughout each authored budget',()=>{
  report.emissionScans=[];
  for(const difficulty of ['normal','hard']){
   const mob=new Stage2.Sim(R,-1,{difficulty,shooting:false,invincible:true});
   for(let tick=1;tick<=mob.rules.stage01.preludeTicks;tick++){mob.tick=tick;mob.pattern();Motion.motion(mob);moveAndCull(mob);if(tick%120===0)checkIntegers(mob);}
   assert.equal(mob.stats.mobSpawned,mob.rules.stage01.schedule.length);assert.ok(mob.stats.enemyPeak<=mob.rules.stage01.enemyCap);report.emissionScans.push({difficulty,part:'mobs',ticks:5760,spawned:mob.stats.enemySpawned,peak:mob.stats.enemyPeak,mobPeak:mob.stats.mobPeak,cap:mob.rules.stage01.enemyCap});
   for(let index=0;index<3;index++){
    const s=new Stage2.Sim(R,index,{difficulty,shooting:false,invincible:true});const budget=Math.max(13020,s.chart.tracks.boss.ticks||0),spawnCap=s.rules.limits.enemySpawnCap,phaseBudget=s.rules.clock.phaseMaxTicks;
    // A real phase times out at phaseBudget. The longer emission-only scan finds live
    // peaks at every music offset; cumulative births are checked in sliding phase-
    // length windows, rather than pretending one phase can last the whole song.
    s.rules=Object.assign({},s.rules,{limits:Object.assign({},s.rules.limits,{enemySpawnCap:Number.MAX_SAFE_INTEGER})});
    const births=[];let actualPeak=0,phaseBirths=0,maxPhaseBirths=0;
    for(let tick=1;tick<=budget;tick++){const prior=s.stats.enemySpawned;s.tick=tick;s.musicTick=tick;s.boss.x=Engine.bossX(tick);s.pattern();Motion.motion(s);moveAndCull(s);const emitted=s.stats.enemySpawned-prior;births.push(emitted);phaseBirths+=emitted;if(births.length>phaseBudget)phaseBirths-=births[births.length-phaseBudget-1];maxPhaseBirths=Math.max(maxPhaseBirths,phaseBirths);actualPeak=Math.max(actualPeak,s.enemies.length);if(tick%120===0)checkIntegers(s);}
    assert.ok(s.stats.enemyPeak<=s.rules.limits.enemyLiveCap);assert.ok(maxPhaseBirths<=spawnCap);report.emissionScans.push({difficulty,part:'boss',phase:index+1,ticks:budget,spawned:s.stats.enemySpawned,peak:s.stats.enemyPeak,postCullPeak:actualPeak,cap:s.rules.limits.enemyLiveCap,phaseBudget,maxPhaseBirths,phaseSpawnCap:spawnCap});
   }
  }
 });
 report.status=failures.length?'FAIL':'PASS';report.checks=checks;if(failures.length){report.failures=failures;throw new Error(failures.length+' v10 check group(s) failed');}
}
fs.mkdirSync(out,{recursive:true});try{main();}catch(error){report.status='FAIL';report.checks=checks;report.error=error.stack;throw error;}finally{fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,checks:checks.length,emissionScans:report.emissionScans,naturalFullClearTested:false}));
