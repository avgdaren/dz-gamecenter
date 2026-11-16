/* (C) 2026 Carinoasd. Garden readable sprites and boss performance: 小典 / Codex. */
(function(root){
 'use strict';
 var guardian=null,effects=[],lastSim=null,lastTick=-1,lastMobs=[],lastModel=null;
 var P=root.Stage02Performance;
 function init(images,layout){
  root.GardenBulletMaterials.init(images,layout);root.Stage02BattleSprites.init(images);
  guardian=document.createElement('canvas');guardian.width=78;guardian.height=78;var c=guardian.getContext('2d');c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';var w=images.enemies.naturalWidth/3;c.drawImage(images.enemies,w*2,0,w,images.enemies.naturalHeight,0,0,78,78);
  effects=[];lastSim=null;lastModel=null;
 }
 function stroke(ctx,color,alpha,width,draw){ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.beginPath();draw();ctx.stroke();ctx.restore();}
 function wind(ctx,x,y,r,t,color,alpha,reduced){
  for(var i=0;i<2;i++)stroke(ctx,color,alpha*(i? .62:1),1.2,function(){var a=(reduced?0:t*.012)+i*Math.PI;ctx.ellipse(x,y,r,r*.31,a*.08,a,a+Math.PI*1.25);});
 }
 function ornament(ctx,key,x,y,size,angle,alpha){root.GardenBulletMaterials.ornament(ctx,key,x,y,size,angle,alpha);}
 function behindBoss(ctx,run,m,reduced,flow){
  var x=m.x,y=m.y,t=run.time;
  if(m.intro&&t<105){var p=t/105;
   stroke(ctx,'#6c967c',Math.sin(p*Math.PI)*.48,1.5,function(){ctx.moveTo(390,-10);ctx.bezierCurveTo(300,10,370,125,240,145);});
   if(!reduced)for(var k=0;k<7;k++){var u=(p+k*.09)%1;ornament(ctx,k%2?'petal':'leaf',342-112*u+Math.sin(u*7)*22,-20+u*175,9,1.2+u*2,Math.sin(u*Math.PI)*.55);}
  }
  if(flow.phase==='victory'){
   var v=flow.victoryTicks/75;wind(ctx,run.sim.boss.x/64,112,24+v*100,t,'#b4965d',(1-v)*.65,reduced);
   if(!reduced)for(var j=0;j<12;j++){var a=j*Math.PI/6,d=18+v*115;ornament(ctx,j%3?'petal':'leaf',run.sim.boss.x/64+Math.cos(a)*d,112+Math.sin(a)*d*.5-v*35,9-v*3,a+v,(1-v)*.65);}
  }
  if(m.alpha<=0)return;
  if(m.transition){
   var q=m.transitionTick/120,burst=Math.min(1,q*4);
   wind(ctx,240,105,28+burst*116,t,m.color,(1-q)*.5,reduced);
   if(!reduced)for(var b=0;b<(m.index===1?10:6);b++){var a=b*Math.PI/(m.index===1?5:3)+q*.5,r=25+burst*95;ornament(ctx,m.index===1?'petal':'bud',240+Math.cos(a)*r,105+Math.sin(a)*r*.55,12,a+.7,(1-q)*.64);}
  }else if(!reduced&&!m.intro&&flow.phase==='boss'){
   if(m.index===0){
    for(var i=0;i<2;i++)stroke(ctx,'#668d7f',.10,1.1,function(){var drift=Math.sin(t*.014+i)*10;ctx.moveTo(30,84+i*65);ctx.bezierCurveTo(160,20+drift+i*75,290,155+drift+i*10,450,90+i*62);});
   }else if(m.index===1){
    for(var n=0;n<5;n++){var a=n*Math.PI*2/5+t*.004;ornament(ctx,'petal',x+Math.cos(a)*53,y+18+Math.sin(a)*35,12,a+Math.PI/2,.15);}
   }
  }
  if(m.cast>0){
   var staffX=x-29,staffY=y-30;
   wind(ctx,staffX,staffY,6+m.cast*12,t,m.color,m.cast*.5,reduced);
   if(m.anticipation>0&&!reduced)for(var s=0;s<3;s++){var a=t*.045+s*Math.PI*2/3,r=20*(1-m.anticipation)+5;ornament(ctx,m.index===1?'petal':m.index===2?'bud':'leaf',staffX+Math.cos(a)*r,staffY+Math.sin(a)*r*.7,6,a,m.anticipation*.65);}
   if(m.release>0){
    var origins=(run.sim.emitters||[]).filter(function(e){return run.sim.tick-e.born<8;}).slice(-4);
    origins.forEach(function(e){stroke(ctx,m.color,m.release*.26,1,function(){ctx.moveTo(staffX,staffY);ctx.quadraticCurveTo((staffX+e.x)/2,y+30,e.x,e.y);});});
   }
  }
 }
 function introCard(ctx,images,t,reduced){
  if(t<58||t>286)return;
  var enter=P.ease((t-58)/35),exit=P.clamp((286-t)/36,0,1),alpha=enter*exit;
  ctx.save();ctx.globalAlpha=alpha;
  var g=ctx.createLinearGradient(0,0,480,0);g.addColorStop(0,'#16383bdf');g.addColorStop(.6,'#214e45bd');g.addColorStop(1,'#1a393d18');ctx.fillStyle=g;ctx.fillRect(0,220,480,330);
  ctx.save();ctx.beginPath();ctx.rect(120,44,360,510);ctx.clip();ctx.drawImage(images.portrait,135+(reduced?0:(1-enter)*42),36,340,510);ctx.restore();
  ctx.fillStyle='#e7c889';ctx.fillRect(29,390,35,2);ctx.fillStyle='#fcf1d9';ctx.font='15px "Microsoft YaHei",sans-serif';ctx.fillText('司 风 天 使',28,426);ctx.font='bold 34px "Microsoft YaHei",sans-serif';ctx.fillText('铃 羽',25,474);ctx.fillStyle='#e3d7bc';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText('风铃花庭',29,505);ctx.restore();
 }
 function boss(ctx,images,run,reduced,flow){
  var m=P.boss(run,flow.phase,flow.victoryTicks);lastModel=m;behindBoss(ctx,run,m,reduced,flow);
  var hover=reduced||m.intro||flow.phase==='victory'?0:Math.sin(run.time*.035)*.8;
  var spriteAlpha=m.alpha;if(m.intro)spriteAlpha*=run.time<105?P.clamp((105-run.time)/35,0,1):P.clamp((run.time-280)/32,0,1);
  root.Stage02BattleSprites.draw(ctx,'lingyu',m.pose,m.x,m.y+hover,spriteAlpha,reduced?0:m.pose===1?Math.sin(run.time*.018)*.012:0);
  if(run.sim.tick-(run.sim.hitTick===undefined?-999:run.sim.hitTick)<3&&m.alpha>0){wind(ctx,m.x,m.y+2,22,run.time,'#e4ba64',.5,true);}
  if(m.intro)introCard(ctx,images,m.introTick,reduced);
  if(m.transition){var a=Math.sin(Math.min(1,m.transitionTick/110)*Math.PI);ctx.save();ctx.globalAlpha=a;ctx.fillStyle='#1e4545d9';ctx.fillRect(92,202,296,42);ctx.fillStyle='#fff0d6';ctx.font='18px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText(m.title,240,230);ctx.restore();}
 }
 function field(ctx,run,reduced){
  var s=run.sim,t=s.tick;
  if(lastSim!==s){lastSim=s;lastTick=-1;lastMobs=[];effects=[];}
  if(lastTick!==t){var alive=new Set(s.mobs.map(function(m){return m.id;}));lastMobs.forEach(function(m){if(!alive.has(m.id)&&t-m.born<s.rules.stage01.types[m.type].life)effects.push({x:m.x/64,y:m.y/64,born:t,type:m.type});});effects=effects.filter(function(e){return t-e.born<24;}).slice(-14);lastMobs=s.mobs.map(function(m){return{id:m.id,x:m.x,y:m.y,born:m.born,type:m.type};});lastTick=t;}
  s.mobs.forEach(function(m){
   var a=P.mob(s,m),x=m.x/64,y=m.y/64;
   if(m.warningUntil>t){
    stroke(ctx,m.type===0?'#56816b':'#9e8650',.25+a.anticipation*.30,1,function(){ctx.ellipse(x,y,9+a.anticipation*6,4+a.anticipation*3,0,0,Math.PI*2);});
    ctx.save();ctx.strokeStyle='#8f6942';ctx.globalAlpha=.45;ctx.setLineDash([3,7]);var v=s.rules.directionVectors[m.aim];ctx.beginPath();ctx.moveTo(x,y+10);ctx.lineTo(x+v[0]*.09,y+v[1]*.09);ctx.stroke();ctx.restore();
   }
   var hover=reduced?0:Math.sin((t+m.id*9)*.06)*.6;
   if(m.type<2)root.Stage02BattleSprites.draw(ctx,m.type===0?'fairy':'attendant',a.pose,x,y+hover,1,0);
   else{ctx.save();ctx.translate(Math.round(x),Math.round(y+hover));if(!reduced)ctx.rotate(Math.sin(t*.018)*.035);ctx.drawImage(guardian,-39,-39);ctx.restore();}
   if(a.release>0)wind(ctx,x,y,8+(1-a.release)*15,t,m.type===0?'#54856b':'#a88b55',a.release*.5,reduced);
   if(t-(m.hitTick===undefined?-999:m.hitTick)<3)wind(ctx,x,y,s.rules.stage01.types[m.type].radius+4,t,'#d9b66b',.65,true);
   var top=y-(m.type===0?34:m.type===1?42:42);ctx.fillStyle='#244c4dbb';ctx.fillRect(Math.round(x)-14,Math.round(top),28,2);ctx.fillStyle='#bd9754';ctx.fillRect(Math.round(x)-14,Math.round(top),28*m.hp/s.rules.stage01.types[m.type].hp,2);
  });
  effects.forEach(function(e){var age=t-e.born;wind(ctx,e.x,e.y,5+age*(e.type===2?1.5:.8),t,e.type===2?'#9d7136':'#346f7c',(1-age/24)*.7,reduced);if(!reduced)for(var i=0;i<6;i++){var a=i*Math.PI/3,d=8+age*.9;ornament(ctx,i%2?'petal':'leaf',e.x+Math.cos(a)*d,e.y+Math.sin(a)*d,7,a,(1-age/24)*.8);}});
  s.drops.forEach(function(d){var x=d.x/64,y=d.y/64;ctx.fillStyle=d.kind===1?'#87612e':d.kind===2?'#346e9b':'#3f6f62';ctx.strokeStyle='#fff4d4';ctx.lineWidth=1;ctx.fillRect(x-7,y-7,14,14);ctx.strokeRect(x-7,y-7,14,14);ctx.fillStyle='#fff9e9';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(d.kind===1?'B':d.kind===2?'S':'P',x,y+3);ctx.textAlign='left';});
 }
 function draw(ctx,images,layout,run,reduced,focused,flow){
  flow=flow||{phase:run.sim.index<0?'stage':'boss',victoryTicks:0};var s=run.sim,isStage=s.index<0;
  ctx.clearRect(0,0,480,640);root.Stage02Garden.draw(ctx,images,layout,run.time/60,isStage?'tour':'boss',reduced,true);
  lastModel=isStage?null:P.boss(run,flow.phase,flow.victoryTicks);root.GardenBulletMaterials.emitters(ctx,s,reduced,lastModel,flow.phase);
  if(!isStage)boss(ctx,images,run,reduced,flow);
  field(ctx,run,reduced);s.shots.forEach(function(shot){root.DanmakuWeapons.drawShot(ctx,shot,reduced);});
  s.enemies.forEach(function(e){root.GardenBulletMaterials.draw(ctx,e,s.index,s.tick,reduced);});
  root.DanmakuStageView.bomb(ctx,s,reduced);root.DanmakuPlayerView.sprite(ctx,images.player,s.player,reduced?0:run.time);root.DanmakuPlayerView.hitpoint(ctx,s.player,focused);
  if(s.testInvincible){ctx.save();ctx.strokeStyle='#756534';ctx.lineWidth=1;ctx.beginPath();ctx.arc(s.player.x/64,s.player.y/64,18,0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.fillStyle='#183d42e8';ctx.fillRect(0,0,480,34);ctx.fillStyle='#fff3d5';ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText('生命 '+s.player.lives+'   火力 '+root.DanmakuStage01.level(s.player.power,s.rules)+'/5   B '+s.player.bombs,14,22);
  if(!isStage){ctx.fillStyle='#274e51';ctx.fillRect(232,10,226,5);ctx.fillStyle='#d9b773';ctx.fillRect(232,10,226*Math.max(0,s.hp)/s.hpMax,5);ctx.fillStyle='#ebd6b2';ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillText((s.index+1)+' / 3  '+P.names[s.index],234,28);}
 }
 root.Stage02JourneyBattleView={init:init,draw:draw,inspect:function(){return{version:2,boss:lastModel?Object.assign({},lastModel):null,sprites:root.Stage02BattleSprites.inspect(),meshDeformation:false};}};
}(window));
