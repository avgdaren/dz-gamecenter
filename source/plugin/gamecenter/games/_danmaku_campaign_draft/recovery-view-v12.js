/* (C) 2026 Carinoasd. Clock-bound light feathers and return shield: 小典 / Codex. */
(function(root){'use strict';
 function ring(ctx,x,y,r,color,width,start,end){ctx.beginPath();ctx.arc(x,y,r,start||0,end===undefined?Math.PI*2:end);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 function draw(ctx,image,s,flow,reduced,focused,visible){var m=root.DanmakuRecovery.model(s),p=s.player;if(!m){if(visible!==false)root.DanmakuPlayerView.sprite(ctx,image,p,reduced?0:flow.tick);root.DanmakuPlayerView.hitpoint(ctx,p,focused);return;}
  var x=m.x/64,y=m.y/64,age=m.age;ctx.save();
  if(age<48){var fade=Math.max(0,1-age/48),spread=8+(reduced?Math.min(age,24)*1.3:age*1.8);ctx.globalAlpha=fade;
   ring(ctx,x,y,6+age*.9,'#fff2cf',2);ring(ctx,x,y,4+age*1.35,'#b9e9ef',1);
   for(var i=0;i<(reduced?8:16);i++){var a=i*Math.PI*2/(reduced?8:16)+.25,reach=spread*(.65+(i%3)*.18),xx=x+Math.cos(a)*reach,yy=y+Math.sin(a)*reach+age*.18;ctx.save();ctx.translate(xx,yy);ctx.rotate(a+.4);ctx.fillStyle=i%2?'#c0ecf5':'#fff5d8';ctx.beginPath();ctx.moveTo(0,-7);ctx.quadraticCurveTo(5,-1,0,9);ctx.quadraticCurveTo(-3,0,0,-7);ctx.fill();ctx.restore();}
   if(age<8){ctx.globalAlpha=(1-age/8)*.5;root.DanmakuPlayerView.sprite(ctx,image,p,flow.tick);}
  }
  ctx.restore();if(m.hidden)return;
  root.DanmakuPlayerView.sprite(ctx,image,p,reduced?0:flow.tick);root.DanmakuPlayerView.hitpoint(ctx,p,focused);
  if(m.protection>0){var px=p.x/64,py=p.y/64,warning=m.protection<=60;ctx.save();ctx.globalAlpha=warning&&!reduced?.62+.25*Math.sin(flow.tick*.35):.84;
   ring(ctx,px,py,25,'#112b40',4);ring(ctx,px,py,25,warning?'#ffd69c':'#d6f6f4',1.5);ring(ctx,px,py,30,'#c8eaff',2,-Math.PI/2,-Math.PI/2+Math.PI*2*m.protection/m.protectionTicks);
   ctx.font='10px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#10283b';var label=warning?'保护即将结束':'复归保护';ctx.strokeText(label,px,py+43);ctx.fillStyle='#fff2cb';ctx.fillText(label,px,py+43);ctx.restore();
  }
 }
 root.DanmakuRecoveryView={draw:draw};
}(window));
