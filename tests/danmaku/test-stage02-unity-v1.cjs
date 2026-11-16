/* (C) 2026 Carinoasd. Bounded shared-style/sample checks: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),old=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),draft=path.join(root,'source/plugin/gamecenter/games/_danmaku_stage02_draft');
const Stage=require(path.join(old,'stage.js')),Common=require(path.join(old,'stage-show.js')),Show=require(path.join(draft,'unity-show-v1.js')),Sample=require(path.join(draft,'unity-sample-v1.js'));
const base=JSON.parse(fs.readFileSync(path.join(old,'rules.json'),'utf8')),before=JSON.stringify(base),idle={dx:0,dy:0,flags:1},checks=[];
function core(m){const keys=['kind','phase','progress','opacity','bossAlpha','origin','burst','shake','flash'];return Object.fromEntries(keys.map(k=>[k,m[k]]));}
for(const kind of ['intro','phase','clear'])for(const age of [0,12,35,60,100,119]){
 const state=Common.create();state.breakOrigin=[288,88];state.terminal={status:'clear',origin:[240,88]};state.endingAge=age;
 const facade={stage:kind==='intro'?'opening':kind==='phase'?'transition':'over',status:'clear',phaseIndex:kind==='phase'?1:0,phaseBreaks:kind==='phase'?1:0,remaining:(kind==='intro'?180:120)-age,rules:{clock:{introTicks:180,transitionTicks:120}}};
 assert.deepEqual(core(Show.model(0,kind,age,false)),core(Common.model(state,facade,false)));
 if(kind==='intro')assert.deepEqual(core(Show.model(1,kind,age+45,false)),core(Show.model(0,kind,age,false)));
 else assert.deepEqual(core(Show.model(1,kind,age,false)),core(Show.model(0,kind,age,false)));
}
checks.push('same intro/card, phase and defeat equations come from the unmodified first-stage presenter');
assert.equal(Show.model(1,'intro',235,false).kind,'none');checks.push('Stage 2 retains the 6.5s scene hold while its title card uses the shared 3s core');
const rows=Sample.schedule();assert.equal(rows.length,18);assert.ok(rows.every((r,i)=>!i||r.at>=rows[i-1].at));assert.deepEqual(rows.slice(0,4).map(r=>r.at),[120,153,186,219]);assert.equal(rows.filter(r=>r.type===1).length,2);
checks.push('18 enemies form four compact teams and one two-attendant section in the 24s sample');
const pressure=new Sample.Sim(base,{shooting:false,invincible:true});let mobPeak=0,enemyPeak=0;
for(let t=0;t<Sample.duration;t++){pressure.step(idle,true);mobPeak=Math.max(mobPeak,pressure.mobs.length);enemyPeak=Math.max(enemyPeak,pressure.enemies.length);}
assert.equal(pressure.status,'prelude_clear');assert.equal(pressure.stats.mobSpawned,18);assert.ok(mobPeak<=10);assert.ok(enemyPeak<=96);assert.equal(pressure.enemies.length,0);checks.push('bounded no-kill pressure sample stays within first-stage mob/bullet budgets and ends with residual bullets gone');
const t20=[];
function killTime(second,level){const s=second?new Sample.Sim(base,{level,invincible:true}):new Stage.Sim(base,-1,false,Stage.cornerRule);s.testInvincible=true;s.player.power=s.rules.stage01.growth.thresholds[level-1];const m={id:500,type:1,hp:s.rules.stage01.types[1].hp,born:0,baseX:240*64,mirror:false,reward:0,x:240*64,y:140*64,px:240*64,py:140*64,aim:128,warningUntil:0,warningKind:0};s.mobs=[m];s.pattern=function(){};for(let t=1;t<=600;t++){s.step(idle,true);if(m.hp<=0)return t;}throw Error('static target was not defeated');}
for(const level of [1,3,5]){const a=killTime(false,level),b=killTime(true,level);assert.ok(b>=a&&b<=a*1.2);t20.push({level,firstTicks:a,secondTicks:b});}
checks.push('same resource/weapon static-target kill times remain close at levels 1, 3 and 5');
const paired=new Sample.Pair(base,{level:3,invincible:true}),reference=new Stage.Sim(base,-1,false,Stage.cornerRule);reference.testInvincible=true;reference.player.power=paired.first.player.power;
for(let t=0;t<240;t++){paired.step(idle);reference.step(idle,true);}assert.deepEqual(paired.first.snapshot(),reference.snapshot());checks.push('the left-hand first-stage simulation is unchanged for the same input and resources');
assert.equal(JSON.stringify(base),before);checks.push('new sample configuration never rewrites shared rules');
const report={status:'PASS',checks,sampleSeconds:24,enemyCount:18,mobPeak,enemyPeak,totalBullets:pressure.stats.enemySpawned,targetKillTimes:t20,fullStageTested:false,easyCalibrationComplete:false,serverVerifierTested:false};
const out=path.join(root,'tmp/danmaku/stage02-unity-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
