/* (C) 2026 Carinoasd. Bounded Boss r3 checks, no auto-play: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=JSON.parse(fs.readFileSync(path.join(base,'rules.json'),'utf8'));
const S=require(path.join(base,'stage.js')),B=require(path.join(base,'battle.js')),E=require(path.join(base,'engine.js'));
const R=require(path.join(base,'stage-replay.js')),BR=require(path.join(base,'battle-replay.js')),C=require(path.join(base,'replay.js'));
const out=path.join(root,'tmp/danmaku/boss-r3');fs.mkdirSync(out,{recursive:true});
const zero={dx:0,dy:0,flags:1},checks=[];
function test(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function php(file,packet){const r=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(packet),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(r.status,0,r.error?.message||r.stderr||r.stdout);return JSON.parse(r.stdout);}
test('r3 is separate from the two old rules, and every phase replacement retains the revision',()=>{
 const oldStageRules=['danmaku-stage01-r1','danmaku-stage01-r2','danmaku-stage01-r3'];
 assert.ok(oldStageRules.every(rule=>S.supportedRules.includes(rule)));
 for(const rule of oldStageRules){const b=new S.Stage(rules,false,rule);for(const i of [0,1,2]){b.replace(i);assert.equal(b.sim.patternV3,rule===S.patternRule);assert.equal(b.sim.bombMode,rule!==S.rule);}}
 for(const rule of [B.rule,B.focusRule,B.patternRule]){const b=new B.Battle(rules,false,rule);for(let i=0;i<3;i++){assert.equal(b.sim.patternV3,rule===B.patternRule);if(i<2)b.nextPhase();}}
});
test('three attack signatures use separate geometries and genuine warning/gap windows',()=>{
 const a=new S.Sim(rules,0,false,S.patternRule);a.tick=45;a.pattern();assert.ok(a.enemies.length>=20);assert.ok(a.enemies.every(e=>e.radius===4));
 assert.ok(a.enemies.some(e=>e.vy<0)&&a.enemies.some(e=>e.vx<0)&&a.enemies.some(e=>e.vx>0));
 const b=new S.Sim(rules,1,false,S.patternRule);b.tick=30;b.pattern();assert.equal(b.warningUntil,66);assert.equal(b.enemies.length,0);
 b.tick=65;b.pattern();assert.equal(b.enemies.length,0);b.tick=66;b.pattern();assert.equal(b.enemies.length,5);assert.ok(b.enemies.every(e=>e.radius===3&&e.vy>0));
 for(const c of [0,1,2,3]){const s=new S.Sim(rules,2,false,S.patternRule);s.tick=c*360+30;s.pattern();const gap=rules.bossPatternsR3[2].gapCenters[c];assert.equal(s.enemies.length,14);assert.ok(s.enemies.every(e=>e.vx===0&&Math.abs(e.x/64-gap)>48));}
});
const budgets=[];
test('max-duration attack-only fixtures stay inside live/spawn caps without a player run',()=>{
 for(const index of [-1,0,1,2]){
  const s=new S.Sim(rules,index,false,S.patternRule),ticks=index<0?4320:4200;
  for(let t=1;t<=ticks;t++){
   s.tick=t;s.boss.px=s.boss.x;s.boss.x=E.bossX(t);s.pattern();
   s.enemies.forEach(e=>{e.x+=e.vx;e.y+=e.vy;});
   s.enemies=s.enemies.filter(e=>t-e.born<e.ttl&&e.x>=-32*64&&e.x<=512*64&&e.y>=-32*64&&e.y<=672*64);
  }
  budgets.push({index,spawned:s.stats.enemySpawned,livePeak:s.stats.enemyPeak});
 }
 assert.ok(budgets.reduce((n,b)=>n+b.spawned,0)<=rules.limits.enemySpawnCap);
 assert.ok(budgets.every(b=>b.livePeak<=rules.limits.enemyLiveCap));
});
const fixtureCases=[],expected=[];
for(const kind of ['stage','practice'])for(const assist of [false,true])for(const index of [0,1,2]){
 const rule=kind==='stage'?S.patternRule:B.patternRule;
 fixtureCases.push({kind,assist,index,rule,ticks:720});
 const s=kind==='stage'?new S.Sim(rules,index,assist,rule):new B.Phase(rules,index,assist,true,true);
 s.player.invulUntil=1000000;const trace=[];for(let t=0;t<720;t++){s.step(zero);if(s.tick%60===0)trace.push(s.snapshot());}expected.push(trace);
}
test('12 isolated stage/practice phases match PHP at every 60 ticks, standard and assist',()=>{
 assert.deepEqual(php('boss-r3-fixtures.php',fixtureCases),JSON.parse(JSON.stringify(expected)));
});
const actualFile=path.join(__dirname,'fixtures/r2-automated-input.json');
const oldPayload=JSON.parse(fs.readFileSync(actualFile,'utf8')),oldRecords=C.decodeInputs(oldPayload.ticks,oldPayload.input,rules,rules.stage01.maxTicks);
const stage=new S.Stage(rules,false,S.patternRule),records=[];
for(const input of oldRecords.slice(0,4900)){if(stage.status!=='playing')break;stage.step(input);records.push(input);}
const stagePayload=R.encode(records,rules,stage);
const practice=new B.Battle(rules,false,B.patternRule),practiceRecords=[];
for(let t=0;t<1080&&practice.status==='playing';t++){practice.step(zero);practiceRecords.push(zero);}
const practicePayload=BR.encode(practiceRecords,rules,practice);
test('legal existing input prefix and new practice payload are accepted and match PHP',()=>{
 const a=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload:stagePayload,partial:true}]}).results[0];assert.equal(a.ok,1);assert.deepEqual(a.data,R.run(stagePayload,rules,true,true));
 const b=php('cli-p1.php',{action:'batch',trace:true,cases:[{payload:practicePayload,partial:true}]}).results[0];assert.equal(b.ok,1);assert.deepEqual(b.data,BR.run(practicePayload,rules,true,true));
});
test('invalid new-rule score, version, fields, input and encoding are rejected in both runtimes',()=>{
 const bad=[{...stagePayload,score:stagePayload.score+1},{...stagePayload,rule:'danmaku-stage01-r99'},
  {...stagePayload,assist:1},{...stagePayload,score:rules.stage01.bombScoreUpperBound+1},
  {...stagePayload,phase:2},{...stagePayload,input:'!!!!'},{...stagePayload,ticks:0},
  {...stagePayload,input:Buffer.from([255,127,0,0,0]).toString('base64'),ticks:1}];
 const result=php('cli-stage01.php',{action:'batch',trace:false,cases:bad.map(payload=>({payload,partial:true}))}).results;
 bad.forEach((payload,i)=>{assert.throws(()=>R.run(payload,rules,true,false));assert.equal(result[i].ok,0);});
 const badP=[{...practicePayload,score:practicePayload.score+1},{...practicePayload,phase:1},{...practicePayload,rule:'danmaku-p1-r99'}];
 const p=php('cli-p1.php',{action:'batch',trace:false,cases:badP.map(payload=>({payload,partial:true}))}).results;
 badP.forEach((payload,i)=>{assert.throws(()=>BR.run(payload,rules,true,false));assert.equal(p[i].ok,0);});
});
test('existing completed r2 replay still matches its archived JS and the current PHP verifier',()=>{
 const legacy=require(path.join(__dirname,'fixtures/legacy-stage01-r2/stage-replay.js')),oldRules=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/legacy-stage01-r2/rules.json'),'utf8'));
 const expected=legacy.run(oldPayload,oldRules,false,false),current=R.run(oldPayload,rules,false,false);assert.deepEqual(current,expected);
 const verified=php('cli-stage01.php',{action:'batch',trace:false,cases:[{payload:oldPayload,partial:false}]}).results[0];assert.equal(verified.ok,1);assert.deepEqual(verified.data,current);
});
const report={status:'PASS',checks,budgets,phaseFixtureCases:12,invalidRejected:11,oldR2ReplayPreserved:true,newRule:S.patternRule,
 partialPrefixTicks:records.length,newPracticeTicks:practiceRecords.length,newNaturalClearRun:false,browserAutoPlay:false};
fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
