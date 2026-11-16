/* (C) 2026 Carinoasd. Music-intro timing adapter: 小典 / Codex.
 * Moves the whole prelude by six seconds; combat and boss plans remain intact.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./refined-combat-v2.js'));
 else root.Stage02Refined=factory(root.Stage02Refined);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy){
 'use strict';var DELAY=360,DURATION=legacy.duration+DELAY,RULE='danmaku-stage02-easy-refined-v3';
 function schedule(){return legacy.schedule().map(function(m){return Object.assign({},m,{at:m.at+DELAY});});}
 var segments=[{at:0,name:'花庭前奏'}].concat(legacy.segments.map(function(s){return Object.assign({},s,{at:s.at+DELAY});}));
 function shiftRules(r){return Object.assign({},r,{stage01:Object.assign({},r.stage01,{preludeTicks:DURATION,gatherTick:r.stage01.gatherTick+DELAY,maxTicks:r.stage01.maxTicks+DELAY,schedule:schedule(),segments:segments})});}
 function configure(base){return shiftRules(legacy.configure(base));}
 function adapt(sim){Object.setPrototypeOf(sim,Sim.prototype);sim.rules=shiftRules(sim.rules);sim.rule=RULE;return sim;}
 function Sim(base,index,options){legacy.Sim.call(this,base,index,options);adapt(this);}
 Sim.prototype=Object.create(legacy.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.snapshot=function(){var v=legacy.Sim.prototype.snapshot.call(this);v.rule=RULE;return v;};
 function Flow(base,selection,preset,invincible){legacy.Flow.call(this,base,selection,preset,invincible);this.rules=shiftRules(this.rules);adapt(this.sim);if(this.phaseIndex<0)this.remaining=DURATION;}
 Flow.prototype=Object.create(legacy.Flow.prototype);Flow.prototype.constructor=Flow;
 Flow.prototype.replace=function(index){legacy.Flow.prototype.replace.call(this,index);adapt(this.sim);};
 Flow.prototype.retryBoss=function(){var ok=legacy.Flow.prototype.retryBoss.call(this);if(ok)adapt(this.sim);return ok;};
 Flow.prototype.step=function(input){var status=legacy.Flow.prototype.step.call(this,input);if(this.phaseIndex<0&&this.stage==='prelude')this.remaining=Math.max(0,DURATION-this.sim.tick);return status;};
 Flow.prototype.inspect=function(){var v=legacy.Flow.prototype.inspect.call(this);v.rule=RULE;v.entryDelayTicks=DELAY;v.stageDurationTicks=DURATION;return v;};
 return Object.assign({},legacy,{Sim:Sim,Flow:Flow,configure:configure,schedule:schedule,segments:segments,duration:DURATION,rule:RULE,entryDelayTicks:DELAY,firstEnemyTick:480});
}));
