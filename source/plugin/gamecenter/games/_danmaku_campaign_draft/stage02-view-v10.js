/* (C) 2026 Carinoasd. Garden-source telegraphs and staged spell declarations: 小典 / Codex. */
(function(root){
 'use strict';var images,data,effects,lastModel;var common=root.DanmakuStageShow,logic=root.Stage02Refined;
 function init(loaded,config){images=loaded;data=config;root.GardenBulletMaterials.init(images,data.materialLayout);root.Stage02RefinedSprites.init(images,data.spriteLayout);effects=root.DanmakuStageArt.createEffects();}
 function model(flow,reduced){var event=flow.events.filter(function(e){return e.type==='phase_clear';}).slice(-1)[0];return common.scene(flow,2,reduced,flow.endingAge,event&&event.origin);}
 function bossAct(flow,reduced){var s=flow.sim,activeLogic=s.difficulty?root.Stage02Difficulty.forDifficulty(s.difficulty):logic,cue=activeLogic.cue(s.index,s.musicTick),next=cue?cue.inTicks:null;if(s.difficulty&&next!==null&&s.tick+next<36)next=null;var unused=0,release=Math.max(0,1-(s.tick-s.lastCast)/18),pre=next===null?0:Math.max(0,1-next/36),active=flow.stage==='active';
  var pose=active&&(pre>0||release>0)?3:active&&Math.abs(s.boss.x-s.boss.px)>12?(s.boss.x<s.boss.px?1:2):0;
  if(reduced)pose=0;return{pose:pose,anticipation:active?pre:0,release:active?release:0,nextCastIn:next,cue:active&&next!==null?cue:null};
 }
 function mobPose(s,m,reduced){if(reduced)return 0;var age=s.tick-m.born,attacks=logic.mobAttacks(s,m),casting=attacks.some(function(a){return age>=a.warning&&age<a.at+18;});return casting?3:m.x-m.px< -24?1:m.x-m.px>24?2:0;}
 function drops(ctx,s){root.DanmakuStageView.field(ctx,{mobs:[],drops:s.drops,rules:s.rules,tick:s.tick},null,true);}
 function mobs(ctx,s,reduced){s.mobs.forEach(function(m){var x=m.x/64,y=m.y/64,type=s.rules.stage01.types[m.type];
  if(s.tick<m.warningUntil){ctx.strokeStyle='#a6c6f0';ctx.lineWidth=1;if(m.warningKind===1){var v=s.rules.directionVectors[m.aim];ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+v[0]*.18,y+v[1]*.18);ctx.stroke();ctx.setLineDash([]);}else{ctx.beginPath();ctx.arc(x,y,type.radius+10,0,Math.PI*2);ctx.stroke();}}
  root.Stage02RefinedSprites.draw(ctx,['fairy','attendant','guardian'][m.type],mobPose(s,m,reduced),x,y,1);
  var label=[28,36,44][m.type],width=m.type===2?50:25;ctx.fillStyle='#273447';ctx.fillRect(x-width/2,y-label,width,2);ctx.fillStyle='#c8d5e8';ctx.fillRect(x-width/2,y-label,width*m.hp/type.hp,2);
  if(m.reward){ctx.fillStyle='#efcf85';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('✦',x,y-label-7);ctx.textAlign='start';}
 });drops(ctx,s);}
 function sources(ctx,flow,act,reduced){var s=flow.sim;
  if(s.index>=0&&flow.stage==='active'){
   var activeLogic=s.difficulty?root.Stage02Difficulty.forDifficulty(s.difficulty):logic,targets=activeLogic.sources(s.index,s.musicTick,s.boss),points=activeLogic.presentationNodes(s.index,s.musicTick,s.boss);if(s.difficulty&&!act.cue)targets=[];
   points.forEach(function(p){var target=targets.find(function(v){return Math.abs(v.x-p[0])<1&&Math.abs(v.y-p[1])<1;}),charge=target?act.anticipation:0,birth=0;
    s.emitters.forEach(function(e){var age=s.tick-e.born;if(age>=0&&age<18&&Math.abs(e.x-p[0])<2&&Math.abs(e.y-p[1])<2)birth=Math.max(birth,1-age/18);});
    var visible=.58+charge*.32+birth*.1;
    if(s.index===1){
     for(var f=0;f<5;f++){var a=f*Math.PI*2/5;root.GardenBulletMaterials.ornament(ctx,'petal',p[0]+Math.cos(a)*5,p[1]+Math.sin(a)*5,8+charge*3,a+Math.PI/2,visible);}
     ctx.save();ctx.fillStyle='#eed6a1';ctx.strokeStyle='#536663';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p[0],p[1],2.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
    }else if(s.index===2){
     ctx.save();ctx.strokeStyle='#486355';ctx.globalAlpha=visible;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(p[0]-9,p[1]+3);ctx.quadraticCurveTo(p[0]-11,p[1]-18,p[0]+4,p[1]-13);ctx.lineTo(p[0]+4,p[1]-7);ctx.stroke();ctx.restore();
     root.GardenBulletMaterials.ornament(ctx,'leaf',p[0]-8,p[1]-12,9,-.75,visible);root.GardenBulletMaterials.ornament(ctx,'bud',p[0]+3,p[1],14+charge*2,0,visible);
    }else root.GardenBulletMaterials.ornament(ctx,target&&target.key||'leaf',p[0],p[1],9+charge*4,0,visible);
    if(target&&s.difficulty==='hard'&&target.kind==='call'&&s.hardBellLock&&s.hardBellLock.time===act.cue.musicTick){var locked=s.rules.directionVectors[s.hardBellLock.angle];ctx.save();ctx.strokeStyle='#f5d69d';ctx.globalAlpha=.7;ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(p[0]+locked[0]*.5,p[1]+locked[1]*.5);ctx.stroke();ctx.restore();}if(charge||birth){ctx.save();ctx.globalAlpha=.3+charge*.5+birth*.2;ctx.beginPath();ctx.arc(p[0],p[1],10+charge*6+birth*8,0,Math.PI*2);ctx.strokeStyle='#26374799';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle=s.index===1?'#f3bbca':'#ead7a6';ctx.lineWidth=1;ctx.stroke();
     ctx.globalAlpha=charge*.25;ctx.beginPath();ctx.moveTo(s.boss.x/64-25,s.boss.y/64-26);ctx.quadraticCurveTo((s.boss.x/64+p[0])/2,p[1]-32,p[0],p[1]);ctx.stroke();
     if(target&&s.index===2&&charge>.25){ctx.globalAlpha=.9;ctx.fillStyle='#263747';ctx.fillRect(p[0]-16,p[1]-31,32,14);ctx.fillStyle='#ead7a6';ctx.font='9px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(target.kind==='echo'?'回声':'铃鸣',p[0],p[1]-21);}ctx.restore();}
   });
  }
  // A quiet halo warns the delayed bell echo before its speed change.
  if(s.index===2||s.difficulty)s.enemies.forEach(function(e){var m=e.motion,d=m?m[4]-(s.tick-e.born):-1;if(m&&!m[9]&&d>=0&&d<=24){ctx.save();ctx.strokeStyle='#e8d4a4';ctx.globalAlpha=.16+(24-d)/120;ctx.lineWidth=1;ctx.beginPath();ctx.arc(e.x/64,e.y/64,e.radius+3,0,Math.PI*2);ctx.stroke();if(s.difficulty){var a=m[5]===1?Math.floor(m[0]/256)+m[6]:m[5]===3?m[6]:Math.floor(m[0]/256),v=s.rules.directionVectors[(a%512+512)%512];ctx.globalAlpha=.65;ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(e.x/64,e.y/64);ctx.lineTo(e.x/64+v[0]*.035,e.y/64+v[1]*.035);ctx.stroke();}ctx.restore();}});
  s.emitters.forEach(function(e){var age=s.tick-e.born;if(age<0||age>18)return;ctx.save();ctx.strokeStyle=e.kind===22?'#6b9a88':e.kind===23?'#c8879d':'#c7ad70';ctx.globalAlpha=(1-age/18)*.32;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(e.x,e.y,4+age*.45,2+age*.22,0,0,Math.PI*2);ctx.stroke();ctx.restore();});
  if(s.index>=0&&flow.stage==='active'&&act.anticipation>0){var x=s.boss.x/64,y=s.boss.y/64;ctx.save();ctx.strokeStyle='#a6c6f0';ctx.globalAlpha=act.anticipation*.5;ctx.beginPath();ctx.arc(x-25,y-26,5+act.anticipation*4,0,Math.PI*2);ctx.stroke();ctx.restore();}
 }
 function draw(ctx,flow,reduced,focused){var s=flow.sim,m=model(flow,reduced),act=s.index<0?{pose:0,anticipation:0}:bossAct(flow,reduced);
  if(m.spellChange&&!reduced){act.pose=m.gesture>.2?3:0;act.anticipation=m.charge;}
  ctx.clearRect(0,0,480,640);root.Stage02Garden.draw(ctx,images,data.gardenLayout,s.index<0?s.tick/60:flow.bossTicks/60,s.index<0?'tour':'boss',reduced,true);
  common.begin(ctx,m);common.underlay(ctx,m,reduced);root.DanmakuStageArt.effects(ctx,s,effects,reduced);sources(ctx,flow,act,reduced);
  if(s.index>=0){var origin=m.origin||[s.boss.x/64,s.boss.y/64];root.Stage02RefinedSprites.draw(ctx,'lingyu',act.pose,origin[0],origin[1],m.bossAlpha);}
  mobs(ctx,s,reduced);s.shots.forEach(function(shot){root.DanmakuWeapons.drawShot(ctx,shot,reduced);});
  s.enemies.forEach(function(e){root.GardenBulletMaterials.draw(ctx,e,s.index,s.tick,reduced);});common.effects(ctx,m,reduced);
  root.DanmakuStageView.bomb(ctx,s,reduced);common.title(ctx,m);root.DanmakuPlayerView.sprite(ctx,images.player,s.player,reduced?0:flow.tick);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);root.DanmakuStageView.feedback(ctx,s);common.end(ctx,m);
  lastModel={show:m,acting:act,emitters:s.emitters.filter(function(e){return s.tick-e.born<=18;}).map(function(e){return{x:e.x,y:e.y,born:e.born,kind:e.kind,count:e.count};})};return m;
 }
 root.Stage02RefinedView={init:init,draw:draw,model:model,mobPose:mobPose,bossAct:bossAct,inspect:function(){return lastModel;}};
}(window));
