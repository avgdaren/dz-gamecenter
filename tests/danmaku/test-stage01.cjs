/* (C) 2026 Carinoasd. One-stage growth and cross-language checks: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=JSON.parse(fs.readFileSync(path.join(base,'rules.json'),'utf8'));
const S=require(path.join(base,'stage.js')),R=require(path.join(base,'stage-replay.js')),codec=require(path.join(base,'replay.js'));
const {drive}=require('./stage01-policy.cjs'),zero=(flags=1)=>({dx:0,dy:0,flags});
const out=path.join(root,'tmp/danmaku/stage01-growth');fs.mkdirSync(out,{recursive:true});
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('one stage only and three fixed growth tiers',()=>{
 assert.equal(rules.stage01.schedule.length,40);assert.equal(rules.stage01.maxTicks,17340);
 for(const [power,want]of [[0,1],[2,1],[3,2],[7,2],[8,3]])assert.equal(S.level(power,rules),want);
 assert.deepEqual(rules.stage01.growth.levels.map(v=>v.focused.length),[3,5,7]);
 assert.deepEqual(rules.stage01.growth.levels.map(v=>v.focused.reduce((n,s)=>n+s.damage,0)),[10,14,18]);
});
test('score envelope includes all assist resources and all finite rewards',()=>{
 const r=rules.score,resource=Math.max(rules.player.standardLives,rules.assist.lives)*r.remainingLifeOnClear+Math.max(rules.player.standardBombs,rules.assist.bombs)*r.remainingBombOnClear;
 const expected=r.clear+3*r.phaseBreak+r.totalDamageBudget+r.grazeBulletCap*r.grazePerBullet+resource+r.timeBonusCap+
  rules.stage01.schedule.reduce((n,m)=>n+rules.stage01.types[m.type].killScore+m.reward*rules.stage01.growth.overflowPerUnit,0);
 assert.equal(rules.stage01.scoreUpperBound,expected);
});
test('assisted near-vertical shots normalize integer zero across languages',()=>{
 const s=new S.Sim(rules,0,true);s.spawn(15360,5632,129,109,4);
 assert.equal(Object.is(s.enemies[0].vx,-0),false);assert.equal(s.enemies[0].vx,0);
});
test('upgrade changes new volley; existing shots retain damage and firing level',()=>{
 const s=new S.Sim(rules,0,false);s.step(zero());s.collect({value:3,recovery:false});for(let i=0;i<6;i++)s.step(zero());
 assert.ok(s.shots.filter(v=>v.born===1).every(v=>v.level===1));assert.equal(s.shots.filter(v=>v.born===7).length,5);
 s.collect({value:5,recovery:false});for(let i=0;i<6;i++)s.step(zero(0));
 assert.equal(s.shots.filter(v=>v.born===13).length,7);assert.ok(s.shots.filter(v=>v.born===13).some(v=>v.vx!==0));
});
test('overflow and recovered power cannot create recovery score',()=>{
 const s=new S.Sim(rules,-1,false);s.collect({value:8,recovery:false});s.collect({value:3,recovery:false});
 assert.equal(s.player.power,8);assert.equal(s.stats.overflowScoreUnits,3);
 s.collect({value:5,recovery:true});assert.equal(s.stats.overflowScoreUnits,3);assert.equal(s.player.power,8);
});
test('hit loses one tier and emits exactly the lost power with a pickup delay',()=>{
 const s=new S.Sim(rules,0,false);s.player.power=8;s.spawn(s.player.x,s.player.y,0,0,4);s.step(zero());
 assert.equal(s.player.lives,2);assert.equal(s.player.power,3);assert.equal(s.drops.length,1);
 assert.equal(s.drops[0].value,5);assert.equal(s.drops[0].recovery,true);assert.equal(s.drops[0].unlock,61);
});
test('level one never drops invented power and a mortal hit wins over pickup/damage',()=>{
 const s=new S.Sim(rules,0,false);s.player.lives=1;s.drop(s.player.x,s.player.y,8,false);s.drops[0].unlock=0;
 s.hp=1;s.shots=[{id:1,x:15360,y:6400,px:15360,py:6400,born:0,vx:0,vy:-768,damage:8,focused:true,level:1}];s.nextShot=2;
 s.spawn(s.player.x,s.player.y,0,0,4);s.step(zero());assert.equal(s.status,'dead');assert.equal(s.player.power,0);assert.equal(s.stats.powerCollected,0);
 assert.equal(s.hp,1);assert.equal(s.stats.damage,0);
});
test('bomb clears current bullets before same-tick hit without awarding pickups',()=>{
 const s=new S.Sim(rules,0,false);s.spawn(s.player.x,s.player.y,0,0,4);s.step(zero(3));
 assert.equal(s.player.lives,3);assert.equal(s.player.bombs,1);assert.equal(s.enemies.length,0);assert.equal(s.drops.length,0);
});
test('focused pickup radius is larger and final gather attracts only real items',()=>{
 const a=new S.Sim(rules,-1,false),b=new S.Sim(rules,-1,false);
 for(const s of [a,b]){s.drop(s.player.x+80*64,s.player.y,1,false);s.drops[0].unlock=0;}
 a.items(zero(0));b.items(zero());assert.equal(a.drops[0].attracted,false);assert.equal(b.drops[0].attracted,true);
 a.tick=4080;a.items(zero(0));assert.equal(a.drops.length,0,'Expired items must not be revived by final gather');
 a.drop(a.player.x+80*64,a.player.y,1,false);a.tick+=12;a.items(zero(0));assert.equal(a.drops[0].attracted,true);
 assert.equal(new S.Sim(rules,-1,false).drops.length,0);
});
test('idle transition preserves resources and does not fire or consume bombs',()=>{
 const b=new S.Stage(rules,false);b.sim.player.power=8;b.sim.player.bombs=1;b.sim.drop(b.sim.player.x,b.sim.player.y,5,true);
 b.replace(0);b.stage='opening';b.remaining=180;
 for(let i=0;i<180;i++)b.step(zero(3));
 assert.equal(b.stage,'active');assert.equal(b.sim.player.power,8);assert.equal(b.sim.player.bombs,1);assert.equal(b.sim.shots.length,0);assert.equal(b.stats.overflowScoreUnits,0);
});
test('PHP internal boundary fixtures agree on mortal priority, bomb, sweep and recovered power',()=>{
 const result=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'test-stage01-edges.php')],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),[
  {status:'dead',hp:1,lives:0,power:0,damage:0,bombs:2},
  {status:'phase_clear',hp:0,lives:1,power:8,damage:1,bombs:1},
  {lives:2,hits:1},
  {afterHit:3,recoveryValue:5,unlock:61,power:8,overflowScoreUnits:0,lost:5}
 ]);
});
const cases=[],fixtures=[];
for(const [name,assist,options]of [['standard-clear',false,{}],['assist-clear',true,{}],['standard-long',false,{delays:[2100,2100,1800]}]]){
 const result=drive(rules,assist,options),b=result.battle;
 test('legal-input model reaches a natural terminal '+name,()=>assert.equal(b.status,'clear'));
 assert.equal(b.stats.mobSpawned,40);assert.ok(b.stats.powerCollected>0);assert.ok(result.changes.some(c=>c.level===3));
 assert.ok(b.stats.mobPeak<=rules.stage01.mobCap);assert.ok(b.tick<=rules.stage01.maxTicks);
 const payload=R.encode(result.records,rules,b);assert.deepEqual(R.run(payload,rules,false,false).snapshot,b.snapshot());
 fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(payload));fixtures.push({...result,payload});cases.push({payload,partial:false});
 console.log('ROUTE '+name+': '+b.tick+' ticks; kills='+b.stats.mobKills+' powerCollected='+b.stats.powerCollected);
}
let seed=91711;function random(n){seed=seed*48271%2147483647;return seed%n;}
for(let i=0;i<10;i++){
 const b=new S.Stage(rules,!!(i%2)),records=[];let input=zero();
 while(b.status==='playing'){
  if(b.tick%24===0){const slow=random(2),x=random(3)-1,y=random(3)-1,speed=x&&y?(slow?67:181):(slow?96:256);input={dx:x*speed,dy:y*speed,flags:slow};}
  const v={...input,flags:input.flags|(random(600)===0?2:0)};records.push(v);b.step(v);
 }
 cases.push({payload:R.encode(records,rules,b),partial:false});
}
for(const length of [1,239,240,321,1200,2400,4080,4319,4320,4499,4500,8000]){
 const records=fixtures[0].records.slice(0,length),b=new S.Stage(rules,false);records.forEach(v=>b.step(v));
 cases.push({payload:R.encode(records,rules,b),partial:true});
}
const legal=cases.length,good=fixtures[0].payload;
function badByte(payload,offset,value){const bytes=Buffer.from(payload.input,'base64');bytes[offset]=value;return{...payload,input:bytes.toString('base64')};}
const extra=fixtures[0].records.concat([zero()]);
const malformed=[{...good,rule:'danmaku-stage02-r1'},{...good,score:good.score+1},{...good,power:8},{...good,drops:[]},{...good,hp:9999},
 {...good,mobsKilled:40},{...good,assist:'false'},{...good,v:2},{...good,stage:1},badByte(good,4,4),badByte(good,0,255),
 {...good,ticks:17341},{...good,input:good.input.slice(0,-4)},
 {...good,ticks:extra.length,input:codec.encodeInputs(extra,rules,rules.stage01.maxTicks)},
 {...good,ticks:1,input:codec.encodeInputs([zero()],rules,rules.stage01.maxTicks),score:0}];
malformed[10]=badByte(badByte(good,0,255),1,127);
for(const payload of malformed){assert.throws(()=>R.run(payload,rules,false,false));cases.push({payload,partial:false});}
console.log('Comparing stage snapshots and illegal input rejection with PHP…');
// Small batches keep diagnostic snapshots bounded without changing simulation.
for(let start=0;start<cases.length;start+=8){
 const group=cases.slice(start,start+8);
 const php=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli-stage01.php')],
  {input:JSON.stringify({action:'batch',trace:true,cases:group}),encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000});
 assert.equal(php.status,0,php.stderr||php.stdout.slice(0,400));const rows=JSON.parse(php.stdout).results;assert.equal(rows.length,group.length);
 rows.forEach((row,i)=>{const n=start+i;if(n<legal){assert.equal(row.ok,1,row.reason);assert.deepEqual(row.data,R.run(group[i].payload,rules,group[i].partial,true));}else assert.equal(row.ok,0,'PHP accepted illegal case '+n);});
}
const report={status:'PASS',checks,rule:S.rule,legalDifferential:legal,illegalRejectedByBoth:malformed.length,
 modelClearRoutes:fixtures.map(f=>({ticks:f.battle.tick,assist:f.battle.assist,kills:f.battle.stats.mobKills,power:f.battle.stats.powerCollected,changes:f.changes})),
 humanClearVerified:false,physicalPhoneVerified:false};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
