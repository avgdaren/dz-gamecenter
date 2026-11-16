/* (C) 2026 Carinoasd. Local feedback rules, preserving accepted v11: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./difficulty-flow-v11.js'),require('./player-recovery-v12.js'),require('./elite-stay-v12.js'),require('../_danmaku_proto/engine.js'));else root.DanmakuCampaignDifficulties=factory(root.DanmakuCampaignDifficulties,root.DanmakuRecovery,root.DanmakuEliteStay,root.DanmakuP0);}(typeof globalThis!=='undefined'?globalThis:this,function(legacy,recovery,elite,engine){
 'use strict';function ruleFor(id){legacy.ruleFor(id);return 'danmaku-campaign-'+id+'-'+(id==='easy'?'v6':'v3');}
 function prepareSim(s,number){s.rules=elite.rules(s.rules,number);recovery.prepare(s);elite.prepare(s,number);}
 function prepareFlow(f,number){if(f.feedbackPreparedV12)return f;f.feedbackPreparedV12=true;f.rules=elite.rules(f.rules,number);prepareSim(f.sim,number);
  var replace=f.replace,retry=f.retryBoss,step=f.step;
  f.replace=function(index){var old=this.sim;replace.call(this,index);prepareSim(this.sim,number);recovery.transfer(old,this.sim);};
  f.retryBoss=function(){var ok=retry.call(this);if(ok){delete this.pendingDeathV12;prepareSim(this.sim,number);}return ok;};
  f.step=function(input){
   engine.validateInput(input,this.sim.rules);
   if(this.pendingDeathV12){this.tick++;recovery.advance(this);if(this.sim.recovery.age>=recovery.delayTicks){this.status='dead';this.stage='over';this.pendingDeathV12=false;return'dead';}return'playing';}
   if(this.status!=='playing')return step.call(this,input);recovery.advance(this);var before=this.stats.hitsTaken,hidden=recovery.hidden(this.sim),result=step.call(this,hidden?{dx:0,dy:0,flags:input.flags&1}:input);
   if(this.stats.hitsTaken>before){var r=recovery.begin(this);if(r.terminal){this.pendingDeathV12=true;this.status='playing';this.stage='death-ending';return'playing';}}
   return result;
  };return f;
 }
 function Session(base,selection,preset,invincible,playStory,id){id=id||'easy';var s=new legacy.Session(base,selection,preset,invincible,playStory,id),make=s.make,retry=s.retryBoss,enter=s.enterSecond,step=s.step,inspect=s.inspect;
  s.rule=ruleFor(id);s.make=function(number,boss){return prepareFlow(make.call(this,number,boss),number);};prepareFlow(s.current,s.stageNumber);
  s.retryBoss=function(){var ok=retry.call(this);if(ok)prepareSim(this.sim,this.stageNumber);return ok;};
  s.enterSecond=function(){var old=this.sim;enter.call(this);recovery.transfer(old,this.sim);};
  s.step=function(input){engine.validateInput(input,this.sim.rules);if(!this.dialogue&&this.state==='handoff'&&this.status==='playing'){recovery.advance(this.current);if(this.sim.recovery&&this.sim.recovery.returned&&this.departure){this.departure.player.x=this.sim.player.x;this.departure.player.y=this.sim.player.y;}}
   return step.call(this,input);
  };
  s.inspect=function(){var v=inspect.call(this);v.rule=this.rule;v.recovery=recovery.model(this.sim);v.eliteExtraTicks=elite.extraTicks;return v;};return s;
 }
 return Object.assign({},legacy,{Session:Session,ruleFor:ruleFor,prepareFlow:prepareFlow,version:12,recovery:recovery,elite:elite});
}));
