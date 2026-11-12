/* (C) 2026 Carinoasd. Five-level and binding behavior checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json'));
const S=require(path.join(base,'stage.js')),R=require(path.join(base,'stage-replay.js')),C=require(path.join(base,'replay.js')),K=require(path.join(base,'controls.js'));
const checks=[];function test(name,f){f();checks.push(name);console.log('PASS '+name);}function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
test('focus binding supports both default Shifts, ordinary remaps, rejects conflicts and malformed storage',()=>{
 assert.equal(K.normalize('ShiftRight'),'Shift');assert.equal(K.matches('ShiftLeft','Shift'),true);assert.equal(K.matches('ShiftRight','Shift'),true);
 assert.equal(K.normalize('KeyZ'),'KeyZ');assert.equal(K.matches('KeyZ','KeyZ'),true);assert.equal(K.matches('ShiftLeft','KeyZ'),false);assert.equal(K.label('KeyZ'),'Z');
 for(const key of ['KeyW','KeyA','KeyS','KeyD','KeyX','Escape','Space','Tab','Enter','ControlLeft','AltRight','MetaLeft','ArrowLeft','F5','Unidentified'])assert.equal(K.normalize(key),null,key);
 for(const raw of [null,'','bad','{}','null','{"focus":"KeyX"}','{"focus":3}'])assert.equal(K.fromStored(raw),'Shift');
 assert.equal(K.fromStored('{"focus":"KeyZ"}'),'KeyZ');assert.equal(K.fromStored('{"focus":"ShiftRight"}'),'Shift');assert.equal(K.normalize('Digit2'),'Digit2');
});
test('new growth adds levels 4 and 5 without modifying earlier rules or Normal attacks',()=>{
 const {power05,weapons06,weapons07,collect08,corner09,...rest}=r;const old=JSON.parse(require('node:child_process').execFileSync('git',['-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897','show','1d1bbb88600ff956314ba04245220eabe529438a:source/plugin/gamecenter/games/_danmaku_proto/rules.json'],{cwd:root,encoding:'utf8'}));assert.deepEqual(rest,old);
 assert.deepEqual(power05.levels.slice(0,3),r.stage01.growth.levels);assert.deepEqual(power05.thresholds,[0,3,8,12,16]);
 for(const rule of [S.powerRule,S.normalPowerRule]){const b=new S.Stage(r,false,rule);assert.equal(b.rules.stage01.growth.levels.length,5);assert.equal(b.sim.respawnBombs,true);for(const i of [0,1,2]){b.replace(i);assert.equal(b.sim.rules.stage01.growth.maxPower,16);assert.equal(b.sim.normalRevision,rule===S.normalPowerRule?2:0);}}
 assert.equal(new S.Stage(r,false,S.normalV2Rule).rules.stage01.growth.maxPower,8);
});
test('all thresholds, focused/scatter ray counts and damage budgets grow monotonically',()=>{
 const s=new S.Sim(r,0,false,S.normalPowerRule),g=s.rules.stage01.growth;
 for(let power=0;power<=18;power++){const expected=power>=16?5:power>=12?4:power>=8?3:power>=3?2:1;assert.equal(S.level(power,s.rules),expected);}
 for(let lv=0;lv<5;lv++)for(const flags of [0,1]){s.shots=[];s.tick=1;s.player.power=g.thresholds[lv];s.fire({dx:0,dy:0,flags});assert.equal(s.shots.length,3+lv*2);assert.equal(s.shots.reduce((n,x)=>n+x.damage,0),[10,14,18,22,26][lv]);}
});
const inputs=Array.from({length:360},(_,i)=>({dx:i%180<90?64:-64,dy:0,flags:i%120<60?1:0})),cases=[];
for(const rule of [S.powerRule,S.normalPowerRule])for(const index of [-1,0,1,2])for(const assist of [false,true])cases.push({rule,index,assist,inputs});
test('16 isolated level-5 stage/Boss standard/assist fixtures match PHP',()=>{
 const expected=cases.map(c=>{const s=new S.Sim(r,c.index,c.assist,c.rule);s.player.power=16;s.player.invulUntil=1000000;const trace=[];for(const i of c.inputs){s.step(i);if(s.tick%60===0)trace.push(s.snapshot());}return trace;});assert.deepEqual(php('power5-fixtures.php',{action:'phases',cases}),JSON.parse(JSON.stringify(expected)));
});
test('full-power death drops one level, respawns bombs, recovery restores level 5 without duplicate score',()=>{
 const expected=cases.map(c=>{const s=new S.Sim(r,c.index,c.assist,c.rule);s.player.power=16;s.player.bombs=0;s.spawn(s.player.x,s.player.y,0,0,4);s.step({dx:0,dy:0,flags:1});const hit={level:S.level(s.player.power,s.rules),power:s.player.power,stock:s.player.bombs,lives:s.player.lives,drops:s.snapshot().drops};assert.equal(hit.level,4);assert.equal(hit.power,12);assert.equal(hit.stock,c.assist?3:2);s.collect({kind:0,value:4,recovery:true});const recovered=s.player.power;assert.equal(recovered,16);s.collect({kind:0,value:4,recovery:false});s.collect({kind:0,value:4,recovery:true});assert.equal(s.stats.overflowScoreUnits,4);return{hit,recovered,power:s.player.power,overflowScoreUnits:s.stats.overflowScoreUnits,level:S.level(s.player.power,s.rules)};});assert.deepEqual(php('power5-fixtures.php',{action:'boundaries',cases}),expected);
});
let shotPeak=0;test('continuous level-5 bottom-edge fire stays below the isolated 192-shot cap',()=>{
 for(const focused of [false,true]){const s=new S.Sim(r,-1,false,S.normalPowerRule);s.player.power=16;s.player.x=s.player.px=12*64;s.player.y=s.player.py=624*64;s.player.invulUntil=1000000;for(let t=0;t<600;t++){s.step({dx:0,dy:0,flags:focused?1:0});shotPeak=Math.max(shotPeak,s.shots.length);}assert.ok(shotPeak<s.rules.stage01.shotCap);}
});
let rejected=0;test('new legal replay prefixes pass and level/score/field tampering is rejected by both runtimes',()=>{
 const old=require('./fixtures/r2-automated-input.json'),records=C.decodeInputs(old.ticks,old.input,r,r.stage01.maxTicks);
 for(const rule of [S.powerRule,S.normalPowerRule]){const s=new S.Stage(r,false,rule),used=[];for(const input of records.slice(0,2300)){if(s.status!=='playing')break;s.step(input);used.push(input);}const payload=R.encode(used,r,s),partial=s.status==='playing';const got=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload,partial}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,R.run(payload,r,partial,true));const bad=[{...payload,score:payload.score+1},{...payload,power:16},{...payload,level:5},{...payload,rule:'danmaku-stage01-r999'},{...payload,input:'!!!!'},{...payload,assist:0}];const results=php('cli-stage01.php',{action:'batch',trace:false,cases:bad.map(payload=>({payload,partial:true}))}).results;bad.forEach((p,i)=>{assert.throws(()=>R.run(p,r,true,false));assert.equal(results[i].ok,0);rejected++;});}
});
const out=path.join(root,'tmp/danmaku/title-power-v1');fs.mkdirSync(out,{recursive:true});const report={status:'PASS',checks,phaseFixtures:cases.length,boundaryFixtures:cases.length,invalidRejected:rejected,shotPeak,fullGameAutoPlay:false,naturalClearRun:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
