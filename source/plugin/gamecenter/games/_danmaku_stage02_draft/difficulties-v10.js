/* (C) 2026 Carinoasd. Independent garden difficulty adapters: 小典 / Codex.
 * Easy delegates to the accepted implementation; player and resource rules stay shared.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./refined-easy-entry-v6.js'),require('./difficulty-normal-v1.js'),require('./difficulty-hard-v1.js'));
 else root.Stage02Difficulty=factory(root.Stage02Refined,root.Stage02Normal,root.Stage02Hard);
}(typeof globalThis!=='undefined'?globalThis:this,function(easy,normal,hard){
 'use strict';var modules={easy:easy,normal:normal,hard:hard};
 function forDifficulty(id){if(!Object.prototype.hasOwnProperty.call(modules,id))throw Error('未知的难度');return modules[id];}
 function ruleFor(id){forDifficulty(id);return id==='easy'?easy.rule:'danmaku-stage02-'+id+'-v1';}
 function configure(base,id){var m=forDifficulty(id);if(id==='easy')return easy.configure(base);
  // Read the effective five-level player core, rather than the historical
  // three-level base JSON. Difficulty configuration only replaces combat fields.
  var r=new easy.Sim(base,-1,{shooting:false}).rules;
  r=Object.assign({},r,{stage01:Object.assign({},r.stage01,{types:r.stage01.types.map(function(t,i){return Object.assign({},t,{hp:[1,176,540][i]});})})});return m.configure(r);
 }
 function adopt(s,id,rules){Object.setPrototypeOf(s,Sim.prototype);s.difficulty=id;s.rule=ruleFor(id);s.rules=rules;s.hpMax=s.index<0?0:rules.boss.phaseHP[s.index];s.hp=s.hpMax;return s;}
 function Sim(base,index,options){options=options||{};var id=options.difficulty||'easy';forDifficulty(id);if(id==='easy')return new easy.Sim(base,index,options);
  easy.Sim.call(this,base,index,options);adopt(this,id,configure(base,id));
 }
 Sim.prototype=Object.create(easy.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.pattern=function(){if(this.index<0)return easy.Sim.prototype.pattern.call(this);forDifficulty(this.difficulty).pattern(this);};
 Sim.prototype.snapshot=function(){var v=easy.Sim.prototype.snapshot.call(this);v.rule=this.rule;v.difficulty=this.difficulty;if(this.hardBellLock)v.hardBellLock=Object.assign({},this.hardBellLock);return v;};
 function Flow(base,selection,preset,invincible,id){id=id||'easy';forDifficulty(id);if(id==='easy')return new easy.Flow(base,selection,preset,invincible);
  easy.Flow.call(this,base,selection,preset,invincible);this.difficulty=id;this.rules=configure(base,id);adopt(this.sim,id,this.rules);if(this.phaseIndex>=0)this.checkpoint=this.captureCheckpoint();
 }
 Flow.prototype=Object.create(easy.Flow.prototype);Flow.prototype.constructor=Flow;
 Flow.prototype.replace=function(index){easy.Flow.prototype.replace.call(this,index);adopt(this.sim,this.difficulty,this.rules);};
 Flow.prototype.retryBoss=function(){var ok=easy.Flow.prototype.retryBoss.call(this);if(ok)adopt(this.sim,this.difficulty,this.rules);return ok;};
 Flow.prototype.inspect=function(){var v=easy.Flow.prototype.inspect.call(this);v.rule=ruleFor(this.difficulty);v.difficulty=this.difficulty;v.originalGardenPatterns=false;delete v.bossEasyPatternsAccepted;return v;};
 return{Sim:Sim,Flow:Flow,configure:configure,forDifficulty:forDifficulty,ruleFor:ruleFor,presets:easy.presets,duration:easy.duration};
}));
