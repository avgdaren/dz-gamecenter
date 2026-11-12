/* (C) 2026 Carinoasd. Integer homing and focused projectile rendering: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuWeapons=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';var Q=64;
 function targets(sim){
  if(sim.index>=0)return sim.hp>0?[{id:0,x:sim.boss.x,y:sim.boss.y}]:[];
  return sim.mobs.filter(function(m){return m.hp>0&&m.y>=-32*Q&&m.y<=640*Q;}).map(function(m){return{id:m.id,x:m.x,y:m.y};});
 }
 function approach(v,w,step){return v<w?Math.min(w,v+step):Math.max(w,v-step);}
 function tracking(sim){
  var list=targets(sim),config=sim.rules.weapons06.tracking;
  sim.shots.forEach(function(s){
   if(s.kind!==1)return;
   var target=list.find(function(t){return t.id===s.target;});
   if(!target){var best=Infinity;list.forEach(function(t){var d=(t.x-s.x)*(t.x-s.x)+(t.y-s.y)*(t.y-s.y);if(!target||d<best||d===best&&t.id<target.id){best=d;target=t;}});}
   s.target=target?target.id:-1;if(!target)return;
   var dx=target.x-s.x,dy=target.y-s.y,d=Math.max(1,Math.abs(dx),Math.abs(dy));
   s.vx=approach(s.vx,Math.trunc(dx*config.speedQ/d)+0,config.turnStepQ);s.vy=approach(s.vy,Math.trunc(dy*config.speedQ/d)+0,config.turnStepQ);
  });
 }
 function drawShot(ctx,s,reduced){
  var x=s.x/Q,y=s.y/Q;ctx.save();ctx.translate(x,y);
  if(s.kind===2){
   var length=s.level===5?36:28;
   if(!reduced){var glow=ctx.createLinearGradient(0,-8,0,length);glow.addColorStop(0,'#a9edff88');glow.addColorStop(1,'#72bdff00');ctx.fillStyle=glow;ctx.fillRect(-6,-8,12,length+8);}
   ctx.fillStyle='#82c9f4';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(3,-2);ctx.lineTo(2,length-8);ctx.lineTo(0,length);ctx.lineTo(-2,length-8);ctx.lineTo(-3,-2);ctx.closePath();ctx.fill();
   ctx.fillStyle=s.level===5?'#fff6ce':'#effcff';ctx.fillRect(-1,-5,2,length-2);
  }else if(s.kind===3){
   if(!reduced){ctx.strokeStyle='#77dbba';ctx.lineWidth=3;ctx.globalAlpha=.32;ctx.beginPath();ctx.moveTo(-s.vx/Q*5,-s.vy/Q*5);ctx.lineTo(0,0);ctx.stroke();}
   ctx.globalAlpha=1;ctx.rotate(Math.atan2(s.vx,-s.vy));ctx.fillStyle='#9df5d4';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(4,2);ctx.lineTo(0,6);ctx.lineTo(-4,2);ctx.closePath();ctx.fill();ctx.fillStyle='#f0fff9';ctx.fillRect(-1,-6,2,7);
  }else{
   if(!reduced){ctx.globalAlpha=.16;ctx.fillStyle='#77dbba';ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();}
   ctx.globalAlpha=1;ctx.rotate(Math.atan2(s.vx,-s.vy));ctx.fillStyle='#9df5d4';ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(3,0);ctx.lineTo(0,4);ctx.lineTo(-3,0);ctx.closePath();ctx.fill();ctx.fillStyle='#f0fff9';ctx.fillRect(-1,-3,2,4);
  }
  ctx.restore();
 }
 return{tracking:tracking,drawShot:drawShot};
}));
