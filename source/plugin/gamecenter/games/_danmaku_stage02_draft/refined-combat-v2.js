/* (C) 2026 Carinoasd. Garden formations and independent Easy patterns: 小典 / Codex.
 * Offline candidate; fixed-point shared player/motion core, no ranked registration.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./refined-combat-v1.js'),require('../_danmaku_proto/stage.js'));
 else root.Stage02Refined=factory(root.Stage02Refined,root.DanmakuStage01);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy,stage){
 'use strict';var Q=64,RULE='danmaku-stage02-easy-refined-v2';
 var names=['风廊 · 交错风径','花瓣舒展 · 三庭开合','铃声回响 · 隔庭应答'];
 var segments=[{at:0,name:'花庭入口'},{at:120,name:'双翼风队'},{at:390,name:'庭间列阵'},{at:1080,name:'拾取与整备'},{at:1260,name:'风侍合流'},{at:1800,name:'花铃与双翼'},{at:2280,name:'短暂喘息'},{at:2520,name:'三庭交唱'},{at:3060,name:'回收与整备'},{at:3240,name:'庭门合奏'},{at:4380,name:'列阵收束'},{at:5040,name:'终场拾取'}];
 function schedule(){
  var rows=[],id=200;
  function team(sec,mirror,n,reward){for(var i=0;i<n;i++)rows.push({id:++id,type:0,at:Math.round(sec*60)+i*18,x:(mirror?416:64)*Q,mirror:mirror,reward:i===n-1?reward:0,route:'sweep'});}
  function columns(sec){for(var row=0;row<2;row++)[120,240,360].forEach(function(x,i){rows.push({id:++id,type:0,at:Math.round(sec*60)+row*36,x:x*Q,mirror:i===2,reward:i===1?1:0,route:'column'});});}
  function caster(sec,x,reward,type){rows.push({id:++id,type:type===undefined?1:type,at:Math.round(sec*60),x:x*Q,mirror:false,reward:reward,route:'hold'});}
  team(2,false,5,2);team(4,true,5,2);caster(6.5,128,1);caster(6.5,352,1);columns(9);caster(13,240,2);
  team(21,false,5,1);team(23,true,5,1);caster(25,128,1);caster(25,352,1);columns(26);caster(30,240,3,2);team(33,false,5,1);team(35,true,5,1);
  [96,240,384].forEach(function(x){caster(42,x,1);});columns(43);team(46,false,4,1);team(46.6,true,4,1);
  team(54,false,5,1);team(56,true,5,1);caster(58.5,128,1);caster(58.5,352,1);columns(60.5);caster(64.5,240,3,2);team(67,false,5,1);team(69,true,5,1);caster(73,128,1);caster(73,352,1);columns(77.5);
  return rows.sort(function(a,b){return a.at-b.at||a.id-b.id;});
 }
 function configure(base){
  var r=Object.assign({},base);
  var attacks=[
   [{at:60,warning:30,aimed:false,capture:false,offsets:[-18,0,18]},{at:132,warning:102,aimed:false,capture:false,offsets:[-18,0,18]}],
   [{at:66,warning:30,aimed:true,capture:true,offsets:[-16,0,16]},{at:156,warning:120,aimed:true,capture:true,offsets:[-28,-14,0,14,28]}],
   [{at:120,warning:84,aimed:false,capture:false,offsets:[-44,-22,0,22,44]},{at:228,warning:192,aimed:true,capture:true,offsets:[-18,0,18]},{at:336,warning:300,aimed:false,capture:false,offsets:[-66,-44,-22,0,22,44,66]},{at:444,warning:408,aimed:true,capture:true,offsets:[-18,0,18]}]
  ];
  r.stage01=Object.assign({},base.stage01,{preludeTicks:5400,gatherTick:5040,maxTicks:19000,schedule:schedule(),segments:segments,mobCap:24,enemyCap:192,
   types:base.stage01.types.map(function(v,i){return Object.assign({},v,{name:['风庭精灵','司铃风侍','花铃守卫'][i],hp:[32,128,420][i],life:[330,300,600][i],speedQ:[140,152,132][i],bulletRadius:i===2?4:3,ttl:i===2?300:280,attacks:attacks[i]});})});
  r.collect08=Object.assign({},base.collect08,{extraPowerIds:[]});r.boss=Object.assign({},base.boss,{phaseHP:[5700,6300,6900]});return r;
 }
 var plans=[
  [60,90,120,150,180,210].map(function(at,i){return{at:at,kind:'wind',ordinal:i};}),
  [{at:72,kind:'bloom',node:0},{at:132,kind:'bloom',node:2},{at:192,kind:'bloom',node:1},{at:282,kind:'bloom',node:2},{at:342,kind:'bloom',node:0}],
  [{at:60,kind:'call',node:0},{at:108,kind:'echo',node:2},{at:180,kind:'call',node:2},{at:228,kind:'echo',node:0},{at:300,kind:'call',node:1},{at:348,kind:'echoPair',node:1}]
 ];
 var periods=[360,420,480],flowerNodes=[[128,148],[240,184],[352,148]],bellNodes=[[112,124],[240,104],[368,124]];
 function cycle(index,t){var n=periods[index];return{q:1+(t-1)%n,c:Math.floor((t-1)/n),length:n};}
 function castAt(index,t){return t>0&&plans[index].some(function(p){return p.at===cycle(index,t).q;});}
 function nextCast(index,t){for(var d=1;d<=36;d++)if(castAt(index,t+d))return d;return null;}
 function cue(index,t){for(var d=1;d<=36;d++){var p=cycle(index,t+d),row=plans[index].find(function(v){return v.at===p.q;});if(row)return Object.assign({inTicks:d,cycle:p.c},row);}return null;}
 function nodeIndex(index,node,c){return c%2&&node!==1?2-node:node;}
 function sources(index,t,boss){
  var next=cue(index,t);if(!next)return[];
  if(index===0)return[{x:boss.x/Q-30,y:boss.y/Q+10,key:'leaf'},{x:boss.x/Q+30,y:boss.y/Q+10,key:'leaf'}];
  var table=index===1?flowerNodes:bellNodes,ids=next.kind==='echoPair'?[0,2]:[nodeIndex(index,next.node,next.cycle)];
  return ids.map(function(i){return{x:table[i][0],y:table[i][1],key:index===1?'petal':'bud',node:i,kind:next.kind};});
 }
 function mobAttacks(s,m){var rows=s.rules.stage01.types[m.type].attacks;return m.type===0&&m.route!=='column'?rows.slice(0,1):rows;}
 function position(s,m,age){
  var r=s.rules,side=m.mirror?-1:1,sine=function(period,amplitude,offset){var n=(Math.floor(age*512/period)+(offset||0))%512;return Math.trunc(r.directionVectors[n][1]*amplitude*Q/1024);},x=m.baseX,y;
  if(m.type===0){x+=m.route==='column'?sine(240,18):side*(age*40+sine(330,18));y=-32*Q+age*136;}
  else if(m.type===1){x+=sine(240,12);y=age<80?-40*Q+age*128:age<=240?120*Q:120*Q-(age-240)*192;}
  else{x+=sine(480,18);y=age<100?-48*Q+age*120:age<=480?139*Q:139*Q-(age-480)*128;}
  return{x:Math.max(16*Q,Math.min(464*Q,x)),y:y};
 }
 function Sim(base,index,options){
  options=options||{};stage.Sim.call(this,configure(base),index,false,stage.cornerRule);this.rule=RULE;this.choreographyMode=true;
  this.testInvincible=!!options.invincible;this.shooting=options.shooting!==false;this.emitters=[];this.lastCast=-999;this.lastCue=null;
  this.player.power=options.power===undefined?16:options.power;this.hpMax=index<0?0:this.rules.boss.phaseHP[index];this.stats.castMobs=0;this.stats.gardenPhasePower=0;
 }
 Sim.prototype=Object.create(stage.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.fire=function(input){if(this.shooting)stage.Sim.prototype.fire.call(this,input);};
 Sim.prototype.spawn=function(x,y,angle,speed,radius,ttl,kind){
  if(this.index<0&&kind<3)kind=[22,23,24][kind];stage.Sim.prototype.spawn.call(this,x,y,Math.round(angle),speed,radius,ttl,kind);
  var key=this.tick+'|'+x+'|'+y,prior=this.emitters.find(function(e){return e.key===key;});if(prior)prior.count++;else this.emitters.push({key:key,x:x/Q,y:y/Q,born:this.tick,kind:kind,count:1});
  this.emitters=this.emitters.filter(function(e){return this.tick-e.born<=18;},this).slice(-24);this.lastCast=this.tick;
 };
 function emit(s,x,y,angle,speed,radius,ttl,kind,turn,changeAge,nextSpeed){
  // Keep off-body garden sources away from close-range player positions.
  if((x-s.player.x)**2+(y-s.player.y)**2<(72*Q)**2)return null;
  s.spawn(x,y,angle,speed,radius,ttl,kind);var e=s.enemies[s.enemies.length-1];
  if(turn||changeAge)e.motion=[((Math.round(angle)*256)%131072+131072)%131072,speed,turn||0,0,changeAge||-1,1,0,nextSpeed||speed,0,0,0];return e;
 }
 function mobs(s){
  var r=s.rules.stage01,t=s.tick;
  while(s.cursor<r.schedule.length&&r.schedule[s.cursor].at<=t){var b=r.schedule[s.cursor++],m={id:b.id,type:b.type,born:b.at,baseX:b.x,mirror:b.mirror,reward:b.reward,route:b.route,hp:r.types[b.type].hp,aim:128,warningUntil:0,warningKind:0};Object.assign(m,position(s,m,0));m.px=m.x;m.py=m.y;s.mobs.push(m);s.stats.mobSpawned++;}
  s.mobs=s.mobs.filter(function(m){return m.hp>0&&t-m.born<r.types[m.type].life;});s.stats.mobPeak=Math.max(s.stats.mobPeak,s.mobs.length);if(s.mobs.length>r.mobCap)throw Error('花庭编队超过上限');
  s.mobs.forEach(function(m){var age=t-m.born,spec=r.types[m.type];m.px=m.x;m.py=m.y;Object.assign(m,position(s,m,age));mobAttacks(s,m).forEach(function(a){
   if(age===a.warning){if(a.capture)s.capture(m);m.warningUntil=t+a.at-a.warning;m.warningKind=a.aimed?1:2;}
   if(age===a.at){if(m.cast===undefined)s.stats.castMobs++;m.cast=t;a.offsets.forEach(function(offset){s.spawn(m.x,m.y,(a.aimed?m.aim:128)+offset,spec.speedQ,spec.bulletRadius,spec.ttl,m.type);});}
  });});
 }
 function bossPattern(s){
  var p=cycle(s.index,s.tick),row=plans[s.index].find(function(v){return v.at===p.q;});if(!row)return;s.lastCue=Object.assign({tick:s.tick,cycle:p.c},row);
  var x=s.boss.x,y=s.boss.y,side=p.c%2?-1:1;
  if(s.index===0){
   var gap=[168,240,312,240][p.c%4],sweep=[150,142,134,126,118,126][row.ordinal];
   [-1,1].forEach(function(sign){var sx=x+sign*30*Q,sy=y+10*Q,center=sign<0?sweep:256-sweep;
    [-22,-11,0,11,22].forEach(function(offset){var a=center+offset,v=s.rules.directionVectors[a],landing=sx/Q+(500-sy/Q)*v[0]/v[1];if(Math.abs(landing-gap)<72)return;var e=emit(s,sx,sy,a,144,3,330,22,sign*side*16,90,148);if(e)e.windGap=gap;});
   });
  }else if(s.index===1){
   var node=nodeIndex(1,row.node,p.c),point=flowerNodes[node],px=point[0]*Q,py=point[1]*Q;
   if(node===1){for(var lobe=0;lobe<5;lobe++)for(var k=-1;k<=1;k++)emit(s,px,py,64+lobe*24+k*6,[112,144,172,144,112][lobe],3,330,23,side*(lobe-2)*10,96,148);}
   else for(var i=0;i<7;i++)emit(s,px,py,56+i*22+(node===0?4:-4),132,3,330,23,node===0?16:-16,96,148);
  }else{
   var ids=row.kind==='echoPair'?[0,2]:[nodeIndex(2,row.node,p.c)],echo=row.kind!=='call';
   ids.forEach(function(i){var pt=bellNodes[i],angles=row.kind==='echoPair'?[-48,-32,-16,16,32,48]:[-56,-42,-28,-14,0,14,28,42,56];angles.forEach(function(offset){emit(s,pt[0]*Q,pt[1]*Q,128+offset+(echo?(i===0?-6:6):0),echo?112:176,echo?3:4,350,24,echo?(i-1)*14:0,echo?72:0,echo?160:176);});});
  }
 }
 Sim.prototype.pattern=function(){if(this.index<0)mobs(this);else bossPattern(this);};
 Sim.prototype.snapshot=function(){var v=stage.Sim.prototype.snapshot.call(this);v.rule=RULE;v.routes=this.mobs.map(function(m){return[m.id,m.route];});return v;};
 var presets={standard:{lives:3,bombs:2,power:16},worn:{lives:2,bombs:1,power:12},damaged:{lives:1,bombs:1,power:8},low:{lives:2,bombs:1,power:0}};
 function copy(v){return JSON.parse(JSON.stringify(v));}
 function Flow(base,selection,preset,invincible){
  if(!presets[preset])throw Error('抵达资源预设无效');legacy.Flow.call(this,base,selection,'standard',invincible);this.preset=preset;this.rules=configure(base);
  this.sim=new Sim(base,this.phaseIndex,{invincible:invincible,power:presets[preset].power});Object.assign(this.sim.player,presets[preset]);this.stats=this.sim.stats;this.checkpoint=this.phaseIndex>=0?this.captureCheckpoint():null;
 }
 Flow.prototype=Object.create(legacy.Flow.prototype);Flow.prototype.constructor=Flow;
 Flow.prototype.replace=function(index){
  var old=this.sim;
  // Two marked P after each nonfinal boss phase support recovery; retries restore
  // the pre-boss checkpoint, so these rewards never accumulate across attempts.
  if(old.index>=0){old.drop(old.boss.x,old.boss.y,2,false);old.stats.gardenPhasePower+=2;}
  old.drops.forEach(function(d){old.collect(d);});old.drops=[];var next=new Sim(this.base,index,{invincible:old.testInvincible});
  next.player=Object.assign({},old.player,{px:old.player.x,py:old.player.y,invulUntil:Math.max(0,old.player.invulUntil-old.tick)});next.stats=this.stats;
  next.nextEnemy=old.nextEnemy;next.nextShot=old.nextShot;next.nextDrop=old.nextDrop;next.bombActiveUntil=Math.max(0,old.bombActiveUntil-old.tick);next.bombCooldownUntil=Math.max(0,old.bombCooldownUntil-old.tick);next.lastBomb=Math.max(-999,old.lastBomb-old.tick);next.bombX=old.bombX;next.bombY=old.bombY;this.sim=next;this.phaseIndex=index;
 };
 Flow.prototype.retryBoss=function(){
  if(!this.checkpoint)return false;var c=this.checkpoint,next=new Sim(this.base,c.index,{invincible:this.sim.testInvincible});next.player=Object.assign({},c.player,{px:c.player.x,py:c.player.y,invulUntil:c.invul});next.stats=copy(c.stats);next.bombCooldownUntil=c.cooldown;
  next.nextEnemy=c.nextIds[0];next.nextShot=c.nextIds[1];next.nextDrop=c.nextIds[2];this.sim=next;this.stats=next.stats;this.phaseIndex=c.index;this.stage='opening';this.remaining=390;this.status='playing';this.endingAge=0;this.bossTicks=0;this.phaseBreaks=0;this.usedTest=true;this.events.push({type:'retryBoss',tick:this.tick});return true;
 };
 Flow.prototype.inspect=function(){var v=legacy.Flow.prototype.inspect.call(this);v.rule=RULE;return v;};
 return{Sim:Sim,Flow:Flow,configure:configure,schedule:schedule,segments:segments,presets:presets,names:names,cycle:cycle,castAt:castAt,nextCast:nextCast,cue:cue,sources:sources,nodeIndex:nodeIndex,flowerNodes:flowerNodes,bellNodes:bellNodes,mobAttacks:mobAttacks,position:position,duration:5400,rule:RULE};
}));
