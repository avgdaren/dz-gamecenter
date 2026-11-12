/* (C) 2026 Carinoasd. Stage art, telegraphs and fallback shapes: 小典 / Codex. */
(function(root){
  'use strict';
  function circle(ctx,x,y,r,fill,stroke){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
  function field(ctx,sim,images,reduced){
    if(!sim.mobs)return;
    var r=sim.rules,t=sim.tick;
    sim.mobs.forEach(function(m){
      var x=m.x/64,y=m.y/64,type=r.stage01.types[m.type];
      if(t<m.warningUntil){
        if(m.warningKind===1){var v=r.directionVectors[m.aim];ctx.strokeStyle='#a6c6f0';ctx.setLineDash([4,8]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+v[0]*.18,y+v[1]*.18);ctx.stroke();ctx.setLineDash([]);}
        else circle(ctx,x,y,type.radius+10,null,'#a3bad5');
      }
      if(!root.DanmakuStageArt||!root.DanmakuStageArt.mob(ctx,images,sim,m,reduced)){
      ctx.save();ctx.translate(Math.round(x),Math.round(y));
      if(m.type===0){
        ctx.fillStyle='#283c65';ctx.fillRect(-8,-8,16,16);
        ctx.fillStyle='#b7cde9';ctx.fillRect(-18,-2,11,5);ctx.fillRect(-14,-7,7,6);ctx.fillRect(7,-2,11,5);ctx.fillRect(7,-7,7,6);
        ctx.fillStyle='#5d8db9';ctx.fillRect(-7,-14,14,8);ctx.fillStyle='#ebdccd';ctx.fillRect(-5,-7,10,8);
        ctx.fillStyle='#283c65';ctx.fillRect(-6,2,12,10);ctx.fillStyle='#e3e9f1';ctx.fillRect(-9,11,18,4);
        ctx.fillStyle='#14263d';ctx.fillRect(-4,-3,2,2);ctx.fillRect(2,-3,2,2);
      }else if(m.type===1){
        ctx.fillStyle='#3b355d';ctx.fillRect(-10,-10,20,20);
        ctx.fillStyle='#6d648e';ctx.fillRect(-8,-20,16,9);ctx.fillStyle='#eadbd4';ctx.fillRect(-5,-11,10,8);
        ctx.fillStyle='#3b355d';ctx.fillRect(-7,-2,14,22);ctx.fillStyle='#c4b6df';ctx.fillRect(-12,0,4,17);ctx.fillRect(8,0,4,17);
        ctx.fillStyle='#e3d4ab';ctx.fillRect(16,-12,2,28);ctx.fillRect(13,-16,8,5);
      }else{
        circle(ctx,0,0,28,'#1d2e47','#e5c98f');circle(ctx,0,0,20,null,'#6e8bab');
        ctx.fillStyle='#d9c191';ctx.fillRect(-34,-4,12,8);ctx.fillRect(22,-4,12,8);ctx.fillRect(-4,-34,8,12);ctx.fillRect(-4,22,8,12);
        ctx.rotate(Math.PI/4);ctx.fillStyle='#8caacb';ctx.fillRect(-9,-9,18,18);ctx.fillStyle='#eff3d9';ctx.fillRect(-3,-3,6,6);
      }
      ctx.restore();
      }
      var width=m.type===2?50:25,label=root.DanmakuStageArt?root.DanmakuStageArt.labelOffset(m.type):type.radius+15;
      ctx.fillStyle='#273447';ctx.fillRect(x-width/2,y-label,width,2);
      ctx.fillStyle='#c8d5e8';ctx.fillRect(x-width/2,y-label,width*m.hp/type.hp,2);
      if(m.reward){ctx.font='10px "Microsoft YaHei",sans-serif';ctx.fillStyle='#efcf85';ctx.textAlign='center';ctx.fillText('✦',x,y-label-7);ctx.textAlign='start';}
    });
    sim.drops.forEach(function(d){
      var isBomb=d.kind===1,x=Math.round(d.x/64),y=Math.round(d.y/64);ctx.fillStyle=isBomb?'#57452b':d.recovery?'#6f552f':'#294b62';ctx.fillRect(x-7,y-7,14,14);
      ctx.strokeStyle=isBomb||d.recovery?'#efcf85':'#9cdef0';ctx.strokeRect(x-7,y-7,14,14);
      ctx.fillStyle='#f1f4ec';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText(isBomb?'B':'P',x,y+3);ctx.textAlign='start';
      if(d.value>1){ctx.font='9px monospace';ctx.fillStyle='#efcf85';ctx.fillText('×'+d.value,x+10,y+3);}
    });
  }
  function feedback(ctx,sim){
    var text=sim.tick-sim.lastUpgrade<75?'火力提升 '+['Ⅰ','Ⅱ','Ⅲ'][root.DanmakuStage01.level(sim.player.power,sim.rules)-1]:sim.tick-sim.lastDowngrade<60?'强化可捡回':'';
    if(text){ctx.font='12px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#e9d49e';ctx.fillText(text,sim.player.x/64,sim.player.y/64-38);ctx.textAlign='start';}
    if(sim.bombMode&&sim.tick-sim.lastBombPickup<60){ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f4dc9e';ctx.fillText(sim.lastBombOverflow===sim.lastBombPickup?'大招已满 +500':'大招 +1',sim.player.x/64,sim.player.y/64-(text?54:38));ctx.textAlign='start';}
  }
  function bomb(ctx,sim,reduced){
    if(!sim.bombMode)return false;
    var duration=sim.rules.stage01.bomb.clearTicks,age=sim.tick-sim.lastBomb;
    if(age<0||age>=duration)return false;
    var progress=(age+1)/duration,fade=1-progress,x=sim.bombX/64,y=sim.bombY/64,p=sim.player;
    ctx.save();ctx.lineWidth=1.5;ctx.globalAlpha=.3+.6*fade;
    circle(ctx,p.x/64,p.y/64,22,null,'#f1d79d');
    if(!reduced){
      var radius=24+progress*760;
      ctx.globalAlpha=.55*fade;circle(ctx,x,y,radius,null,'#eed29a');circle(ctx,x,y,radius*.72,null,'#a6e1f1');
      ctx.beginPath();
      for(var i=0;i<16;i++){var angle=i*Math.PI/8-Math.PI/2,rr=radius*(i%2?.56:.94),xx=x+Math.cos(angle)*rr,yy=y+Math.sin(angle)*rr;if(i)ctx.lineTo(xx,yy);else ctx.moveTo(xx,yy);}
      ctx.closePath();ctx.strokeStyle='#e6d4b2';ctx.lineWidth=1;ctx.stroke();
      var spread=16+Math.min(1,age/18)*28;ctx.globalAlpha=.75*fade;ctx.strokeStyle='#deedf1';ctx.lineWidth=2;
      for(var side=-1;side<=1;side+=2)for(var feather=0;feather<3;feather++){
        ctx.beginPath();ctx.moveTo(p.x/64+side*8,p.y/64-4);
        ctx.quadraticCurveTo(p.x/64+side*(spread+feather*10),p.y/64-26+feather*4,p.x/64+side*(spread+feather*8),p.y/64+6+feather*5);ctx.stroke();
      }
    }
    if(age<36){ctx.globalAlpha=.85*(1-age/36);ctx.font=(reduced?'14':'18')+'px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillStyle='#f0d9a8';ctx.fillText(sim.rules.stage01.bomb.name,240,260);}
    ctx.restore();return true;
  }
  root.DanmakuStageView={field:field,feedback:feedback,bomb:bomb};
}(typeof globalThis!=='undefined'?globalThis:this));
