/* (C) 2026 Carinoasd. Stage 2 compact Easy candidate: 小典 / Codex.
 * Offline practice only. Shared Stage 1 player mechanics; no ranked registration.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/stage.js'),require('../_danmaku_proto/engine.js'));
 else root.Stage02Refined=factory(root.DanmakuStage01,root.DanmakuP0);
}(typeof globalThis!=='undefined'?globalThis:this,function(stage,engine){
 'use strict';var Q=64,DURATION=5400,RULE='danmaku-stage02-easy-refined-v1';
 var names=['风廊','花瓣舒展','铃声回响'];
 var segments=[{at:0,name:'花庭入口'},{at:120,name:'风队迎行'},{at:600,name:'司铃与回风'},{at:1260,name:'拾取空隙'},{at:1620,name:'双翼合流'},{at:2160,name:'短暂喘息'},{at:2340,name:'花铃守卫'},{at:3120,name:'回收与整备'},{at:3420,name:'司铃交唱'},{at:4140,name:'庭门合奏'},{at:5040,name:'收束与拾取'}];
 function schedule(){
  var rows=[],id=100;
  function team(sec,mirror,n,reward){for(var i=0;i<(n||4);i++)rows.push({id:++id,type:0,at:Math.round(sec*60)+i*33,x:0,mirror:mirror,reward:i===(n||4)-1?reward:0});}
  function guard(sec,x,reward,type){rows.push({id:++id,type:type===undefined?1:type,at:Math.round(sec*60),x:x*Q,mirror:false,reward:reward});}
  // Preserve the approved first 24 seconds, then develop complete formations.
  team(2,false,4,2);team(6,true,4,2);guard(10,144,1);guard(10,336,1);team(13,false,4,2);team(15.5,true,4,2);
  team(27,false,3,1);team(27.55,true,3,1);guard(31.5,160,1);guard(31.5,320,1);
  guard(39,240,3,2);team(42,false,4,1);team(46,true,4,1);
  guard(57,144,1);guard(57,336,1);team(62,false,3,1);team(64,true,3,1);
  guard(69,240,3,2);team(74,false,3,1);team(77,true,3,1);
  return rows.sort(function(a,b){return a.at-b.at||a.id-b.id;});
 }
 function configure(base){
  var r=Object.assign({},base);
  r.stage01=Object.assign({},base.stage01,{preludeTicks:DURATION,gatherTick:5040,maxTicks:19000,schedule:schedule(),segments:segments,
   types:base.stage01.types.map(function(v,i){return Object.assign({},v,{name:['风庭精灵','司铃风侍','花铃守卫'][i],hp:i===1?96:v.hp});})});
  r.collect08=Object.assign({},base.collect08,{extraPowerIds:[]});
  // Boss HP, timeout, hitbox and all shared player rules match the first Easy.
  r.boss=Object.assign({},base.boss,{phaseHP:base.boss.phaseHP.slice()});return r;
 }
 function cycle(index,t){var length=index===0?450:index===1?300:360;return{q:1+(t-1)%length,c:Math.floor((t-1)/length),length:length};}
 function castAt(index,t){if(t<1)return false;var q=cycle(index,t).q;return(index===0?[45,63,195,213,345,363]:index===1?[66,98,216,248]:[30,54,78,102,186,218]).indexOf(q)>=0;}
 function nextCast(index,t){for(var d=1;d<=36;d++)if(castAt(index,t+d))return d;return null;}
 function capture(s){var m={x:s.boss.x,y:s.boss.y,aim:128};s.capture(m);s.aimAngle=m.aim;}
 function Sim(base,index,options){
  options=options||{};stage.Sim.call(this,configure(base),index,false,stage.cornerRule);this.rule=RULE;
  this.testInvincible=!!options.invincible;this.shooting=options.shooting!==false;this.emitters=[];this.lastCast=-999;
  this.player.power=options.power===undefined?8:options.power;this.hpMax=index<0?0:this.rules.boss.phaseHP[index];
 }
 Sim.prototype=Object.create(stage.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.fire=function(input){if(this.shooting)stage.Sim.prototype.fire.call(this,input);};
 Sim.prototype.spawn=function(x,y,angle,speed,radius,ttl,kind){
  kind=this.index<0?[22,23,24][kind]:kind;
  stage.Sim.prototype.spawn.call(this,x,y,Math.round(angle),speed,radius,ttl,kind);
  var key=this.tick+'|'+x+'|'+y,prior=this.emitters.find(function(e){return e.key===key;});
  if(prior)prior.count++;else this.emitters.push({key:key,x:x/Q,y:y/Q,born:this.tick,kind:kind,count:1});
  this.emitters=this.emitters.filter(function(e){return this.tick-e.born<=18;},this).slice(-24);this.lastCast=this.tick;
 };
 Sim.prototype.pattern=function(){
  if(this.index<0){stage.Sim.prototype.pattern.call(this);return;}
  var t=this.tick,p=cycle(this.index,t),q=p.q,c=p.c,x=this.boss.x,y=this.boss.y,s=this;
  function emit(xx,yy,a,speed,radius,kind){s.spawn(xx,yy,a,speed,radius,360,kind);}
  if(this.index===0){
   // Familiar rosette timing/speeds; wind shifts the gap gently between calls.
   var main=[45,195,345].indexOf(q),echo=[63,213,363].indexOf(q);
   if(main<0&&echo<0)return;
   var ordinal=c*3+Math.max(main,echo),rotation=[-10,0,10][c%3],gap=[128,120,128,136][ordinal%4],sx=x+(echo>=0?18:-18)*Q;
   for(var i=0;i<24;i++){var a=Math.floor(i*512/24)+rotation,d=(a-gap+768)%512-256;if(Math.abs(d)>32)emit(sx,y+8*Q,a,echo>=0?80:104,4,22);}
  }else if(this.index===1){
   // Two flower blooms and a locked echo. Existing 36-tick aim warning stays.
   if(q===62||q===212){capture(this);this.warningUntil=t+36;}
   if(q===66||q===216){
    for(var k=0;k<20;k++){var angle=Math.floor(k*512/20)+(c%3-1)*8,delta=(angle-128+768)%512-256;if(Math.abs(delta)>28)emit(x,y+8*Q,angle,[104,132,152,132][k%4],3,23);}
   }
   if(q===98||q===248)[-10,-5,0,5,10].forEach(function(a){emit(x,y+8*Q,s.aimAngle+a,192,3,23);});
  }else{
   // Three visible bells call in sequence, each leaving its own central opening.
   var row=[30,54,78,102].indexOf(q);
   if(row>=0){var bell=([0,1,2,1][row]+c)%3,bx=[112,240,368][bell]*Q,by=(bell===1?104:124)*Q;
    for(var j=-5;j<=5;j++)if(Math.abs(j)>1)emit(bx,by,128+j*12,128,4,24);
   }
   if(q===186||q===218){[48,64,80].forEach(function(a){emit(24*Q,80*Q,a,160,4,22);emit(456*Q,80*Q,256-a,160,4,22);});}
  }
 };
 Sim.prototype.snapshot=function(){var v=stage.Sim.prototype.snapshot.call(this);v.rule=RULE;return v;};
 var presets={standard:{lives:3,bombs:2,power:8},low:{lives:2,bombs:1,power:0},grown:{lives:3,bombs:2,power:16}};
 function copy(obj){return JSON.parse(JSON.stringify(obj));}
 function Flow(base,selection,preset,invincible){
  if(['stage','boss','phase0','phase1','phase2'].indexOf(selection)<0||!presets[preset])throw Error('练习入口无效');
  this.base=base;this.selection=selection;this.preset=preset;this.rules=configure(base);this.tick=0;this.bossTicks=0;this.phaseBreaks=0;this.events=[];this.endingAge=0;this.checkpoint=null;
  this.phaseIndex=selection==='stage'?-1:selection==='boss'?0:Number(selection.slice(-1));this.stage=this.phaseIndex<0?'prelude':'opening';this.remaining=this.phaseIndex<0?DURATION:390;this.status='playing';
  this.sim=new Sim(base,this.phaseIndex,{invincible:invincible,power:presets[preset].power});Object.assign(this.sim.player,presets[preset]);this.stats=this.sim.stats;this.usedTest=!!invincible;
  if(this.phaseIndex>=0)this.checkpoint=this.captureCheckpoint();
 }
 Flow.prototype.captureCheckpoint=function(){return{player:copy(this.sim.player),stats:copy(this.stats),invul:Math.max(0,this.sim.player.invulUntil-this.sim.tick),cooldown:Math.max(0,this.sim.bombCooldownUntil-this.sim.tick),nextIds:[this.sim.nextEnemy,this.sim.nextShot,this.sim.nextDrop],index:Math.max(0,this.phaseIndex)};};
 Flow.prototype.replace=function(index){
  var old=this.sim;old.drops.forEach(function(d){old.collect(d);});old.drops=[];
  var next=new Sim(this.base,index,{invincible:old.testInvincible});next.player=Object.assign({},old.player,{px:old.player.x,py:old.player.y,invulUntil:Math.max(0,old.player.invulUntil-old.tick)});
  next.stats=this.stats;next.nextEnemy=old.nextEnemy;next.nextShot=old.nextShot;next.nextDrop=old.nextDrop;
  next.bombActiveUntil=Math.max(0,old.bombActiveUntil-old.tick);next.bombCooldownUntil=Math.max(0,old.bombCooldownUntil-old.tick);next.lastBomb=Math.max(-999,old.lastBomb-old.tick);next.bombX=old.bombX;next.bombY=old.bombY;
  this.sim=next;this.phaseIndex=index;
 };
 Flow.prototype.retryBoss=function(){
  if(!this.checkpoint)return false;var c=this.checkpoint,next=new Sim(this.base,c.index,{invincible:this.sim.testInvincible});
  next.player=Object.assign({},c.player,{px:c.player.x,py:c.player.y,invulUntil:c.invul});next.stats=copy(c.stats);next.bombCooldownUntil=c.cooldown;
  next.nextEnemy=c.nextIds[0];next.nextShot=c.nextIds[1];next.nextDrop=c.nextIds[2];this.sim=next;this.stats=next.stats;this.phaseIndex=c.index;
  this.stage='opening';this.remaining=390;this.status='playing';this.endingAge=0;this.bossTicks=0;this.phaseBreaks=0;this.usedTest=true;this.events.push({type:'retryBoss',tick:this.tick});return true;
 };
 Flow.prototype.setInvincible=function(value){this.sim.testInvincible=!!value;if(value)this.usedTest=true;};
 Flow.prototype.step=function(input){
  engine.validateInput(input,this.sim.rules);if(this.status!=='playing')return this.status;
  this.tick++;if(this.phaseIndex>=0)this.bossTicks++;
  if(this.stage==='ending'){if(++this.endingAge>=100){this.status='clear';this.stage='over';}return this.status;}
  if(this.stage==='opening'||this.stage==='transition'){
   var p=this.sim.player,b=this.rules.field.playerBounds;p.px=p.x;p.py=p.y;p.x=Math.max(b.minX*Q,Math.min(b.maxX*Q,p.x+input.dx));p.y=Math.max(b.minY*Q,Math.min(b.maxY*Q,p.y+input.dy));
   p.invulUntil=Math.max(0,p.invulUntil-1);this.sim.bombCooldownUntil=Math.max(0,this.sim.bombCooldownUntil-1);this.sim.bombActiveUntil=Math.max(0,this.sim.bombActiveUntil-1);this.sim.lastBomb=Math.max(-999,this.sim.lastBomb-1);
   if(--this.remaining===0)this.stage='active';return this.status;
  }
  var result=this.sim.step(input,true);
  if(this.phaseIndex<0)this.remaining=Math.max(0,DURATION-this.sim.tick);
  if(result==='prelude_clear'){
   this.events.push({type:'stage_clear',tick:this.tick});this.replace(0);this.checkpoint=this.captureCheckpoint();this.stage='opening';this.remaining=390;this.bossTicks=0;
  }else if(result==='phase_clear'){
   this.phaseBreaks++;this.events.push({type:'phase_clear',index:this.phaseIndex,tick:this.tick,origin:[this.sim.boss.x/Q,this.sim.boss.y/Q]});
   if(this.phaseIndex===2||this.selection.indexOf('phase')===0){this.sim.drops.forEach(function(d){this.sim.collect(d);},this);this.sim.drops=[];this.sim.enemies=[];this.sim.shots=[];this.sim.emitters=[];this.stage='ending';this.endingAge=0;}
   else{this.replace(this.phaseIndex+1);this.stage='transition';this.remaining=120;}
  }else if(result==='dead'||result==='timeout'){this.status=result;this.stage='over';}
  return this.status;
 };
 Flow.prototype.inspect=function(){return{rule:RULE,selection:this.selection,preset:this.preset,tick:this.tick,bossTicks:this.bossTicks,stage:this.stage,status:this.status,phaseIndex:this.phaseIndex,phaseBreaks:this.phaseBreaks,remaining:this.remaining,endingAge:this.endingAge,checkpoint:!!this.checkpoint,usedTest:this.usedTest,ranked:false,sim:this.sim.snapshot(),stats:copy(this.stats),events:copy(this.events)};};
 return{Sim:Sim,Flow:Flow,configure:configure,schedule:schedule,segments:segments,presets:presets,names:names,cycle:cycle,castAt:castAt,nextCast:nextCast,duration:DURATION,rule:RULE};
}));
