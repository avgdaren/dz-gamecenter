/* (C) 2026 Carinoasd. Real projectile collision and shared durability regression: 小典 / Codex. */
'use strict';const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),g=path.join(root,'source/plugin/gamecenter/games'),R=require(path.join(g,'_danmaku_proto/rules.json')),Old=require(path.join(g,'_danmaku_campaign_draft/difficulty-flow-v10.js')),New=require(path.join(g,'_danmaku_campaign_draft/difficulty-flow-v11.js')),First=require(path.join(g,'_danmaku_proto/stage.js'));
const idle={dx:0,dy:0,flags:0},HP=[1,128,450],checks=[],report={naturalFullClearTested:false},original=JSON.stringify(R),out=path.join(root,'tmp/danmaku/campaign-v11');
const make=(api,id,entry='stage1')=>new api.Session(R,entry,'standard',false,false,id),clean=r=>({...r,stage01:{...r.stage01,types:r.stage01.types.map(t=>({...t,hp:0}))}});
function test(name,fn){fn();checks.push(name);console.log('PASS '+name);}
function target(s,type){s.fire=function(){};s.pattern=function(){};const m={id:1,type,born:s.tick,baseX:240*64,mirror:false,reward:0,hp:s.rules.stage01.types[type].hp,x:240*64,y:160*64,px:240*64,py:160*64,aim:128,warningUntil:0,warningKind:0};s.mobs=[m];return m;}
function shot(s,m,kind=0){s.shots.push({id:s.nextShot++,x:m.x,y:m.y,px:m.x,py:m.y,born:s.tick,vx:0,vy:0,damage:1,focused:kind===2,level:First.level(s.player.power,s.rules),kind,target:-1});}
test('all three Stage 1 difficulties use the shared durability and source rules are not mutated',()=>{
 for(const id of ['easy','normal','hard'])for(const entry of ['campaign','stage1','boss1']){const c=make(New,id,entry);assert.deepEqual(c.sim.rules.stage01.types.map(t=>t.hp),HP);assert.deepEqual(c.current.rules.stage01.types.map(t=>t.hp),HP);}
 for(const id of ['normal','hard']){const a=make(Old,id),b=make(New,id);assert.deepEqual(clean(a.sim.rules),clean(b.sim.rules));assert.equal(b.rule,'danmaku-campaign-'+id+'-v2');assert.equal(a.rule,'danmaku-campaign-'+id+'-v1');assert.deepEqual(a.sim.rules.stage01.types.map(t=>t.hp),[32,90,360]);}
 assert.equal(JSON.stringify(R),original);assert.throws(()=>make(New,'nightmare'));report.before=[32,90,360];report.after=HP;
});
test('one weakest projectile collision defeats a light enemy at every power level and weapon kind',()=>{
 report.projectileCases=0;
 for(const id of ['easy','normal','hard'])for(const power of [0,3,8,12,16])for(const kind of [0,1,2,3]){const c=make(New,id),s=c.sim;s.player.power=power;const m=target(s,0);shot(s,m,kind);s.step(idle,true);assert.equal(s.stats.mobKills,1);assert.equal(s.stats.mobDamage,1);assert.equal(s.stats.shotHits,1);assert.equal(s.mobs.length,0);report.projectileCases++;}
});
test('same-frame multiple projectiles award one defeat and one drop; medium and large keep durability',()=>{
 for(const id of ['easy','normal','hard']){const s=make(New,id).sim,m=target(s,0);shot(s,m);shot(s,m);s.step(idle,true);assert.equal(s.stats.mobKills,1);assert.equal(s.stats.dropSpawned,1);assert.equal(s.stats.mobDamage,1);
  for(const type of [1,2]){const s=make(New,id).sim,m=target(s,type);shot(s,m);s.step(idle,true);assert.equal(s.stats.mobKills,0);assert.equal(m.hp,HP[type]-1);assert.equal(s.stats.dropSpawned,0);}
 }
});
test('first-stage attacks and timings match the old implementation with only the approved HP profile applied',()=>{
 for(const id of ['normal','hard']){const c=make(New,id),base={...R,stage01:{...R.stage01,types:R.stage01.types.map((t,i)=>({...t,hp:HP[i]}))}},f=new First.Stage(base,false,id==='normal'?First.normalCornerRule:First.hardV3Rule);
  for(let t=0;t<720;t++){const input={dx:t%120<60?64:-64,dy:0,flags:t%90<45?1:0};c.step(input);f.step(input);assert.deepEqual(c.current.snapshot(),f.snapshot());}
 }
});
test('Boss entry, all phase replacements and checkpoint retry retain HP without changing Boss combat',()=>{
 for(const id of ['normal','hard']){const c=make(New,id,'campaign'),f=c.current;f.tick=f.sim.tick=f.sim.rules.stage01.preludeTicks-1;f.sim.cursor=f.sim.rules.stage01.schedule.length;c.step(idle);const checkpoint=f.snapshot();assert.equal(c.retryBoss(),true);assert.deepEqual(c.current.snapshot(),checkpoint);assert.deepEqual(c.sim.rules.stage01.types.map(t=>t.hp),HP);
  for(const index of [0,1,2]){const a=make(Old,id,'boss1'),b=make(New,id,'boss1');a.current.replace(index);b.current.replace(index);a.current.stage=b.current.stage='active';a.setInvincible(true);b.setInvincible(true);assert.deepEqual(b.sim.rules.stage01.types.map(t=>t.hp),HP);for(let t=0;t<180;t++){a.step(idle);b.step(idle);assert.deepEqual(b.current.snapshot(),a.current.snapshot());}}
 }
});
test('Easy and every second-stage difficulty keep their previous local snapshots',()=>{
 for(const id of ['easy','normal','hard'])for(const entry of ['stage2','boss2']){const a=make(Old,id,entry),b=make(New,id,entry);for(let t=0;t<720;t++){a.step(idle);b.step(idle);assert.deepEqual(b.current.inspect(),a.current.inspect());}}
 const a=make(Old,'easy','campaign'),b=make(New,'easy','campaign');for(let t=0;t<720;t++){a.step(idle);b.step(idle);assert.deepEqual(b.inspect(),a.inspect());}
});
report.status='PASS';report.checks=checks;assert.equal(JSON.stringify(R),original);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length,projectileCases:report.projectileCases,naturalFullClearTested:false}));
