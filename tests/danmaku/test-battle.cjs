/* (C) 2026 Carinoasd. P1 transitions, scoring and cross-language checks: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=require(path.join(base,'rules.json')),E=require(path.join(base,'engine.js'));
const {Battle,Phase}=require(path.join(base,'battle.js')),R=require(path.join(base,'battle-replay.js'));
const codec=require(path.join(base,'replay.js')),{drive}=require('./p1-policy.cjs');
const zero=()=>({dx:0,dy:0,flags:0});let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function steps(sim,n,input=zero()){for(let i=0;i<n;i++)sim.step(input);}
function shot(sim){const x=E.bossX(sim.tick+1),y=88*64+rules.playerShot.speedStepQ;return{id:sim.nextShot++,x,y,px:x,py:y,born:sim.tick+1};}
function bullet(sim,x=0,y=0){return{id:sim.nextEnemy++,x:sim.player.x+x*64,y:sim.player.y+y*64,px:0,py:0,vx:0,vy:0,radius:5,born:sim.tick+1,grazed:false};}
test('opening permits movement but cannot shoot or consume bombs',()=>{
 const b=new Battle(rules,false);steps(b,179,{dx:256,dy:0,flags:2});
 assert.equal(b.stage,'opening');assert.equal(b.sim.tick,0);assert.equal(b.sim.player.bombs,2);assert.equal(b.stats.damage,0);assert.equal(b.sim.shots.length,0);
 b.step(zero());assert.equal(b.stage,'active');assert.equal(b.sim.tick,0);b.step(zero());assert.equal(b.sim.tick,1);assert.equal(b.sim.shots.length,1);
});
test('phase damage clips overkill and counts a projectile once',()=>{
 const p=new Phase(rules,0,false);p.damageBoss(5000);p.damageBoss(10);
 assert.equal(p.hp,0);assert.equal(p.stats.damage,4500);assert.equal(p.stats.shotHits,1);
});
test('deadline-step kill wins before timeout',()=>{
 const p=new Phase(rules,0,false);p.tick=4199;p.hp=10;p.shots=[shot(p)];p.step(zero());
 assert.equal(p.status,'phase_clear');assert.equal(p.hp,0);
});
test('last-life death precedes a simultaneous last hit on the boss',()=>{
 const p=new Phase(rules,0,false);p.hp=10;p.player.lives=1;p.shots=[shot(p)];p.enemies=[bullet(p)];p.step(zero());
 assert.equal(p.status,'dead');assert.equal(p.hp,10);assert.equal(p.stats.damage,0);
});
test('phase timeout cannot silently advance',()=>{
 const p=new Phase(rules,1,false);p.tick=4199;p.player.invulUntil=9999;p.step(zero());assert.equal(p.status,'timeout');
});
test('phase transition clears both sides and preserves lives, bombs, position and stats',()=>{
 const b=new Battle(rules,false);steps(b,180);b.sim.hp=10;b.sim.stats.damage=4490;
 b.sim.player.lives=2;b.sim.player.bombs=1;b.sim.player.invulUntil=60;b.sim.shots=[shot(b.sim)];b.step(zero());
 assert.equal(b.stage,'transition');assert.equal(b.phaseBreaks,1);assert.equal(b.sim.enemies.length,0);assert.equal(b.sim.shots.length,0);
 const active=b.activeTicks;steps(b,119,{dx:0,dy:0,flags:2});assert.equal(b.phaseIndex,0);assert.equal(b.sim.player.bombs,1);
 b.step(zero());assert.equal(b.stage,'active');assert.equal(b.phaseIndex,1);assert.equal(b.activeTicks,active);assert.equal(b.sim.hp,4800);
 assert.equal(b.sim.player.lives,2);assert.equal(b.sim.player.bombs,1);assert.equal(b.sim.player.x,240*64);assert.equal(b.sim.player.invulUntil,0);assert.equal(b.stats.damage,4500);
 b.sim.damageBoss(10);assert.equal(b.stats.damage,4510);
});
test('second phase emits both aim salvos and wave rows',()=>{
 const p=new Phase(rules,1,false);p.player.invulUntil=9999;steps(p,396);assert.equal(p.stats.enemySpawned,36);
});
test('third phase uses the denser mixed recipe and locks aiming at tick 540',()=>{
 const p=new Phase(rules,2,false);p.player.invulUntil=9999;steps(p,60);assert.equal(p.stats.enemySpawned,29);
 steps(p,300);assert.equal(p.stats.enemySpawned,95);steps(p,180);const angle=p.aimAngle;
 assert.equal(p.warningUntil,570);steps(p,30);assert.equal(p.stats.enemySpawned,142);assert.equal(p.aimAngle,angle);
});
test('score components and integer ordering match an independently calculated example',()=>{
 const b=new Battle(rules,false);b.status='clear';b.phaseBreaks=3;b.stats.damage=14400;b.stats.graze=7;
 b.sim.player.lives=2;b.sim.player.bombs=1;b.activeTicks=12000;
 assert.deepEqual(b.score(),{clear:200000,phase:60000,damage:20000,graze:70,resources:5000,time:1000,total:286070});
 b.status='dead';assert.equal(b.score().clear,0);assert.equal(b.score().resources,0);assert.equal(b.score().time,0);
});
test('graze and time bonuses are capped; maximal mathematical score is bounded',()=>{
 const b=new Battle(rules,false);b.status='clear';b.phaseBreaks=3;b.stats.damage=14400;b.stats.graze=999999;b.activeTicks=0;
 assert.equal(b.score().total,308000);
});
test('ended battles reject additional steps and the hard upper bound is enforced',()=>{
 const b=new Battle(rules,false);b.status='clear';assert.throws(()=>b.step(zero()));
 const c=new Battle(rules,false);c.tick=13200;assert.throws(()=>c.step(zero()));
});
const out=path.join(root,'tmp/danmaku/p1');fs.mkdirSync(out,{recursive:true});
const cases=[],fixtures=[];
function addFixture(label,assist,options){
 const {battle:b,records}=drive(rules,assist,options);assert.equal(b.status,'clear','test route failed: '+label);
 const payload=R.encode(records,rules,b);assert.deepEqual(R.run(payload,rules,false,false).snapshot,b.snapshot());
 fixtures.push({label,payload,records});cases.push({payload,partial:false});
 fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(payload));
 console.log('ROUTE '+label+': '+b.tick+' ticks, '+b.score().total+' points');
}
addFixture('standard-clear',false,{y:500,horizon:30});
addFixture('assist-clear',true,{y:500,horizon:30});
addFixture('standard-long-clear',false,{y:500,horizon:30,delays:[1320,1140,1020]});
const timeout=new Battle(rules,false),timeoutRecords=[];
while(timeout.status==='playing'){const v=zero();timeoutRecords.push(v);timeout.step(v);}
test('a stationary complete battle times out after exactly 180+4200 ticks',()=>{
 assert.equal(timeout.status,'timeout');assert.equal(timeout.tick,4380);assert.equal(timeout.phaseBreaks,0);assert.equal(timeout.score().clear,0);
});
const timeoutPayload=R.encode(timeoutRecords,rules,timeout);cases.push({payload:timeoutPayload,partial:false});
fs.writeFileSync(path.join(out,'standard-timeout.json'),JSON.stringify(timeoutPayload));
let seed=771110;
function random(n){seed=seed*48271%2147483647;return seed%n;}
for(let i=0;i<40;i++){
 const b=new Battle(rules,Boolean(i%2)),records=[];let v=zero();
 while(b.status==='playing'){
  if(b.tick%12===0){let dx=random(3)-1,dy=random(3)-1,slow=Boolean(random(2)),speed=dx&&dy?(slow?67:181):(slow?96:256);v={dx:dx*speed,dy:dy*speed,flags:slow?1:0};}
  const input={...v,flags:v.flags|(random(900)===0?2:0)};records.push(input);b.step(input);
 }
 cases.push({payload:R.encode(records,rules,b),partial:false});
}
for(let i=0;i<20;i++){
 const f=fixtures[i%fixtures.length],length=180+random(f.records.length-180),records=f.records.slice(0,length),b=new Battle(rules,f.payload.assist);
 records.forEach(v=>b.step(v));cases.push({payload:R.encode(records,rules,b),partial:true});
}
const legalCount=cases.length,valid=fixtures[0].payload,bad=[];
function invalid(name,patch){bad.push({name,payload:{...valid,...patch}});}
invalid('spoofed score',{score:valid.score+1});invalid('score string',{score:String(valid.score)});
invalid('wrong battle version',{v:2});invalid('wrong rules',{rule:'danmaku-p0-r1'});invalid('wrong discriminator',{battle:false});
invalid('client HP',{hp:0});invalid('client phase',{phase:2});invalid('fake assist',{assist:'false'});
invalid('invalid time',{ticks:0});invalid('overlong time',{ticks:13201});invalid('bad Base64',{input:valid.input+' '});
const bytes=Buffer.from(valid.input,'base64');bytes.writeInt16LE(32767,0);invalid('teleport input',{input:bytes.toString('base64')});
bytes.writeInt16LE(0,0);bytes[4]=128;invalid('unknown action',{input:bytes.toString('base64')});
const extra=fixtures[0].records.concat([zero()]);invalid('input after victory',{ticks:extra.length,input:codec.encodeInputs(extra,rules,13200)});
const early=fixtures[0].records.slice(0,-1);invalid('truncated before victory',{ticks:early.length,input:codec.encodeInputs(early,rules,13200)});
for(const item of bad){test('reject '+item.name,()=>assert.throws(()=>R.run(item.payload,rules,false,false)));cases.push({payload:item.payload,partial:false});}
console.log('Comparing '+legalCount+' legal P1 cases and '+bad.length+' invalid cases against PHP…');
const p=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli-p1.php')],
 {input:JSON.stringify({action:'batch',trace:true,cases}),encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000});
if(p.error)throw p.error;assert.equal(p.status,0,p.stderr||p.stdout.slice(0,200));
const result=JSON.parse(p.stdout);assert.equal(result.ok,1);assert.equal(result.results.length,cases.length);
for(let i=0;i<cases.length;i++){
 const row=result.results[i];
 if(i<legalCount){assert.equal(row.ok,1,'PHP rejected '+i+': '+row.reason);assert.deepEqual(row.data,R.run(cases[i].payload,rules,cases[i].partial,true),'PHP drift case '+i);}
 else assert.equal(row.ok,0,'PHP accepted '+bad[i-legalCount].name);
}
const report={status:'PASS',rule:'danmaku-p1-r1',checks:count,fullClearRoutes:3,longestMeasuredClearTicks:fixtures[2].payload.ticks,
 legalDifferentialCases:legalCount,randomTerminalCases:40,legalPrefixCases:20,illegalRejectedByBoth:bad.length,
 humanDifficultyVerified:false,trace:'every 60 ticks, stage/phase change and terminal'};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
