/* (C) 2026 Carinoasd. Side-by-side Stage 1/2 reference renderer: 小典 / Codex. */
(function(root){
 'use strict';var images,layout,mobs,bossImages,effects=[null,null];
 function init(loaded,data){images=loaded;layout=data;root.GardenBulletMaterials.init(images,data.materialLayout);root.Stage02UnitySprites.init(images,data.spriteLayout);
  mobs={corridor:images.corridor,fairy:images.refFairy,attendant:images.refAttendant,guardian:images.refGuardian};bossImages={body:images.refBoss,back:images.refBack,front:images.refFront,face:images.refFace};effects=[root.DanmakuStageArt.createEffects(),root.DanmakuStageArt.createEffects()];}
 function background(ctx,index,t,reduced,neutral){
  ctx.clearRect(0,0,480,640);if(neutral){ctx.fillStyle='#152238';ctx.fillRect(0,0,480,640);ctx.strokeStyle='#304259';ctx.lineWidth=.5;for(var x=0;x<480;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,640);ctx.stroke();}return;}
  if(index===0)root.DanmakuStageArt.background(ctx,images.corridor,t,reduced);else root.Stage02Garden.draw(ctx,images,layout.gardenLayout,t/60,'tour',reduced,true);
 }
 function player(ctx,s,t,reduced,focused){root.DanmakuPlayerView.sprite(ctx,images.player,s.player,reduced?0:t);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);}
 function boss(ctx,index,s,t,reduced,model){
  if(index===0)root.DanmakuBossView.sprite(ctx,bossImages,s,t,reduced,model&&model.kind==='phase'?'transition':'active',model);
  else{var origin=model&&model.origin||[s.boss.x/64,s.boss.y/64],alpha=model?model.bossAlpha:1;root.Stage02UnitySprites.draw(ctx,'lingyu',origin[0],origin[1],t,reduced,alpha);}
 }
 function labels(ctx){ctx.fillStyle='#b7c7dc';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('妖精',108,368);ctx.fillText('侍从',230,368);ctx.fillText('Boss',355,368);ctx.textAlign='start';}
 function roles(ctx,index,s,t,reduced,neutral,focused){
  background(ctx,index,t,reduced,neutral);
  [0,1].forEach(function(type){var m={id:type+1,type:type,born:0,x:(type===0?108:230)*64,y:280*64,px:(type===0?108:230)*64,py:280*64,warningUntil:0,warningKind:0,reward:0,hp:s.rules.stage01.types[type].hp};
   if(index===0)root.DanmakuStageArt.mob(ctx,mobs,s,m,reduced);else root.Stage02UnitySprites.draw(ctx,type===0?'fairy':'attendant',m.x/64,m.y/64,t,reduced,1);
  });boss(ctx,index,s,t,reduced,{origin:[355,280],bossAlpha:1,kind:'none'});labels(ctx);player(ctx,s,t,reduced,focused);
 }
 function acting(ctx,index,s,kind,age,reduced,focused){
  if(index===0){background(ctx,0,0,reduced,false);}else{ctx.clearRect(0,0,480,640);root.Stage02Garden.draw(ctx,images,layout.gardenLayout,kind==='intro'?age/60:(390+age)/60,'boss',reduced,true);}
  var m=root.Stage02UnityShow.model(index,kind,age,reduced);root.DanmakuStageShow.begin(ctx,m);boss(ctx,index,s,age,reduced,m);root.DanmakuStageShow.effects(ctx,m,reduced);player(ctx,s,age,reduced,focused);root.DanmakuStageShow.end(ctx,m);return m;
 }
 function drops(ctx,s){s.drops.forEach(function(d){var x=Math.round(d.x/64),y=Math.round(d.y/64);ctx.save();if(d.kind===2){ctx.fillStyle='#286bba';ctx.strokeStyle='#b2e5ff';ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+8,y);ctx.lineTo(x,y+8);ctx.lineTo(x-8,y);ctx.closePath();ctx.fill();ctx.stroke();}else{ctx.fillStyle=d.kind===1?'#57452b':d.recovery?'#6f552f':'#294b62';ctx.fillRect(x-7,y-7,14,14);ctx.strokeStyle=d.kind===1||d.recovery?'#efcf85':'#9cdef0';ctx.strokeRect(x-7,y-7,14,14);}ctx.fillStyle='#f1f4ec';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(d.kind===2?'S':d.kind===1?'B':'P',x,y+3);ctx.restore();});}
 function secondField(ctx,s,reduced){
  var t=s.tick;
  s.mobs.forEach(function(m){var x=m.x/64,y=m.y/64,type=s.rules.stage01.types[m.type];
   if(t<m.warningUntil){ctx.strokeStyle='#a6c6f0';if(m.warningKind===1){var v=s.rules.directionVectors[m.aim];ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+v[0]*.18,y+v[1]*.18);ctx.stroke();ctx.setLineDash([]);}else{ctx.beginPath();ctx.arc(x,y,type.radius+10,0,Math.PI*2);ctx.stroke();}}
   root.Stage02UnitySprites.draw(ctx,m.type===0?'fairy':'attendant',x,y,t,reduced,1);
   var label=m.type===0?28:36;ctx.fillStyle='#273447';ctx.fillRect(x-12.5,y-label,25,2);ctx.fillStyle='#c8d5e8';ctx.fillRect(x-12.5,y-label,25*m.hp/type.hp,2);
   if(m.reward){ctx.fillStyle='#efcf85';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('✦',x,y-label-7);ctx.textAlign='start';}
  });drops(ctx,s);
 }
 function firstBullet(ctx,e){var x=e.x/64,y=e.y/64;if(e.kind===1){ctx.fillStyle='#d1b9f0';ctx.fillRect(x-4,y-6,8,12);return;}ctx.beginPath();ctx.arc(x,y,e.radius,0,Math.PI*2);ctx.fillStyle=e.radius===5?'#efbcbb':e.radius===4?'#e9c47c':'#a7baef';ctx.fill();ctx.strokeStyle='#fff0e2';ctx.stroke();ctx.beginPath();ctx.arc(x,y,1.3,0,Math.PI*2);ctx.fillStyle='#6b4b68';ctx.fill();}
 function wave(ctx,index,s,t,reduced,focused){
  background(ctx,index,t,reduced,false);root.DanmakuStageArt.effects(ctx,s,effects[index],reduced);
  if(index===0)root.DanmakuStageView.field(ctx,s,mobs,reduced);else secondField(ctx,s,reduced);
  s.shots.forEach(function(e){root.DanmakuWeapons.drawShot(ctx,e,reduced);});player(ctx,s,t,reduced,focused);root.DanmakuStageView.feedback(ctx,s);
  s.enemies.forEach(function(e){if(index===0)firstBullet(ctx,e);else root.GardenBulletMaterials.draw(ctx,Object.assign({},e,{kind:e.kind===0?22:23}),0,s.tick,reduced);});
  root.DanmakuStageView.bomb(ctx,s,reduced);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);
 }
 function contact(){
  var c=document.createElement('canvas');c.width=960;c.height=390;var ctx=c.getContext('2d');ctx.fillStyle='#152238';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#e7d2ac';ctx.font='14px "Microsoft YaHei",sans-serif';ctx.fillText('第一关 · 当前运行素材',24,25);ctx.fillText('第二关 · 标准姿态候选',504,25);
  var refs=[images.refFairy,images.refAttendant,images.refBoss],sizes=[[48,48],[48,64],[96,128]],keys=['fairy','attendant','lingyu'];
  for(var i=0;i<3;i++){var x=[30,145,280][i],w=sizes[i][0],h=sizes[i][1],scale=2;ctx.imageSmoothingEnabled=false;ctx.drawImage(refs[i],0,0,w,h,x,64,w*scale,h*scale);ctx.drawImage(root.Stage02UnitySprites.image(keys[i]),x+480,64,w*scale,h*scale);}
  ctx.fillStyle='#9cafca';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText('均为2倍观察；试玩战场中按第一关原尺寸显示',24,363);return c;
 }
 root.Stage02UnityView={init:init,roles:roles,acting:acting,wave:wave,contact:contact};
}(window));
