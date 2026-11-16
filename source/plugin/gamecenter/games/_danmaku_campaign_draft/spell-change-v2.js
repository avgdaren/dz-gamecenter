/* (C) 2026 Carinoasd. Shared visible Boss spell change: 小典 / Codex.
 * Read-only presentation; the existing 120-tick inter-phase window is preserved.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/stage-show.js'));
 else root.DanmakuStageShow=factory(root.DanmakuStageShow);
}(typeof globalThis!=='undefined'?globalThis:this,function(common){
 'use strict';function clamp(v){return Math.max(0,Math.min(1,v));}function ease(v){v=clamp(v);return v*v*(3-2*v);}
 function model(state,battle,reduced){
  var m=common.model(state,battle,reduced);if(!battle||battle.stage!=='transition')return m;
  var duration=battle.rules.clock.transitionTicks,age=duration-battle.remaining,from=state.breakOrigin||[240,88],p=ease(age/duration);
  m.spellChange=true;m.burst=null;m.shake=[0,0];m.flash=0;m.bossAlpha=1;m.origin=[from[0]+(240-from[0])*p,from[1]+(88-from[1])*p];
  m.opacity=ease(age/14)*ease((battle.remaining-2)/18);return m;
 }
 function effects(ctx,m,reduced){
  if(!m.spellChange)return common.effects(ctx,m,reduced);
  var p=m.progress,origin=m.origin||[240,88],charge=Math.sin(Math.PI*p),radius=52-12*ease(p),color=['#a5dce9','#d1b9ed','#ead1a0'][m.phase%3];
  ctx.save();ctx.globalAlpha=.3+charge*.35;ctx.strokeStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(origin[0],origin[1]+3,radius,radius*.38,0,0,Math.PI*2);ctx.stroke();
  if(!reduced){
   for(var i=0;i<8;i++){var a=i*Math.PI/4+p*Math.PI*.65,reach=radius+22*(1-p),x=origin[0]+Math.cos(a)*reach,y=origin[1]+Math.sin(a)*reach*.65;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(origin[0]+Math.cos(a)*(radius-5),origin[1]+Math.sin(a)*(radius-5)*.65);ctx.stroke();}
  }
  ctx.globalAlpha=m.opacity;var y=Math.max(206,origin[1]+96);ctx.fillStyle='#0b152ae8';ctx.fillRect(42,y-24,396,62);ctx.strokeStyle='#bda57966';ctx.beginPath();ctx.moveTo(42,y-24);ctx.lineTo(438,y-24);ctx.moveTo(42,y+38);ctx.lineTo(438,y+38);ctx.stroke();
  ctx.textAlign='center';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillStyle='#aebdd6';ctx.fillText('招式切换',240,y-6);ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillStyle='#ecd2a4';ctx.fillText(m.title,240,y+20,370);ctx.restore();return true;
 }
 return Object.assign({},common,{model:model,effects:effects,spellChangeVersion:2});
}));
