/* (C) 2026 Carinoasd. Unranked Hard timing / compatibility checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json')),S=require(path.join(base,'stage.js')),H=require(path.join(base,'hard-patterns.js')),R=require(path.join(base,'stage-replay.js')),A=require(path.join(base,'audio.js'));
const checks=[],plain=x=>JSON.parse(JSON.stringify(x));
function test(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:128*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
const git=['-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897'];
function previous(name){return execFileSync('git',[...git,'show','27b6500:source/plugin/gamecenter/games/_danmaku_proto/'+name],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024});}
test('Hard is a separate unranked version; only hard01 is appended; assets and music are identical',()=>{
 const {hard01,hard02,hard03,...old}=r;assert.deepEqual(old,JSON.parse(previous('rules.json')));assert.equal(hard01.ranked,false);assert.equal(S.rankedRules.includes(S.hardRule),false);
 for(const name of ['bgm-bank.js','audio.js','engine.js','battle.js','weapons.js','boss-patterns.js'])assert.equal(fs.readFileSync(path.join(base,name),'utf8').replace(/\r\n/g,'\n'),previous(name).replace(/\r\n/g,'\n'));
 for(const key of ['stage','boss']){const f=path.join(root,'docs/danmaku/audio/stage01-happyshrimp-v1',key==='stage'?'stage.mp3':'bossCore.mp3');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),hard01.music[key].sha256);}
 const b=new S.Stage(r,false,S.hardRule);assert.equal(b.rules.stage01.schedule.reduce((n,m)=>n+m.reward,0),26);assert.ok(b.sim.cornerMode&&b.sim.collectMode&&b.sim.wideWeaponMode&&b.sim.respawnBombs);assert.equal(b.sim.player.lives,r.player.standardLives);assert.equal(b.sim.player.bombs,2);
});
test('stage enemy births and every shot follow measured beat cues; warnings precede fire',()=>{
 const beats=new Set(r.hard01.stageBeats.map(c=>c[0]));let count=0;
 for(const m of r.hard01.schedule){assert.ok(beats.has(m.at));for(const a of r.hard01.attacks[m.id]){assert.ok(beats.has(m.at+a.at));assert.equal(a.at-a.warning,30);assert.ok(a.warning>=0&&a.at<r.stage01.types[m.type].life);count++;}}
 for(const rows of [r.hard01.stageBeats,r.hard01.bossPulses])for(let i=0;i<rows.length;i++){assert.ok(Number.isInteger(rows[i][0]));assert.ok(!i||rows[i][0]>rows[i-1][0]);assert.deepEqual(H.cue(rows,rows[i][0]),rows[i]);}
 assert.ok(count>100);
});
let phaseCases=[];
test('32 focused/moving/weapon/assist and late-music slices agree exactly in JS and PHP',()=>{
 const expected=[];
 for(const index of [-1,0,1,2])for(const assist of [false,true])for(const musicTick of [0,2870,12180,12600]){
  const c={index,assist,musicTick,power:16,inputs:Array.from({length:360},(_,i)=>({dx:i%120<60?64:-64,dy:0,flags:(i%120<60?1:0)|(i===121?2:0)}))};
  const s=new S.Sim(r,index,assist,S.hardRule);s.musicTick=musicTick;s.player.power=16;s.player.invulUntil=100000;const trace=[];
  for(const input of c.inputs){s.step(input);if(s.tick%60===0)trace.push(plain(s.snapshot()));}phaseCases.push(c);expected.push(trace);
 }
 assert.deepEqual(php('hard-fixtures.php',{cases:phaseCases}),expected);
});
const caps=[];
test('Hard prelude emits only on music beats and remains within its live cap without kills',()=>{
 const s=new S.Sim(r,-1,false,S.hardRule),beats=new Set(r.hard01.stageBeats.map(c=>c[0]));
 for(let tick=1;tick<=4320;tick++){
  s.tick=tick;const before=s.stats.enemySpawned;s.pattern();if(s.stats.enemySpawned>before)assert.ok(beats.has(tick));
  s.enemies=s.enemies.filter(e=>{e.x+=e.vx;e.y+=e.vy;return tick-e.born+1<e.ttl&&e.x>=-64*64&&e.x<=544*64&&e.y>=-64*64&&e.y<=704*64;});
 }
 assert.equal(s.stats.mobSpawned,40);assert.ok(s.stats.enemyPeak<=r.hard01.preludeEnemyCap);caps.push({index:-1,assist:false,peak:s.stats.enemyPeak,spawned:s.stats.enemySpawned});
});
test('all music sections and loop stay inside existing 360 boss live cap; no off-cue boss fire',()=>{
 for(const index of [0,1,2])for(const assist of [false,true]){
  const s=new S.Sim(r,index,assist,S.hardRule);let peak=0,spawned=0;
  for(let tick=1;tick<=13020;tick++){
   s.tick=tick;s.musicTick=tick;s.boss.x=240*64;const old=s.stats.enemySpawned;s.pattern();
   if(s.stats.enemySpawned>old){assert.ok(H.cue(r.hard01.bossPulses,tick));spawned+=s.stats.enemySpawned-old;}
   s.enemies=s.enemies.filter(e=>{e.x+=e.vx;e.y+=e.vy;return tick-e.born+1<e.ttl&&e.x>=-64*64&&e.x<=544*64&&e.y>=-64*64&&e.y<=704*64;});peak=Math.max(peak,s.enemies.length);
  }
  assert.ok(peak<=360);caps.push({index,assist,peak,spawned});
 }
});
test('music clock matches the audio plan through opening and transitions',()=>{
 const b=new S.Stage(r,false,S.hardRule),input={dx:0,dy:0,flags:0};
 b.tick=4319;b.sim.tick=4319;b.sim.musicTick=4319;b.sim.player.invulUntil=100000;b.step(input);assert.equal(b.stage,'opening');assert.equal(b.sim.musicTick,0);
 for(let i=0;i<180;i++)b.step(input);assert.equal(b.stage,'active');assert.equal(b.sim.musicTick,180);
 b.sim.hp=0;b.step(input);assert.equal(b.stage,'transition');const before=b.sim.musicTick;
 for(let i=0;i<120;i++)b.step(input);assert.equal(b.sim.musicTick,before+120);
 const view={scene:'stage',mode:'running',status:'playing',stage:b.stage,tick:b.tick,preludeTicks:4320,phase:b.phaseIndex};assert.equal(A.plan(view,true).offset,b.sim.musicTick/60);
 assert.equal(b.sim.tick,0);b.step(input);assert.equal(b.sim.musicTick,before+121);
});
test('all sixteen existing rule versions retain pre-change snapshots and scores',()=>{
 const sandbox={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(previous('stage.js'),sandbox);const Old=sandbox.module.exports;
 for(const rule of Old.supportedRules)for(const index of [-1,0,1,2]){
  const a=new Old.Sim(r,index,false,rule),b=new S.Sim(r,index,false,rule);for(const s of [a,b]){s.player.invulUntil=100000;s.player.power=16;}
  for(let i=0;i<360;i++){const input={dx:i%120<60?64:-64,dy:0,flags:i%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));
 }
});
test('Hard uses the same respawn stock rules for every phase and assist mode',()=>{
 const cases=[],expected=[];
 for(const index of [-1,0,1,2])for(const assist of [false,true])for(const stock of [0,1,3])for(const lives of [1,3]){
  const c={kind:'stage',index,assist,stock,lives,rule:S.hardRule},s=new S.Sim(r,index,assist,S.hardRule);s.player.bombs=stock;s.player.lives=lives;s.player.invulUntil=0;
  for(let i=0;i<2;i++)s.spawn(s.player.x,s.player.y,0,0,4);s.step({dx:0,dy:0,flags:1});
  assert.equal(s.player.lives,lives-1);assert.equal(s.player.bombs,lives===1?stock:assist?3:2);assert.equal(s.stats.hitsTaken,1);
  cases.push(c);expected.push({stock:s.player.bombs,lives:s.player.lives,taken:s.stats.hitsTaken,used:s.stats.bombsUsed,collected:s.stats.bombCollected||0,status:s.status});
 }
 assert.deepEqual(php('revision-fixtures.php',{action:'respawn',cases}),expected);
});
test('legal Hard replay passes, tampered rule/score/fields fail; forum bridge rejects Hard',()=>{
 const b=new S.Stage(r,false,S.hardRule),inputs=Array.from({length:480},(_,i)=>({dx:i%120<60?64:-64,dy:0,flags:i%90<45?1:0}));for(const input of inputs)b.step(input);
 const payload=R.encode(inputs,r,b),data=R.run(payload,r,true,true),got=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload,partial:true}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,data);
 const bad=[{...payload,score:payload.score+1},{...payload,musicTick:480},{...payload,ranked:true},{...payload,rule:'danmaku-stage01-hard-r99'}];
 for(const p of bad){assert.throws(()=>R.run(p,r,true,false));}
 const rejected=php('cli-stage01.php',{action:'batch',trace:false,cases:bad.map(payload=>({payload,partial:true}))});assert.ok(rejected.results.every(x=>x.ok===0));
 const forum=php('test-handoff-bridge.php',[{seed:1,data:{...payload,stage:1,assist:0}}]);assert.equal(forum[0].ok,0);
 assert.throws(()=>R.run(payload,r,false,false),/尚未自然结束/);
 const ended=new S.Stage(r,false,S.hardRule),records=[];
 while(ended.status==='playing'&&ended.tick<4320){const input={dx:0,dy:0,flags:0};records.push(input);ended.step(input);}
 assert.equal(ended.status,'dead');const complete=R.encode(records,r,ended);
 const terminal=php('cli-stage01.php',{action:'batch',trace:false,cases:[{payload:complete,partial:false}]}).results[0];
 assert.equal(terminal.ok,1);assert.deepEqual(terminal.data,R.run(complete,r,false,false));
});
const out=path.join(root,'tmp/danmaku/hard-v1');fs.mkdirSync(out,{recursive:true});const report={status:'PASS',checks,phaseCases:phaseCases.length,caps,naturalClearRun:false,forumInstalled:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
