/* (C) 2026 Carinoasd. Focus-fire, version compatibility and JS/PHP verification: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=require(path.join(base,'rules.json')),E=require(path.join(base,'engine.js'));
const B=require(path.join(base,'battle.js')),R=require(path.join(base,'replay.js'));
const BR=require(path.join(base,'battle-replay.js')),V=require(path.join(base,'player-view.js'));
const {drive}=require('./p1-policy.cjs');
const zero=(flags=0)=>({dx:0,dy:0,flags});
function step(sim,n,flags=0){for(let i=0;i<n;i++)sim.step(zero(flags));}
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('legacy rule keeps the original shot and ignores focus for firing',()=>{
 const a=new E.Sim(rules,'aim',false),b=new E.Sim(rules,'aim',false);
 step(a,40);step(b,40,1);assert.deepEqual(a.snapshot(),b.snapshot());
 assert.equal(a.rule,'danmaku-p0-r1');assert.equal(a.snapshot().shots[0].length,4);
});
test('normal spreads and focused lanes stay parallel with equal volley damage',()=>{
 const a=new E.Sim(rules,'aim',false,E.focusRule),b=new E.Sim(rules,'aim',false,E.focusRule);
 a.step(zero());b.step(zero(1));
 assert.deepEqual(a.shots.map(s=>s.vx),[-64,0,64]);assert.deepEqual(b.shots.map(s=>s.vx),[0,0,0]);
 assert.equal(a.shots.reduce((n,s)=>n+s.damage,0),10);assert.equal(b.shots.reduce((n,s)=>n+s.damage,0),10);
 assert.ok(a.shots[0].x<b.shots[0].x);assert.equal(a.snapshot().shots[0].length,8);
});
test('mode switch affects new volleys without rewriting bullets in flight',()=>{
 const s=new E.Sim(rules,'aim',false,E.focusRule);s.step(zero());step(s,6,1);
 assert.equal(s.shots.filter(b=>b.born===1).length,3);assert.ok(s.shots.filter(b=>b.born===1).every(b=>!b.focused));
 assert.ok(s.shots.filter(b=>b.born===7).every(b=>b.focused&&b.vx===0));
 step(s,6);assert.ok(s.shots.filter(b=>b.born===13).every(b=>!b.focused));
 assert.ok(s.shots.filter(b=>b.born===7).every(b=>b.focused&&b.vx===0));
});
test('focus speed bound remains strict and collision radius remains three',()=>{
 assert.throws(()=>E.validateInput({dx:256,dy:0,flags:1},rules));
 E.validateInput({dx:96,dy:0,flags:1},rules);assert.equal(rules.player.hitRadius,3);
 const a=new E.Sim(rules,'aim',false,E.focusRule);a.step({dx:96,dy:0,flags:1});
 assert.equal(a.player.x,240*64+96);
});
test('focus shooting preserves cadence and stays under its bounded projectile cap',()=>{
 const s=new E.Sim(rules,'flower',true,E.focusRule);let peak=0;
 for(let i=0;i<600;i++){s.step(zero(i%2));peak=Math.max(peak,s.shots.length);if(s.status!=='playing')break;}
 assert.ok(peak<=rules.playerShot.styles.liveCap);assert.ok(peak>3);
});
test('new battle version survives both phase handovers',()=>{
 const b=new B.Battle(rules,false,B.focusRule);step(b,180);
 for(let phase=0;phase<2;phase++){
   b.sim.hp=1;const x=E.bossX(b.sim.tick+1),y=88*64+768;
   b.sim.shots=[{id:b.sim.nextShot++,x,y,px:x,py:y,born:b.sim.tick+1,vx:0,vy:-768,damage:1,focused:true}];
   b.step(zero(1));assert.equal(b.stage,'transition');step(b,120,1);
   assert.equal(b.phaseIndex,phase+1);assert.equal(b.rule,B.focusRule);assert.equal(b.sim.focusFire,true);
 }
});
test('renderer selects native idle and side frames without mirroring',()=>{
 assert.deepEqual(V.frame(0,0),{column:0,row:0});assert.deepEqual(V.frame(8,-1),{column:1,row:1});
 assert.deepEqual(V.frame(30,1),{column:0,row:2});
 let args;const ctx={save(){},restore(){},drawImage(...v){args=v;}};
 V.sprite(ctx,{}, {x:240*64,y:552*64,px:244*64},8);
 assert.deepEqual(args.slice(1),[48,48,48,48,216,524,48,48]);
});
test('hitpoint makes no draw calls outside focus and stays on the true center in focus',()=>{
 const calls=[],ctx={save(){calls.push('save');},restore(){calls.push('restore');},beginPath(){},moveTo(){},lineTo(){},arc(...a){calls.push(a);},fill(){},stroke(){}};
 const p={x:15361,y:35329};assert.equal(V.hitpoint(ctx,p,false),false);assert.equal(calls.length,0);
 assert.equal(V.hitpoint(ctx,p,true),true);assert.deepEqual(calls.filter(Array.isArray).map(a=>a.slice(0,3)),[[p.x/64,p.y/64,11],[p.x/64,p.y/64,5],[p.x/64,p.y/64,3],[p.x/64,p.y/64,1]]);
});
test('runtime images match approved exports and opaque pixels fit all movement boundaries',()=>{
 const art=path.join(root,'docs/danmaku/art/player-production-v1/native-v1');
 for(const name of ['player-motion-v1.png','player-front-display-v1.png'])assert.deepEqual(fs.readFileSync(path.join(base,'assets',name)),fs.readFileSync(path.join(art,name)));
 const audit=JSON.parse(fs.readFileSync(path.join(art,'audit.json'),'utf8')),bounds=rules.field.playerBounds;
 for(const f of audit.frames){const [x0,y0,x1,y1]=f.bbox;assert.ok(bounds.minX+x0-24>=0);assert.ok(bounds.maxX+x1-24<480);assert.ok(bounds.minY+y0-28>=0);assert.ok(bounds.maxY+y1-28<640);}
});
const proto=[],battleCases=[],out=path.join(root,'tmp/danmaku/focus');fs.mkdirSync(out,{recursive:true});
for(const scene of E.scenes)for(const assist of [false,true]){
 const s=new E.Sim(rules,scene,assist,E.focusRule),records=[];
 while(s.status==='playing'){const v=zero(Math.floor(s.tick/45)%2);records.push(v);s.step(v);}
 const payload=R.encode(records,rules,scene,assist,s.rule);
 assert.deepEqual(R.run(payload,rules,false).snapshot,s.snapshot());proto.push({payload,partial:false});
}
const fixtures=[];
for(const [label,assist,extra]of [['standard-clear-r2',false,{}],['assist-clear-r2',true,{}],['standard-long-clear-r2',false,{delays:[1260,1080,960]}]]){
 const {battle:b,records}=drive(rules,assist,{rule:B.focusRule,focus:true,y:500,horizon:30,...extra});
 test('legal focused model completes all three phases '+label,()=>assert.equal(b.status,'clear'));
 const payload=BR.encode(records,rules,b);assert.deepEqual(BR.run(payload,rules,false,false).snapshot,b.snapshot());
 fixtures.push({payload,records});battleCases.push({payload,partial:false});
 fs.writeFileSync(path.join(out,label+'.json'),JSON.stringify(payload));
 console.log('ROUTE '+label+': '+b.tick+' ticks');
}
let seed=771111;function random(n){seed=seed*48271%2147483647;return seed%n;}
for(let i=0;i<12;i++){
 const b=new B.Battle(rules,Boolean(i%2),B.focusRule),records=[];let v=zero();
 while(b.status==='playing'){
   if(b.tick%15===0){const slow=random(2),dx=random(3)-1,dy=random(3)-1,speed=dx&&dy?(slow?67:181):(slow?96:256);v={dx:dx*speed,dy:dy*speed,flags:slow};}
   const input={...v,flags:v.flags|(random(700)===0?2:0)};records.push(input);b.step(input);
 }
 battleCases.push({payload:BR.encode(records,rules,b),partial:false});
}
for(const length of [1,179,181,900,4300,8000]){
 const f=fixtures[0],b=new B.Battle(rules,false,B.focusRule),records=f.records.slice(0,length);
 records.forEach(v=>b.step(v));battleCases.push({payload:BR.encode(records,rules,b),partial:true});
}
const protoValid=proto.length,battleValid=battleCases.length;
function illegalInput(payload,offset,value){const bytes=Buffer.from(payload.input,'base64');bytes[offset]=value;return{...payload,input:bytes.toString('base64')};}
const p=proto[0].payload,b=fixtures[0].payload;
for(const bad of [{...p,rule:'danmaku-p0-r3'},{...p,shots:[]},illegalInput(p,4,4),{...p,assist:'false'}])proto.push({payload:bad,partial:false});
const after=fixtures[0].records.concat([zero()]);
for(const bad of [{...b,rule:'danmaku-p1-r3'},{...b,score:b.score+1},{...b,shotDamage:9999},illegalInput(b,4,4),
 {...b,ticks:after.length,input:R.encodeInputs(after,rules,13200)},
 {...b,ticks:b.ticks-1,input:R.encodeInputs(fixtures[0].records.slice(0,-1),rules,13200)}])battleCases.push({payload:bad,partial:false});
function compare(cases,legal,codec,file){
 for(let i=legal;i<cases.length;i++)assert.throws(()=>codec.run(cases[i].payload,rules,false,false));
 const result=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,file)],
 {input:JSON.stringify({action:'batch',trace:true,cases}),encoding:'utf8',maxBuffer:128*1024*1024,timeout:180000});
 if(result.error)throw result.error;assert.equal(result.status,0,result.stderr||result.stdout.slice(0,200));
 const rows=JSON.parse(result.stdout).results;assert.equal(rows.length,cases.length);
 for(let i=0;i<cases.length;i++){
   if(i<legal){assert.equal(rows[i].ok,1,rows[i].reason);assert.deepEqual(rows[i].data,codec.run(cases[i].payload,rules,cases[i].partial,true));}
   else assert.equal(rows[i].ok,0,'PHP accepted invalid case '+i);
 }
}
console.log('Comparing focus replays with PHP…');
compare(proto,protoValid,R,'cli.php');compare(battleCases,battleValid,BR,'cli-p1.php');
const report={status:'PASS',checks,practiceRule:E.focusRule,battleRule:B.focusRule,
 legalPracticeDifferential:protoValid,legalBattleDifferential:battleValid,illegalRejectedByBoth:proto.length-protoValid+battleCases.length-battleValid,
 modelClearRoutes:fixtures.length,humanClearVerified:false,legacyChecks:'run test-core.cjs and test-battle.cjs separately'};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
