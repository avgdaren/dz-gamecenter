/* (C) 2026 Carinoasd. Read-only garden acting timeline: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/engine.js'));else root.Stage02Performance=factory(root.DanmakuP0);
}(typeof globalThis!=='undefined'?globalThis:this,function(engine){
 'use strict';
 var names=['风廊','花瓣舒展','铃声回响'];
 var colors=['#64917b','#c9879c','#be9b56'];
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function ease(v){v=clamp(v,0,1);return 1-Math.pow(1-v,3);}
 function fires(c,index){var q=c[1]%16;if(index===0)return q%2===0;if(index===1)return q%4===0||!!c[2]&&q%4===2;return q%4===0||q%4===2||c[2]===2&&q===15;}
 function nextCue(run){
  var s=run.sim,rows=run.chart.tracks.boss.pulses,t=s.musicTick,lo=0,hi=rows.length;
  while(lo<hi){var m=(lo+hi)>>1;if(rows[m][0]<=t)lo=m+1;else hi=m;}
  for(var i=lo;i<rows.length&&rows[i][0]-t<=24;i++)if(rows[i][0]>=390&&rows[i][0]<=12960&&fires(rows[i],s.index))return rows[i];
  return null;
 }
 function nextCast(run){var c=nextCue(run);return c?c[0]-run.sim.musicTick:null;}
 function boss(run,phase,victoryTicks){
  var s=run.sim,t=run.time,intro=run.selection==='boss'&&t<390,change=!intro&&run.wait>0;
  var age=s.presentationCast===undefined?999:s.tick-s.presentationCast,next=nextCast(run),pre=next!==null?(24-next)/24:0;
  if(change||intro&&t<366)pre=0;
  var release=age>=0&&age<28?1-age/28:0,cast=Math.max(pre,release),moving=age>28&&Math.abs(Math.cos(s.musicTick*.005))>.45;
  var x=s.boss.x/64,y=s.boss.y/64,pose=cast>0?(s.index===2?3:2):moving?1:0,alpha=1;
  if(intro){var enter=ease(t/104);x=240+(1-enter)*88+(engine.bossX(Math.max(1,t))/64-240)*ease((t-286)/104);y=88-(1-enter)*208;pose=t<92?1:pose;}
  if(run.selection==='boss'&&t===390&&s.tick===0)x=engine.bossX(390)/64;
  if(change)pose=(120-run.wait)<82?3:s.index===2?3:2;
  if(phase==='victory'||phase==='epilogue'||phase==='complete'){
   var v=phase==='victory'?victoryTicks:75,u=clamp((v-20)/55,0,1),p=u*u*(3-2*u);x+=p*64;y-=p*145;alpha=1-p;pose=v<25?3:1;cast=0;
  }
  var cue=nextCue(run),bell=cue&&s.index===2&&cue[1]%4!==3?(Math.floor(cue[1]/4)+Math.floor(cue[1]/16))%3:-1;
  return{x:x,y:y,pose:pose,alpha:alpha,cast:cast,anticipation:pre,release:release,age:age,nextCastIn:next,sourceBell:bell,intro:intro,introTick:t,transition:change,transitionTick:change?120-run.wait:0,index:s.index,title:names[s.index],color:colors[s.index]};
 }
 function mob(s,m){
  var age=s.tick-(m.cast===undefined?-999:m.cast),pre=m.warningUntil>s.tick,pose=pre?3:age>=0&&age<14?2:age<31?3:Math.abs(m.x-m.px)>12?1:0;
  return{pose:pose,anticipation:pre?(30-(m.warningUntil-s.tick))/30:0,release:age>=0&&age<18?1-age/18:0};
 }
 return{boss:boss,mob:mob,nextCast:nextCast,fires:fires,names:names,colors:colors,clamp:clamp,ease:ease};
}));
