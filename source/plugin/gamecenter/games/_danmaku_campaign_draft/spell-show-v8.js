/* (C) 2026 Carinoasd. Boss spell lifecycle derived only from battle clocks: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./spell-change-v4.js'),require('./spell-preview-v1.js'),require('./spell-canvas-v8.js'),require('./notice-frames-v8.js'));else root.DanmakuStageShow=factory(root.DanmakuStageShow,root.DanmakuSpellPreview,root.DanmakuSpellCanvas,root.DanmakuNoticeFrames);}(typeof globalThis!=='undefined'?globalThis:this,function(prior,preview,canvas,frames){
 'use strict';var portraits={},hudBottom=58;
 function clamp(v){return Math.max(0,Math.min(1,v));}function ease(v){v=clamp(v);return v*v*(3-2*v);}
 function scene(flow,number,reduced,endingAge,breakOrigin){
  var s=flow.sim,phase=Math.max(0,Math.min(2,flow.phaseIndex)),theme=number===2?'lingyu':'observer',duration=number===2?390:flow.rules.clock.introTicks;
  var state=prior.create();state.breakOrigin=breakOrigin;state.endingAge=endingAge||0;state.terminal={origin:[s.boss.x/64,s.boss.y/64]};
  var m=prior.model(state,flow,reduced),kind=flow.stage==='opening'?'intro':flow.stage==='transition'?'phase':flow.stage==='ending'||flow.status==='clear'?'clear':flow.stage==='active'?'active':'none';
  m.kind=kind;m.theme=number-1;m.phase=phase;m.title=preview.THEMES[theme].spells[phase];m.bossName=preview.THEMES[theme].name;m.burst=null;m.flash=0;m.shake=[0,0];
  if(flow.phaseIndex<0||kind==='none'){m.life=null;return m;}
  var age=kind==='intro'?duration-flow.remaining:kind==='phase'?120-flow.remaining:kind==='clear'?(endingAge||0):flow.sim.tick;
  var declaration=kind==='intro'?age-(duration-120):kind==='phase'?age:120;
  var v=Object.assign({},preview.model(theme,phase,Math.max(0,declaration),reduced));
  v.rotation=reduced?0:flow.tick*.003;
  if(kind==='intro'||kind==='phase'){v.ringAlpha=(kind==='intro'?.12+.08*ease(declaration/18):.2)+.38*ease(declaration/24)*(1-v.leave);v.particleAlpha=.055+.945*v.enter*(1-v.leave);}
  // Persistent title remains below the actual DOM resource HUD, including narrow screens.
  v.titleY=(1-v.settle)*446+v.settle*Math.max(112,hudBottom+54);
  var closed=kind==='clear'?ease(age/72):0;
  if(kind==='active'||kind==='clear'){v.frame=120;v.particleAlpha=kind==='active'?.055:0;v.ringAlpha=.2*(1-closed);v.titleAlpha=kind==='clear'?1-ease(age/28):1;}
  if(declaration<0){v.portraitAlpha=0;v.bandAlpha=0;v.titleAlpha=0;v.ringAlpha=.12*ease(age/42);v.particleAlpha=.07;}
  if(kind==='clear'){v.portraitAlpha=0;v.bandAlpha=0;v.flash=0;}
  m.origin=kind==='phase'?m.origin:[s.boss.x/64,s.boss.y/64];
  m.bossAlpha=kind==='clear'?1-ease(age/64):kind==='intro'?ease(age/32):1;
  m.spellChange=kind==='phase'||kind==='intro'&&declaration>=0;m.phaseAge=Math.max(0,declaration);m.gesture=v.enter*(1-v.leave);m.charge=m.spellChange?Math.sin(Math.PI*clamp(declaration/120)):0;
  m.life={kind:kind,age:age,declarationAge:declaration,clock:flow.tick,theme:theme,phase:phase,visual:v,cornerY:Math.max(112,hudBottom+54),
   fieldAlpha:kind==='clear'?.32*(1-closed):kind==='active'?.32:declaration<0?.1*ease(age/32):(kind==='intro'?.1+.22*ease(declaration/18):.32)+.34*(v.enter*(1-v.leave)),
   closed:closed,oldMix:kind==='phase'?1-ease(age/24):0,oldTitleAlpha:kind==='phase'?1-ease(age/18):0,
   anchor:[m.origin[0],m.origin[1]+143],finalOrigin:[s.boss.x/64,s.boss.y/64]};
  return m;
 }
 function underlay(ctx,m,reduced){frames.beginFrame(ctx,m);if(!m.life)return false;canvas.underlay(ctx,m,portraits);register(ctx,m);return true;}
 function effects(){return false;}
 function title(ctx,m){if(!m.life)return false;var notice=canvas.notice(ctx,m);frames.registerBoss(ctx,notice);canvas.titles(ctx,m);return !!notice;}
 function register(ctx,m){if(m.life)frames.registerBoss(ctx,canvas.notice(ctx,m));}
 return Object.assign({},prior,{scene:scene,underlay:underlay,effects:effects,title:title,registerTitle:register,
  setHudBottom:function(value){hudBottom=Math.max(0,Math.min(180,Number(value)||58));},setPortraits:function(value){portraits=value;},spellChangeVersion:8});
}));
