/* (C) 2026 Carinoasd. Shared Stage 1 presentation adapter: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/stage-show.js'));else root.Stage02UnityShow=factory(root.DanmakuStageShow);
}(typeof globalThis!=='undefined'?globalThis:this,function(common){
 'use strict';
 var themes=[{title:'星环观测者',stage:'星穹回廊',phases:common.phases,introOffset:0,hold:180},{title:'铃羽',stage:'风铃花庭',phases:['风廊','花瓣舒展','铃声回响'],introOffset:45,hold:390}];
 function model(index,kind,age,reduced){
  var theme=themes[index],state=common.create(),stage=kind==='intro'?'opening':kind==='phase'?'transition':'over';
  state.breakOrigin=[288,88];state.terminal={status:'clear',origin:[240,88]};state.endingAge=age;
  var coreAge=kind==='intro'?age-theme.introOffset:age;
  var facade={stage:stage,status:'clear',phaseIndex:kind==='phase'?1:0,phaseBreaks:kind==='phase'?1:0,remaining:(kind==='intro'?180:120)-Math.max(0,coreAge),rules:{clock:{introTicks:180,transitionTicks:120}}};
  var m=common.model(state,facade,reduced);m.title=theme.phases[m.phase];
  if(kind==='intro'&&(coreAge<0||coreAge>=180)){m.kind='none';m.opacity=0;m.bossAlpha=coreAge<0?Math.max(0,age/42):1;}
  m.theme=index;m.stageName=theme.stage;m.bossName=theme.title;m.coreAge=coreAge;return m;
 }
 return{themes:themes,model:model,coreSource:'_danmaku_proto/stage-show.js',introCardTicks:180,phaseTicks:120};
}));
