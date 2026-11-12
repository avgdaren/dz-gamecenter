/* (C) 2026 Carinoasd. Top-corner attraction and legacy compatibility: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json')),S=require(path.join(base,'stage.js')),R=require(path.join(base,'stage-replay.js'));
const checks=[],plain=x=>JSON.parse(JSON.stringify(x)),git=['-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897'];function test(name,f){f();checks.push(name);console.log('PASS '+name);}function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
test('only corner09 is appended; both new rules retain power, points, stocks and difficulty',()=>{
 const old=JSON.parse(execFileSync('git',[...git,'show','7550203:source/plugin/gamecenter/games/_danmaku_proto/rules.json'],{cwd:root,encoding:'utf8'}));const {corner09,...rest}=r;assert.deepEqual(rest,old);
 for(const rule of [S.cornerRule,S.normalCornerRule]){const b=new S.Stage(r,false,rule);assert.equal(b.sim.cornerMode,true);assert.equal(b.sim.collectMode,true);assert.equal(b.sim.respawnBombs,true);assert.equal(b.rules.stage01.schedule.reduce((n,m)=>n+m.reward,0),26);assert.equal(S.scoreLimit(r,rule),331700);b.replace(1);assert.equal(b.sim.normalRevision,rule===S.normalCornerRule?2:0);}
});
const positions=[[96*64,192*64,true],[96*64+1,192*64,false],[384*64,192*64,true],[384*64-1,192*64,false],[48*64,192*64+1,false],[432*64,192*64+1,false],[240*64,144*64,false],[48*64,144*64,true],[432*64,144*64,true]],cases=[];
for(const rule of [S.cornerRule,S.normalCornerRule])for(const assist of [false,true])for(const flags of [0,1])for(const [x,y,armed] of positions)cases.push({rule,assist,flags,x,y,armed,leave:armed});
for(const rule of [S.collectRule,S.normalCollectRule])for(const flags of [0,1])for(const x of [48*64,432*64])cases.push({rule,assist:false,flags,x,y:160*64,armed:false,leave:false});
test('80 JS/PHP exact boundary cases attract all kinds, bypass unlock and continue after departure',()=>{
 const expected=cases.map(c=>{const b=new S.Stage(r,c.assist,c.rule),s=b.sim;s.player.x=s.player.px=c.x;s.player.y=s.player.py=c.y;
  for(const [kind,value,recovery] of [[0,1,false],[0,4,true],[1,1,false],[2,1,false]])s.drop(240*64,620*64,value,recovery,kind);s.tick=1;s.items({flags:c.flags});assert.equal(s.drops.every(d=>d.attracted),c.armed);assert.equal(s.stats.pointScore,0);if(c.armed)assert.ok(s.drops.every(d=>d.unlock===1));const first=plain(b.snapshot());
  if(c.leave){s.player.x=s.player.px=240*64;s.player.y=s.player.py=550*64;}
  for(let t=2;t<=80;t++){s.tick=t;s.items({flags:c.flags});}assert.equal(s.player.power,c.armed?5:0);assert.equal(s.player.bombs,c.armed?3:c.assist?3:2);assert.equal(s.stats.pointScore,c.armed?500:0);assert.equal(s.player.lives,c.assist?r.assist.lives:r.player.standardLives);return[first,plain(b.snapshot())];
 });assert.deepEqual(php('corner-fixtures.php',{cases}),expected);
});
test('holding the corner attracts future drops, expiry is respected and pickups award only once',()=>{
 const b=new S.Stage(r,false,S.cornerRule),s=b.sim;s.player.x=48*64;s.player.y=160*64;s.drop(240*64,500*64,1,false,2);for(let t=1;t<=80;t++){s.tick=t;s.items({flags:0});}assert.equal(b.score().points,500);s.drop(240*64,500*64,1,false,2);for(let t=81;t<=160;t++){s.tick=t;s.items({flags:0});}assert.equal(b.score().points,1000);assert.equal(s.stats.pointCollected,2);s.items({flags:0});assert.equal(b.score().points,1000);s.drop(240*64,500*64,1,false,2);s.tick+=900;s.items({flags:0});assert.equal(s.drops.length,0);assert.equal(b.score().points,1000);
});
test('all fourteen old rules keep snapshots and score behavior',()=>{
 const source=execFileSync('git',[...git,'show','7550203:source/plugin/gamecenter/games/_danmaku_proto/stage.js'],{cwd:root,encoding:'utf8'}),sandbox={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(source,sandbox);const O=sandbox.module.exports;
 for(const rule of O.supportedRules)for(const index of [-1,1]){const a=new O.Sim(r,index,false,rule),b=new S.Sim(r,index,false,rule);for(const s of [a,b]){s.player.power=16;s.player.invulUntil=100000;}for(let i=0;i<180;i++){const input={dx:i%60<30?64:-64,dy:0,flags:i%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
});
let rejected=0;test('legal corner movement prefixes pass and altered scores or auto-collect fields are rejected',()=>{
 for(const rule of [S.cornerRule,S.normalCornerRule]){const s=new S.Stage(r,false,rule),inputs=Array.from({length:180},(_,i)=>({dx:i>=102&&i<150?-256:0,dy:i<102?-256:0,flags:0}));for(const input of inputs)s.step(input);assert.ok(s.sim.player.x<=96*64&&s.sim.player.y<=192*64);const p=R.encode(inputs,r,s),got=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload:p,partial:true}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,R.run(p,r,true,true));const bad=[{...p,score:p.score+500},{...p,autoCollect:true},{...p,corner:true},{...p,rule:'danmaku-stage01-r999'}];const rows=php('cli-stage01.php',{action:'batch',trace:false,cases:bad.map(payload=>({payload,partial:true}))}).results;bad.forEach((v,i)=>{assert.throws(()=>R.run(v,r,true,false));assert.equal(rows[i].ok,0);rejected++;});}
});
const out=path.join(root,'tmp/danmaku/corner-v1');fs.mkdirSync(out,{recursive:true});const report={status:'PASS',checks,boundaryCases:cases.length,legacyCases:28,invalidRejected:rejected,naturalClearRun:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
