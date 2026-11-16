/* (C) 2026 Carinoasd. Stage 2 Hard wind, delayed petals and three-bell counterpoint: 小典 / Codex.
 * Offline candidate. Only stage composition changes; shared player/resource rules stay intact.
 */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/hard-choreography.js'),function(){return require('./chart.json');});
 else root.Stage02Hard=factory(root.DanmakuChoreography,function(){return root.Stage02RefinedData.chart;});
}(typeof globalThis!=='undefined'?globalThis:this,function(choreo,getChart){
 'use strict';
 var Q=64,MIN_MUSIC=390,MAX_MUSIC=12960;
 var names=['风廊 · 回卷双风','花瓣舒展 · 迟放回庭','铃声回响 · 三铃错奏'];
 var bells=[[112,124],[240,104],[368,124]],flowers=[[144,148],[336,148]];
 function attack(at,aimed,offsets,warning){return{at:at,warning:at-(warning||36),aimed:aimed,capture:aimed,offsets:offsets};}
 function configure(r){
  var rows=r.stage01.schedule.map(function(m){var next=Object.assign({},m);
   // Offset the two callers, then let each guard cover a different bank.
   if(next.type===1&&next.x>240*Q)next.at+=36;
   if(next.type===2)next.x=(next.at<3000?160:320)*Q;
   return next;
  }),id=2000;
  function side(sec,mirror){for(var lane=0;lane<3;lane++)rows.push({id:++id,type:0,at:Math.round(sec*60),x:(mirror?416:64)*Q,mirror:mirror,reward:0,route:'sideArc',lane:lane});}
  side(17.4,false);side(18,true);side(68.2,true);side(68.8,false);
  [72,140,208,272,340,408].forEach(function(x,i){rows.push({id:++id,type:0,at:2232+(i%2)*18,x:x*Q,mirror:false,reward:0,route:'column',lane:0});});
  [144,336].forEach(function(x,i){rows.push({id:++id,type:1,at:4560+i*36,x:x*Q,mirror:false,reward:0,route:'hold',lane:0});});
  rows.sort(function(a,b){return a.at-b.at||a.id-b.id;});
  var attacks=[
   [attack(78,true,[-24,-12,0,12,24]),attack(168,false,[-42,-21,0,21,42])],
   [attack(84,true,[-12,0,12]),attack(150,false,[-42,-21,0,21,42]),attack(222,true,[-12,0,12])],
   [attack(108,false,[-60,-40,-20,0,20,40,60]),attack(204,true,[-20,-10,0,10,20]),attack(300,false,[-70,-50,-30,-10,10,30,50,70]),attack(396,true,[-20,-10,0,10,20])]
  ];
  return Object.assign({},r,{stage01:Object.assign({},r.stage01,{schedule:rows,mobCap:32,enemyCap:320,
   types:r.stage01.types.map(function(t,i){return Object.assign({},t,{hp:[1,208,600][i],speedQ:[160,168,148][i],attacks:attacks[i]});}),
   segments:r.stage01.segments.map(function(s){return Object.assign({},s);})}),boss:Object.assign({},r.boss,{phaseHP:[6300,6900,7500]})});
 }
 function event(index,row){
  var n=row[1],q=n%16,g=Math.floor(n/16),kind=null,node=(Math.floor(n/4)+g)%3;
  if(index===0){if(q<12)kind=q%2===0?'wind':'windEcho';else if(q===12||q===14)kind='windClose';}
  else if(index===1){if(q%8===0)kind='bloom';else if(q%8===4)kind='pairedBloom';else if(q%8===6)kind='petalEcho';}
  else if(index===2){if(q<12&&q%4===0)kind='call';else if(q<12&&q%4===2)kind='echo';else if(q===12)kind='chord';}
  return kind?{musicTick:row[0],n:n,q:q,group:g,strong:row[2],kind:kind,node:node}:null;
 }
 function rowAt(time){var rows=getChart().tracks.boss.pulses,lo=0,hi=rows.length-1;
  while(lo<=hi){var mid=(lo+hi)>>1;if(rows[mid][0]===time)return rows[mid];if(rows[mid][0]<time)lo=mid+1;else hi=mid-1;}return null;
 }
 function cue(index,time){var rows=getChart().tracks.boss.pulses;
  for(var i=0;i<rows.length;i++){var row=rows[i];if(row[0]<=time)continue;if(row[0]-time>36)break;
   if(row[0]<MIN_MUSIC||row[0]>MAX_MUSIC)continue;var e=event(index,row);if(e)return Object.assign({inTicks:row[0]-time},e);
  }return null;
 }
 function points(index,c,boss){
  if(!c)return[];var x=boss.x/Q,y=boss.y/Q;
  if(index===0)return c.kind==='wind'||c.kind==='windEcho'?[{x:x-52,y:y+12,key:'leaf'},{x:x+52,y:y+12,key:'petal'}]:[{x:x,y:y,key:'bud'}];
  if(index===1)return c.kind==='bloom'?[{x:x,y:y+8,key:'petal'}]:flowers.map(function(p){return{x:p[0],y:p[1],key:'petal'};});
  var ids=c.kind==='call'?[c.node]:c.kind==='echo'?[0,1,2].filter(function(i){return i!==c.node;}):[0,1,2];
  return ids.map(function(i){return{x:bells[i][0],y:bells[i][1],key:'bud',node:i,kind:c.kind};});
 }
 function sources(index,time,boss){return points(index,cue(index,time),boss);}
 function presentationNodes(index,time,boss){
  var fixed=index===2?bells:index===1?flowers.concat([[boss.x/Q,boss.y/Q+8]]):[[boss.x/Q-52,boss.y/Q+12],[boss.x/Q+52,boss.y/Q+12],[boss.x/Q,boss.y/Q]];
  return fixed.map(function(p){return p.slice();});
 }
 function emit(s,x,y,a,speed,radius,ttl,kind,o){return choreo.emit(s,Math.round(x),Math.round(y),Math.round(a),speed,radius,ttl,kind,o);}
 function delta(a,b){return(a-b+768)%512-256;}
 function opening(s,x,y,gate){return choreo.direction(s,x,y,gate*Q,560*Q);}
 function wind(s,c){
  var x=s.boss.x,y=s.boss.y,side=c.group%2?-1:1,gate=[152,208,272,328,272,208][c.group%6];
  if(c.kind==='wind'||c.kind==='windEcho'){
   var sweep=[94,108,122,136,150,136][Math.floor(c.q/2)];
   var width=c.kind==='windEcho'?1:3;
   [-1,1].forEach(function(sign){for(var i=-width;i<=width;i++){
    var a=(sign<0?sweep:256-sweep)+i*6;
    emit(s,x+sign*52*Q,y+12*Q,a,(c.kind==='windEcho'?144:156)+(i+width)*4,3,350,sign<0?22:23,{turn:sign*side*56,changeAge:96,mode:1,angle:-sign*side*10,nextSpeed:184,nextTurn:-sign*side*64});
   }});
  }else{
   var aim=opening(s,x,y,gate);for(var j=0;j<28;j++){
    var angle=Math.floor(j*512/28)+(c.q===14?8:0);if(Math.abs(delta(angle,aim))<=28)continue;
    emit(s,x,y,angle,c.q===12?148:136,4,340,c.q===12?20:21,{turn:side*16,changeAge:112,mode:1,nextSpeed:160,nextTurn:0});
   }
  }
 }
 function petals(s,c){
  var side=c.group%2?-1:1,gate=[176,240,304,240][c.group%4],targets=points(1,c,s.boss);
  targets.forEach(function(p,node){var px=p.x*Q,py=p.y*Q,sourceGate=c.kind==='pairedBloom'?gate+(node===0?-24:24):gate,aim=opening(s,px,py,sourceGate),rotation=(c.group*19+(c.q%8===4?26:0))%102;
   if(c.kind==='petalEcho'){
    var lock=choreo.direction(s,px,py,s.player.x,s.player.y),count=c.strong?2:1;
    for(var z=-count;z<=count;z++)emit(s,px,py,lock+z*9,152,3,310,22,{turn:(node?-1:1)*24,changeAge:84,mode:1,angle:node?-12:12,nextSpeed:176,nextTurn:0});
    return;
   }
   var width=c.kind==='bloom'?4:2;
   for(var lobe=0;lobe<5;lobe++)for(var k=-width;k<=width;k++){
    var a=Math.round(lobe*512/5)+k*(width===4?6:9)+rotation;
    // Preserve the downward lobe edges: a wide cut used to erase a whole petal.
    if(Math.abs(delta(a,aim))<=(c.kind==='bloom'?14:12))continue;
    var speed=width===4?180-Math.abs(k)*10:160-Math.abs(k)*12,turn=(node?1:-1)*side;
    emit(s,px,py,a,speed,3,370,node%2?22:23,{turn:turn*18,accel:-1,changeAge:96,mode:1,angle:turn*18,nextSpeed:188,nextTurn:-turn*48});
   }
  });
 }
 function ringing(s,c){
  var targets=points(2,c,s.boss),sign=c.group%2?-1:1,gate=[160,240,320,240][c.group%4];
  targets.forEach(function(p){var x=p.x*Q,y=p.y*Q;
   if(c.kind==='call'){
    var locked=s.hardBellLock;if(!locked||locked.time!==c.musicTick||locked.node!==p.node)return;
    for(var i=-6;i<=6;i++)emit(s,x,y,locked.angle+i*8,192,4,340,24,{turn:(p.node-1)*20,changeAge:108,mode:1,nextSpeed:176,nextTurn:0});
   }else if(c.kind==='echo'){
    for(var j=-4;j<=4;j++)if(j!==0)emit(s,x,y,128+j*13-sign*8,128,3,370,23,{turn:(p.node-1)*-36,changeAge:108,mode:1,angle:(p.node-1)*12,nextSpeed:192,nextTurn:0});
   }else{
    var aim=opening(s,x,y,gate);for(var k=0;k<20;k++){var a=38+k*10;if(Math.abs(delta(a,aim))<=26)continue;
     emit(s,x,y,a,144,3,350,p.node===1?24:22,{turn:sign*(p.node-1)*24,changeAge:96,mode:1,nextSpeed:168,nextTurn:0});
    }
   }
  });
 }
 function pattern(s){
  // Capture once at the visible 36-step source warning, never chase afterwards.
  if(s.index===2){var next=cue(s.index,s.musicTick);if(next&&next.kind==='call'&&next.inTicks===36){var p=bells[next.node];s.hardBellLock={time:next.musicTick,node:next.node,angle:choreo.direction(s,p[0]*Q,p[1]*Q,s.player.x,s.player.y)};}}
  if(s.index<0||s.index>2||s.tick<36||s.musicTick<MIN_MUSIC||s.musicTick>MAX_MUSIC)return;
  var row=rowAt(s.musicTick),c=row&&event(s.index,row);if(!c)return;
  var count=s.stats.enemySpawned,prior=s.lastCast;
  if(s.index===0)wind(s,c);else if(s.index===1)petals(s,c);else ringing(s,c);
  s.lastCast=s.stats.enemySpawned===count?prior:s.tick;
 }
 return{id:'hard',names:names,configure:configure,pattern:pattern,cue:cue,sources:sources,presentationNodes:presentationNodes};
}));
