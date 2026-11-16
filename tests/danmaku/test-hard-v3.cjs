/* (C) 2026 Carinoasd. Choreography parity, lifecycle and short route checks: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json')),S=require(path.join(base,'stage.js')),C=require(path.join(base,'hard-choreography.js')),E=require(path.join(base,'engine.js')),R=require(path.join(base,'stage-replay.js')),M=require(path.join(base,'bullet-materials.js')),{choose}=require('./stage01-policy.cjs');
const plain=x=>JSON.parse(JSON.stringify(x)),checks=[],caps=[],routes=[];
function test(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:128*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
test('approved transparent atlas is byte-identical and six slots match blue/gold families',()=>{
 const bytes=fs.readFileSync(path.join(base,'assets/projectile-atlas-v1.png')),draft=fs.readFileSync(path.join(root,'../output/天使弹幕祭/制作参考/danmaku-material-study-v1/projectile-atlas-draft-v1.png'));assert.deepEqual(bytes,draft);assert.deepEqual(M.size,[1536,1024]);
 const calls=[],ctx=new Proxy({drawImage:(...args)=>calls.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}}),image={complete:true,naturalWidth:1536,naturalHeight:1024};
 for(let k=20;k<=25;k++)assert.equal(M.draw(ctx,image,{kind:k,x:0,y:0,vx:0,vy:128}),true);
 for(let i=0;i<6;i++){assert.equal(calls[i][1],Math.floor(i/2)*512);assert.equal(calls[i][2],i%2*512);}assert.equal(M.ready({...image,naturalWidth:1}),false);
});
test('32 short weapon/movement/bomb/music slices match PHP including every motion word',()=>{
 const cases=[],expected=[];
 for(const index of [-1,0,1,2])for(const assist of [false,true])for(const musicTick of [0,2900,5800,12180]){
  const c={index,assist,musicTick,power:16,rule:S.hardV3Rule,inputs:Array.from({length:360},(_,i)=>({dx:i%120<60?64:-64,dy:0,flags:(i%100<50?1:0)|(i===200?2:0)}))},s=new S.Sim(r,index,assist,c.rule);s.player.power=c.power;s.player.invulUntil=100000;s.musicTick=musicTick;const rows=[];
  for(const input of c.inputs){s.step(input);if(s.tick%60===0)rows.push(plain(s.snapshot()));}cases.push(c);expected.push(rows);
 }
 assert.deepEqual(php('hard-fixtures.php',{cases}),expected);
});
test('seed decelerates, holds, warns once, locks prior position, splits and retires deterministically',()=>{
 const s=new S.Sim(r,1,false,S.hardV3Rule),rows=[];C.emit(s,240*64,160*64,128,160,6,102,24,{accel:-3,changeAge:100,mode:4,nextSpeed:0});
 let stopped,locked;
 for(let t=1;t<=110;t++){
  s.tick=t;if(t===80)s.player.x=160*64;C.motion(s);for(const e of s.enemies){e.x+=e.vx;e.y+=e.vy;}
  if(t===54){assert.equal(s.enemies[0].motion[1],0);stopped=[s.enemies[0].x,s.enemies[0].y];}
  if(t===76){locked=s.enemies[0].motion[10];assert.deepEqual([s.enemies[0].x,s.enemies[0].y],stopped);assert.equal(locked,128*256);}
  if(t===99)assert.equal(s.enemies[0].motion[10],locked);
  if(t===100){assert.equal(s.enemies.length,5);assert.ok(s.enemies.every(e=>e.kind===23&&e.born===100));assert.deepEqual(s.enemies.map(e=>e.motion[0]/256),[112,120,128,136,144]);}
  if([1,54,76,80,99,100,110].includes(t))rows.push(plain(s.snapshot()));
 }
 assert.deepEqual(php('choreography-fixtures.php',{action:'seed'}),rows);
});
test('curve reverses smoothly, point-blank births are suppressed, Bomb leaves no delayed offspring',()=>{
 const s=new S.Sim(r,0,false,S.hardV3Rule);C.emit(s,240*64,100*64,128,160,4,360,20,{turn:48,changeAge:100,mode:1,nextSpeed:176,nextTurn:-48});
 for(let t=1;t<=101;t++){s.tick=t;C.motion(s);}assert.equal(s.enemies[0].motion[2],-48);assert.equal(s.enemies[0].motion[9],1);
 const safe=new S.Sim(r,1,false,S.hardV3Rule);for(const dx of [0,31*64,32*64,33*64])C.emit(safe,safe.player.x+dx,safe.player.y,128,160,4,300,20);assert.equal(safe.enemies.length,2);assert.deepEqual(php('choreography-fixtures.php',{action:'safe'}),plain(safe.snapshot()));
 const b=new S.Sim(r,1,false,S.hardV3Rule);b.pattern=()=>{};C.emit(b,240*64,160*64,128,160,6,102,24,{accel:-3,changeAge:100,mode:4});for(let t=1;t<=110;t++)b.step({dx:0,dy:0,flags:t===80?2:0});assert.equal(b.stats.enemySpawned,1);assert.equal(b.stats.bombsUsed,1);assert.equal(b.enemies.length,0);
});
test('authored motion across the whole music/loop stays within existing live caps without kills',()=>{
 for(const index of [0,1,2])for(const assist of [false,true]){
  const s=new S.Sim(r,index,assist,S.hardV3Rule);let peak=0;
  for(let t=1;t<=13020;t++){
   s.tick=t;s.musicTick=t;s.boss.x=E.bossX(t);s.pattern();C.motion(s);
   s.enemies=s.enemies.filter(e=>{e.x+=e.vx;e.y+=e.vy;const m=r.field.enemyCullMargin*64;return t-e.born+1<e.ttl&&e.x>=-m&&e.x<=480*64+m&&e.y>=-m&&e.y<=640*64+m;});peak=Math.max(peak,s.enemies.length);
   if(t%100===0)for(const e of s.enemies)assert.ok([e.x,e.y,e.vx,e.vy,...e.motion].every(Number.isInteger));
  }
  assert.ok(peak<=360);caps.push({index,assist,peak,spawned:s.stats.enemySpawned});
 }
});
test('three bounded 15-second legal low-speed routes need no hits, Bombs or invincibility',()=>{
 const cases=[],expected=[];
 for(const index of [0,1,2]){
  const s=new S.Sim(r,index,false,S.hardV3Rule),b={sim:s,stage:'active',phaseIndex:index,tick:0},inputs=[],rows=[];
  for(let t=0;t<900;t++){assert.equal(s.player.invulUntil,0);const input=choose(b,{focus:true,horizon:24,bombRisk:Infinity,y:540});inputs.push(input);s.step(input);b.tick++;if(s.tick%60===0)rows.push(plain(s.snapshot()));}
  assert.equal(s.stats.hitsTaken,0);assert.equal(s.stats.bombsUsed,0);assert.equal(s.player.lives,3);assert.equal(s.status,'playing');cases.push({rule:S.hardV3Rule,index,assist:false,power:0,musicTick:0,invulUntil:0,inputs});expected.push(rows);routes.push({phase:index+1,ticks:900,hits:0,bombs:0,invincible:false});
 }
 assert.deepEqual(php('hard-fixtures.php',{cases}),expected);
});
test('Hard v2 snapshots and fixed delivery remain intact',()=>{
 const file=path.join(__dirname,'fixtures/legacy-hard/stage-hard-v2.js'),source=fs.readFileSync(file,'utf8');assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'fd4764c3134e19593145fdb6b0617d3d609cd39ea0a7f302629d41c241d8c9d2');
 const sandbox={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(source,sandbox);const Old=sandbox.module.exports;
 for(const index of [-1,0,1,2]){const a=new Old.Sim(r,index,false,S.hardV2Rule),b=new S.Sim(r,index,false,S.hardV2Rule);for(const s of [a,b])s.player.invulUntil=100000;for(let t=0;t<360;t++){const input={dx:t%120<60?64:-64,dy:0,flags:t%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
});
test('ordinary v3 replay is accepted, unknown behavior fields and altered scores rejected',()=>{
 const b=new S.Stage(r,false,S.hardV3Rule),inputs=Array.from({length:480},()=>({dx:0,dy:0,flags:1}));for(const input of inputs)b.step(input);const good=R.encode(inputs,r,b),cases=[{payload:good,partial:true}];for(const delta of [{score:good.score+1},{motion:[]},{testInvincible:true},{rule:'danmaku-stage01-hard-r999'}])cases.push({payload:{...good,...delta},partial:true});
 const got=php('cli-stage01.php',{action:'batch',trace:true,cases}).results;assert.equal(got[0].ok,1);assert.deepEqual(got[0].data,R.run(good,r,true,true));assert.ok(got.slice(1).every(v=>v.ok===0));assert.equal(S.rankedRules.includes(S.hardV3Rule),false);
});
const out=path.join(root,'tmp/danmaku/hard-v3');fs.mkdirSync(out,{recursive:true});const report={status:'PASS',checks,caps,routes,naturalClearRun:false,humanPlaytest:false,forumInstalled:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
