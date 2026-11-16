/* (C) 2026 Carinoasd. Stage 1 view with staged spell declarations: 小典 / Codex.
 * Reuses the existing sprites, field, boss and presentation components.
 */
(function(root){
 'use strict';var images,effects,lastSession,lastModel;
 function init(loaded){images=loaded;effects=root.DanmakuStageArt.createEffects();}
 function circle(ctx,x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
 function draw(ctx,session,reduced,focused){
  if(lastSession!==session){effects=root.DanmakuStageArt.createEffects();lastSession=session;}
  var f=session.current,s=f.sim,p=s.player,b=s.boss,prelude=f.phaseIndex<0,common=root.DanmakuStageShow,state=common.create();
  var show=common.scene(f,1,reduced,session.handoffAge,session.firstBreakOrigin);
  ctx.clearRect(0,0,480,640);common.begin(ctx,show);root.DanmakuStageArt.background(ctx,images.corridor,f.tick,reduced);common.underlay(ctx,show,reduced);
  ctx.font='9px "Microsoft YaHei",sans-serif';ctx.fillStyle='#7185a0';ctx.fillText(prelude?'星穹回廊 / '+root.DanmakuStage01.segment(f.rules,s.tick):'首领 / '+root.DanmakuDifficultyPresentation.names(root.DanmakuDifficultyPresentation.difficulty(f),1)[f.phaseIndex],22,26);
  if(f.stage==='active'){if(s.choreographyMode)root.DanmakuChoreography.telegraphs(ctx,s,reduced);else root.DanmakuBossPatterns.emitters(ctx,s);}
  if(s.tick<s.warningUntil&&f.stage==='active'){
   var v=s.rules.directionVectors[s.aimAngle];ctx.strokeStyle='#efbf83';ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(b.x/64,b.y/64);ctx.lineTo(b.x/64+v[0],b.y/64+v[1]);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#efbf83';ctx.fillText('瞄准已锁定',b.x/64-28,b.y/64-45);
  }
  if(!prelude)root.DanmakuBossView.sprite(ctx,images.boss,s,f.tick,reduced,f.stage,show);
  common.effects(ctx,show,reduced);root.DanmakuStageArt.effects(ctx,s,effects,reduced);root.DanmakuStageView.field(ctx,s,images,reduced);
  s.shots.forEach(function(shot){
   if(shot.kind===1||shot.kind===2||shot.kind===3){root.DanmakuWeapons.drawShot(ctx,shot,reduced);return;}
   ctx.save();ctx.translate(shot.x/64,shot.y/64);if(shot.vx)ctx.rotate(Math.atan2(shot.vx,-shot.vy));ctx.fillStyle=shot.focused?'#d9f8ff':'#8ec6e8';ctx.fillRect(-1.5,-6,3,12);if(shot.focused){ctx.fillStyle='#fff4c9';ctx.fillRect(-.5,-5,1,8);}ctx.restore();
  });
  var invulnerable=s.testInvincible||s.tick<p.invulUntil;if(invulnerable)circle(ctx,p.x/64,p.y/64,23,null,'#d7d6a5');
  root.DanmakuStageView.feedback(ctx,s);s.enemies.forEach(function(e){
   if(s.choreographyMode&&!prelude&&root.DanmakuBulletMaterials.draw(ctx,images.projectiles,e))return;
   if(s.patternV3&&!prelude){root.DanmakuBossPatterns.bullet(ctx,e,s.index);return;}
   var color=e.radius===5?'#efbcbb':e.radius===4?'#e9c47c':'#a7baef';
   if(e.kind===1){ctx.fillStyle='#d1b9f0';ctx.fillRect(e.x/64-4,e.y/64-6,8,12);}
   else if(e.radius===6||e.kind===2){var r=e.radius*Math.SQRT2;ctx.fillStyle=color;ctx.strokeStyle='#e3eaff';ctx.beginPath();ctx.moveTo(e.x/64,e.y/64-r);ctx.lineTo(e.x/64+r,e.y/64);ctx.lineTo(e.x/64,e.y/64+r);ctx.lineTo(e.x/64-r,e.y/64);ctx.closePath();ctx.fill();ctx.stroke();}
   else{circle(ctx,e.x/64,e.y/64,e.radius,color,'#fff0e2');circle(ctx,e.x/64,e.y/64,1.3,'#6b4b68');}
  });
  if(s.tick-s.lastHit<16){ctx.strokeStyle='#f29e9e';ctx.lineWidth=3;ctx.strokeRect(2,2,476,636);ctx.lineWidth=1;}
  root.DanmakuStageView.bomb(ctx,s,reduced);common.title(ctx,show);if(s.testInvincible||!invulnerable||s.tick%12<8)root.DanmakuPlayerView.sprite(ctx,images.player,p,f.tick);root.DanmakuPlayerView.hitpoint(ctx,p,focused);common.end(ctx,show);lastModel=show;return show;
 }
 root.DanmakuCampaignStage01View={init:init,draw:draw,inspect:function(){return lastModel;}};
}(window));
