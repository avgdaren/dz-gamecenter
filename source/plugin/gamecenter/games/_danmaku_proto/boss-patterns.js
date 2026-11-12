/* (C) 2026 Carinoasd. Distinct Boss patterns for r3: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuBossPatterns=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function capture(sim){
    var dx=sim.player.x-sim.boss.x,dy=sim.player.y-sim.boss.y,best=-Infinity;
    sim.rules.directionVectors.forEach(function(v,i){var dot=dx*v[0]+dy*v[1];if(dot>best){best=dot;sim.aimAngle=i;}});
  }
  function pattern(sim){
    var config=sim.rules.bossPatternsR3,p=config[sim.index],q=1+(sim.tick-1)%p.cycleTicks,c=Math.floor((sim.tick-1)/p.cycleTicks),i;
    if(sim.index===0){
      var echo=p.fireTicks.indexOf(q-p.echoDelay)>=0,main=p.fireTicks.indexOf(q)>=0;
      if(!main&&!echo)return;
      var rotation=p.rotations[c%p.rotations.length];
      for(i=0;i<p.slots;i++){
        var angle=Math.floor(i*512/p.slots)+rotation,d=(angle-128+768)%512-256;
        if(Math.abs(d)<=p.gapHalfAngle)continue;
        sim.spawn(sim.boss.x,sim.boss.y,angle,echo?p.echoSpeed:p.speed,p.radius);
      }
    }else if(sim.index===1){
      if(p.captureTicks.indexOf(q)>=0){capture(sim);sim.warningUntil=sim.tick+p.warningTicks;}
      if(p.fireTicks.indexOf(q)>=0)p.angles.forEach(function(a){sim.spawn(sim.boss.x,sim.boss.y,sim.aimAngle+a,p.speed,p.radius);});
    }else{
      if(p.wallTicks.indexOf(q)>=0){
        var gap=p.gapCenters[c%p.gapCenters.length];
        p.columns.forEach(function(x){if(Math.abs(x-gap)>p.gapHalfWidth)sim.spawn(x*64,p.wallY*64,128,p.wallSpeed,p.wallRadius);});
      }
      if(p.fanTicks.indexOf(q)>=0){
        p.leftAngles.forEach(function(a){sim.spawn(24*64,80*64,a,p.fanSpeed,p.fanRadius);});
        p.rightAngles.forEach(function(a){sim.spawn(456*64,80*64,a,p.fanSpeed,p.fanRadius);});
      }
    }
  }
  function bullet(ctx,e,index){
    var x=e.x/64,y=e.y/64,r=e.radius;
    ctx.save();ctx.translate(x,y);ctx.lineWidth=1;
    if(index===0){
      ctx.fillStyle='#68dce5';ctx.strokeStyle='#dcfbff';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#20496b';ctx.beginPath();ctx.arc(0,0,Math.max(1,r-2),0,Math.PI*2);ctx.fill();
    }else if(index===1){
      ctx.rotate(Math.atan2(e.vx,-e.vy));ctx.fillStyle='#b59aff';ctx.strokeStyle='#eee5ff';
      ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(r,2);ctx.lineTo(0,6);ctx.lineTo(-r,2);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#7866b4';ctx.beginPath();ctx.moveTo(0,9);ctx.lineTo(0,14);ctx.stroke();
    }else{
      ctx.fillStyle='#efc66d';ctx.strokeStyle='#fff2c9';ctx.beginPath();
      for(var i=0;i<8;i++){var a=i*Math.PI/4-Math.PI/2,dist=i%2?r*.58:r*1.42;ctx[i?'lineTo':'moveTo'](Math.cos(a)*dist,Math.sin(a)*dist);}ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#91613f';ctx.fillRect(-1,-1,2,2);
    }
    ctx.restore();
  }
  return{pattern:pattern,bullet:bullet};
}));
