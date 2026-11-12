/* (C) 2026 Carinoasd. Stage presentation invariants: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const A=require(path.join(base,'stage-art-view.js')),S=require(path.join(base,'stage.js')),R=require(path.join(base,'stage-replay.js'));
const rules=JSON.parse(fs.readFileSync(path.join(base,'rules.json'),'utf8')),out=path.join(root,'tmp/danmaku/stage01-art');fs.mkdirSync(out,{recursive:true});
let checks=0;function test(name,fn){fn();checks++;console.log('PASS '+name);}
const calls=[],ctx=Object.fromEntries(['save','restore','drawImage','fillRect','beginPath','arc','fill','stroke','moveTo','lineTo'].map(name=>[name,(...args)=>calls.push([name,...args])]));
const images=Object.fromEntries(Object.entries(A.assets).map(([key,[w,h]])=>[key,{complete:true,naturalWidth:w,naturalHeight:h}]));
test('continuous bounded camera decelerates and stops before boss; reduced mode is still',()=>{
 assert.equal(A.camera(0,false),800);assert.equal(A.camera(4320,false),0);assert.equal(A.camera(17340,false),0);
 let prior=800;for(let t=0;t<=17340;t++){const v=A.camera(t,false);assert.ok(v>=0&&v<=prior);prior=v;assert.equal(A.camera(t,true),0);}
 assert.ok(Math.abs((A.camera(3719,false)-A.camera(3720,false))-(A.camera(3720,false)-A.camera(3721,false)))<.001);assert.ok(A.camera(4319,false)<.0002);
});
test('background uses real crop and safely falls back for missing or malformed assets',()=>{
 assert.equal(A.background(ctx,null,0,false),false);assert.equal(A.background(ctx,{...images.corridor,naturalHeight:1},0,false),false);
 calls.length=0;assert.equal(A.background(ctx,images.corridor,0,false),true);assert.deepEqual(calls.find(c=>c[0]==='drawImage').slice(2),[0,800,480,640,0,0,480,640]);
});
test('fairy selects separate flight poses and charging/firing follows actual attacks',()=>{
 const sim=new S.Sim(rules,-1,false,S.bombRule),fairy={type:0,born:0,x:100,px:200};sim.tick=90;assert.equal(A.frame(sim,fairy,false).row,1);fairy.px=0;assert.equal(A.frame(sim,fairy,false).row,2);
 for(const type of [1,2]){const a=rules.stage01.types[type].attacks[0],m={type,born:0};sim.tick=a.warning+1;assert.equal(A.frame(sim,m,false).row,1);sim.tick=a.at+1;assert.equal(A.frame(sim,m,false).row,2);assert.equal(A.frame(sim,m,true).col,0);}
});
test('draws cover the unchanged physical core and never touch simulator state',()=>{
 const sim=new S.Sim(rules,-1,false,S.bombRule);sim.tick=2300;sim.pattern();const before=sim.snapshot();
 for(const m of sim.mobs){calls.length=0;assert.equal(A.mob(ctx,images,sim,m,false),true);assert.deepEqual(calls.find(c=>c[0]==='arc').slice(1,4),[m.x/64,m.y/64,rules.stage01.types[m.type].radius]);assert.ok(calls.some(c=>c[0]==='drawImage'));}
 A.background(ctx,images.corridor,sim.tick,false);assert.deepEqual(sim.snapshot(),before);assert.equal(A.mob(ctx,{},sim,sim.mobs[0],false),false);
});
test('defeat effects freeze and expire without celebrating escaped enemies',()=>{
 const sim={tick:1,mobs:[{id:1,x:6400,y:6400,born:0,type:0}],rules},state=A.createEffects();A.effects(ctx,sim,state,false);
 sim.tick=2;sim.mobs=[];assert.equal(A.effects(ctx,sim,state,false),1);const frozen=JSON.stringify(state.bursts);A.effects(ctx,sim,state,false);assert.equal(JSON.stringify(state.bursts),frozen);
 assert.equal(A.effects(ctx,sim,state,true),0);sim.tick=26;assert.equal(A.effects(ctx,sim,state,false),0);
 sim.tick=rules.stage01.types[0].life-1;sim.mobs=[{id:2,x:6400,y:6400,born:0,type:0}];A.effects(ctx,sim,state,false);sim.tick++;sim.mobs=[];assert.equal(A.effects(ctx,sim,state,false),0);
});
let engineBytes=0,replayChecked=false;
const oldBase=path.join(root,'../output/danmaku-stage01-bomb-r2/source/plugin/gamecenter/games/_danmaku_proto');
if(fs.existsSync(oldBase))test('rules and JS/PHP simulation are byte-identical to approved bomb version',()=>{
 for(const name of ['rules.json','engine.js','engine.php','battle.js','battle.php','stage.js','stage.php','replay.js','battle-replay.js','stage-replay.js']){assert.deepEqual(fs.readFileSync(path.join(base,name)),fs.readFileSync(path.join(oldBase,name)),name);engineBytes++;}
});
const actual=path.join(root,'tmp/danmaku/bomb-r2/browser/actual-browser-stage01.json');
if(fs.existsSync(actual))test('actual approved browser replay survives presentation calls without mutation',()=>{
 const payload=JSON.parse(fs.readFileSync(actual,'utf8')),records=R.decode(payload,rules),b=new S.Stage(rules,payload.assist,payload.rule),state=A.createEffects();
 records.forEach(input=>{b.step(input);if(b.tick%120===0){const before=b.snapshot();A.background(ctx,images.corridor,b.tick,false);A.effects(ctx,b.sim,state,false);b.sim.mobs.forEach(m=>A.mob(ctx,images,b.sim,m,false));assert.deepEqual(b.snapshot(),before);calls.length=0;}});
 assert.deepEqual(b.snapshot(),R.run(payload,rules,false,false).snapshot);replayChecked=true;
});
const report={status:'PASS',checks,ruleUnchanged:S.bombRule,unchangedEngineFiles:engineBytes,replayChecked};fs.writeFileSync(path.join(out,'view-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
