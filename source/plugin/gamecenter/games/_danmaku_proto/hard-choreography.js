/* (C) 2026 Carinoasd. Original fixed-point Hard v3 choreography: 小典 / Codex.
 * Authored for Angel Danmaku Festival; no external game scripts/assets copied.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./hard-patterns.js'));
  else root.DanmakuChoreography=factory(root.DanmakuHardPatterns);
}(typeof globalThis!=='undefined'?globalThis:this,function(timing){
  'use strict';
  var FULL=512*256;
  // Motion: angleQ, speedQ, turnQ, accelQ, changeAge, mode, angleArg,
  // nextSpeedQ, nextTurnQ, changed, capturedAngleQ. All integers.
  function direction(s,x,y,tx,ty){
    var dx=tx-x,dy=ty-y,best=-Infinity,angle=128;
    s.rules.directionVectors.forEach(function(v,i){var dot=dx*v[0]+dy*v[1];if(dot>best){best=dot;angle=i;}});return angle;
  }
  function emit(s,x,y,angle,speed,radius,ttl,kind,options){
    var safe=s.rules.hard03.minimumSpawnDistance*64,dx=x-s.player.x,dy=y-s.player.y;
    if(dx*dx+dy*dy<safe*safe)return null;
    s.spawn(x,y,angle,speed,radius,ttl,kind);var e=s.enemies[s.enemies.length-1],o=options||{};
    e.motion=[((angle*256)%FULL+FULL)%FULL,speed,o.turn||0,o.accel||0,o.changeAge===undefined?-1:o.changeAge,o.mode||0,o.angle||0,o.nextSpeed===undefined?speed:o.nextSpeed,o.nextTurn||0,0,0];return e;
  }
  function motion(s){
    var removed=[],births=[],r=s.rules;
    s.enemies.forEach(function(e){
      var m=e.motion;if(!m)return;var age=s.tick-e.born;
      if(m[4]>=0&&!m[9]){
        if((m[5]===2||m[5]===4)&&age===Math.max(0,m[4]-24))m[10]=direction(s,e.x,e.y,s.player.x,s.player.y)*256;
        if(age>=m[4]){
          if(m[5]===4){
            for(var lane=-2;lane<=2;lane++)births.push([e.x,e.y,Math.floor(m[10]/256)+lane*8,208+Math.abs(lane)*8,3,260,23]);
            removed.push(e.id);return;
          }
          if(m[5]===1)m[0]+=m[6]*256;
          else if(m[5]===2)m[0]=m[10];
          else if(m[5]===3)m[0]=m[6]*256;
          m[1]=m[7];m[2]=m[8];m[3]=0;m[9]=1;
        }
      }
      m[0]=((m[0]+m[2])%FULL+FULL)%FULL;m[1]=Math.max(0,m[1]+m[3]);
      var speed=m[1];if(s.assist)speed=Math.trunc(speed*r.assist.enemySpeedNumerator/r.assist.enemySpeedDenominator);
      var vector=r.directionVectors[Math.floor(m[0]/256)];e.vx=Math.trunc(speed*vector[0]/1024)+0;e.vy=Math.trunc(speed*vector[1]/1024)+0;
    });
    if(removed.length)s.enemies=s.enemies.filter(function(e){return removed.indexOf(e.id)<0;});
    births.forEach(function(b){emit.apply(null,[s].concat(b));});
  }
  function pulseIndex(rows,t){var lo=0,hi=rows.length-1;while(lo<=hi){var mid=(lo+hi)>>1;if(rows[mid][0]===t)return mid;if(rows[mid][0]<t)lo=mid+1;else hi=mid-1;}return -1;}
  function pattern(s){
    var rows=s.rules.hard01.bossPulses,index=pulseIndex(rows,s.musicTick),c=index>=0?rows[index]:null;
    if(!c||s.tick<30)return;
    var n=c[1],q=n%32,group=Math.floor(n/32),strong=c[2]>0,x=s.boss.x,y=s.boss.y,i,a,d;
    if(s.index===0){
      var gap=[104,116,128,140,152,140,128,116][Math.floor(n/4)%8],turn=group%2?48:-48;
      if(q%4===0){
        var count=strong?40:32;
        for(i=0;i<count;i++){
          a=Math.floor(i*512/count)+(group%3-1)*4;d=(a-gap+768)%512-256;
          if(Math.abs(d)>24)emit(s,x,y,a,160+(i%4)*4,4,360,20,{turn:turn,changeAge:100,mode:1,nextSpeed:176,nextTurn:-turn});
        }
      }
      if(strong&&q%4===2)for(i=0;i<24;i++){
        a=Math.floor(i*512/24)+(q%8?5:-5);d=(a-gap+768)%512-256;
        if(Math.abs(d)>30)emit(s,x,y,a,144,3,340,23,{turn:-turn,changeAge:100,mode:1,nextSpeed:160,nextTurn:turn});
      }
    }else if(s.index===1){
      if(q%8===0){
        var future=rows[Math.min(rows.length-1,index+8)],delay=Math.max(72,future[0]-c[0]);
        for(i=0;i<5;i++)emit(s,x,y,48+i*40,160,6,delay+2,24,{accel:-3,changeAge:delay,mode:4,nextSpeed:0});
      }
      if(strong&&q%8===4){
        for(i=0;i<13;i++)emit(s,x,y,64+i*10+(group%2?4:-4),144,3,300,22,{turn:group%2?24:-24,changeAge:120,mode:1,nextSpeed:160,nextTurn:0});
      }
    }else{
      if(q<24){
        var sweep=[76,84,92,100,108,116,124,116,108,100,92,84][q%12],lanes=strong?[-8,-4,0,4,8]:[-6,0,6];
        lanes.forEach(function(offset,k){
          emit(s,84*64,104*64,sweep+offset,156+(k%2)*12,3,320,group%2?23:22,{turn:64,changeAge:90,mode:1,nextSpeed:168,nextTurn:-64});
          emit(s,396*64,104*64,256-sweep-offset,156+(k%2)*12,4,320,group%2?20:21,{turn:-64,changeAge:90,mode:1,nextSpeed:168,nextTurn:64});
        });
      }
      if(q===24||q===28){
        var gateX=[160,240,320,240][group%4],opening=direction(s,x,y,gateX*64,520*64);
        for(i=0;i<28;i++){a=Math.floor(i*512/28)+(q===28?9:0);d=(a-opening+768)%512-256;if(Math.abs(d)>28)emit(s,x,y,a,q===24?144:136,4,340,q===24?21:20);}
      }
    }
  }
  function telegraphs(ctx,s,reduced){
    if(s.index===2){
      ctx.save();ctx.strokeStyle='#e8d28d';ctx.globalAlpha=.55;ctx.lineWidth=1;
      [84,396].forEach(function(x){ctx.beginPath();ctx.arc(x,104,10+(reduced?0:Math.sin(s.tick/8)*2),0,Math.PI*2);ctx.stroke();});ctx.restore();
    }
    if(s.index!==1)return;
    s.enemies.forEach(function(e){
      var m=e.motion;if(!m||m[5]!==4||m[9])return;var remain=m[4]-(s.tick-e.born);if(remain<=0||remain>24)return;
      var v=s.rules.directionVectors[Math.floor(m[10]/256)],x=e.x/64,y=e.y/64;
      ctx.save();ctx.strokeStyle='#ffe4a1';ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+v[0]*.14,y+v[1]*.14);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(x,y,11+(24-remain)/8,0,Math.PI*2);ctx.stroke();ctx.restore();
    });
  }
  return{pattern:pattern,motion:motion,emit:emit,direction:direction,telegraphs:telegraphs};
}));
