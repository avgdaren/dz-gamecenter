/* (C) 2026 Carinoasd. Peer-feedback enemy roles: 小典 / Codex.
 * Independent offline campaign revision; prior rules and replays stay untouched.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./flow-v1.js'));
 else root.DanmakuCampaign=factory(root.DanmakuCampaign);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy){
 'use strict';var RULE='danmaku-campaign-easy-v2',HP=[[1,128,450],[1,176,540]];
 function rules(r,number){var hp=HP[number-1];if(r.stage01.types.every(function(t,i){return t.hp===hp[i];}))return r;
  return Object.assign({},r,{stage01:Object.assign({},r.stage01,{types:r.stage01.types.map(function(t,i){return Object.assign({},t,{hp:hp[i]});})})});
 }
 function prepare(session){var f=session.current;f.rules=rules(f.rules,session.stageNumber);f.sim.rules=rules(f.sim.rules,session.stageNumber);}
 function Session(base,selection,preset,invincible){legacy.Session.call(this,base,selection,preset,invincible);this.rule=RULE;prepare(this);}
 Session.prototype=Object.create(legacy.Session.prototype);Session.prototype.constructor=Session;
 Session.prototype.make=function(number,boss){var f=legacy.Session.prototype.make.call(this,number,boss);f.rules=rules(f.rules,number);f.sim.rules=rules(f.sim.rules,number);return f;};
 Session.prototype.step=function(input){var status=legacy.Session.prototype.step.call(this,input);prepare(this);return status;};
 Session.prototype.retryBoss=function(){var ok=legacy.Session.prototype.retryBoss.call(this);if(ok)prepare(this);return ok;};
 Session.prototype.retryStage2=function(){var ok=legacy.Session.prototype.retryStage2.call(this);if(ok)prepare(this);return ok;};
 Session.prototype.inspect=function(){var v=legacy.Session.prototype.inspect.call(this);v.rule=RULE;v.mobHP=HP[this.stageNumber-1].slice();return v;};
 return Object.assign({},legacy,{Session:Session,rule:RULE,mobHP:HP.map(function(hp){return hp.slice();})});
}));
