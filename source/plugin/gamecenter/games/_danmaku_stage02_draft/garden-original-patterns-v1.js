/* (C) 2026 Carinoasd. Original garden pattern extraction: 小典 / Codex.
 * The pulse lookup and attack generator are copied verbatim from combat.js.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/hard-choreography.js'));
 else root.DanmakuGardenOriginal=factory(root.DanmakuChoreography);
}(typeof globalThis!=='undefined'?globalThis:this,function(choreo){
 'use strict';var Q=64;
  function pulse(rows,t){var lo=0,hi=rows.length-1;while(lo<=hi){var m=(lo+hi)>>1;if(rows[m][0]===t)return rows[m];if(rows[m][0]<t)lo=m+1;else hi=m-1;}return null;}
  function emit(s,x,y,a,speed,radius,ttl,kind,o){return choreo.emit(s,Math.round(x),Math.round(y),Math.round(a),speed,radius,ttl,kind,o);}
  function bossPattern(s){
    var c=pulse(s.chart.tracks.boss.pulses,s.musicTick);if(!c)return;
    var n=c[1],q=n%16,group=Math.floor(n/16),strong=c[2],x=s.boss.x,y=s.boss.y,i,j,a;
    if(s.musicTick<390||s.musicTick>12960)return;
    s.lastCast=s.tick;
    if(s.index===0){
      // Repeated diagonal ribbons, with the near corridor shifting between phrases.
      var sweep=[92,104,116,128,140,152,164,152][Math.floor(n/2)%8];
      s.windGate=[128,192,288,352,288,192][group%6];
      if(q<12&&q%2===0){
        [-1,1].forEach(function(side){for(i=-2;i<=2;i++){
          var angle=side<0?sweep+i*6:256-sweep+i*6;
          emit(s,x+side*48*Q,y+12*Q,angle,144+(i+2)*5,3,330,side<0?22:23,{turn:side*40,changeAge:110,mode:1,nextSpeed:160,nextTurn:-side*24});
        }});
      }
      if(q===12||q===14)for(i=0;i<17;i++){
        a=48+i*10;var opening=choreo.direction(s,x,y,s.windGate*Q,560*Q),d=(a-opening+768)%512-256;
        if(Math.abs(d)>20)emit(s,x,y,a,144,4,330,q===12?20:21,{turn:group%2?20:-20});
      }
    }else if(s.index===1){
      // Five separate petal lobes: speed undulates around each lobe, not a plain ring.
      if(q%4===0){
        var rotation=(group*23+(q===8?18:0))%102,gap=128+(group%3-1)*16;
        for(i=0;i<40;i++){
          a=i*512/40+rotation;var delta=(Math.round(a)-gap+768)%512-256;
          if(Math.abs(delta)<23)continue;
          var speed=[120,138,170,196,210,196,170,138][i%8];
          emit(s,x,y,a,speed,3,360,q%8?23:22,{turn:group%2?48:-48,changeAge:105,mode:1,nextSpeed:156,nextTurn:group%2?-24:24});
        }
      }
      if(strong&&q%4===2)for(i=-3;i<=3;i++){
        emit(s,x,y,128+i*13+(group%2?8:-8),152,4,320,21,{turn:group%2?-36:36});
      }
    }else{
      // Three bell locations share a call, then a delayed quieter answer.
      var bell=(Math.floor(n/4)+group)%3,sourceX=[112,240,368][bell]*Q,sourceY=(104+(bell===1?0:20))*Q;
      if(q%4===0||q%4===2){
        var echo=q%4===2;
        for(i=-7;i<=7;i++){
          if(Math.abs(i)<=1)continue;
          a=128+i*9+(group%2?10:-10);
          emit(s,sourceX,sourceY,a,echo?144:184,echo?3:4,340,echo?23:20,{turn:(bell-1)*(echo?-28:28),changeAge:96,mode:1,nextSpeed:160,nextTurn:0});
        }
      }
      if(strong===2&&q===15)for(j=-1;j<=1;j+=2)for(i=0;i<6;i++)emit(s,(240+j*136)*Q,72*Q,128+j*(24+i*7),148,3,300,21,{turn:-j*24});
    }
  }

 function fires(index,row){var q=row[1]%16;return index===0?q%2===0:index===1?q%4===0||!!row[2]&&q%4===2:q%4===0||q%4===2||row[2]===2&&q===15;}
 function cue(chart,index,time){var rows=chart.tracks.boss.pulses;for(var i=0;i<rows.length;i++){var row=rows[i];if(row[0]<=time)continue;if(row[0]-time>36)break;if(row[0]<390||row[0]>12960||!fires(index,row))continue;var n=row[1],q=n%16,g=Math.floor(n/16);return{inTicks:row[0]-time,musicTick:row[0],n:n,q:q,group:g,strong:row[2],kind:index===0?q<12?'wind':'windFan':index===1?'bloom':q%4===2?'echo':q===15?'sideAnswer':'call',node:(Math.floor(n/4)+g)%3};}return null;}
 function pattern(s){var prior=s.lastCast,count=s.stats.enemySpawned;bossPattern(s);if(s.stats.enemySpawned===count)s.lastCast=prior;}
 return{pattern:pattern,cue:cue,pulse:pulse,fires:fires,verbatimAttackSource:'combat.js'};
}));
