/* (C) 2026 Carinoasd. Readable bomb burst, clearing field and protection: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./notice-frames-v6.js'));else{var api=factory(root.DanmakuNoticeFrames);root.DanmakuBombView=api;root.DanmakuStageView=Object.assign({},root.DanmakuStageView,{bomb:api.draw});}
}(typeof globalThis!=='undefined'?globalThis:this,function(frames){
 'use strict';
 function model(s,reduced){var age=s.tick-s.lastBomb,d=s.rules.stage01.bomb.clearTicks;if(!s.bombMode||age<0||age>=d)return null;return{age:age,progress:age/d,fade:Math.min(1,(d-age)/24),impact:Math.max(0,1-age/22),radius:32+Math.min(1,age/32)*760,x:s.bombX/64,y:s.bombY/64,player:[s.player.x/64,s.player.y/64],protected:s.tick<s.player.invulUntil,reduced:!!reduced};}
 function ring(c,x,y,r,color,width,alpha){c.globalAlpha=alpha;c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();}
 function draw(c,s,reduced){var m=model(s,reduced);if(!m)return false;var x=m.x,y=m.y,fade=m.fade,age=m.age;c.save();frames.clipOutsideBoss(c);
  c.fillStyle='#9cdde8';c.globalAlpha=(reduced?.08:.1+.12*m.impact)*fade;c.fillRect(0,0,480,640);
  if(!reduced){
   // One soft impact, then a travelling front. No repeating white strobe or shake.
   var glow=c.createRadialGradient(x,y,0,x,y,Math.max(80,90+age*17));glow.addColorStop(0,'#fff1b9');glow.addColorStop(.25,'#e7f5de99');glow.addColorStop(1,'#99dcec00');c.globalAlpha=.65*m.impact;c.fillStyle=glow;c.fillRect(0,0,480,640);
   ring(c,x,y,m.radius,'#a6eafa',18,.2*fade);ring(c,x,y,m.radius,'#fff2c4',5,.85*fade);ring(c,x,y,m.radius*.72,'#c0e8ec',2,.6*fade);
   c.fillStyle='#e5f0de';c.globalAlpha=.17*fade;c.fillRect(x-48,0,96,640);c.fillStyle='#ffedb0';c.globalAlpha=.7*fade;c.fillRect(x-2,0,4,640);
   for(var side=-1;side<=1;side+=2)for(var f=0;f<6;f++){var reach=45+Math.min(1,age/12)*120+f*9;c.beginPath();c.moveTo(x+side*10,y-8);c.quadraticCurveTo(x+side*reach*.5,y-130-f*10,x+side*reach,y-96-f*16);c.quadraticCurveTo(x+side*reach*.8,y+f*8,x+side*12,y+18);c.closePath();c.globalAlpha=(.32+f*.025)*fade;c.fillStyle=f%2?'#c7e9ec':'#fff1ce';c.fill();c.globalAlpha=.78*fade;c.lineWidth=1.5;c.strokeStyle='#fff1c5';c.stroke();}
   c.strokeStyle='#fff3c4';c.lineWidth=2;for(var i=0;i<24;i++){var a=i*Math.PI/12+.15,d=35+age*(3+i%4*.6),xx=x+Math.cos(a)*d,yy=y+Math.sin(a)*d;c.globalAlpha=.8*fade;c.beginPath();c.moveTo(xx-5,yy);c.lineTo(xx+5,yy);c.moveTo(xx,yy-5);c.lineTo(xx,yy+5);c.stroke();}
  }
  // The persistent edge and player-centred shield explain the full clearing window.
  c.globalAlpha=.58*fade;c.strokeStyle='#d1ecdc';c.lineWidth=3;c.strokeRect(5,5,470,630);
  if(m.protected){ring(c,m.player[0],m.player[1],25,'#fff0ad',3,.95*fade);ring(c,m.player[0],m.player[1],29,'#b7e7ed',1,.55*fade);}
  c.restore();c.save();frames.bomb(c,m,s.rules.stage01.bomb.name||'星翼绽放');
  c.restore();return true;
 }
 return{model:model,draw:draw};
}));
