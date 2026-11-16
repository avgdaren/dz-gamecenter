/* (C) 2026 Carinoasd. Prayer ordering, orphan pages and unchanged bomb rules: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games'),C=path.join(base,'_danmaku_campaign_draft');
const R=require(path.join(base,'_danmaku_proto/rules.json')),N=require(path.join(C,'story-flow-v5.js')),old=require(path.join(C,'story-flow-v3.js')),D=require(path.join(C,'dialogue-layout-v5.js')),raw=require(path.join(C,'story-data-v1.js')),B=require(path.join(C,'bomb-view-v5.js'));
const idle={dx:0,dy:0,flags:0},checks=[],report={};function test(name,fn){fn();checks.push(name);}
function clear(c){c.dialogue=null;const f=c.current;f.replace(2);f.phaseBreaks=2;f.stage='active';f.sim.hp=1;f.sim.fire=function(){this.damageBoss(1);};c.step(idle);}
test('authored text preserved, two-line measured pages and orphan endings balanced',()=>{
 let repaired=0;const measure=s=>Array.from(s).reduce((n,ch)=>n+(ch.charCodeAt(0)<128?7:14),0);
 for(const width of [80,140,220,280,320,400,420])for(const scene of D.scenes)for(const [,line] of scene.lines){const pages=D.layout(line,measure,width),prior=raw.layout(line,measure,width);assert.equal(pages.flat().join(''),line);for(const p of pages){assert.ok(p.length<=2);for(const l of p)assert.ok(measure(l)<=width);}
  if(prior.length>1&&prior.at(-1).join('').length<8){assert.ok(pages.at(-1).join('').length>=(width>=140?8:6));repaired++;}
 }
 assert.ok(repaired>0);report.rebalancedWidthCases=repaired;
 const sample='天'.repeat(41);assert.equal(raw.layout(sample,s=>s.length,20).at(-1)[0],'天');assert.ok(D.layout(sample,s=>s.length,20).at(-1).join('').length>=8);
 assert.throws(()=>D.layout('x',s=>s.length,0));
});
test('post-fight dialogue, 100-step prayer, second opening; frozen reading and exact resource inheritance',()=>{
 const c=new N.Session(R);c.skipStory();Object.assign(c.sim.player,{power:11,bombs:1,lives:2});clear(c);
 assert.equal(c.dialogue.id,'s1-after');assert.equal(c.handoffAge,0);const tick=c.tick,snap=c.current.snapshot(),score=c.summary().total;
 for(let i=0;i<60;i++)c.step(idle);assert.equal(c.tick,tick);assert.deepEqual(c.current.snapshot(),snap);
 c.skipStory();assert.equal(c.stageNumber,1);assert.equal(c.handoffAge,0);assert.equal(c.dialogue,null);
 for(let i=0;i<99;i++)c.step(idle);assert.equal(c.stageNumber,1);assert.equal(c.handoffAge,99);assert.equal(c.summary().total,score);
 c.step(idle);assert.equal(c.stageNumber,2);assert.equal(c.dialogue.id,'s2-open');assert.equal(c.sim.tick,0);assert.deepEqual(c.inspect().resources,{lives:2,bombs:1,power:11});assert.deepEqual(c.stageCheckpoint.player,c.sim.player);assert.equal(c.events.filter(e=>e.type==='stageEnter').length,1);
 const second=c.sim.snapshot();c.step(idle);assert.deepEqual(c.sim.snapshot(),second);c.skipStory();c.step(idle);assert.equal(c.sim.tick,1);
});
test('story-off keeps a single original handoff and practice adds no prayer gate',()=>{
 const c=new N.Session(R,'campaign','standard',false,false);clear(c);assert.equal(c.dialogue,null);for(let i=0;i<100;i++)c.step(idle);assert.equal(c.stageNumber,2);assert.equal(c.sim.tick,0);
 const p=new N.Session(R,'stage1');clear(p);for(let i=0;i<100;i++)p.step(idle);assert.equal(p.stageNumber,1);assert.equal(p.status,'clear');assert.equal(p.dialogue,null);
});
test('both stages retain bomb stock, damage, clearing, protection and cooldown; view is read only',()=>{
 for(const number of [1,2]){
  const a=new old.Session(R,'boss'+number),b=new N.Session(R,'boss'+number);
  for(const c of [a,b]){c.current.stage='active';c.sim.tick=120;c.sim.fire=function(){};for(let i=0;i<24;i++)c.sim.spawn((40+i%8*55)*64,(200+Math.floor(i/8)*70)*64,128,64,4,240,3);}
  for(let i=0;i<92;i++){const input={dx:i%2?64:0,dy:0,flags:i===0?2:0};a.step(input);b.step(input);assert.deepEqual(a.sim.snapshot(),b.sim.snapshot());
   const snap=JSON.stringify(b.sim.snapshot()),m=B.model(b.sim,false);assert.deepEqual(B.model(b.sim,false),m);assert.equal(JSON.stringify(b.sim.snapshot()),snap);
   if(i<90){assert.ok(m&&m.fade>=0&&m.fade<=1&&m.protected);assert.equal(m.age,i);}else assert.equal(m,null);
  }
  assert.equal(b.sim.player.bombs,1);assert.equal(b.sim.stats.bombsUsed,1);assert.equal(b.sim.stats.bombDamage,300);assert.ok(b.sim.stats.bombCleared>=24);assert.ok(b.sim.bombCooldownUntil>b.sim.lastBomb);
 }
});
report.status='PASS';report.checks=checks;report.naturalFullClearTested=false;const dir=path.join(root,'tmp/danmaku/campaign-v5');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'logic-checks.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
