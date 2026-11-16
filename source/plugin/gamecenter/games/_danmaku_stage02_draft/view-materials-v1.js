/* (C) 2026 Carinoasd. Garden combat draft drawing: 小典 / Codex. */
(function(root){
 'use strict';
 var sizes=[[48,48],[58,66],[78,78]],textures=[],body=null,effects=[],lastSim=null,lastTick=-1,lastMobs=[];
 function init(images,layout){
  root.GardenBulletMaterials.init(images,layout);
  textures=sizes.map(function(size,i){var c=document.createElement('canvas');c.width=size[0];c.height=size[1];var x=c.getContext('2d');x.imageSmoothingEnabled=false;var w=images.enemies.naturalWidth/3;x.drawImage(images.enemies,i*w,0,w,images.enemies.naturalHeight,0,0,c.width,c.height);return c;});
  body=document.createElement('canvas');body.width=110;body.height=142;var context=body.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(images.battle,0,0,110,142);effects=[];
 }
 function triangle(ctx,image,uv,p){
  var a=uv[0],b=uv[1],c=uv[2],v=p[0],q=p[1],r=p[2],det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
  var A=((q.x-v.x)*(c[1]-a[1])-(r.x-v.x)*(b[1]-a[1]))/det,B=((q.y-v.y)*(c[1]-a[1])-(r.y-v.y)*(b[1]-a[1]))/det;
  var C=((r.x-v.x)*(b[0]-a[0])-(q.x-v.x)*(c[0]-a[0]))/det,D=((r.y-v.y)*(b[0]-a[0])-(q.y-v.y)*(c[0]-a[0]))/det;
  ctx.save();ctx.beginPath();p.forEach(function(v,i){ctx[i?'lineTo':'moveTo'](v.x,v.y);});ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,v.x-A*a[0]-C*a[1],v.y-B*a[0]-D*a[1]);ctx.drawImage(image,0,0,1,1);ctx.restore();
 }
 function deform(ctx,image,t,reduced,boss,casting){
  if(reduced){ctx.drawImage(image,0,0);return;}
  var cols=boss?8:4,rows=boss?10:5,w=image.width,h=image.height;
  function vertex(uv){var u=uv[0],v=uv[1],edge=Math.max(0,(Math.abs(u-.5)-.17)/.33),hem=Math.max(0,(v-.45)/.55),arm=Math.max(0,1-Math.abs(v-.4)*5);
   return {x:u*w+Math.sin(t*.075-v*6)*edge*(boss?1.8:1.2)*(hem+.25)+casting*edge*arm*(boss?2.8:1.3),y:v*h+Math.sin(t*.095+u*5)*edge*hem*(boss?1.6:.8)};
  }
  for(var y=0;y<rows;y++)for(var x=0;x<cols;x++){
   var a=[x/cols,y/rows],b=[(x+1)/cols,y/rows],c=[(x+1)/cols,(y+1)/rows],d=[x/cols,(y+1)/rows];triangle(ctx,image,[a,b,c],[vertex(a),vertex(b),vertex(c)]);triangle(ctx,image,[a,c,d],[vertex(a),vertex(c),vertex(d)]);
  }
 }
 function boss(ctx,run,reduced){
  var s=run.sim,x=s.boss.x/64,y=s.boss.y/64,t=run.time,cast=Math.max(0,1-(s.tick-s.lastCast)/18);
  if(run.selection==='boss'&&t<390){x=240;y=88;}
  if(s.index===2){ctx.save();ctx.strokeStyle='#947749';ctx.lineWidth=1;ctx.globalAlpha=.65;[112,240,368].forEach(function(bx,i){var by=i===1?104:124;ctx.beginPath();ctx.arc(bx,by,11+(reduced?0:Math.sin(t/14+i)*2),0,Math.PI*2);ctx.stroke();ctx.fillStyle='#b1863c';ctx.beginPath();ctx.moveTo(bx-5,by+3);ctx.lineTo(bx+5,by+3);ctx.lineTo(bx+3,by-4);ctx.lineTo(bx-3,by-4);ctx.fill();});ctx.restore();}
  ctx.save();ctx.translate(x-55,y-36+(reduced?0:Math.sin(t*.035)*1.2));ctx.imageSmoothingEnabled=false;deform(ctx,body,t,reduced,true,cast);ctx.restore();
  if(s.tick-(s.hitTick||-999)<3){ctx.save();ctx.strokeStyle='#fff5c4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,30,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(cast>0){ctx.save();ctx.globalAlpha=cast*.65;ctx.strokeStyle=s.index===1?'#5575a1':'#8c6c23';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(x-30,y+7,12+(1-cast)*12,0,Math.PI*2);ctx.stroke();ctx.restore();}
  if(run.selection==='boss'&&t<390){
   var sec=t/60,alpha=Math.min(1,sec/.6)*Math.max(0,1-(sec-4.2)/2);
   if(alpha>0){ctx.save();ctx.globalAlpha=alpha;var shade=ctx.createLinearGradient(0,0,480,0);shade.addColorStop(0,'#172e3440');shade.addColorStop(1,'#172e34d0');ctx.fillStyle=shade;ctx.fillRect(0,0,480,640);ctx.drawImage(root.Stage02DraftImages.portrait,110+Math.max(0,1-sec/1.2)*30,56,347,520);ctx.fillStyle='#fff2d7';ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText('司风天使',28,472);ctx.font='34px "Microsoft YaHei",sans-serif';ctx.fillText('铃 羽',26,518);ctx.restore();}
  }
 }
 function field(ctx,run,reduced){
  var s=run.sim,t=s.tick;
  if(lastSim!==s){lastSim=s;lastTick=-1;lastMobs=[];effects=[];}
  if(lastTick!==t){var alive=new Set(s.mobs.map(function(m){return m.id;}));lastMobs.forEach(function(m){if(!alive.has(m.id)&&t-m.born<s.rules.stage01.types[m.type].life)effects.push({x:m.x/64,y:m.y/64,born:t,type:m.type});});effects=effects.filter(function(e){return t-e.born<24;}).slice(-14);lastMobs=s.mobs.map(function(m){return{id:m.id,x:m.x,y:m.y,born:m.born,type:m.type};});lastTick=t;}
  s.mobs.forEach(function(m){var image=textures[m.type],cast=Math.max(0,1-(t-(m.cast||-999))/18),x=m.x/64,y=m.y/64;
   if(m.warningUntil>t){ctx.save();ctx.strokeStyle='#8f6942';ctx.globalAlpha=.7;ctx.setLineDash([3,6]);var v=s.rules.directionVectors[m.aim];ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+v[0]*.12,y+v[1]*.12);ctx.stroke();ctx.restore();}
   ctx.save();ctx.translate(x-image.width/2,y-image.height/2+(reduced?0:Math.sin((t+m.id*9)*.06)*1));ctx.imageSmoothingEnabled=false;deform(ctx,image,t+m.id*17,reduced,false,cast);ctx.restore();
   if(t-(m.hitTick||-999)<3){ctx.save();ctx.strokeStyle='#fff1b7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,s.rules.stage01.types[m.type].radius+4,0,Math.PI*2);ctx.stroke();ctx.restore();}
   ctx.fillStyle='#244c4d';ctx.fillRect(x-17,y-image.height/2-3,34,2);ctx.fillStyle='#c49242';ctx.fillRect(x-17,y-image.height/2-3,34*m.hp/s.rules.stage01.types[m.type].hp,2);
  });
  effects.forEach(function(e){var age=t-e.born;ctx.save();ctx.globalAlpha=(1-age/24)*.8;ctx.strokeStyle=e.type===2?'#9d7136':'#346f7c';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(e.x,e.y,5+age*(e.type===2?1.5:.8),0,Math.PI*2);ctx.stroke();if(!reduced)for(var i=0;i<6;i++){var angle=i*Math.PI/3,d=8+age*.9;ctx.fillStyle=i%2?'#edce91':'#f4d2d9';ctx.fillRect(e.x+Math.cos(angle)*d-2,e.y+Math.sin(angle)*d-2,4,3);}ctx.restore();});
  s.drops.forEach(function(d){var x=d.x/64,y=d.y/64;ctx.fillStyle=d.kind===1?'#87612e':d.kind===2?'#346e9b':'#3f6f62';ctx.strokeStyle='#fff4d4';ctx.lineWidth=1;ctx.fillRect(x-7,y-7,14,14);ctx.strokeRect(x-7,y-7,14,14);ctx.fillStyle='#fff9e9';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(d.kind===1?'B':d.kind===2?'S':'P',x,y+3);ctx.textAlign='left';});
 }
 function draw(ctx,images,layout,run,reduced,focused){
  var s=run.sim,isStage=s.index<0;
  ctx.clearRect(0,0,480,640);root.Stage02Garden.draw(ctx,images,layout,run.time/60,isStage?'tour':'boss',reduced,true);
  if(!isStage)boss(ctx,run,reduced);field(ctx,run,reduced);
  s.shots.forEach(function(shot){root.DanmakuWeapons.drawShot(ctx,shot,reduced);});
  s.enemies.forEach(function(e){root.GardenBulletMaterials.draw(ctx,e,s.index,s.tick,reduced);});
  root.DanmakuStageView.bomb(ctx,s,reduced);root.DanmakuPlayerView.sprite(ctx,images.player,s.player,reduced?0:run.time);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);
  if(s.testInvincible){ctx.save();ctx.strokeStyle='#756534';ctx.lineWidth=1;ctx.beginPath();ctx.arc(s.player.x/64,s.player.y/64,18,0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.fillStyle='#183d42e8';ctx.fillRect(0,0,480,34);ctx.fillStyle='#fff3d5';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText('生命 '+s.player.lives+'   火力 '+root.DanmakuStage01.level(s.player.power,s.rules)+'/5   B '+s.player.bombs,14,22);
  if(!isStage){ctx.fillStyle='#274e51';ctx.fillRect(232,14,226,6);ctx.fillStyle='#d9b773';ctx.fillRect(232,14,226*Math.max(0,s.hp)/s.hpMax,6);}
  if(run.wait>0&&run.time>=390){ctx.save();ctx.fillStyle='#193e4666';ctx.fillRect(0,0,480,640);ctx.fillStyle='#fff3d6';ctx.textAlign='center';ctx.font='22px "Microsoft YaHei",sans-serif';ctx.fillText('风向转变',240,290);ctx.restore();}
 }
 root.Stage02DraftView={init:init,draw:draw};
}(window));
