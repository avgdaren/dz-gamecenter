/* (C) 2026 Carinoasd. Shared Stage 1 enemy durability in all campaign difficulties: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./difficulty-flow-v10.js'));
 else root.DanmakuCampaignDifficulties=factory(root.DanmakuCampaignDifficulties);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy){
 'use strict';var HP=[1,128,450];
 function rules(r){return Object.assign({},r,{stage01:Object.assign({},r.stage01,{types:r.stage01.types.map(function(t,i){return Object.assign({},t,{hp:HP[i]});})})});}
 function prepare(f){f.rules=rules(f.rules);f.sim.rules=rules(f.sim.rules);return f;}
 function ruleFor(id){legacy.ruleFor(id);return id==='easy'?legacy.ruleFor(id):'danmaku-campaign-'+id+'-v2';}
 function Session(base,selection,preset,invincible,playStory,id){id=id||'easy';if(id==='easy')return new legacy.Session(base,selection,preset,invincible,playStory,id);
  legacy.Session.call(this,base,selection,preset,invincible,playStory,id);this.rule=ruleFor(id);
 }
 Session.prototype=Object.create(legacy.Session.prototype);Session.prototype.constructor=Session;
 Session.prototype.make=function(number,boss){var f=legacy.Session.prototype.make.call(this,number,boss);return number===1?prepare(f):f;};
 Session.prototype.retryBoss=function(){var ok=legacy.Session.prototype.retryBoss.call(this);if(ok&&this.stageNumber===1)prepare(this.current);return ok;};
 Session.prototype.inspect=function(){var v=legacy.Session.prototype.inspect.call(this);if(this.stageNumber===1)v.mobHP=this.sim.rules.stage01.types.map(function(t){return t.hp;});return v;};
 return Object.assign({},legacy,{Session:Session,ruleFor:ruleFor,version:11,stage01MobHP:HP.slice()});
}));
