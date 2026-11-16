/* (C) 2026 Carinoasd. Hard v2 music variations and bullet art: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./hard-patterns.js'));
  else root.DanmakuHardRich=factory(root.DanmakuHardPatterns);
}(typeof globalThis!=='undefined'?globalThis:this,function(timing){
  'use strict';
  var palette={
    10:{name:'青玉',color:'#54e5ed',edge:'#dbffff',shape:'orb'},
    11:{name:'桃瓣',color:'#ff83b9',edge:'#ffe3ef',shape:'petal'},
    12:{name:'蓝矢',color:'#729fff',edge:'#e5eeff',shape:'kunai'},
    13:{name:'金星',color:'#ffd15c',edge:'#fff2bc',shape:'star'},
    14:{name:'翠环',color:'#6aefaa',edge:'#d9ffe8',shape:'ring'},
    15:{name:'白米',color:'#f7ead9',edge:'#ffffff',shape:'rice'},
    16:{name:'橙晶',color:'#ff9b58',edge:'#ffe1ac',shape:'diamond'},
    17:{name:'紫珠',color:'#bd8dff',edge:'#f0e2ff',shape:'orb'}
  };
  function capture(s){
    var dx=s.player.x-s.boss.x,dy=s.player.y-s.boss.y,best=-Infinity;
    s.rules.directionVectors.forEach(function(v,i){var d=dx*v[0]+dy*v[1];if(d>best){best=d;s.aimAngle=i;}});
  }
  function pattern(s){
    var rows=s.rules.hard01.bossPulses,up=timing.cue(rows,s.musicTick+24),c=timing.cue(rows,s.musicTick),i,j;
    if(up&&((s.index===1&&up[1]%8===0)||(s.index!==1&&up[1]%4===0))){
      if(s.index===1)capture(s);s.warningUntil=s.tick+24;
    }
    if(!c||s.tick<30)return;
    var n=c[1],q=n%16,v=c[2],bar=Math.floor(n/16),variant=bar%2,x=s.boss.x,y=s.boss.y;
    if(s.index===0){
      var gap=[104,116,128,140,152,140,128,116][Math.floor(n/4)%8];
      if(q%4===0){
        if(!variant){
          // Speed bands make a six-lobed flower expand into separate petals.
          for(i=0;i<36;i++){
            var a=Math.floor(i*512/36)+(bar%3-1)*5,d=(a-gap+768)%512-256;
            if(Math.abs(d)>18)s.spawn(x,y,a,[152,176,208,232,208,176][i%6],4,330,i%2?11:10);
          }
        }else{
          // Six rotating spokes, four speeds per spoke, with the same exit gap.
          for(i=0;i<6;i++)for(j=0;j<4;j++){
            var angle=Math.floor(i*512/6)+(n*3)%64+j*4,delta=(angle-gap+768)%512-256;
            if(Math.abs(delta)>18)s.spawn(x,y,angle,152+j*32,4,330,j%2?13:17);
          }
        }
      }
      if(v>0&&q%4===1)for(i=0;i<24;i++){
        var echo=Math.floor(i*512/24)+(bar%2?6:-6),dist=(echo-gap+768)%512-256;
        if(Math.abs(dist)>20)s.spawn(x,y,echo,144,4,330,variant?14:15);
      }
      if(v>0&&q%4===2)[68,92,116,140].forEach(function(a,k){
        var turn=(bar%4-1)*6;
        s.spawn(x-64*64,y+16*64,a+turn,192+k*8,3,280,variant?12:16);
        s.spawn(x+64*64,y+16*64,256-a-turn,192+k*8,3,280,variant?16:12);
      });
    }else if(s.index===1){
      if(q%8<=2&&(v>0||q%8===0)&&s.warningUntil>0&&s.tick>=s.warningUntil&&s.tick<=s.warningUntil+30){
        if(!variant)for(i=-4;i<=4;i++)s.spawn(x,y,s.aimAngle+i*5,272+(q%8)*24,3,240,q%8===1?15:12);
        else for(j=-1;j<=1;j+=2)for(i=-3;i<=3;i++){
          s.spawn(x+j*18*64,y,s.aimAngle+i*6+j*3,256+(q%8)*24,3,240,j<0?11:14);
        }
      }
      if(v>0&&(q%8===4||v===2&&q%8===6))[48,64,80,96].forEach(function(a,k){
        var sweep=variant?(q%8===4?-8:8):0;
        s.spawn(24*64,120*64,a+sweep,192+k*8,4,280,variant?17:16);
        s.spawn(456*64,120*64,256-a-sweep,192+k*8,4,280,variant?13:10);
      });
    }else{
      if(q%2===0&&q<12&&(v>0||q%4===0)){
        var row=q/2,base=[128,240,352,240][bar%4],gate=base+[0,16,32,48,32,16][row]*(bar%2?-1:1);
        // Alternate straight star stairs and a staggered, gently slanted jewel lattice.
        for(i=16+(variant&&row%2?8:0);i<=464;i+=variant?24:16)if(Math.abs(i-gate)>32){
          s.spawn(i*64,48*64,128+(variant?(row%2?5:-5):0),216,5,240,variant?(row%2?14:16):(row%2?13:12));
        }
      }
      if(v>0&&(q===13||q===15))[48,64,80,96,112].forEach(function(a,k){
        s.spawn(24*64,80*64,a+(variant?6:0),208+k*8,4,280,variant?11:15);
        s.spawn(456*64,80*64,256-a-(variant?6:0),208+k*8,4,280,variant?17:10);
      });
    }
  }
  function bullet(ctx,e){
    var p=palette[e.kind];if(!p)return false;
    var r=e.radius;ctx.save();ctx.translate(e.x/64,e.y/64);ctx.rotate(Math.atan2(e.vx,-e.vy));
    ctx.fillStyle=p.color;ctx.strokeStyle='#112037';ctx.lineWidth=2.5;ctx.beginPath();
    if(p.shape==='orb'||p.shape==='ring')ctx.arc(0,0,r+1,0,Math.PI*2);
    else if(p.shape==='rice')ctx.ellipse(0,0,r*.65,r*1.8,0,0,Math.PI*2);
    else if(p.shape==='petal'){
      ctx.moveTo(0,-r*2);ctx.bezierCurveTo(r*1.7,-r,r*1.1,r*1.4,0,r*1.5);ctx.bezierCurveTo(-r*1.1,r*1.4,-r*1.7,-r,0,-r*2);
    }else if(p.shape==='kunai'){
      ctx.moveTo(0,-r*2.3);ctx.lineTo(r,r*.6);ctx.lineTo(0,r*1.7);ctx.lineTo(-r,r*.6);ctx.closePath();
    }else if(p.shape==='diamond'){
      ctx.moveTo(0,-r*1.6);ctx.lineTo(r,0);ctx.lineTo(0,r*1.6);ctx.lineTo(-r,0);ctx.closePath();
    }else for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.55:r*1.4;ctx[i?'lineTo':'moveTo'](Math.cos(a)*d,Math.sin(a)*d);}
    ctx.closePath();ctx.stroke();ctx.fill();ctx.strokeStyle=p.edge;ctx.lineWidth=.8;ctx.stroke();
    if(p.shape==='ring'){ctx.fillStyle='#16354a';ctx.beginPath();ctx.arc(0,0,r*.55,0,Math.PI*2);ctx.fill();}
    else{ctx.fillStyle='#ffffff';ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(0,-r*.2,Math.max(.8,r*.28),0,Math.PI*2);ctx.fill();}
    ctx.restore();return true;
  }
  function emitters(ctx,s){timing.emitters(ctx,s);}
  return{pattern:pattern,bullet:bullet,emitters:emitters,palette:palette};
}));
