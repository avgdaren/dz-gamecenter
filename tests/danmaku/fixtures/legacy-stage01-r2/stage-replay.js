/* (C) 2026 Carinoasd. Strict one-stage replay schema: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./stage.js'),require('./replay.js'));
  else root.DanmakuStageReplay=factory(root.DanmakuStage01,root.DanmakuReplay);
}(typeof globalThis!=='undefined'?globalThis:this,function(stage,codec){
  'use strict';
  function encode(records,rules,sim){return{stage:true,v:1,rule:sim.rule,assist:sim.assist,ticks:records.length,
    input:codec.encodeInputs(records,rules,rules.stage01.maxTicks),score:sim.score().total};}
  function decode(payload,rules){
    var allowed=['stage','v','rule','assist','ticks','input','score'];
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(function(k){return allowed.indexOf(k)<0;})||
      payload.stage!==true||payload.v!==1||stage.supportedRules.indexOf(payload.rule)<0||typeof payload.assist!=='boolean'||!Number.isInteger(payload.score)||
      payload.score<0||payload.score>stage.scoreLimit(rules,payload.rule))throw new Error('第一关回放格式、版本或分数无效');
    return codec.decodeInputs(payload.ticks,payload.input,rules,rules.stage01.maxTicks);
  }
  function run(payload,rules,partial,traceEnabled){
    var records=decode(payload,rules),sim=new stage.Stage(rules,payload.assist,payload.rule),trace=[];
    records.forEach(function(input){var prior=sim.stage,phase=sim.phaseIndex,power=sim.sim.player.power,bombs=sim.sim.player.bombs,used=sim.stats.bombsUsed,collected=sim.stats.bombCollected||0;sim.step(input);
      var bombEvent=sim.sim.bombMode&&(bombs!==sim.sim.player.bombs||used!==sim.stats.bombsUsed||collected!==sim.stats.bombCollected);
      if(traceEnabled!==false&&(sim.tick%60===0||sim.status!=='playing'||prior!==sim.stage||phase!==sim.phaseIndex||power!==sim.sim.player.power||bombEvent))trace.push(sim.snapshot());});
    if(!partial&&sim.status==='playing')throw new Error('第一关尚未自然结束');
    if(sim.score().total!==payload.score)throw new Error('第一关重算分数不符');
    return{snapshot:sim.snapshot(),trace:trace};
  }
  return{encode:encode,decode:decode,run:run};
}));
