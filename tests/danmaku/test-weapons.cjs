/* (C) 2026 Carinoasd. Laser/homing rule boundaries and replay parity: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{spawnSync,execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json'));
const S=require(path.join(base,'stage.js')),W=require(path.join(base,'weapons.js')),R=require(path.join(base,'stage-replay.js')),Show=require(path.join(base,'stage-show.js'));
const checks=[];function test(name,f){f();checks.push(name);console.log('PASS '+name);}function php(file,p){const x=spawnSync(process.env.DANMAKU_PHP||'php',[path.join(__dirname,file)],{input:JSON.stringify(p),encoding:'utf8',maxBuffer:64*1024*1024});assert.equal(x.status,0,x.error?.message||x.stderr);return JSON.parse(x.stdout);}
const plain=x=>JSON.parse(JSON.stringify(x)),git=['-c','http.proxy=http://127.0.0.1:7897','-c','https.proxy=http://127.0.0.1:7897'];
test('new rules change only weapons, retain Normal v2 enemies, five thresholds and respawn stocks',()=>{
 const old=JSON.parse(execFileSync('git',[...git,'show','b887178:source/plugin/gamecenter/games/_danmaku_proto/rules.json'],{cwd:root,encoding:'utf8'}));const {weapons06,weapons07,...rest}=r;assert.deepEqual(rest,old);
 for(const rule of [S.weaponRule,S.normalWeaponRule]){const b=new S.Stage(r,false,rule);assert.equal(b.sim.respawnBombs,true);assert.deepEqual(b.rules.stage01.growth.thresholds,[0,3,8,12,16]);b.replace(2);assert.equal(b.sim.normalRevision,rule===S.normalWeaponRule?2:0);}
});
test('levels 1–3 retain pellets; level 4 focuses into packets; level 5 fast has exactly four tracking lanes',()=>{
 for(let lv=1;lv<=5;lv++)for(const flags of [0,1]){const s=new S.Sim(r,0,false,S.weaponRule);s.tick=1;s.player.power=s.rules.stage01.growth.thresholds[lv-1];s.fire({flags});assert.equal(s.shots.length,flags&&lv>=4?3:3+2*(lv-1));assert.equal(s.shots.filter(x=>x.kind===1).length,!flags&&lv===5?4:0);}
});
function mob(id,x,y,hp=100){return{id,type:0,x:x*64,y:y*64,px:x*64,py:y*64,hp,reward:0,born:0,baseX:0,mirror:false,aim:128,warningUntil:0,warningKind:0};}
test('focused packets travel before hitting; sustained full-hit DPS is 300 / 420, with no beam',()=>{
 for(const [lv,power,dps,speed] of [[4,12,300,1152],[5,16,420,1536]]){const s=new S.Sim(r,0,false,S.weaponRule);s.player.power=power;s.player.x=240*64;s.player.y=550*64;s.hp=10000;s.pattern=function(){this.boss.x=240*64;};s.step({dx:0,dy:0,flags:1});assert.equal(s.stats.damage,0);assert.equal(s.shots.length,3);assert.ok(s.shots.every(x=>x.kind===2&&x.vx===0&&x.vy===-speed));assert.equal(s.beam,undefined);for(let t=1;t<100;t++)s.step({dx:0,dy:0,flags:1});const before=s.stats.damage;for(let t=0;t<60;t++)s.step({dx:0,dy:0,flags:1});assert.equal(s.stats.damage-before,dps);s.tick=163;s.fire({flags:0});assert.ok(s.shots.slice(-(3+2*(lv-1))).every(x=>x.kind!==2));}
});
test('a focused volley hits a front mob once per projectile without piercing or off-axis/behind hits',()=>{
 const s=new S.Sim(r,-1,false,S.weaponRule);s.player.x=240*64;s.player.y=560*64;s.player.power=12;s.pattern=function(){};s.mobs=[mob(1,240,200),mob(2,240,400),mob(3,320,450),mob(4,240,620)];const fire=s.fire;s.fire=function(input){if(this.tick===1)fire.call(this,input);};for(let t=0;t<40;t++)s.step({dx:0,dy:0,flags:1});assert.deepEqual(s.mobs.map(m=>m.hp),[100,80,100,100]);assert.equal(s.stats.mobDamage,20);assert.equal(s.stats.shotHits,3);assert.equal(s.shots.length,0);
});
test('integer tracking curves toward targets, retains a live target, retargets on death and breaks ties by ID',()=>{
 const s=new S.Sim(r,-1,false,S.weaponRule);s.mobs=[mob(7,300,300),mob(2,180,300)];const p={kind:1,target:-1,x:240*64,y:500*64,vx:0,vy:-576};s.shots=[p];W.tracking(s);assert.equal(p.target,2);assert.equal(p.vx,-64);s.mobs.push(mob(1,240,490));W.tracking(s);assert.equal(p.target,2);s.mobs[1].hp=0;W.tracking(s);assert.equal(p.target,1);s.mobs=[];W.tracking(s);assert.equal(p.target,-1);
});
const cases=[];for(const rule of [S.weaponRule,S.normalWeaponRule])for(const index of [-1,0,1,2])for(const assist of [false,true])for(const power of [12,16])cases.push({rule,index,assist,power,inputs:Array.from({length:360},(_,i)=>({dx:i%180<90?64:-64,dy:0,flags:i%120<60?1:0}))});
test('32 isolated level 4/5 standard/assist stage/Boss fixtures match PHP including focused projectiles and tracking',()=>{
 const expected=cases.map(c=>{const s=new S.Sim(r,c.index,c.assist,c.rule);s.player.power=c.power;s.player.invulUntil=1000000;const trace=[];for(const input of c.inputs){s.step(input);if(s.tick%60===0)trace.push(s.snapshot());}return trace;});assert.deepEqual(php('weapon-fixtures.php',{action:'phases',cases}),plain(expected));
});
test('PHP and JS agree on tracking ties, retention, death retarget and empty targets',()=>{
 const s=new S.Sim(r,-1,false,S.weaponRule);s.mobs=[mob(7,300,300),mob(2,180,300)];const p={kind:1,target:-1,x:240*64,y:500*64,vx:0,vy:-576};s.shots=[p];const expected=[];function row(){W.tracking(s);expected.push([p.vx,p.vy,p.target]);}row();s.mobs.push(mob(1,240,490));row();s.mobs[1].hp=0;row();s.mobs=[];row();assert.deepEqual(php('weapon-fixtures.php',{action:'tracking-edges'}),expected);
});
let peak=0;test('tracking turns remain under the shot cap during bounded bottom-edge fire',()=>{
 for(const rule of [S.weaponRule,S.normalWeaponRule]){const s=new S.Sim(r,1,false,rule);s.player.power=16;s.player.y=s.player.py=624*64;s.player.invulUntil=1000000;for(let t=0;t<600;t++){s.step({dx:0,dy:0,flags:0});peak=Math.max(peak,s.shots.length);}assert.ok(peak<192);}
});
test('all pre-weapon rule snapshots remain byte-equivalent to the previous committed simulator',()=>{
 const oldSource=execFileSync('git',[...git,'show','b887178:source/plugin/gamecenter/games/_danmaku_proto/stage.js'],{cwd:root,encoding:'utf8'});const sandbox={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(oldSource,sandbox);const O=sandbox.module.exports;
 for(const rule of O.supportedRules)for(const index of [-1,0,2]){const a=new O.Sim(r,index,false,rule),b=new S.Sim(r,index,false,rule);for(const s of [a,b]){s.player.power=16;s.player.invulUntil=1000000;}for(let i=0;i<180;i++){const input={dx:i%60<30?64:-64,dy:0,flags:i%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
});
let rejected=0;test('legal new replay prefixes pass; extra beam/target fields and invalid score/rules are rejected',()=>{
 for(const rule of [S.weaponRule,S.normalWeaponRule]){const s=new S.Stage(r,false,rule),inputs=Array.from({length:600},(_,i)=>({dx:i%180<90?64:-64,dy:0,flags:i%60<30?1:0}));for(const x of inputs)s.step(x);const p=R.encode(inputs,r,s);const got=php('cli-stage01.php',{action:'batch',trace:true,cases:[{payload:p,partial:true}]}).results[0];assert.equal(got.ok,1);assert.deepEqual(got.data,R.run(p,r,true,true));const bad=[{...p,score:p.score+1},{...p,beam:[0,0]},{...p,target:0},{...p,rule:'danmaku-stage01-normal-r999'},{...p,power:16},{...p,input:'!!!!'}];const res=php('cli-stage01.php',{action:'batch',trace:false,cases:bad.map(payload=>({payload,partial:true}))}).results;bad.forEach((v,i)=>{assert.throws(()=>R.run(v,r,true,false));assert.equal(res[i].ok,0);rejected++;});}
});
test('both phase explosions follow frozen logical time and retain the 120-tick transition',()=>{
 for(const phase of [1,2]){const b=new S.Stage(r,false,S.normalWeaponRule);b.phaseIndex=phase;b.phaseBreaks=phase;b.stage='transition';b.remaining=100;const st=Show.create();st.breakOrigin=[280,88];const a=Show.model(st,b,false);assert.equal(a.burst.phase,0);assert.ok(a.flash===0);assert.notDeepEqual(a.shake,[0,0]);const reduced=Show.model(st,b,true);assert.deepEqual(reduced.shake,[0,0]);assert.equal(reduced.flash,0);b.remaining=115;assert.ok(Show.model(st,b,false).flash>0);b.remaining=100;assert.deepEqual(a,Show.model(st,b,false));assert.equal(a.bossAlpha,0);assert.ok(Show.model(st,b,true).burst);assert.equal(r.clock.transitionTicks,120);b.remaining=5;assert.equal(Show.model(st,b,false).burst,null);assert.ok(Show.model(st,b,false).bossAlpha>.9);}
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');assert.ok(!html.includes('id="phase-cue"'));assert.ok(!html.includes('<select'));assert.ok(!html.includes('第一关'));assert.ok(!html.includes('针雨夹击'));assert.equal((html.match(/data-difficulty=/g)||[]).length,2);
});
const out=path.join(root,'tmp/danmaku/weapons-v1');fs.mkdirSync(out,{recursive:true});const report={status:'PASS',checks,phaseFixtures:cases.length,invalidRejected:rejected,shotPeak:peak,naturalClearRun:false,fullGameAutoPlay:false};fs.writeFileSync(path.join(out,'rule-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
