/* (C) 2026 Carinoasd. Music-cued unranked Hard patterns: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuHardPatterns=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function cue(rows,t){
    var lo=0,hi=rows.length-1;
    while(lo<=hi){var mid=(lo+hi)>>1;if(rows[mid][0]===t)return rows[mid];if(rows[mid][0]<t)lo=mid+1;else hi=mid-1;}
    return null;
  }
  function capture(s){
    var dx=s.player.x-s.boss.x,dy=s.player.y-s.boss.y,best=-Infinity;
    s.rules.directionVectors.forEach(function(v,i){var dot=dx*v[0]+dy*v[1];if(dot>best){best=dot;s.aimAngle=i;}});
  }
  function pattern(s){
    var rows=s.rules.hard01.bossPulses,t=s.musicTick,up=cue(rows,t+24),c=cue(rows,t),i;
    if(up&&((s.index===1&&up[1]%8===0)||(s.index!==1&&up[1]%4===0))){
      if(s.index===1)capture(s);
      s.warningUntil=s.tick+24;
    }
    if(!c||s.tick<30)return;
    var n=c[1],q=n%16,v=c[2],bar=Math.floor(n/16),x=s.boss.x,y=s.boss.y;
    if(s.index===0){
      if(q%4===0||v>0&&q%4===1){
        var echo=q%4===1,slots=echo?32:v===0?32:40;
        var gap=[104,116,128,140,152,140,128,116][Math.floor(n/4)%8],rotation=(bar%3-1)*5;
        for(i=0;i<slots;i++){
          var a=Math.floor(i*512/slots)+rotation,d=(a-gap+768)%512-256;
          if(Math.abs(d)>18)s.spawn(x,y,a,echo?152:184,4,360,3);
        }
      }
      if(v>0&&q%4===2)[68,92,116,140].forEach(function(a){
        s.spawn(x-64*64,y+16*64,a+(bar%2?8:-8),192,4,300,3);
        s.spawn(x+64*64,y+16*64,256-a-(bar%2?8:-8),192,4,300,3);
      });
    }else if(s.index===1){
      if(q%8<=2&&(v>0||q%8===0)&&s.warningUntil>0&&s.tick>=s.warningUntil&&s.tick<=s.warningUntil+30)for(i=-4;i<=4;i++)s.spawn(x,y,s.aimAngle+i*5,288+(q%8)*16,3,240,3);
      if(v>0&&(q%8===4||v===2&&q%8===6))[48,64,80,96].forEach(function(a){
        s.spawn(24*64,120*64,a,208,3,300,3);s.spawn(456*64,120*64,256-a,208,3,300,3);
      });
    }else{
      if(q%2===0&&q<12&&(v>0||q%4===0)){
        var row=q/2,base=[128,240,352,240][bar%4],offset=[0,16,32,48,32,16][row]*(bar%2?-1:1),gate=base+offset;
        for(i=16;i<=464;i+=16)if(Math.abs(i-gate)>32)s.spawn(i*64,48*64,128,224,5,240,3);
      }
      if(v>0&&(q===13||q===15))[48,64,80,96,112].forEach(function(a){
        s.spawn(24*64,80*64,a,224,4,300,3);s.spawn(456*64,80*64,256-a,224,4,300,3);
      });
    }
  }
  function emitters(ctx,s){
    if(!s.hardMode||s.index<0)return;
    var next=null;
    for(var d=1;d<=18&&!next;d++)next=cue(s.rules.hard01.bossPulses,s.musicTick+d);
    if(!next||(s.index===0?next[1]%4!==2:s.index===1?next[1]%8!==4&&next[1]%8!==6:next[1]%16!==13&&next[1]%16!==15))return;
    ctx.save();ctx.strokeStyle=['#a5f2ef','#d4b7ff','#ffe6a6'][s.index];ctx.lineWidth=1.5;
    (s.index===0?[s.boss.x/64-64,s.boss.x/64+64]:[24,456]).forEach(function(x){ctx.beginPath();ctx.arc(x,s.index===0?s.boss.y/64+16:s.index===1?120:80,12,0,Math.PI*2);ctx.stroke();});ctx.restore();
  }
  return{cue:cue,pattern:pattern,emitters:emitters};
}));
