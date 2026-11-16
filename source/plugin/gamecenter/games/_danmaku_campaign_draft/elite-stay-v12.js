/* (C) 2026 Carinoasd. Three extra seconds for the existing large guard: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_stage02_draft/refined-easy-entry-v6.js'));else root.DanmakuEliteStay=factory(root.Stage02Refined);}(typeof globalThis!=='undefined'?globalThis:this,function(second){
 'use strict';var EXTRA=180;
 function rules(r,number){if(r.feedbackV12&&r.feedbackV12.stage===number)return r;var types=r.stage01.types.map(function(t,i){return Object.assign({},t,i===2?{life:t.life+EXTRA}:{});}),paths=r.stage01.paths;
  if(number===1){paths=paths.slice();var old=paths[2],height=Math.max.apply(null,old.map(function(v){return v[1];})),end=old.length-1;while(old[end][1]!==height)end--;
   var pause=[];for(var i=0;i<EXTRA;i++)pause.push(old[end].slice());paths[2]=old.slice(0,end+1).concat(pause,old.slice(end+1));
  }
  return Object.assign({},r,{feedbackV12:{stage:number,eliteExtraTicks:EXTRA},player:Object.assign({},r.player,{hitInvulnerabilityTicks:276}),stage01:Object.assign({},r.stage01,{types:types,paths:paths})});
 }
 function position(s,m,age){var p=second.position(s,m,age);if(m.type===2&&age>480){var at=age<=480+EXTRA?480:age-EXTRA;p.y=second.position(s,m,at).y;}return p;}
 function mobs(s){var r=s.rules.stage01,t=s.tick;
  while(s.cursor<r.schedule.length&&r.schedule[s.cursor].at<=t){var b=r.schedule[s.cursor++],m={id:b.id,type:b.type,born:b.at,baseX:b.x,mirror:b.mirror,reward:b.reward,route:b.route,lane:b.lane||0,hp:r.types[b.type].hp,aim:128,warningUntil:0,warningKind:0};Object.assign(m,position(s,m,0));m.px=m.x;m.py=m.y;s.mobs.push(m);s.stats.mobSpawned++;}
  s.mobs=s.mobs.filter(function(m){return m.hp>0&&t-m.born<(m.route==='sideArc'?240:r.types[m.type].life)&&(m.route!=='sideArc'||t-m.born<30||m.x>=-32*64&&m.x<=512*64);});s.stats.mobPeak=Math.max(s.stats.mobPeak,s.mobs.length);if(s.mobs.length>r.mobCap)throw Error('花庭齐阵超过上限');
  s.mobs.forEach(function(m){var age=t-m.born,spec=r.types[m.type];m.px=m.x;m.py=m.y;Object.assign(m,position(s,m,age));second.mobAttacks(s,m).forEach(function(a){
   if(age===a.warning){if(a.capture)s.capture(m);m.warningUntil=t+a.at-a.warning;m.warningKind=a.aimed?1:2;}
   if(age===a.at){if(m.cast===undefined)s.stats.castMobs++;m.cast=t;a.offsets.forEach(function(offset){s.spawn(m.x,m.y,(a.aimed?m.aim:128)+offset,spec.speedQ,spec.bulletRadius,spec.ttl,m.type);});}
  });});
 }
 function prepare(s,number){if(s.eliteStayPreparedV12)return;s.eliteStayPreparedV12=true;var pattern=s.pattern;s.pattern=function(){return number===2&&this.index<0?mobs(this):pattern.call(this);};}
 return{rules:rules,prepare:prepare,position:position,extraTicks:EXTRA};
}));
