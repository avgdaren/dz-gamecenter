/* (C) 2026 Carinoasd. Normal/legacy bounded checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=require(path.join(base,'rules.json')),S=require(path.join(base,'stage.js')),B=require(path.join(base,'battle.js')),E=require(path.join(base,'engine.js'));
const R=require(path.join(base,'stage-replay.js')),BR=require(path.join(base,'battle-replay.js')),codec=require(path.join(base,'replay.js'));
const legacy=path.join(__dirname,'fixtures/legacy-stage01-r3'),oldRules=require(path.join(legacy,'rules.json')),LS=require(path.join(legacy,'stage.js')),LB=require(path.join(legacy,'battle.js'));
const out=path.join(root,'tmp/danmaku/normal-v1');fs.mkdirSync(out,{recursive:true});
function php(file,packet){const r=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(packet),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.error?.message||r.stderr);return JSON.parse(r.stdout);}
const checks=[];function test(name,f){f();checks.push(name);console.log('PASS '+name);}
const zero={dx:0,dy:0,flags:1};
// Move a little, release focus, and use a bomb; never run a whole natural-clear route.
const inputs=Array.from({length:960},(_,i)=>({dx:i%240<80?64:i%240<160?-64:0,dy:0,flags:i===240?3:i%180<120?1:0}));
test('Normal is versioned separately and leaves every old rule value/resource unchanged',()=>{
 const {normal01,normal02,power05,weapons06,weapons07,...rest}=rules;assert.deepEqual(rest,oldRules);
 assert.equal(S.normalRule,normal01.stageRule);assert.equal(B.normalRule,normal01.practiceRule);
 for(const rule of [S.patternRule,S.normalRule]){const b=new S.Stage(rules,false,rule);assert.equal(b.sim.player.lives,3);assert.equal(b.sim.player.bombs,2);for(const i of [0,1,2]){b.replace(i);assert.equal(b.sim.normalMode,rule===S.normalRule);}}
 const original=JSON.stringify(rules);new S.Stage(rules,true,S.normalRule);new B.Battle(rules,false,B.normalRule);assert.equal(JSON.stringify(rules),original);
});
const cases=[],expected=[];
for(const assist of [false,true])for(const kind of ['stage','practice'])for(const index of kind==='stage'?[-1,0,1,2]:[0,1,2]){
 const s=kind==='stage'?new S.Sim(rules,index,assist,S.normalRule):new B.Phase(rules,index,assist,true,true,true);
 s.player.invulUntil=1000000;const trace=[];for(const input of inputs){s.step(input);if(s.tick%60===0)trace.push(s.snapshot());}
 cases.push({kind,index,assist,inputs});expected.push(trace);
}
test('14 isolated Normal prelude/Boss/practice fixtures match PHP through moving, focus and bomb events',()=>assert.deepEqual(php('normal-fixtures.php',cases),JSON.parse(JSON.stringify(expected))));
test('all old stage and practice revisions match the frozen pre-Normal simulators',()=>{
 for(const assist of [false,true]){
  for(const rule of LS.supportedRules)for(const index of [-1,0,1,2]){
   const a=new S.Sim(rules,index,assist,rule),b=new LS.Sim(oldRules,index,assist,rule);a.player.invulUntil=b.player.invulUntil=1000000;
   for(const input of inputs){a.step(input);b.step(input);if(a.tick%120===0)assert.deepEqual(a.snapshot(),b.snapshot());}
  }
  for(const rule of LB.supportedRules){const a=new B.Battle(rules,assist,rule),b=new LB.Battle(oldRules,assist,rule);for(const input of inputs){a.step(input);b.step(input);if(a.tick%120===0)assert.deepEqual(a.snapshot(),b.snapshot());if(a.status!=='playing')break;}}
 }
});
const budgets=[];
test('attack-only maximum durations stay inside each Normal live cap and total spawn cap',()=>{
 for(const index of [-1,0,1,2]){
  const s=new S.Sim(rules,index,false,S.normalRule),ticks=index<0?4320:4200;
  for(let t=1;t<=ticks;t++){
   s.tick=t;s.boss.px=s.boss.x;s.boss.x=E.bossX(t);s.pattern();s.enemies.forEach(e=>{e.x+=e.vx;e.y+=e.vy;});
   s.enemies=s.enemies.filter(e=>t-e.born<e.ttl&&e.x>=-32*64&&e.x<=512*64&&e.y>=-32*64&&e.y<=672*64);
  }
  budgets.push({index,spawned:s.stats.enemySpawned,livePeak:s.stats.enemyPeak});
 }
 assert.ok(budgets.reduce((n,b)=>n+b.spawned,0)<rules.normal01.enemySpawnCap);
 assert.ok(budgets.every(b=>b.livePeak<(b.index<0?rules.normal01.preludeEnemyCap:rules.limits.enemyLiveCap)));
});
test('Normal removes the permanent downwards gap and preserves readable lock/gate travel windows',()=>{
 const p=rules.normal01.boss[0];assert.equal(new Set(p.gapAngles).size,3);
 const signatures=p.fireTicks.map(t=>{const s=new S.Sim(rules,0,false,S.normalRule);s.tick=t;s.pattern();return s.enemies.map(e=>[e.vx,e.vy]);});assert.notDeepEqual(signatures[0],signatures[1]);
 const s=new S.Sim(rules,1,false,S.normalRule);s.tick=24;s.pattern();assert.equal(s.warningUntil,54);assert.equal(s.enemies.length,0);s.tick=53;s.pattern();assert.equal(s.enemies.length,0);s.tick=54;s.pattern();assert.equal(s.enemies.length,7);
 const gate=rules.normal01.boss[2],travelWindow=gate.cycleTicks+gate.wallTicks[0]-gate.wallTicks.at(-1),safeHalfWidth=gate.gapHalfWidth+16-gate.wallRadius-rules.player.hitRadius;
 assert.ok(safeHalfWidth>=32);assert.ok(Math.max(...gate.gapCenters.map((x,i)=>Math.abs(x-gate.gapCenters[(i+1)%gate.gapCenters.length])))*64/rules.player.slowStepQ<travelWindow);
});
const normal=new S.Stage(rules,false,S.normalRule),records=[];
const oldPayload=require('./fixtures/r2-automated-input.json'),oldRecords=codec.decodeInputs(oldPayload.ticks,oldPayload.input,rules,rules.stage01.maxTicks);
for(const input of oldRecords.slice(0,4900)){if(normal.status!=='playing')break;normal.step(input);records.push(input);}
const payload=R.encode(records,rules,normal);
test('legal Normal natural-death replay passes strict JS/PHP end-state checks and cannot enter the Easy bridge',()=>{
 assert.equal(normal.status,'dead');
 const got=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload,partial:false}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,R.run(payload,rules,false,true));
 const bridge=require('../../docs/danmaku/handoff-v1/forum/submission-bridge.js');assert.equal(bridge.build(payload,normal.snapshot(),rules).ok,false);
});
const practice=new B.Battle(rules,false,B.normalRule),pr=[];for(const input of inputs){if(practice.status!=='playing')break;practice.step(input);pr.push(input);}const pp=BR.encode(pr,rules,practice);
test('Normal practice has a separate JS/PHP replay identity',()=>{const got=php('cli-p1.php',{action:'batch',trace:true,cases:[{payload:pp,partial:true}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,BR.run(pp,rules,true,true));});
let rejected=0;
test('wrong scores, unknown difficulty, malformed fields, illegal input and unfinished submissions are rejected',()=>{
 const bad=[{...payload,score:payload.score+1},{...payload,rule:'danmaku-stage01-normal-r99'},{...payload,difficulty:'easy'},{...payload,assist:1},{...payload,input:'!!!!'},
  {...payload,ticks:0},{...payload,input:Buffer.from([255,127,0,0,0]).toString('base64'),ticks:1}];
 const fresh=new S.Stage(rules,false,S.normalRule),short=Array.from({length:120},()=>zero);short.forEach(input=>fresh.step(input));
 const cases=bad.map(payload=>({payload,partial:true}));cases.push({payload:R.encode(short,rules,fresh),partial:false});
 const results=php('cli-stage01.php',{action:'batch',trace:false,cases}).results;
 cases.forEach((c,i)=>{assert.throws(()=>R.run(c.payload,rules,c.partial,false),'invalid case '+i);assert.equal(results[i].ok,0);rejected++;});
});
const report={status:'PASS',checks,normalPhaseFixtures:cases.length,legacyStageFixtures:24,legacyPracticeFixtures:6,budgets,invalidRejected:rejected,prefixTicks:records.length,practiceTicks:pr.length,browserAutoPlay:false,naturalClearRun:false};
fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
