/* (C) 2026 Carinoasd. Two-stage story gates: 小典 / Codex.
 * Reading and skipping never advance combat, music clocks, resources or score.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./mob-feedback-v2.js'),require('./story-data-v1.js'));
 else root.DanmakuCampaign=factory(root.DanmakuCampaign,root.DanmakuStory);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy,story){
 'use strict';var RULE='danmaku-campaign-easy-v3';
 function Session(base,selection,preset,invincible,playStory){legacy.Session.call(this,base,selection,preset,invincible);this.rule=RULE;this.storyEnabled=this.selection==='campaign'&&playStory!==false;this.dialogue=null;this.storySeen={};if(this.storyEnabled)this.requestStory('s1-open');}
 Session.prototype=Object.create(legacy.Session.prototype);Session.prototype.constructor=Session;
 Session.prototype.requestStory=function(id,after,force){var scene=story.get(id);if(!force&&(!this.storyEnabled||this.storySeen[id]))return false;this.dialogue={id:id,line:0,after:after||null};this.events.push({type:'storyStart',id:id,tick:this.tick});return true;};
 Session.prototype.endStory=function(skipped){if(!this.dialogue)return false;var current=this.dialogue;this.storySeen[current.id]=true;this.dialogue=null;this.events.push({type:'storyComplete',id:current.id,skipped:!!skipped,tick:this.tick});
  if(current.after==='enterSecond'){legacy.Session.prototype.enterSecond.call(this);this.requestStory('s2-open');}
  if(current.after==='finish'){this.status='clear';this.state='over';}return true;
 };
 Session.prototype.nextStory=function(){if(!this.dialogue)return false;var scene=story.get(this.dialogue.id);if(this.dialogue.line+1<scene.lines.length){this.dialogue.line++;return true;}return this.endStory(false);};
 Session.prototype.skipStory=function(){return this.endStory(true);};
 Session.prototype.enterSecond=function(){if(this.requestStory('s1-after','enterSecond'))return;legacy.Session.prototype.enterSecond.call(this);this.requestStory('s2-open');};
 Session.prototype.step=function(input){if(this.dialogue)return this.status;var before=this.current.phaseIndex,status=legacy.Session.prototype.step.call(this,input);
  if(before<0&&this.current.phaseIndex===0)this.requestStory(this.stageNumber===1?'s1-before':'s2-before');
  if(status==='clear'&&this.stageNumber===2&&this.requestStory('s2-after','finish')){this.status='playing';this.state='conclusion';}
  return this.status;
 };
 Session.prototype.retryBoss=function(){return this.dialogue?false:legacy.Session.prototype.retryBoss.call(this);};
 Session.prototype.retryStage2=function(){return this.dialogue?false:legacy.Session.prototype.retryStage2.call(this);};
 Session.prototype.inspect=function(){var v=legacy.Session.prototype.inspect.call(this);v.rule=RULE;v.storyEnabled=this.storyEnabled;v.dialogue=this.dialogue?Object.assign({},this.dialogue):null;v.storySeen=Object.assign({},this.storySeen);return v;};
 return Object.assign({},legacy,{Session:Session,rule:RULE,story:story});
}));
