/* (C) 2026 Carinoasd. Easy mob density adjustment: 小典 / Codex.
 * Boss Easy patterns accepted by avg达人 on 2026-11-15; keep them unchanged.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./refined-formation-v4.js'));
 else root.Stage02Refined=factory(root.Stage02Refined);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy){
 'use strict';var RULE='danmaku-stage02-easy-refined-v5';
 var segments=legacy.segments.map(function(s){return Object.assign({},s,s.at===0?{name:'花庭入场'}:{});});
 function rules(r){return Object.assign({},r,{stage01:Object.assign({},r.stage01,{segments:segments,types:r.stage01.types.map(function(type,i){return Object.assign({},type,{attacks:type.attacks.map(function(a,j){
  var offsets=i===0?[-18,18]:i===1&&j===1?[-28,0,28]:i===2&&j===2?[-66,-33,0,33,66]:a.offsets.slice();return Object.assign({},a,{offsets:offsets});
 })});})})});}
 function configure(base){return rules(legacy.configure(base));}
 function adopt(s){Object.setPrototypeOf(s,Sim.prototype);s.rules=rules(s.rules);s.rule=RULE;return s;}
 function Sim(base,index,options){legacy.Sim.call(this,base,index,options);adopt(this);}
 Sim.prototype=Object.create(legacy.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.snapshot=function(){var v=legacy.Sim.prototype.snapshot.call(this);v.rule=RULE;return v;};
 function Flow(base,selection,preset,invincible){legacy.Flow.call(this,base,selection,preset,invincible);this.rules=rules(this.rules);adopt(this.sim);}
 Flow.prototype=Object.create(legacy.Flow.prototype);Flow.prototype.constructor=Flow;
 Flow.prototype.replace=function(index){legacy.Flow.prototype.replace.call(this,index);adopt(this.sim);};
 Flow.prototype.retryBoss=function(){var ok=legacy.Flow.prototype.retryBoss.call(this);if(ok)adopt(this.sim);return ok;};
 Flow.prototype.inspect=function(){var v=legacy.Flow.prototype.inspect.call(this);v.rule=RULE;v.bossEasyPatternsAccepted=true;return v;};
 return Object.assign({},legacy,{Sim:Sim,Flow:Flow,configure:configure,segments:segments,rule:RULE,bossEasyPatternsAccepted:true});
}));
