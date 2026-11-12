/* (C) 2026 Carinoasd. User-reported Boss/respawn regression checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json'));
const E=require(path.join(base,'engine.js')),B=require(path.join(base,'battle.js')),S=require(path.join(base,'stage.js')),R=require(path.join(base,'stage-replay.js')),BR=require(path.join(base,'battle-replay.js')),C=require(path.join(base,'replay.js'));
const out=path.join(root,'tmp/danmaku/normal-v2');fs.mkdirSync(out,{recursive:true});const checks=[];
function test(name,f){f();checks.push(name);console.log('PASS '+name);}
function php(file,packet){const p=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(packet),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(p.status,0,p.error?.message||p.stderr);return JSON.parse(p.stdout);}
const inputs=Array.from({length:960},(_,i)=>({dx:i%240<80?64:i%240<160?-64:0,dy:0,flags:i===240?3:i%180<120?1:0}));
function make(c){if(c.kind==='stage')return new S.Sim(r,c.index,c.assist,c.rule);if(c.kind==='p0')return new E.Sim(r,c.scene,c.assist,c.rule);return new B.Phase(r,c.index,c.assist,true,true,c.rule===B.normalV2Rule,{normalRevision:2,respawnBombs:true});}
test('Normal v2 preserves the approved prelude types and schedules',()=>{
 assert.deepEqual(r.normal02.types,r.normal01.types);assert.equal(r.normal02.preludeEnemyCap,r.normal01.preludeEnemyCap);
 assert.notEqual(S.normalV2Rule,S.normalRule);assert.notEqual(S.respawnRule,S.patternRule);
});
test('14 pre-change Normal v1 traces keep their exact hashes',()=>{
 const gold=require('./fixtures/normal-v1-snapshots.json');
 for(const c of gold.rows){const s=c.kind==='stage'?new S.Sim(r,c.index,c.assist,S.normalRule):new B.Phase(r,c.index,c.assist,true,true,true);s.player.invulUntil=1000000;const trace=[];for(const input of inputs){s.step(input);if(s.tick%60===0)trace.push(s.snapshot());}assert.equal(crypto.createHash('sha256').update(JSON.stringify(trace)).digest('hex'),c.sha256);}
});
const phases=[];for(const assist of [false,true]){
 for(const rule of [S.respawnRule,S.normalV2Rule])for(const index of [-1,0,1,2])phases.push({kind:'stage',rule,index,assist,inputs});
 for(const rule of [B.respawnRule,B.normalV2Rule])for(const index of [0,1,2])phases.push({kind:'practice',rule,index,assist,inputs});
 for(const scene of E.scenes)phases.push({kind:'p0',rule:E.respawnRule,scene,assist,inputs});
}
test('34 new Easy/Normal/practice phase fixtures match PHP with movement and bomb events',()=>{
 const expected=phases.map(c=>{const s=make(c);s.player.invulUntil=1000000;const trace=[];for(const input of c.inputs){s.step(input);if(s.tick%60===0)trace.push(s.snapshot());}return trace;});
 assert.deepEqual(php('revision-fixtures.php',{action:'phases',cases:phases}),JSON.parse(JSON.stringify(expected)));
});
const misses=[];for(const c of phases)for(const stock of [0,1,2,3])misses.push({...c,inputs:undefined,stock});
const finalCase={kind:'stage',rule:S.normalV2Rule,index:0,assist:false,stock:0,lives:1};
misses.push(finalCase,{...finalCase,lives:3,stock:1,invulnerable:true},{...finalCase,lives:3,stock:2,bomb:true},
 {kind:'stage',rule:S.respawnRule,index:-1,assist:false,stock:0,body:true});
test('140 actual collision cases reset low/high stocks globally and gate final death, invulnerability and same-frame bomb',()=>{
 const expected=misses.map((c,i)=>{
  const s=make(c);s.player.bombs=c.stock;s.player.lives=c.lives??3;s.player.invulUntil=c.invulnerable?1000:0;
  if(c.body){s.tick=149;const [x,y]=r.stage01.paths[0][150];Object.assign(s.player,{x,px:x,y,py:y});s.mobs.push({id:100,type:0,born:0,baseX:0,mirror:false,reward:0,hp:32,aim:128,warningUntil:0,warningKind:0,x,px:x,y,py:y});}
  else for(let j=0;j<2;j++)s.spawn(s.player.x,s.player.y,0,0,4);
  s.step({dx:0,dy:0,flags:c.bomb?3:1});
  if(i<136||c.body){assert.equal(s.player.bombs,c.assist?3:2);assert.equal(s.player.lives,2);assert.equal(s.stats.hitsTaken,1);assert.equal(s.stats.bombsUsed,0);assert.equal(s.stats.bombCollected||0,0);}
  else if(c.lives===1){assert.equal(s.status,'dead');assert.equal(s.player.bombs,0);}
  else if(c.invulnerable){assert.equal(s.player.bombs,1);assert.equal(s.stats.hitsTaken,0);}
  else if(c.bomb){assert.equal(s.player.bombs,1);assert.equal(s.player.lives,3);assert.equal(s.stats.bombsUsed,1);}
  return{stock:s.player.bombs,lives:s.player.lives,taken:s.stats.hitsTaken,used:s.stats.bombsUsed,collected:s.stats.bombCollected||0,status:s.status};
 });
 assert.deepEqual(php('revision-fixtures.php',{action:'misses',cases:misses}),expected);
});
test('phase transitions preserve stocks instead of granting a second reset',()=>{
 for(const rule of [S.respawnRule,S.normalV2Rule]){const s=new S.Stage(r,false,rule);s.sim.player.bombs=0;for(const i of [0,1,2]){s.replace(i);assert.equal(s.sim.player.bombs,0);assert.equal(s.sim.respawnBombs,true);}}
 for(const rule of [B.respawnRule,B.normalV2Rule]){const s=new B.Battle(r,false,rule);s.sim.player.bombs=0;for(let i=0;i<2;i++){s.nextPhase();assert.equal(s.sim.player.bombs,0);assert.equal(s.sim.respawnBombs,true);}}
});
test('Boss v2 has two weave emitters, edge pincers, and row-by-row moving solid gates',()=>{
 const a=new S.Sim(r,0,false,S.normalV2Rule);a.tick=72;a.pattern();assert.equal(a.enemies.length,8);assert.equal(new Set(a.enemies.map(e=>e.x)).size,2);
 const b=new S.Sim(r,1,false,S.normalV2Rule);b.tick=20;b.pattern();assert.equal(b.enemies.length,0);assert.equal(b.warningUntil,50);b.tick=50;b.pattern();assert.equal(b.enemies.length,9);
 b.enemies=[];b.tick=88;b.pattern();assert.equal(b.enemies.length,6);assert.deepEqual([...new Set(b.enemies.map(e=>e.x))].sort((x,y)=>x-y),[24*64,456*64]);
 const p=r.normal02.boss[2],gaps=[];
 for(const t of p.wallTicks){const s=new S.Sim(r,2,false,S.normalV2Rule);s.tick=t;s.pattern();const gap=p.gapCenters[0]+p.rowGapOffsets[p.wallTicks.indexOf(t)];gaps.push(gap);assert.ok(s.enemies.every(e=>Math.abs(e.x/64-gap)>p.gapHalfWidth));}
 assert.ok(new Set(gaps).size>3);assert.ok(p.columns[1]-p.columns[0]<2*(p.wallRadius+r.player.hitRadius));
 for(let i=1;i<gaps.length;i++)assert.ok(Math.abs(gaps[i]-gaps[i-1])*64/r.player.slowStepQ<p.wallTicks[i]-p.wallTicks[i-1]);
 const interval=p.cycleTicks+p.wallTicks[0]-p.wallTicks.at(-1);assert.ok(160*64/r.player.slowStepQ<interval);
});
const budgets=[];test('attack-only full-duration bounds stay below new caps',()=>{
 for(const index of [-1,0,1,2]){const s=new S.Sim(r,index,false,S.normalV2Rule);for(let t=1;t<=(index<0?4320:4200);t++){s.tick=t;s.boss.px=s.boss.x;s.boss.x=E.bossX(t);s.pattern();s.enemies.forEach(e=>{e.x+=e.vx;e.y+=e.vy;});s.enemies=s.enemies.filter(e=>t-e.born<e.ttl&&e.x>=-2048&&e.x<=32768&&e.y>=-2048&&e.y<=43008);}budgets.push({index,spawned:s.stats.enemySpawned,peak:s.stats.enemyPeak});}
 assert.ok(budgets.reduce((n,b)=>n+b.spawned,0)<r.normal02.enemySpawnCap);assert.ok(budgets.every(b=>b.peak<(b.index<0?r.normal02.preludeEnemyCap:r.limits.enemyLiveCap)));
});
let invalid=0;test('legal new replay prefixes and terminal death pass; tampering and incomplete submissions fail',()=>{
 const old=require('./fixtures/r2-automated-input.json'),record=C.decodeInputs(old.ticks,old.input,r,r.stage01.maxTicks),rows=[];
 for(const rule of [S.respawnRule,S.normalV2Rule]){const s=new S.Stage(r,false,rule),used=[];for(const input of record.slice(0,4900)){if(s.status!=='playing')break;s.step(input);used.push(input);}const payload=R.encode(used,r,s),partial=s.status==='playing';const js=R.run(payload,r,partial,true),p=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload,partial}]}).results[0];assert.equal(p.ok,1);assert.deepEqual(p.data,js);rows.push({rule,ticks:used.length,status:s.status});
 const fresh=new S.Stage(r,false,rule),short=inputs.slice(0,120);short.forEach(i=>fresh.step(i));const bad=[{...payload,score:payload.score+1},{...payload,rule:'unknown'},{...payload,respawnBombs:false},{...payload,assist:1},{...payload,input:'!!!!'}];const cases=bad.map(payload=>({payload,partial:true}));cases.push({payload:R.encode(short,r,fresh),partial:false});const results=php('cli-stage01.php',{action:'batch',trace:false,cases}).results;cases.forEach((c,i)=>{assert.throws(()=>R.run(c.payload,r,c.partial,false));assert.equal(results[i].ok,0);invalid++;});}
 for(const rule of [B.respawnRule,B.normalV2Rule]){const s=new B.Battle(r,false,rule),used=[];for(const i of inputs){if(s.status!=='playing')break;s.step(i);used.push(i);}const payload=BR.encode(used,r,s);const got=php('cli-p1.php',{action:'batch',trace:true,cases:[{payload,partial:true}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,BR.run(payload,r,true,true));}
 for(const scene of E.scenes){const s=new E.Sim(r,scene,false,E.respawnRule),used=[];for(const i of inputs){if(s.status!=='playing')break;s.step(i);used.push(i);}const payload=C.encode(used,r,scene,false,E.respawnRule),p=php('cli.php',{action:'batch',cases:[{payload,partial:true}]}).results[0];assert.equal(p.ok,1);assert.deepEqual(p.data,C.run(payload,r,true));}
 fs.writeFileSync(path.join(out,'replays.json'),JSON.stringify(rows,null,2)+'\n');
});
const report={status:'PASS',checks,phaseFixtures:phases.length,missCases:misses.length,normalV1HashCases:14,budgets,invalidRejected:invalid,fullGameAutoPlay:false,naturalClearRun:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
