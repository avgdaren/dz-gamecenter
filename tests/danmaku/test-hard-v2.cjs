/* (C) 2026 Carinoasd. Hard v2 variations and local invincibility checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json')),S=require(path.join(base,'stage.js')),H=require(path.join(base,'hard-patterns.js')),P=require(path.join(base,'hard-rich-patterns.js')),T=require(path.join(base,'test-mode.js')),R=require(path.join(base,'stage-replay.js'));
const checks=[],plain=x=>JSON.parse(JSON.stringify(x)),caps=[],kinds={};
function test(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
test('eight distinct palettes render all seven silhouettes; every style has an outlined core',()=>{
 assert.equal(Object.keys(P.palette).length,8);assert.equal(new Set(Object.values(P.palette).map(v=>v.color)).size,8);assert.equal(new Set(Object.values(P.palette).map(v=>v.shape)).size,7);
 for(const kind of r.hard02.bulletKinds){let strokes=0,fills=0;const c=new Proxy({stroke(){strokes++;},fill(){fills++;}},{get:(o,k)=>k in o?o[k]:()=>{}});assert.equal(P.bullet(c,{kind,radius:4,x:0,y:0,vx:12,vy:192}),true);assert.ok(strokes>=2&&fills>=1);}
});
test('32 phase/assist/music slices with actual weapons, movement and bombs match PHP exactly',()=>{
 const cases=[],expected=[];
 for(const index of [-1,0,1,2])for(const assist of [false,true])for(const musicTick of [0,2700,5800,12180]){
  const c={rule:S.hardV2Rule,index,assist,musicTick,power:16,inputs:Array.from({length:360},(_,i)=>({dx:i%100<50?64:-64,dy:0,flags:(i%100<50?1:0)|(i===200?2:0)}))};
  const s=new S.Sim(r,index,assist,c.rule);s.player.power=16;s.player.invulUntil=100000;s.musicTick=musicTick;const trace=[];
  for(const input of c.inputs){s.step(input);if(s.tick%60===0)trace.push(plain(s.snapshot()));}cases.push(c);expected.push(trace);
 }
 assert.deepEqual(php('hard-fixtures.php',{cases}),expected);
});
test('all music sections retain the 360 live limit and every phase uses both variants and multiple kinds',()=>{
 for(const index of [0,1,2])for(const assist of [false,true]){
  const s=new S.Sim(r,index,assist,S.hardV2Rule),seen=new Set(),variants=[0,0];let peak=0;
  for(let t=1;t<=13020;t++){
   s.tick=t;s.musicTick=t;s.boss.x=240*64;const previous=s.nextEnemy;s.pattern();
   if(s.nextEnemy>previous){const cue=H.cue(r.hard01.bossPulses,t);assert.ok(cue);variants[Math.floor(cue[1]/16)%2]++;for(const e of s.enemies)if(e.id>=previous){seen.add(e.kind);assert.ok(P.palette[e.kind]);}}
   s.enemies=s.enemies.filter(e=>{e.x+=e.vx;e.y+=e.vy;const margin=r.field.enemyCullMargin*64;return t-e.born+1<e.ttl&&e.x>=-margin&&e.x<=480*64+margin&&e.y>=-margin&&e.y<=640*64+margin;});peak=Math.max(peak,s.enemies.length);
  }
  assert.ok(peak<=360);assert.ok(seen.size>=6);assert.ok(variants.every(v=>v>0));caps.push({index,assist,peak,spawned:s.stats.enemySpawned,variants});kinds[index]=[...seen].sort((a,b)=>a-b);
 }
});
test('Hard v1 delivered rules and snapshots are preserved',()=>{
 const file=path.join(__dirname,'fixtures/legacy-hard/stage-hard-v1.js'),source=fs.readFileSync(file,'utf8');assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'b57df5f6226574edbde663ebc5e944e24254d04daee56463259163d2c2179281');
 const sandbox={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(source,sandbox);const Old=sandbox.module.exports;
 for(const index of [-1,0,1,2]){const a=new Old.Sim(r,index,false,S.hardRule),b=new S.Sim(r,index,false,S.hardRule);for(const s of [a,b])s.player.invulUntil=100000;for(let t=0;t<720;t++){const input={dx:t%120<60?64:-64,dy:0,flags:t%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
});
test('test switch protects bullets in all current difficulties and phases, then immediately restores collision',()=>{
 for(const rule of [S.cornerRule,S.normalCornerRule,S.hardRule,S.hardV2Rule,S.hardV3Rule])for(const index of [-1,0,1,2]){
  const s=new S.Sim(r,index,false,rule),state=T.create();s.player.invulUntil=0;s.player.power=16;s.player.bombs=0;const power=s.player.power,lives=s.player.lives;
  s.spawn(s.player.x,s.player.y,0,0,4);s.spawn(s.player.x,s.player.y,0,0,4);
  T.toggle(state,true);T.apply(state,s);s.step({dx:0,dy:0,flags:0});assert.equal(s.player.lives,lives);assert.equal(s.stats.hitsTaken,0);assert.equal(s.player.power,power);assert.equal(s.player.bombs,0);assert.equal(s.stats.graze,0);assert.equal(s.player.invulUntil,0);
  T.toggle(state,false);T.apply(state,s);s.step({dx:0,dy:0,flags:0});assert.equal(s.player.lives,lives-1);assert.equal(s.stats.hitsTaken,1);assert.equal(s.player.bombs,2);assert.throws(()=>T.assertReplay(state),/测试局/);
  T.reset(state);assert.equal(state.enabled,false);assert.doesNotThrow(()=>T.assertReplay(state));
 }
});
test('test switch also prevents enemy body hits; turning it off preserves genuine bomb protection',()=>{
 const s=new S.Sim(r,-1,false,S.hardV2Rule),state=T.create();s.tick=149;s.player.invulUntil=0;
 const [x,y]=r.stage01.paths[0][150];s.player.x=s.player.px=x;s.player.y=s.player.py=y;
 s.mobs.push({id:1,type:0,born:0,baseX:0,mirror:false,reward:0,hp:32,aim:128,warningUntil:0,warningKind:0,x,px:x,y,py:y});
 T.toggle(state,true);T.apply(state,s);s.step({dx:0,dy:0,flags:0});assert.equal(s.stats.hitsTaken,0);
 // Use an existing configured mob ID for any later pattern update.
 s.mobs=[];s.step({dx:0,dy:0,flags:2});const genuine=s.player.invulUntil;assert.ok(genuine>s.tick);
 T.toggle(state,false);T.apply(state,s);s.spawn(s.player.x,s.player.y,0,0,4);s.step({dx:0,dy:0,flags:0});assert.equal(s.stats.hitsTaken,0);assert.equal(s.player.invulUntil,genuine);assert.throws(()=>T.assertReplay(state));
});
test('ordinary v2 replays work; test flags, altered scores and unknown rule versions fail',()=>{
 const b=new S.Stage(r,false,S.hardV2Rule),inputs=Array.from({length:480},(_,i)=>({dx:i%90<45?64:-64,dy:0,flags:i%90<45?1:0}));for(const input of inputs)b.step(input);
 const good=R.encode(inputs,r,b),cases=[{payload:good,partial:true}];for(const delta of [{score:good.score+1},{testInvincible:true},{testMode:true},{rule:'danmaku-stage01-hard-r999'}])cases.push({payload:{...good,...delta},partial:true});
 const got=php('cli-stage01.php',{action:'batch',trace:true,cases}).results;assert.equal(got[0].ok,1);assert.deepEqual(got[0].data,R.run(good,r,true,true));assert.ok(got.slice(1).every(v=>v.ok===0));
 for(const c of cases.slice(1))assert.throws(()=>R.run(c.payload,r,true,false));assert.equal(S.rankedRules.includes(S.hardV2Rule),false);
});
const folder=path.join(root,'tmp/danmaku/hard-v2');fs.mkdirSync(folder,{recursive:true});const report={status:'PASS',checks,caps,kinds,naturalClearRun:false,browserVerified:false};fs.writeFileSync(path.join(folder,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
