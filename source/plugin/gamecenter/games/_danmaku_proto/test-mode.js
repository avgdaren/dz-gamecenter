/* (C) 2026 Carinoasd. Local test switch; never a replay or ranking option: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuTestMode=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(){return{enabled:false,used:false};}
  function reset(s){s.used=false;}
  function toggle(s,enabled){s.enabled=!!enabled;}
  function apply(s,sim){sim.testInvincible=s.enabled;if(s.enabled)s.used=true;}
  function assertReplay(s){if(s.used)throw new Error('测试局不导出成绩回放；关闭无敌后返回标题重开即可恢复。');}
  return{create:create,reset:reset,toggle:toggle,apply:apply,assertReplay:assertReplay};
}));
