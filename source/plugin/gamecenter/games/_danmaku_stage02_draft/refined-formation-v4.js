/* (C) 2026 Carinoasd. Visible squads and original garden patterns: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./refined-intro-v1.js'),require('./garden-original-patterns-v1.js'),function(){return require('./chart.json');},require('../_danmaku_proto/engine.js'));
 else root.Stage02Refined=factory(root.Stage02Refined,root.DanmakuGardenOriginal,function(){return root.Stage02RefinedData.chart;},root.DanmakuP0);
}(typeof globalThis!=='undefined'?globalThis:this,function(legacy,original,getChart,engine){
 'use strict';var Q=64,RULE='danmaku-stage02-easy-refined-v4',names=['风廊','花瓣舒展','铃声回响'];
 function schedule(){
  var rows=legacy.schedule().map(function(m){return Object.assign({},m);});
  [false,true].forEach(function(mirror){var last=-999,start=0,count=0;rows.filter(function(m){return m.type===0&&m.route==='sweep'&&m.mirror===mirror;}).forEach(function(m){var at=m.at;if(at-last!==18){start=at;count=0;}last=at;m.at=start+Math.floor(count/3)*36;m.route='sideArc';m.lane=count%3;count++;});});
  var id=900;[9.6,49.5,72.5].forEach(function(sec){[64,134,204,276,346,416].forEach(function(x){rows.push({id:++id,type:0,at:Math.round(sec*60),x:x*Q,mirror:false,reward:0,route:'column',lane:0});});});
  return rows.sort(function(a,b){return a.at-b.at||a.id-b.id;});
 }
 function rules(r){return Object.assign({},r,{stage01:Object.assign({},r.stage01,{schedule:schedule(),mobCap:32,enemyCap:256})});}
 function configure(base){return rules(legacy.configure(base));}
 function adopt(s,time){Object.setPrototypeOf(s,Sim.prototype);s.rules=rules(s.rules);s.rule=RULE;s.chart=getChart();s.musicTick=s.index<0?0:time===undefined?390:time;return s;}
 function Sim(base,index,options){legacy.Sim.call(this,base,index,options);adopt(this);}
 Sim.prototype=Object.create(legacy.Sim.prototype);Sim.prototype.constructor=Sim;
 function position(s,m,age){
  if(m.route!=='sideArc')return legacy.position(s,m,age);
  var distance=age<30?age*256:30*256+(age-30)*144;
  return{x:m.mirror?504*Q-distance:-24*Q+distance,y:(96+(m.lane||0)*44)*Q+age*50};
 }
 function mobs(s){var r=s.rules.stage01,t=s.tick;
  while(s.cursor<r.schedule.length&&r.schedule[s.cursor].at<=t){var b=r.schedule[s.cursor++],m={id:b.id,type:b.type,born:b.at,baseX:b.x,mirror:b.mirror,reward:b.reward,route:b.route,lane:b.lane||0,hp:r.types[b.type].hp,aim:128,warningUntil:0,warningKind:0};Object.assign(m,position(s,m,0));m.px=m.x;m.py=m.y;s.mobs.push(m);s.stats.mobSpawned++;}
  s.mobs=s.mobs.filter(function(m){return m.hp>0&&t-m.born<(m.route==='sideArc'?240:r.types[m.type].life)&&(m.route!=='sideArc'||t-m.born<30||m.x>=-32*Q&&m.x<=512*Q);});s.stats.mobPeak=Math.max(s.stats.mobPeak,s.mobs.length);if(s.mobs.length>r.mobCap)throw Error('花庭齐阵超过上限');
  s.mobs.forEach(function(m){var age=t-m.born,spec=r.types[m.type];m.px=m.x;m.py=m.y;Object.assign(m,position(s,m,age));legacy.mobAttacks(s,m).forEach(function(a){
   if(age===a.warning){if(a.capture)s.capture(m);m.warningUntil=t+a.at-a.warning;m.warningKind=a.aimed?1:2;}
   if(age===a.at){if(m.cast===undefined)s.stats.castMobs++;m.cast=t;a.offsets.forEach(function(offset){s.spawn(m.x,m.y,(a.aimed?m.aim:128)+offset,spec.speedQ,spec.bulletRadius,spec.ttl,m.type);});}
  });});
 }
 Sim.prototype.pattern=function(){if(this.index<0)mobs(this);else original.pattern(this);};
 Sim.prototype.step=function(input,validated){if(!validated)engine.validateInput(input,this.rules);if(this.index>=0)this.musicTick++;return legacy.Sim.prototype.step.call(this,input,true);};
 Sim.prototype.snapshot=function(){var v=legacy.Sim.prototype.snapshot.call(this);v.rule=RULE;v.musicTick=this.musicTick;v.lanes=this.mobs.map(function(m){return[m.id,m.lane||0];});return v;};
 function Flow(base,selection,preset,invincible){legacy.Flow.call(this,base,selection,preset,invincible);this.rules=rules(this.rules);adopt(this.sim,0);}
 Flow.prototype=Object.create(legacy.Flow.prototype);Flow.prototype.constructor=Flow;
 Flow.prototype.replace=function(index){legacy.Flow.prototype.replace.call(this,index);adopt(this.sim,this.bossTicks);};
 Flow.prototype.retryBoss=function(){var ok=legacy.Flow.prototype.retryBoss.call(this);if(ok)adopt(this.sim,0);return ok;};
 Flow.prototype.step=function(input){if(this.phaseIndex>=0)this.sim.musicTick=this.bossTicks;var status=legacy.Flow.prototype.step.call(this,input);if(this.phaseIndex>=0)this.sim.musicTick=this.bossTicks;return status;};
 Flow.prototype.inspect=function(){var v=legacy.Flow.prototype.inspect.call(this);v.rule=RULE;v.originalGardenPatterns=true;return v;};
 function cue(index,time){return original.cue(getChart(),index,time);}
 function sources(index,time,boss){var c=cue(index,time);if(!c)return[];var x=boss.x/Q,y=boss.y/Q;
  if(index===0)return c.kind==='wind'?[{x:x-48,y:y+12,key:'leaf'},{x:x+48,y:y+12,key:'petal'}]:[{x:x,y:y,key:'bud'}];
  if(index===1)return[{x:x,y:y,key:'petal'}];
  if(c.kind==='sideAnswer')return[{x:104,y:72,key:'bud'},{x:376,y:72,key:'bud'}];
  return[{x:[112,240,368][c.node],y:c.node===1?104:124,key:'bud',node:c.node,kind:c.kind}];
 }
 function nodes(index,time,boss){if(index===2)return[[112,124],[240,104],[368,124]].concat(sources(index,time,boss).filter(function(p){return p.y===72;}).map(function(p){return[p.x,p.y];}));return sources(index,time,boss).map(function(p){return[p.x,p.y];});}
 return Object.assign({},legacy,{Sim:Sim,Flow:Flow,configure:configure,schedule:schedule,position:position,names:names,rule:RULE,cue:cue,nextCast:function(index,time){var c=cue(index,time);return c?c.inTicks:null;},sources:sources,presentationNodes:nodes,originalGardenPatterns:true});
}));
