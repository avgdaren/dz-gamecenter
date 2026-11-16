/* (C) 2026 Carinoasd. Bounded Stage 2 Easy formation sample: 小典 / Codex.
 * 24-second review only; not a registered complete-stage or ranked rule.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/stage.js'),require('../_danmaku_proto/engine.js'));
 else root.Stage02UnitySample=factory(root.DanmakuStage01,root.DanmakuP0);
}(typeof globalThis!=='undefined'?globalThis:this,function(stage,engine){
 'use strict';var duration=1440;
 function schedule(){
  var rows=[],id=100;function group(at,mirror,reward){for(var i=0;i<4;i++)rows.push({id:++id,type:0,at:at+i*33,x:0,mirror:mirror,reward:i===3?reward:0});}
  group(120,false,2);group(360,true,2);
  rows.push({id:++id,type:1,at:600,x:144*64,mirror:false,reward:1},{id:++id,type:1,at:600,x:336*64,mirror:false,reward:1});
  group(780,false,2);group(930,true,2);
  return rows.sort(function(a,b){return a.at-b.at||a.id-b.id;});
 }
 function rules(base){
  var r=Object.assign({},base),s=base.stage01;
  r.stage01=Object.assign({},s,{preludeTicks:duration,gatherTick:1320,schedule:schedule(),
   segments:[{at:0,name:'花庭入口'},{at:120,name:'左侧风队'},{at:360,name:'右侧回风'},{at:600,name:'司铃与交错编队'},{at:1260,name:'收束拾取'}],
   types:s.types.map(function(v,i){return Object.assign({},v,{name:['风庭精灵','司铃风侍','花铃守卫'][i],hp:i===1?96:v.hp});})});
  // The old first-stage bonus IDs must never rewrite a new authored wave's rewards.
  r.collect08=Object.assign({},base.collect08,{extraPowerIds:[]});return r;
 }
 function Sim(base,options){
  options=options||{};stage.Sim.call(this,rules(base),-1,false,stage.cornerRule);this.rule='danmaku-stage02-easy-wave-sample-v1';
  this.testInvincible=options.invincible!==false;this.unityShooting=options.shooting!==false;
  var level=options.level===undefined?3:options.level;if([1,3,5].indexOf(level)<0)throw Error('样段火力档无效');this.player.power=this.rules.stage01.growth.thresholds[level-1];
 }
 Sim.prototype=Object.create(stage.Sim.prototype);Sim.prototype.constructor=Sim;
 Sim.prototype.fire=function(input){if(this.unityShooting)stage.Sim.prototype.fire.call(this,input);};
 function Pair(base,options){
  options=options||{};this.first=new stage.Sim(base,-1,false,stage.cornerRule);this.second=new Sim(base,options);this.first.testInvincible=options.invincible!==false;
  this.first.player.power=this.second.player.power;this.tick=0;this.status='playing';this.usedTest=options.invincible!==false;this.duration=duration;
 }
 Pair.prototype.step=function(input){
  engine.validateInput(input,this.second.rules);if(this.status!=='playing')return this.status;
  for(var i=0;i<2;i++){var s=i?this.second:this.first;if(s.status==='playing')s.step(input,true);}
  this.tick++;if(this.tick>=duration)this.status='sample_end';else if(this.second.status==='dead')this.status='dead';return this.status;
 };
 Pair.prototype.setInvincible=function(value){this.first.testInvincible=this.second.testInvincible=!!value;if(value)this.usedTest=true;};
 Pair.prototype.inspect=function(){return{rule:this.second.rule,tick:this.tick,duration:this.duration,status:this.status,usedTest:this.usedTest,ranked:false,completeStage:false,first:this.first.snapshot(),second:this.second.snapshot()};};
 return{Sim:Sim,Pair:Pair,rules:rules,schedule:schedule,duration:duration};
}));
