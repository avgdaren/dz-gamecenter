/* (C) 2026 Carinoasd. Three-difficulty offline campaign: 小典 / Codex.
 * Independent local rules, no leaderboard or server replay registration.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./story-flow-v5.js'),require('./flow-v1.js'),require('../_danmaku_proto/stage.js'),require('../_danmaku_stage02_draft/difficulties-v10.js'),require('./story-data-v1.js'));
 else root.DanmakuCampaignDifficulties=factory(root.DanmakuCampaign,root.DanmakuCampaignBase,root.DanmakuStage01,root.Stage02Difficulty,root.DanmakuStory);
}(typeof globalThis!=='undefined'?globalThis:this,function(easy,baseFlow,first,second,story){
 'use strict';function copy(v){return JSON.parse(JSON.stringify(v));}
 function ruleFor(id){second.forDifficulty(id);return id==='easy'?easy.rule:'danmaku-campaign-'+id+'-v1';}
 function firstRule(id){return id==='normal'?first.normalCornerRule:first.hardV3Rule;}
 function Session(base,selection,preset,invincible,playStory,id){id=id||'easy';second.forDifficulty(id);if(id==='easy')return new easy.Session(base,selection,preset,invincible,playStory);
  this.difficulty=id;this.firstRule=firstRule(id);baseFlow.Session.call(this,base,selection,preset,invincible);this.rule=ruleFor(id);
  this.storyEnabled=this.selection==='campaign'&&playStory!==false;this.dialogue=null;this.storySeen={};if(this.storyEnabled)this.requestStory('s1-open');
 }
 Session.prototype=Object.create(baseFlow.Session.prototype);Session.prototype.constructor=Session;
 Session.prototype.make=function(number,boss){
  if(number===2)return new second.Flow(this.base,boss?'boss':'stage',this.preset,this.invincible,this.difficulty);
  var f=new first.Stage(this.base,false,this.firstRule);if(boss){f.replace(0);f.stage='opening';f.remaining=this.base.clock.introTicks;Object.assign(f.sim.player,second.presets[this.preset]);}f.sim.testInvincible=this.invincible;return f;
 };
 Session.prototype.retryBoss=function(){
  if(this.dialogue)return false;if(this.stageNumber===2)return baseFlow.Session.prototype.retryBoss.call(this);
  if(!this.bossCheckpoint||this.state==='handoff')return false;var c=this.bossCheckpoint,f=this.make(1,false);Object.assign(f,copy(c.flow));f.status='playing';f.sim=new first.Sim(this.base,c.flow.phaseIndex,false,this.firstRule);f.sim.stats=f.stats;
  f.sim.player=Object.assign({},c.arrival.player,{px:c.arrival.player.x,py:c.arrival.player.y,invulUntil:c.arrival.invul});f.sim.bombCooldownUntil=c.arrival.cooldown;f.sim.bombActiveUntil=0;f.sim.lastBomb=-999;f.sim.lastHit=-999;
  f.sim.nextEnemy=c.ids[0];f.sim.nextShot=c.ids[1];f.sim.nextDrop=c.ids[2];this.current=f;delete this.records[1];this.assisted=true;this.attempts++;this.state='playing';this.status='playing';this.firstBreakOrigin=null;this.setInvincible(this.invincible);this.events.push({type:'retryBoss',stage:1,tick:this.tick});return true;
 };
 Session.prototype.retryStage2=function(){return this.dialogue?false:baseFlow.Session.prototype.retryStage2.call(this);};
 Session.prototype.requestStory=easy.Session.prototype.requestStory;
 Session.prototype.endStory=easy.Session.prototype.endStory;
 Session.prototype.nextStory=easy.Session.prototype.nextStory;
 Session.prototype.skipStory=easy.Session.prototype.skipStory;
 Session.prototype.enterSecond=function(){baseFlow.Session.prototype.enterSecond.call(this);this.requestStory('s2-open');};
 Session.prototype.step=function(input){if(this.dialogue)return this.status;var before=this.current.phaseIndex,previous=this.state,status=baseFlow.Session.prototype.step.call(this,input);
  if(previous!=='handoff'&&this.state==='handoff'&&this.selection==='campaign')this.requestStory('s1-after','beginTravel');
  if(before<0&&this.current.phaseIndex===0)this.requestStory(this.stageNumber===1?'s1-before':'s2-before');
  if(status==='clear'&&this.stageNumber===2&&this.requestStory('s2-after','finish')){this.status='playing';this.state='conclusion';}return this.status;
 };
 Session.prototype.inspect=function(){var v=baseFlow.Session.prototype.inspect.call(this);v.rule=this.rule;v.difficulty=this.difficulty;v.storyEnabled=this.storyEnabled;v.dialogue=this.dialogue?Object.assign({},this.dialogue):null;v.storySeen=Object.assign({},this.storySeen);return v;};
 return Object.assign({},baseFlow,{Session:Session,ruleFor:ruleFor,story:story,version:10});
}));
