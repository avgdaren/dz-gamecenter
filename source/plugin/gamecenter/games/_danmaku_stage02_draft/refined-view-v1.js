/* (C) 2026 Carinoasd. Shared-stage garden presentation: 小典 / Codex. */
(function(root){
 'use strict';var images,data,effects,lastModel;var common=root.DanmakuStageShow,logic=root.Stage02Refined;
 function init(loaded,config){images=loaded;data=config;root.GardenBulletMaterials.init(images,data.materialLayout);root.Stage02RefinedSprites.init(images,data.spriteLayout);effects=root.DanmakuStageArt.createEffects();}
 function model(flow,reduced){
  var kind=flow.stage==='opening'?'intro':flow.stage==='transition'?'phase':flow.stage==='ending'||flow.status==='clear'?'clear':null,m;
  if(!kind)return{kind:'none',bossAlpha:1,origin:null,shake:[0,0],flash:0};
  var age=kind==='intro'?390-flow.remaining:kind==='phase'?120-flow.remaining:flow.endingAge;
  m=root.Stage02UnityShow.model(1,kind,age,reduced);m.phase=Math.max(0,flow.phaseIndex);m.title=logic.names[m.phase];
  if(kind==='phase'){var event=flow.events.filter(function(e){return e.type==='phase_clear';}).slice(-1)[0],state=common.create();state.breakOrigin=event?event.origin:[240,88];m=common.model(state,{stage:'transition',phaseIndex:flow.phaseIndex,phaseBreaks:flow.phaseIndex,remaining:flow.remaining,rules:{clock:{transitionTicks:120}}},reduced);m.title=logic.names[flow.phaseIndex];}
  if(kind==='clear'){var ev=flow.events.filter(function(e){return e.type==='phase_clear';}).slice(-1)[0];if(m.burst)m.burst.origin=ev?ev.origin:[flow.sim.boss.x/64,flow.sim.boss.y/64];}
  return m;
 }
 function bossAct(flow,reduced){var s=flow.sim,next=logic.nextCast(s.index,s.tick),release=Math.max(0,1-(s.tick-s.lastCast)/18),pre=next===null?0:Math.max(0,1-next/36),active=flow.stage==='active';
  var pose=active&&(pre>0||release>0)?3:active&&Math.abs(s.boss.x-s.boss.px)>12?(s.boss.x<s.boss.px?1:2):0;
  if(reduced)pose=0;return{pose:pose,anticipation:active?pre:0,release:active?release:0,nextCastIn:next};
 }
 function mobPose(s,m,reduced){if(reduced)return 0;var age=s.tick-m.born,attacks=s.rules.stage01.types[m.type].attacks,casting=attacks.some(function(a){return age>=a.warning&&age<a.at+18;});return casting?3:m.x-m.px< -24?1:m.x-m.px>24?2:0;}
 function drops(ctx,s){root.DanmakuStageView.field(ctx,{mobs:[],drops:s.drops,rules:s.rules,tick:s.tick},null,true);}
 function mobs(ctx,s,reduced){s.mobs.forEach(function(m){var x=m.x/64,y=m.y/64,type=s.rules.stage01.types[m.type];
  if(s.tick<m.warningUntil){ctx.strokeStyle='#a6c6f0';ctx.lineWidth=1;if(m.warningKind===1){var v=s.rules.directionVectors[m.aim];ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+v[0]*.18,y+v[1]*.18);ctx.stroke();ctx.setLineDash([]);}else{ctx.beginPath();ctx.arc(x,y,type.radius+10,0,Math.PI*2);ctx.stroke();}}
  root.Stage02RefinedSprites.draw(ctx,['fairy','attendant','guardian'][m.type],mobPose(s,m,reduced),x,y,1);
  var label=[28,36,44][m.type],width=m.type===2?50:25;ctx.fillStyle='#273447';ctx.fillRect(x-width/2,y-label,width,2);ctx.fillStyle='#c8d5e8';ctx.fillRect(x-width/2,y-label,width*m.hp/type.hp,2);
  if(m.reward){ctx.fillStyle='#efcf85';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('✦',x,y-label-7);ctx.textAlign='start';}
 });drops(ctx,s);}
 function sources(ctx,flow,act,reduced){var s=flow.sim;
  if(s.index===1&&flow.stage==='active'&&s.tick<s.warningUntil){
   var v=s.rules.directionVectors[s.aimAngle],bx=s.boss.x/64,by=s.boss.y/64+8;
   ctx.save();ctx.setLineDash([6,8]);ctx.beginPath();ctx.moveTo(bx,by);ctx.lineTo(bx+v[0],by+v[1]);ctx.strokeStyle='#25324b88';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#efbf83';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
   ctx.font='9px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#25324bd9';ctx.fillRect(bx-40,by+65,80,17);ctx.fillStyle='#efbf83';ctx.fillText('瞄准已锁定',bx,by+77);ctx.restore();
  }
  if(s.index===2&&flow.stage==='active'){
   var p=logic.cycle(2,s.tick),rows=[30,54,78,102],next=rows.findIndex(function(t){return t>p.q&&t-p.q<=36;}),bell=next<0?-1:([0,1,2,1][next]+p.c)%3;
   [112,240,368].forEach(function(x,i){var y=i===1?104:124,charge=i===bell?act.anticipation:0;root.GardenBulletMaterials.ornament(ctx,'bud',x,y,15+charge*2,0,.55+charge*.25);if(charge){ctx.save();ctx.globalAlpha=charge*.35;ctx.strokeStyle='#e8d4a4';ctx.beginPath();ctx.arc(x,y,9+charge*6,0,Math.PI*2);ctx.stroke();ctx.restore();}});
  }
  s.emitters.forEach(function(e){var age=s.tick-e.born;if(age<0||age>18)return;ctx.save();ctx.strokeStyle=e.kind===22?'#6b9a88':e.kind===23?'#c8879d':'#c7ad70';ctx.globalAlpha=(1-age/18)*.32;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(e.x,e.y,4+age*.45,2+age*.22,0,0,Math.PI*2);ctx.stroke();ctx.restore();});
  if(s.index>=0&&flow.stage==='active'&&act.anticipation>0){var x=s.boss.x/64,y=s.boss.y/64;ctx.save();ctx.strokeStyle='#a6c6f0';ctx.globalAlpha=act.anticipation*.5;ctx.beginPath();ctx.arc(x-25,y-26,5+act.anticipation*4,0,Math.PI*2);ctx.stroke();ctx.restore();}
 }
 function draw(ctx,flow,reduced,focused){var s=flow.sim,m=model(flow,reduced),act=s.index<0?{pose:0,anticipation:0}:bossAct(flow,reduced);
  ctx.clearRect(0,0,480,640);root.Stage02Garden.draw(ctx,images,data.gardenLayout,s.index<0?s.tick/60:flow.bossTicks/60,s.index<0?'tour':'boss',reduced,true);
  common.begin(ctx,m);root.DanmakuStageArt.effects(ctx,s,effects,reduced);sources(ctx,flow,act,reduced);
  if(s.index>=0){var origin=m.origin||[s.boss.x/64,s.boss.y/64];root.Stage02RefinedSprites.draw(ctx,'lingyu',act.pose,origin[0],origin[1],m.bossAlpha);}
  mobs(ctx,s,reduced);s.shots.forEach(function(shot){root.DanmakuWeapons.drawShot(ctx,shot,reduced);});
  s.enemies.forEach(function(e){root.GardenBulletMaterials.draw(ctx,e,s.index,s.tick,reduced);});common.effects(ctx,m,reduced);
  root.DanmakuStageView.bomb(ctx,s,reduced);root.DanmakuPlayerView.sprite(ctx,images.player,s.player,reduced?0:flow.tick);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);root.DanmakuStageView.feedback(ctx,s);common.end(ctx,m);
  lastModel={show:m,acting:act};return m;
 }
 root.Stage02RefinedView={init:init,draw:draw,model:model,mobPose:mobPose,bossAct:bossAct,inspect:function(){return lastModel;}};
}(window));
