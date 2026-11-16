/* (C) 2026 Carinoasd. Existing observer casting frames during spell changes: 小典 / Codex. */
(function(root){
 'use strict';var prior=root.DanmakuBossView;
 function sprite(ctx,images,sim,tick,reduced,stage,show){
  if(!show||!show.spellChange||reduced)return prior.sprite(ctx,images,sim,tick,reduced,stage,show);
  if(!prior.ready(images))return false;var f=prior.frame(sim,tick,false,stage),x=show.origin[0],y=show.origin[1],g=show.gesture,frame=Math.min(3,Math.floor(show.phaseAge/12)%4);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(x,y);ctx.rotate(f.ringAngle+show.charge*.2);ctx.globalAlpha=.48+show.charge*.22;ctx.drawImage(images.back,-64,-64,128,128);ctx.restore();
  ctx.save();ctx.translate(x-48,y-48);if(g<1){ctx.globalAlpha=1-g;prior.body(ctx,images.body,tick,false);}if(g>0){ctx.globalAlpha=g;ctx.drawImage(images.body,frame*96,384,96,128,0,0,96,128);}ctx.restore();
  ctx.globalAlpha=.6;ctx.drawImage(images.front,x-32,y-32,64,64);ctx.restore();return Object.assign({},f,{casting:g});
 }
 root.DanmakuBossView=Object.assign({},prior,{sprite:sprite});
}(window));
