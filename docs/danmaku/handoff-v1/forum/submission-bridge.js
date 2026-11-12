/* (C) 2026 Carinoasd. Prepared transport adapter: 小典 / Codex.
 * Does not start sessions or submit. Wire it to the platform after integration.
 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuSubmissionBridge=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function build(payload,snapshot,rules){
    if(!payload||!snapshot||payload.stage!==true||payload.rule!=='danmaku-stage01-r3'||snapshot.rule!==payload.rule)return{ok:false,reason:'仅标准完整第一关记录成绩'};
    if(payload.assist!==false||snapshot.assist!==false)return{ok:false,reason:'辅助练习不记录榜单成绩'};
    if(snapshot.stage!=='over'||['clear','dead','timeout'].indexOf(snapshot.status)<0)return{ok:false,reason:'本局尚未自然结束'};
    if(payload.v!==1||!Number.isInteger(payload.ticks)||payload.ticks<1||payload.ticks>rules.stage01.maxTicks||payload.ticks!==snapshot.tick||
      !Number.isInteger(payload.score)||payload.score<0||payload.score>rules.stage01.bombScoreUpperBound||payload.score!==snapshot.score.total||typeof payload.input!=='string')return{ok:false,reason:'回放字段不完整'};
    return{ok:true,fields:{stage:1,v:1,rule:payload.rule,assist:0,ticks:payload.ticks,input:payload.input,score:payload.score}};
  }
  return{build:build};
}));
