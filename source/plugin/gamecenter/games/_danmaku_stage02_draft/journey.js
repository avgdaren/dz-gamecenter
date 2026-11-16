/* (C) 2026 Carinoasd. Continuous Stage 2 journey and presentation trace: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./combat.js'),require('../_danmaku_proto/engine.js'));
 else root.DanmakuStage02Journey=factory(root.DanmakuStage02,root.DanmakuP0);
}(typeof globalThis!=='undefined'?globalThis:this,function(combat,engine){
 'use strict';
 function trace(sim){
  if(sim.presentationTrace)return;sim.presentationTrace=true;sim.presentationStartMusic=sim.musicTick;sim.emitters=[];var spawn=sim.spawn;
  sim.spawn=function(){
   spawn.apply(this,arguments);var e=this.enemies[this.enemies.length-1];e.originX=e.x;e.originY=e.y;
   var x=e.x/64,y=e.y/64,key=this.tick+'|'+Math.round(x/4)+'|'+Math.round(y/4);
   var found=this.emitters.find(function(v){return v.key===key;});
   if(found)found.count++;else this.emitters.push({key:key,x:x,y:y,born:this.tick,kind:e.kind,count:1});
   this.emitters=this.emitters.filter(function(v){return this.tick-v.born<=24;},this).slice(-24);this.presentationCast=this.tick;
  };
 }
 function Flow(base,chart,dialogue){this.base=base;this.chart=chart;this.script=dialogue;this.phase='title';this.line=0;this.run=new combat.Run(base,chart,'stage',false);this.usedTest=false;this.checkpoint=null;this.victoryTicks=0;this.clock=0;this.events=[];trace(this.run.sim);}
 Flow.prototype.start=function(test){
  this.phase='prologue';this.line=0;this.run=new combat.Run(this.base,this.chart,'stage',!!test);this.usedTest=!!test;this.checkpoint=null;this.victoryTicks=0;this.clock=0;this.events=[];trace(this.run.sim);
 };
 Flow.prototype.lines=function(){return this.script[this.phase]||[];};
 Flow.prototype.advance=function(){
  var lines=this.lines();if(!lines.length)return;
  if(++this.line<lines.length)return;
  this.line=0;this.phase=this.phase==='prologue'?'stage':this.phase==='bossTalk'?'boss':this.phase==='epilogue'?'complete':this.phase;
 };
 Flow.prototype.skip=function(){if(this.lines().length){this.line=this.lines().length-1;this.advance();}};
 Flow.prototype.setTest=function(value){if(value)this.usedTest=true;this.run.setTest(!!value);};
 Flow.prototype.bossRun=function(){
  var c=this.checkpoint,r=new combat.Run(this.base,this.chart,'boss',false);
  r.sim.player=Object.assign({},c.player);r.sim.player.px=r.sim.player.x;r.sim.player.py=r.sim.player.y;
  r.sim.stats=Object.assign({},c.stats);r.usedTest=this.usedTest;r.sim.testInvincible=this.run.sim.testInvincible;
  r.sim.bombCooldownUntil=c.cooldown;r.sim.bombActiveUntil=0;trace(r.sim);return r;
 };
 Flow.prototype.enterBoss=function(){
  var old=this.run.sim;old.drops.forEach(function(d){old.collect(d);});old.drops=[];
  this.usedTest=this.usedTest||this.run.usedTest;
  this.checkpoint={player:Object.assign({},old.player,{invulUntil:Math.max(0,old.player.invulUntil-old.tick)}),stats:Object.assign({},old.stats),cooldown:Math.max(0,old.bombCooldownUntil-old.tick)};
  this.run=this.bossRun();this.phase='bossTalk';this.line=0;this.events.push({phase:'bossTalk',clock:this.clock});
 };
 Flow.prototype.retryBoss=function(){if(!this.checkpoint)return false;this.run=this.bossRun();this.phase='boss';this.line=0;this.victoryTicks=0;this.events.push({phase:'retryBoss',clock:this.clock});return true;};
 Flow.prototype.step=function(input){
  engine.validateInput(input,this.run.sim.rules);
  if(this.phase==='victory'){
   this.clock++;this.victoryTicks++;if(this.victoryTicks>=75){this.phase='epilogue';this.line=0;this.events.push({phase:'epilogue',clock:this.clock});}return;
  }
  if(this.phase!=='stage'&&this.phase!=='boss')return;
  this.clock++;trace(this.run.sim);
  if(this.run.wait>0){this.run.sim.bombCooldownUntil=Math.max(0,this.run.sim.bombCooldownUntil-1);this.run.sim.bombActiveUntil=Math.max(0,this.run.sim.bombActiveUntil-1);}
  var result=this.run.step(input);trace(this.run.sim);this.usedTest=this.usedTest||this.run.usedTest;
  if(result==='stage_clear'){this.enterBoss();}
  else if(result==='boss_clear'){
   this.run.sim.enemies=[];this.run.sim.shots=[];this.run.sim.emitters=[];this.run.sim.drops.forEach(function(d){this.run.sim.collect(d);},this);this.run.sim.drops=[];
   this.phase='victory';this.victoryTicks=0;this.events.push({phase:'victory',clock:this.clock});
  }else if(result==='dead'||result==='timeout'||result==='music_end'){
   this.phase=result==='dead'?'dead':'timeout';this.events.push({phase:this.phase,clock:this.clock});
  }
 };
 Flow.prototype.audio=function(){
  var track=this.run.sim.index<0?'stage':'boss',active=this.phase==='stage'||this.phase==='boss'||this.phase==='victory';
  return {track:track,offset:this.run.time/60+(this.phase==='victory'?this.victoryTicks/60:0),active:active,fade:this.phase==='victory'?Math.max(0,1-this.victoryTicks/48):1};
 };
 Flow.prototype.inspect=function(){return{phase:this.phase,line:this.line,dialogue:this.lines()[this.line]||null,dialogueLength:this.lines().length,clock:this.clock,victoryTicks:this.victoryTicks,checkpoint:!!this.checkpoint,usedTest:this.usedTest,ranked:false,run:this.run.inspect(),audio:this.audio(),events:this.events.slice()};};
 Flow.prototype.snapshot=function(){return{phase:this.phase,line:this.line,clock:this.clock,usedTest:this.usedTest,victoryTicks:this.victoryTicks,run:this.run.inspect(),sim:this.run.sim.snapshot()};};
 return {Flow:Flow,trace:trace};
}));
