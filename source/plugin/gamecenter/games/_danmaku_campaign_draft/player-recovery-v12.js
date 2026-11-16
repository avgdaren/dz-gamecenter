/* (C) 2026 Carinoasd. Shared death, return and protection lifecycle: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuRecovery=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';var DELAY=36,PROTECT=240,CLEAR=72,Q=64;
 function hidden(s){var r=s.recovery;return !!(r&&(r.terminal||r.age<DELAY));}
 function prepare(s){if(s.recoveryPreparedV12)return s;s.recoveryPreparedV12=true;var fire=s.fire,snapshot=s.snapshot;
  s.fire=function(input){if(!hidden(this))return fire.call(this,input);};
  s.snapshot=function(){var v=snapshot.call(this);v.recovery=this.recovery?Object.assign({},this.recovery):null;return v;};return s;
 }
 function begin(flow){var s=flow.sim;s.shots=[];s.recovery={x:s.player.x,y:s.player.y,age:0,returned:false,terminal:s.player.lives<=0,cleared:0};
  if(s.player.lives>0)s.player.invulUntil=Math.max(s.player.invulUntil,s.tick+DELAY+PROTECT);return s.recovery;
 }
 function advance(flow){var s=flow.sim,r=s.recovery;if(!r)return;r.age++;
  if(!r.terminal&&!r.returned&&r.age>=DELAY){r.returned=true;var p=s.player;p.x=p.px=s.rules.player.startX*Q;p.y=p.py=s.rules.player.startY*Q;
   var before=s.enemies.length;s.enemies=s.enemies.filter(function(e){return(e.x-p.x)**2+(e.y-p.y)**2>(CLEAR*Q)**2;});r.cleared+=before-s.enemies.length;
  }
  if(!r.terminal&&r.age>DELAY+PROTECT+24)delete s.recovery;
 }
 function transfer(old,next){if(old.recovery)next.recovery=Object.assign({},old.recovery);}
 function model(s){var r=s.recovery;if(!r)return null;return Object.assign({},r,{hidden:hidden(s),returnAge:Math.max(0,r.age-DELAY),protection:Math.max(0,DELAY+PROTECT-r.age),delay:DELAY,protectionTicks:PROTECT});}
 return{prepare:prepare,begin:begin,advance:advance,transfer:transfer,hidden:hidden,model:model,delayTicks:DELAY,protectionTicks:PROTECT,totalTicks:DELAY+PROTECT,returnClearRadius:CLEAR};
}));
