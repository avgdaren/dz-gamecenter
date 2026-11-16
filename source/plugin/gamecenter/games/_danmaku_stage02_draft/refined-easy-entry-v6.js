/* (C) 2026 Carinoasd. Easy enemy entry grace: 小典 / Codex.
 * Allow two seconds after birth before the first volley; retain warning lengths.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./refined-easy-v5.js'));
 else root.Stage02Refined=factory(root.Stage02Refined);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy){
 'use strict';var RULE='danmaku-stage02-easy-refined-v6',ENTRY_TICKS=120;
 function rules(r){return Object.assign({},r,{stage01:Object.assign({},r.stage01,{types:r.stage01.types.map(function(type){
  var delay=type.attacks.length?Math.max(0,ENTRY_TICKS-type.attacks[0].at):0;
  return Object.assign({},type,{attacks:type.attacks.map(function(a){return Object.assign({},a,{at:a.at+delay,warning:a.warning+delay});})});
 })})});}
 function configure(base){return rules(legacy.configure(base));}
 function adopt(s){Object.setPrototypeOf(s,Sim.prototype);s.rules=rules(s.rules);s.rule=RULE;return s;}
 function Sim(base,index,options){legacy.Sim.call(this,base,index,options);adopt(this);}
 Sim.prototype=Object.create(legacy.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.snapshot=function(){var v=legacy.Sim.prototype.snapshot.call(this);v.rule=RULE;return v;};
 function Flow(base,selection,preset,invincible){legacy.Flow.call(this,base,selection,preset,invincible);this.rules=rules(this.rules);adopt(this.sim);}
 Flow.prototype=Object.create(legacy.Flow.prototype);Flow.prototype.constructor=Flow;
 Flow.prototype.replace=function(index){legacy.Flow.prototype.replace.call(this,index);adopt(this.sim);};
 Flow.prototype.retryBoss=function(){var ok=legacy.Flow.prototype.retryBoss.call(this);if(ok)adopt(this.sim);return ok;};
 Flow.prototype.inspect=function(){var v=legacy.Flow.prototype.inspect.call(this);v.rule=RULE;return v;};
 return Object.assign({},legacy,{Sim:Sim,Flow:Flow,configure:configure,rule:RULE,mobEntryGraceTicks:ENTRY_TICKS});
}));
