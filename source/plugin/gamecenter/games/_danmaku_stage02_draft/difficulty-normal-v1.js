/* (C) 2026 Carinoasd. Independent garden Normal choreography: 小典 / Codex.
 * Native offline rules; shared player, resources and accepted Easy stay unchanged.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/hard-choreography.js'));
 else root.Stage02Normal=factory(root.DanmakuChoreography);
}(typeof globalThis!=='undefined'?globalThis:this,function(choreo){
 'use strict';var Q=64,START=426;
 var names=['风廊 · 交叶迁径','花瓣舒展 · 错庭重瓣','铃声回响 · 隔庭追响'];
 var periods=[384,448,480],flowers=[[128,148],[240,176],[352,148]],bells=[[112,124],[240,104],[368,124]];
 var plans=[
  [0,36,72,108,144,180].map(function(at,i){return{at:at,kind:'wind',ordinal:i};}).concat([{at:240,kind:'windFan'},{at:288,kind:'windFan'}]),
  [{at:0,kind:'bloom',node:0},{at:48,kind:'bloomEcho',node:0},{at:112,kind:'bloom',node:2},{at:160,kind:'bloomEcho',node:2},{at:224,kind:'bloom',node:1},{at:272,kind:'bloomEcho',node:1},{at:336,kind:'weave'}],
  [{at:0,kind:'call',node:0},{at:64,kind:'echo',node:2},{at:128,kind:'call',node:2},{at:192,kind:'echo',node:0},{at:256,kind:'call',node:1},{at:320,kind:'echoPair'},{at:384,kind:'bellClose',node:1}]
 ];
 function configure(r){
  if(r.stage02NormalV1===true)return r;
  var result=Object.assign({},r),rows=r.stage01.schedule.map(function(row){return Object.assign({},row);}),lastId=rows.reduce(function(n,row){return Math.max(n,row.id);},0);
  // Escorts share the guard's pressure window; recovery intervals and P/B supply remain.
  [38.5,76].forEach(function(sec){[96,384].forEach(function(x){rows.push({id:++lastId,type:1,at:Math.round(sec*60),x:x*Q,mirror:false,reward:0,route:'hold'});});});
  rows.sort(function(a,b){return a.at-b.at||a.id-b.id;});
  var attacks=[
   [{at:96,warning:66,aimed:false,capture:false,offsets:[-24,-12,0,12,24]},{at:168,warning:138,aimed:true,capture:true,offsets:[-12,0,12]}],
   [{at:90,warning:54,aimed:false,capture:false,offsets:[-32,-16,0,16,32]},{at:156,warning:120,aimed:true,capture:true,offsets:[-12,0,12]},{at:222,warning:186,aimed:false,capture:false,offsets:[-42,-21,0,21,42]}],
   [{at:108,warning:72,aimed:false,capture:false,offsets:[-54,-36,-18,0,18,36,54]},{at:216,warning:180,aimed:true,capture:true,offsets:[-24,-12,0,12,24]},{at:324,warning:288,aimed:false,capture:false,offsets:[-64,-48,-32,-16,0,16,32,48,64]},{at:432,warning:396,aimed:true,capture:true,offsets:[-24,-12,0,12,24]}]
  ];
  result.stage01=Object.assign({},r.stage01,{schedule:rows,types:r.stage01.types.map(function(type,i){return Object.assign({},type,{hp:[1,192,600][i],speedQ:[156,172,148][i],attacks:attacks[i]});})});
  result.boss=Object.assign({},r.boss,{phaseHP:[6000,6600,7200]});result.stage02NormalV1=true;return result;
 }
 function eventAt(index,time){
  if(index<0||index>2||time<START)return null;var elapsed=time-START,period=periods[index],at=elapsed%period;
  var row=plans[index].find(function(p){return p.at===at;});return row?Object.assign({cycle:Math.floor(elapsed/period),musicTick:time},row):null;
 }
 function cue(index,time){for(var d=1;d<=36;d++){var row=eventAt(index,time+d);if(row)return Object.assign({inTicks:d},row);}return null;}
 function emit(s,x,y,angle,speed,radius,ttl,kind,options){return choreo.emit(s,Math.round(x),Math.round(y),((Math.round(angle)%512)+512)%512,speed,radius,ttl,kind,options);}
 function delta(a,b){return(a-b+768)%512-256;}
 function phaseNode(node,cycle){return cycle%2&&node!==1?2-node:node;}
 function points(index,row,boss){
  if(index===0)return row.kind==='wind'?[{x:boss.x/Q-52,y:boss.y/Q+12,key:'leaf'},{x:boss.x/Q+52,y:boss.y/Q+12,key:'petal'}]:[{x:boss.x/Q,y:boss.y/Q,key:'bud'}];
  var table=index===1?flowers:bells,ids=row.kind==='weave'||row.kind==='echoPair'?[0,2]:[phaseNode(row.node,row.cycle)];
  return ids.map(function(i){return{x:table[i][0],y:table[i][1],key:index===1?'petal':'bud',node:i,kind:row.kind};});
 }
 function sources(index,time,boss){var row=cue(index,time);return row?points(index,row,boss):[];}
 function presentationNodes(index,time,boss){
  if(index===1)return flowers.map(function(p){return p.slice();});if(index===2)return bells.map(function(p){return p.slice();});
  return[[boss.x/Q-52,boss.y/Q+12],[boss.x/Q,boss.y/Q],[boss.x/Q+52,boss.y/Q+12]];
 }
 function wind(s,row){
  var x=s.boss.x,y=s.boss.y,gate=[156,216,276,324,276,216][row.cycle%6],side=row.cycle%2?-1:1,i,a;
  if(row.kind==='wind'){
   var sweep=[84,96,108,120,132,144][row.ordinal];
   [-1,1].forEach(function(sign){var sx=x+sign*52*Q,sy=y+12*Q,center=sign<0?sweep:256-sweep;
    for(var k=-4;k<=4;k++){a=center+k*8;var v=s.rules.directionVectors[a],landing=sx/Q+(550-sy/Q)*v[0]/v[1];if(v[1]<=0||Math.abs(landing-gate)<62)continue;
     emit(s,sx,sy,a,156+Math.abs(k)*3,3,300,sign<0?22:23,{turn:sign*side*10,changeAge:96,mode:1,nextSpeed:168,nextTurn:0});}
   });
  }else{
   var opening=choreo.direction(s,x,y,gate*Q,550*Q);for(i=0;i<27;i++){a=40+i*7;if(Math.abs(delta(a,opening))>23)emit(s,x,y,a,156,4,310,21);}
  }
 }
 function bloom(s,row){
  var side=row.cycle%2?-1:1,gate=[156,240,324,240][row.cycle%4],targets=points(1,row,s.boss);
  targets.forEach(function(point){var x=point.x*Q,y=point.y*Q,opening=choreo.direction(s,x,y,gate*Q,560*Q),i,a;
   if(row.kind==='weave'){
    for(i=-4;i<=4;i++){a=128+i*13+(point.node===0?8:-8);if(Math.abs(delta(a,opening))>18)emit(s,x,y,a,164,3,290,22,{turn:point.node===0?12:-12});}return;
   }
   var echo=row.kind==='bloomEcho',count=echo?30:40,rotation=(row.cycle*11+(echo?9:0))%32;
   for(i=0;i<count;i++){a=Math.floor(i*512/count)+rotation;if(Math.abs(delta(a,opening))< (echo?29:25))continue;
    var speed=echo?[116,132,156,168,144,124][i%6]:[128,144,176,200,176,144,128,120][i%8];
    emit(s,x,y,a,speed,3,330,echo?22:23,{turn:echo?-side*18:side*24,changeAge:echo?84:96,mode:1,nextSpeed:echo?148:168,nextTurn:echo?0:-side*12});
   }
  });
 }
 function bell(s,row){
  points(2,row,s.boss).forEach(function(point){var x=point.x*Q,y=point.y*Q,i,a;
   if(row.kind==='bellClose'){
    var gate=[176,304,240,304][row.cycle%4],opening=choreo.direction(s,x,y,gate*Q,550*Q);
    for(i=0;i<24;i++){a=36+i*8;if(Math.abs(delta(a,opening))>24)emit(s,x,y,a,152,4,320,20);}return;
   }
   // Every fan locks once at release. Moving afterwards never bends it toward the player.
   var echo=row.kind!=='call',aim=choreo.direction(s,x,y,s.player.x,s.player.y),count=row.kind==='echoPair'?4:6;
   for(i=-count;i<=count;i++){a=aim+i*(echo?10:8);emit(s,x,y,a,echo?140:192,echo?3:4,340,echo?23:24,echo?{changeAge:84,mode:1,nextSpeed:184}:undefined);}
  });
 }
 function pattern(s){
  if(s.index<0||s.index>2||s.tick<36)return;var row=eventAt(s.index,s.musicTick);if(!row)return;
  s.lastCue=Object.assign({tick:s.tick},row);if(s.index===0)wind(s,row);else if(s.index===1)bloom(s,row);else bell(s,row);
 }
 return{id:'normal',names:names,configure:configure,pattern:pattern,cue:cue,sources:sources,presentationNodes:presentationNodes,
  phaseStartGraceTicks:36,periods:periods.slice(),eventAt:eventAt,firstMusicEventTick:START};
}));
