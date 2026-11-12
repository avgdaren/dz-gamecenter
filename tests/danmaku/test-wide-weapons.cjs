/* (C) 2026 Carinoasd. Focused side fire coverage and compatibility: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json'));
const S=require(path.join(base,'stage.js')),W=require(path.join(base,'weapons.js')),R=require(path.join(base,'stage-replay.js')),checks=[];
const git=['-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897'],plain=x=>JSON.parse(JSON.stringify(x));
function test(name,f){f();checks.push(name);console.log('PASS '+name);}function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
test('only the new weapons07 config is appended, retaining enemy and narrow-focus rules',()=>{
 const old=JSON.parse(execFileSync('git',[...git,'show','8888e43:source/plugin/gamecenter/games/_danmaku_proto/rules.json'],{cwd:root,encoding:'utf8'}));const {weapons07,collect08,corner09,...rest}=r;assert.deepEqual(rest,old);
 for(const rule of [S.wideWeaponRule,S.normalWideWeaponRule]){const b=new S.Stage(r,false,rule);assert.equal(b.sim.wideWeaponMode,true);assert.equal(b.sim.respawnBombs,true);b.replace(1);assert.equal(b.sim.normalRevision,rule===S.normalWideWeaponRule?2:0);}
});
test('levels 4/5 focus retain the exact three center projectiles and add four non-tracking green lanes',()=>{
 for(const power of [12,16]){const a=new S.Sim(r,0,false,S.weaponRule),b=new S.Sim(r,0,false,S.wideWeaponRule);for(const s of [a,b]){s.tick=1;s.player.power=power;s.fire({flags:1});}assert.deepEqual(b.shots.filter(s=>s.kind===2),a.shots);const sides=b.shots.filter(s=>s.kind===3);assert.deepEqual(sides.map(s=>(s.x-b.player.x)/64),[-36,-18,18,36]);assert.ok(sides.every(s=>s.vx===0&&s.vy===-576&&s.target===-1));W.tracking(b);assert.ok(sides.every(s=>s.vx===0&&s.vy===-576&&s.target===-1));}
});
test('side volleys use their own 6-tick cadence; levels 1–3 and fast fire stay unchanged',()=>{
 for(let power of [0,3,8,12,16])for(const flags of [0,1]){const a=new S.Sim(r,0,false,S.weaponRule),b=new S.Sim(r,0,false,S.wideWeaponRule);a.player.power=b.player.power=power;for(let tick=1;tick<=12;tick++){a.tick=b.tick=tick;a.fire({flags});b.fire({flags});}if(!flags||power<12)assert.deepEqual(b.shots,a.shots);else{assert.deepEqual(b.shots.filter(s=>s.kind===3).map(s=>s.born),[1,1,1,1,7,7,7,7]);assert.equal(b.shots.filter(s=>s.kind===1).length,0);}}
});
function target(x){return{id:1,type:0,born:0,baseX:0,mirror:false,reward:0,x:x*64,y:200*64,px:x*64,py:200*64,hp:10000,aim:128,warningUntil:0,warningKind:0};}
test('real side projectiles hit enemies 36px left/right that the previous center volley misses',()=>{
 for(const power of [12,16])for(const x of [204,276]){const results=[];for(const rule of [S.weaponRule,S.wideWeaponRule]){const s=new S.Sim(r,-1,false,rule);s.pattern=function(){};s.player.x=240*64;s.player.y=550*64;s.player.power=power;s.mobs=[target(x)];for(let t=0;t<100;t++)s.step({dx:0,dy:0,flags:1});results.push(s.stats.mobDamage);}assert.equal(results[0],0);assert.ok(results[1]>0);}
});
const cases=[];for(const rule of [S.wideWeaponRule,S.normalWideWeaponRule])for(const index of [-1,0,1,2])for(const assist of [false,true])for(const power of [12,16])cases.push({rule,index,assist,power,inputs:Array.from({length:360},(_,i)=>({dx:i%180<90?64:-64,dy:0,flags:i===180?3:i%120<60?1:0}))});
test('32 movement/focus/bomb fixtures match PHP including new straight side shots',()=>{
 const expected=cases.map(c=>{const s=new S.Sim(r,c.index,c.assist,c.rule);s.player.power=c.power;s.player.invulUntil=1000000;const trace=[];for(const input of c.inputs){s.step(input);if(s.tick%60===0)trace.push(s.snapshot());}return trace;});assert.deepEqual(php('weapon-fixtures.php',{action:'phases',cases}),plain(expected));
});
let peak=0;test('bounded focus and fast fire remain below the 192-projectile cap',()=>{
 for(const power of [12,16])for(const flags of [0,1]){const s=new S.Sim(r,-1,false,S.normalWideWeaponRule);s.player.power=power;s.player.y=s.player.py=624*64;s.player.invulUntil=100000;for(let t=0;t<600;t++){s.step({dx:0,dy:0,flags});peak=Math.max(peak,s.shots.length);}}assert.ok(peak<192);
});
test('all ten prior rule snapshots match the preceding committed simulator',()=>{
 const source=execFileSync('git',[...git,'show','8888e43:source/plugin/gamecenter/games/_danmaku_proto/stage.js'],{cwd:root,encoding:'utf8'}),sandbox={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(source,sandbox);const O=sandbox.module.exports;
 for(const rule of O.supportedRules)for(const index of [-1,1]){const a=new O.Sim(r,index,false,rule),b=new S.Sim(r,index,false,rule);for(const s of [a,b]){s.player.power=16;s.player.invulUntil=100000;}for(let i=0;i<180;i++){const input={dx:i%60<30?64:-64,dy:0,flags:i%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
});
let rejected=0;test('new legal prefixes match PHP; modified scores, side-shot fields and unknown rules are rejected',()=>{
 for(const rule of [S.wideWeaponRule,S.normalWideWeaponRule]){const s=new S.Stage(r,false,rule),inputs=Array.from({length:600},(_,i)=>({dx:i%180<90?64:-64,dy:0,flags:i%60<30?1:0}));for(const input of inputs)s.step(input);const p=R.encode(inputs,r,s);const got=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload:p,partial:true}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,R.run(p,r,true,true));const bad=[{...p,score:p.score+1},{...p,sideShots:4},{...p,rule:'danmaku-stage01-r999'},{...p,power:16}];const res=php('cli-stage01.php',{action:'batch',trace:false,cases:bad.map(payload=>({payload,partial:true}))}).results;bad.forEach((v,i)=>{assert.throws(()=>R.run(v,r,true,false));assert.equal(res[i].ok,0);rejected++;});}
});
const out=path.join(root,'tmp/danmaku/weapons-v2');fs.mkdirSync(out,{recursive:true});const report={status:'PASS',checks,phaseFixtures:32,oldRuleFixtures:20,invalidRejected:rejected,shotPeak:peak,naturalClearRun:false,fullGameAutoPlay:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
