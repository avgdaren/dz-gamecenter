/* (C) 2026 Carinoasd. Stage design geometry only: 小典 / Codex.
 * Continuous-time review model; no collisions, HP, kills, rewards or game rules.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DanmakuStage01Design = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var clamp = function (v, min, max) { return Math.max(min, Math.min(max, v)); };
  function cubic(a, b, c, d, u) { var v = 1 - u; return v*v*v*a + 3*v*v*u*b + 3*v*u*u*c + u*u*u*d; }
  function create(data) {
    var mobs = [];
    data.formations.forEach(function (group) {
      for (var i=0;i<group.count;i++) mobs.push({id:group.id+'-'+(i+1),type:'fairy',start:group.start+i*group.spacing,side:group.side,reward:i===group.rewardIndex});
    });
    data.attendants.forEach(function (mob) { mobs.push(Object.assign({type:'attendant'},mob)); });
    data.guardians.forEach(function (mob) { mobs.push(Object.assign({type:'guardian'},mob)); });
    mobs.sort(function (a,b) { return a.start-b.start || a.id.localeCompare(b.id); });
    function position(mob, age) {
      var type=data.types[mob.type], a=clamp(age,0,type.lifeSeconds),x,y;
      if (mob.type==='fairy') {
        var u=a/type.lifeSeconds;
        x=cubic(-24,80,400,504,u);y=cubic(56,220,220,56,u);
        if(mob.side==='right')x=480-x;
      } else if(mob.type==='attendant') {
        x=mob.x;
        y=a<1?-32+152*a:a<4.2?120:120-160*(a-4.2)/1.8;
      } else {
        x=mob.x+(a<1.6||a>=10.4?0:40*Math.sin((a-1.6)*Math.PI/4.4));
        y=a<1.6?-48+180*a/1.6:a<10.4?132:132-180*(a-10.4)/1.6;
      }
      return {x:x,y:y};
    }
    var emissions=[];
    mobs.forEach(function(mob) {
      var type=data.types[mob.type];
      type.fireAt.forEach(function(age,index) {
        var origin=position(mob,age),aimed=mob.type==='attendant'||(mob.type==='guardian'&&index%2===0);
        var captureAge=mob.type==='attendant'?type.captureAt:age-type.warningSeconds;
        var capture=position(mob,captureAge),p=data.field.playerReference;
        var angle=aimed?Math.atan2(p[1]-capture.y,p[0]-capture.x):Math.PI/2;
        var offsets=mob.type==='guardian'?(aimed?type.aimOffsetsDegrees:type.fanOffsetsDegrees):type.offsetsDegrees;
        var warningStart=mob.type==='attendant'?type.captureAt:age-type.warningSeconds;
        emissions.push({id:mob.id+'@'+index,mob:mob,type:mob.type,start:mob.start+age,age:age,
          origin:origin,angle:angle,aimed:aimed,warningStart:mob.start+warningStart,
          capture:capture,offsets:offsets,speed:type.bulletSpeedPerSecond,ttl:type.bulletTtlSeconds});
      });
    });
    emissions.sort(function(a,b){return a.start-b.start||a.id.localeCompare(b.id);});
    function segment(t) {
      return data.segments.find(function(s){return t>=s.start&&t<s.end;}) ||
        {id:'boss-active',start:75,end:75,name:'Boss战开始',cue:'进入现有三阶段Boss规则'};
    }
    function sample(t) {
      t=clamp(t,0,data.timing.bossActiveSeconds);
      var active=mobs.filter(function(m){return t>=m.start&&t<m.start+data.types[m.type].lifeSeconds;})
        .map(function(m){return Object.assign({},m,position(m,t-m.start));});
      var bullets=[],warnings=[];
      emissions.forEach(function(event){
        if(t>=event.warningStart&&t<event.start)warnings.push(event);
        var age=t-event.start;if(age<0||age>=event.ttl)return;
        event.offsets.forEach(function(offset,index){
          var angle=event.angle+offset*Math.PI/180;
          var x=event.origin.x+Math.cos(angle)*event.speed*age,y=event.origin.y+Math.sin(angle)*event.speed*age;
          if(x>=-32&&x<=512&&y>=-32&&y<=672)bullets.push({id:event.id+'#'+index,x:x,y:y,type:event.type});
        });
      });
      return {time:t,segment:segment(t),mobs:active,bullets:bullets,warnings:warnings};
    }
    function path(mob) { var result=[],life=data.types[mob.type].lifeSeconds;for(var i=0;i<=40;i++)result.push(position(mob,life*i/40));return result; }
    return {data:data,mobs:mobs,emissions:emissions,position:position,sample:sample,path:path};
  }
  return {create:create};
}));
