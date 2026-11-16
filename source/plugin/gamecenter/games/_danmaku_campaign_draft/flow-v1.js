/* (C) 2026 Carinoasd. Two-stage offline Easy session: 小典 / Codex.
 * Stage simulations remain versioned and unchanged. No ranked registration.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/stage.js'),require('../_danmaku_proto/engine.js'),require('../_danmaku_stage02_draft/refined-easy-entry-v6.js'));
 else root.DanmakuCampaign=factory(root.DanmakuStage01,root.DanmakuP0,root.Stage02Refined);
}(typeof globalThis!=='undefined'?globalThis:this,function(first,engine,second){
 'use strict';var RULE='danmaku-campaign-easy-v1',HANDOFF=100;
 function copy(value){return JSON.parse(JSON.stringify(value));}
 function resources(s){return{lives:s.player.lives,bombs:s.player.bombs,power:s.player.power};}
 function arrival(s){return{player:copy(s.player),invul:Math.max(0,s.player.invulUntil-s.tick),cooldown:Math.max(0,s.bombCooldownUntil-s.tick)};}
 function applyArrival(s,c,elapsed){s.player=Object.assign({},c.player,{px:c.player.x,py:c.player.y,invulUntil:Math.max(0,c.invul-elapsed)});s.bombCooldownUntil=Math.max(0,c.cooldown-elapsed);s.bombActiveUntil=0;s.lastBomb=-999;s.lastHit=-999;}
 function stage2Score(f){
  var s=f.stats,r=f.rules,p={mobs:s.mobScore,points:s.pointScore,overflow:s.overflowScoreUnits*r.stage01.growth.overflowPerUnit,bombOverflow:s.bombOverflowTokens*r.stage01.bomb.overflowScore,
   damage:s.damage,phase:f.phaseBreaks*r.score.phaseBreak,graze:Math.min(s.graze,r.score.grazeBulletCap)*r.score.grazePerBullet};
  // Garden draft: one point per applied Boss damage. No Stage 1 HP denominator,
  // clear/resource/time award is reused for this independent stage's subtotal.
  p.total=Object.keys(p).reduce(function(n,key){return n+p[key];},0);return p;
 }
 function Session(base,selection,preset,invincible){
  selection=selection||'campaign';preset=preset||'standard';
  if(['campaign','stage1','stage2','boss1','boss2'].indexOf(selection)<0||!second.presets[preset])throw Error('未知的连战入口');
  this.rule=RULE;this.base=base;this.selection=selection;this.preset=preset;this.invincible=!!invincible;this.assisted=selection!=='campaign'||!!invincible;
  this.tick=0;this.state='playing';this.status='playing';this.stageNumber=selection==='stage2'||selection==='boss2'?2:1;
  this.handoffAge=0;this.departure=null;this.stageCheckpoint=null;this.bossCheckpoint=null;this.records={};this.events=[];this.attempts=1;this.firstBreakOrigin=null;
  this.current=this.make(this.stageNumber,selection.indexOf('boss')===0);
  if(this.stageNumber===2&&selection==='stage2')this.stageCheckpoint=arrival(this.sim);
  if(selection.indexOf('boss')===0)this.saveBoss();
 }
 Object.defineProperty(Session.prototype,'sim',{get:function(){return this.current.sim;}});
 Session.prototype.make=function(number,boss){
  if(number===2)return new second.Flow(this.base,boss?'boss':'stage',this.preset,this.invincible);
  var f=new first.Stage(this.base,false,first.cornerRule);if(boss){f.replace(0);f.stage='opening';f.remaining=this.base.clock.introTicks;Object.assign(f.sim.player,second.presets[this.preset]);}
  f.sim.testInvincible=this.invincible;return f;
 };
 Session.prototype.setInvincible=function(value){this.invincible=!!value;this.sim.testInvincible=this.invincible;if(value)this.assisted=true;};
 Session.prototype.saveBoss=function(){
  if(this.stageNumber===2){this.bossCheckpoint={number:2};return;}
  var f=this.current,s=f.sim;
  this.bossCheckpoint={number:1,flow:copy({tick:f.tick,activeTicks:f.activeTicks,phaseIndex:f.phaseIndex,phaseBreaks:f.phaseBreaks,stage:f.stage,remaining:f.remaining,events:f.events,stats:f.stats}),
   arrival:arrival(s),ids:[s.nextEnemy,s.nextShot,s.nextDrop]};
 };
 Session.prototype.retryBoss=function(){
  if(!this.bossCheckpoint||this.state==='handoff')return false;
  if(this.stageNumber===2){if(!this.current.retryBoss())return false;}
  else{
   var c=this.bossCheckpoint,f=this.make(1,false);Object.assign(f,copy(c.flow));f.status='playing';f.sim=new first.Sim(this.base,c.flow.phaseIndex,false,first.cornerRule);f.sim.stats=f.stats;
   applyArrival(f.sim,c.arrival,0);f.sim.nextEnemy=c.ids[0];f.sim.nextShot=c.ids[1];f.sim.nextDrop=c.ids[2];this.current=f;
  }
  delete this.records[this.stageNumber];this.assisted=true;this.attempts++;this.state='playing';this.status='playing';this.firstBreakOrigin=null;this.setInvincible(this.invincible);
  this.events.push({type:'retryBoss',stage:this.stageNumber,tick:this.tick});return true;
 };
 Session.prototype.retryStage2=function(){
  if(this.stageNumber!==2||!this.stageCheckpoint)return false;
  this.current=this.make(2,false);applyArrival(this.sim,this.stageCheckpoint,0);this.current.checkpoint=null;this.bossCheckpoint=null;
  delete this.records[2];this.assisted=true;this.attempts++;this.state='playing';this.status='playing';this.setInvincible(this.invincible);
  this.events.push({type:'retryStage',stage:2,tick:this.tick,resources:resources(this.sim)});return true;
 };
 Session.prototype.row=function(){var f=this.current;return{stage:this.stageNumber,name:this.stageNumber===1?'星穹回廊':'风铃花庭',status:f.status,ticks:f.tick,phaseBreaks:f.phaseBreaks,resources:resources(f.sim),stats:copy(f.stats),score:this.stageNumber===1?copy(f.score()):stage2Score(f)};};
 Session.prototype.archive=function(){if(!this.records[this.stageNumber]){this.records[this.stageNumber]=this.row();this.events.push({type:'stageComplete',stage:this.stageNumber,tick:this.tick,resources:resources(this.sim)});}};
 Session.prototype.enterSecond=function(){
  if(this.stageNumber!==1||!this.departure)throw Error('缺少第一关抵达状态');
  this.current=this.make(2,false);applyArrival(this.sim,this.departure,HANDOFF);this.current.checkpoint=null;this.stageNumber=2;this.state='playing';this.bossCheckpoint=null;
  this.stageCheckpoint=arrival(this.sim);this.events.push({type:'stageEnter',stage:2,tick:this.tick,resources:resources(this.sim)});
 };
 Session.prototype.step=function(input){
  engine.validateInput(input,this.sim.rules);if(this.status!=='playing')return this.status;this.tick++;
  if(this.state==='handoff'){
   if(++this.handoffAge>=HANDOFF){if(this.selection==='campaign')this.enterSecond();else{this.state='over';this.status='clear';}}return this.status;
  }
  var f=this.current,previous={phase:f.phaseIndex,stage:f.stage,x:f.sim.boss.x,y:f.sim.boss.y};this.setInvincible(this.invincible);var result=f.step(input);
  this.sim.testInvincible=this.invincible;
  if(previous.phase<0&&f.phaseIndex===0)this.saveBoss();
  if(this.stageNumber===1&&previous.stage==='active'&&f.stage==='transition')this.firstBreakOrigin=[previous.x/64,previous.y/64];
  if(result==='clear'){
   this.archive();if(this.stageNumber===1){this.departure=arrival(this.sim);this.state='handoff';this.handoffAge=0;}
   else{this.state='over';this.status='clear';}
  }else if(result==='dead'||result==='timeout'){this.state='over';this.status=result;this.events.push({type:'failed',stage:this.stageNumber,tick:this.tick,status:result});}
  return this.status;
 };
 Session.prototype.summary=function(){
  var rows=Object.keys(this.records).map(function(k){return copy(this.records[k]);},this);if(!this.records[this.stageNumber])rows.push(this.row());rows.sort(function(a,b){return a.stage-b.stage;});
  return{rows:rows,total:rows.reduce(function(n,row){return n+row.score.total;},0),completedStages:rows.filter(function(row){return row.status==='clear';}).length,
   expectedStages:this.selection==='campaign'?2:1,ticksPlayed:this.tick,assisted:this.assisted,continuous:this.selection==='campaign'&&!this.assisted,attempts:this.attempts};
 };
 Session.prototype.inspect=function(){var f=this.current;return{rule:RULE,difficulty:'easy',selection:this.selection,stageNumber:this.stageNumber,state:this.state,status:this.status,tick:this.tick,handoffAge:this.handoffAge,
  current:this.stageNumber===1?f.snapshot():f.inspect(),resources:resources(this.sim),stageCheckpoint:this.stageCheckpoint?copy(this.stageCheckpoint):null,bossCheckpoint:!!this.bossCheckpoint,
  summary:this.summary(),events:copy(this.events),invincible:this.invincible,ranked:false,stage01Connected:true};};
 return{Session:Session,rule:RULE,handoffTicks:HANDOFF,stage2Score:stage2Score,resources:resources};
}));
