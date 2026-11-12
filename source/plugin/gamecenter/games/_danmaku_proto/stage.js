/* (C) 2026 Carinoasd. One-stage growth simulation: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./engine.js'),require('./battle.js'));
  else root.DanmakuStage01=factory(root.DanmakuP0,root.DanmakuBattle);
}(typeof globalThis!=='undefined'?globalThis:this,function(engine,battle){
  'use strict';
  var RULE='danmaku-stage01-r1',BOMB_RULE='danmaku-stage01-r2',PATTERN_RULE='danmaku-stage01-r3',Q=64;
  var SUPPORTED=[RULE,BOMB_RULE,PATTERN_RULE];
  function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
  function level(power,rules){var thresholds=rules.stage01.growth.thresholds;return power>=thresholds[2]?3:power>=thresholds[1]?2:1;}
  function position(rules,mob,age){
    var spec=rules.stage01.types[mob.type],v=rules.stage01.paths[mob.type][clamp(age,0,spec.life)];
    return mob.type===0?{x:mob.mirror?480*Q-v[0]:v[0],y:v[1]}:{x:mob.baseX+v[0],y:v[1]};
  }
  function touches(a,b,radius){
    var x0=a.px-b.px,y0=a.py-b.py,x1=a.x-b.x,y1=a.y-b.y;
    if((x0>radius&&x1>radius)||(x0< -radius&&x1< -radius)||(y0>radius&&y1>radius)||(y0< -radius&&y1< -radius))return false;
    return engine.sweptHit(x0,y0,x1,y1,radius);
  }
  function Sim(rules,index,assist,rule){
    if(rule===undefined)rule=RULE;
    if(SUPPORTED.indexOf(rule)<0)throw new Error('未知的关卡规则版本');
    battle.Phase.call(this,rules,Math.max(0,index),assist,true,rule===PATTERN_RULE);
    this.index=index;this.rule=rule;this.bombMode=rule!==RULE;this.scene=index<0?'corridor':index===1?'aim':'flower';
    this.hp=index<0?0:rules.boss.phaseHP[index];
    this.player.power=0;this.mobs=[];this.drops=[];this.cursor=0;this.nextDrop=1;
    this.lastUpgrade=-999;this.lastDowngrade=-999;
    Object.assign(this.stats,{mobDamage:0,mobKills:0,mobScore:0,powerCollected:0,powerRecovered:0,powerLost:0,
      powerOverflow:0,overflowScoreUnits:0,mobSpawned:0,mobPeak:0,dropSpawned:0,dropPeak:0,upgrades:0});
    if(this.bombMode){
      var config=rules.stage01.bomb;
      this.player.bombs=assist?config.assistStart:config.standardStart;
      this.bombActiveUntil=0;this.bombCooldownUntil=0;this.bombX=this.player.x;this.bombY=this.player.y;
      this.lastBombPickup=-999;this.lastBombOverflow=-999;
      Object.assign(this.stats,{bombDamage:0,bombKills:0,bombCleared:0,bombCollected:0,bombOverflowTokens:0,bombItemsSpawned:0});
    }
  }
  Sim.prototype=Object.create(battle.Phase.prototype);Sim.prototype.constructor=Sim;
  Sim.prototype.spawn=function(x,y,angle,speed,radius,ttl,kind){
    var r=this.rules,v=r.directionVectors[(angle%512+512)%512];
    if(this.assist)speed=Math.trunc(speed*r.assist.enemySpeedNumerator/r.assist.enemySpeedDenominator);
    // +0 normalizes JS -0 so snapshots agree with PHP integer zero.
    this.enemies.push({id:this.nextEnemy++,x:x,y:y,px:x,py:y,vx:Math.trunc(speed*v[0]/1024)+0,vy:Math.trunc(speed*v[1]/1024)+0,
      radius:radius,born:this.tick,grazed:false,ttl:ttl===undefined?480:ttl,kind:kind===undefined?3:kind});
    this.stats.enemySpawned++;
    if(this.enemies.length>(this.index<0?r.stage01.enemyCap:r.limits.enemyLiveCap)||this.stats.enemySpawned>r.limits.enemySpawnCap)throw new Error('敌弹超过关卡上限');
    this.stats.enemyPeak=Math.max(this.stats.enemyPeak,this.enemies.length);
  };
  Sim.prototype.capture=function(mob){
    var dx=this.player.x-mob.x,dy=this.player.y-mob.y,best=-Infinity,angle=128;
    this.rules.directionVectors.forEach(function(v,i){var dot=dx*v[0]+dy*v[1];if(dot>best){best=dot;angle=i;}});
    mob.aim=angle;
  };
  Sim.prototype.pattern=function(){
    if(this.index>=0){battle.Phase.prototype.pattern.call(this);return;}
    var t=this.tick,r=this.rules,s=r.stage01,sim=this;
    while(this.cursor<s.schedule.length&&s.schedule[this.cursor].at<=t){
      var birth=s.schedule[this.cursor++],type=s.types[birth.type];
      var mob={id:birth.id,type:birth.type,born:birth.at,baseX:birth.x,mirror:birth.mirror,reward:birth.reward,hp:type.hp,
        aim:128,warningUntil:0,warningKind:0};
      Object.assign(mob,position(r,mob,0));mob.px=mob.x;mob.py=mob.y;this.mobs.push(mob);this.stats.mobSpawned++;
    }
    this.mobs=this.mobs.filter(function(m){return t-m.born<s.types[m.type].life&&m.hp>0;});
    this.stats.mobPeak=Math.max(this.stats.mobPeak,this.mobs.length);
    if(this.mobs.length>s.mobCap)throw new Error('小怪超过关卡上限');
    this.mobs.forEach(function(m){
      var age=t-m.born,type=s.types[m.type];m.px=m.x;m.py=m.y;Object.assign(m,position(r,m,age));
      type.attacks.forEach(function(a){
        if(age===a.warning){
          if(a.capture)sim.capture(m);
          m.warningUntil=Math.max(m.warningUntil,t+a.at-a.warning);m.warningKind=a.aimed?1:2;
        }
        if(age===a.at)a.offsets.forEach(function(offset){sim.spawn(m.x,m.y,(a.aimed?m.aim:128)+offset,type.speedQ,type.bulletRadius,type.ttl,m.type);});
      });
    });
  };
  Sim.prototype.drop=function(x,y,value,recovery,kind){
    if(value<=0)return;
    var g=this.rules.stage01.growth;
    this.drops.push({id:this.nextDrop++,x:clamp(x,12*Q,468*Q),y:Math.max(0,y),px:x,py:y,born:this.tick,value:value,
      recovery:recovery,unlock:this.tick+(recovery?g.recoveryUnlockTicks:g.rewardUnlockTicks),attracted:false});
    if(this.bombMode){
      this.drops[this.drops.length-1].kind=kind===1?1:0;
      if(kind===1)this.stats.bombItemsSpawned++;
    }
    this.stats.dropSpawned++;this.stats.dropPeak=Math.max(this.stats.dropPeak,this.drops.length);
    if(this.drops.length>this.rules.stage01.dropCap)throw new Error('掉落超过关卡上限');
  };
  Sim.prototype.losePower=function(){
    var p=this.player,g=this.rules.stage01.growth,before=level(p.power,this.rules);
    if(before===1)return;
    var next=g.thresholds[before-2],lost=p.power-next;p.power=next;this.stats.powerLost+=lost;this.lastDowngrade=this.tick;
    if(p.lives>0)this.drop(p.x,p.y-48*Q,lost,true);
  };
  Sim.prototype.collect=function(item){
    if(this.bombMode&&item.kind===1){
      var config=this.rules.stage01.bomb;this.stats.bombCollected++;this.lastBombPickup=this.tick;
      if(this.player.bombs<config.stockCap)this.player.bombs++;
      else{this.stats.bombOverflowTokens++;this.lastBombOverflow=this.tick;}
      return;
    }
    var p=this.player,g=this.rules.stage01.growth,prior=level(p.power,this.rules),raw=p.power+item.value;
    var overflow=Math.max(0,raw-g.maxPower);p.power=Math.min(g.maxPower,raw);
    this.stats[item.recovery?'powerRecovered':'powerCollected']+=item.value;
    this.stats.powerOverflow+=overflow;
    if(!item.recovery)this.stats.overflowScoreUnits+=overflow;
    var after=level(p.power,this.rules);if(after>prior){this.lastUpgrade=this.tick;this.stats.upgrades+=after-prior;}
  };
  Sim.prototype.damageMob=function(m,damage,fromBomb){
    if(m.hp<=0)return;
    var applied=Math.min(m.hp,damage),type=this.rules.stage01.types[m.type];m.hp-=applied;this.stats.mobDamage+=applied;
    if(fromBomb)this.stats.bombDamage+=applied;else this.stats.shotHits++;
    if(m.hp===0){
      this.stats.mobKills++;this.stats.mobScore+=type.killScore;this.drop(m.x,m.y,m.reward,false);
      if(fromBomb)this.stats.bombKills++;
      if(this.bombMode&&m.type===this.rules.stage01.bomb.rewardType)this.drop(m.x,m.y,this.rules.stage01.bomb.rewardValue,false,1);
    }
  };
  Sim.prototype.bombDamage=function(){
    var damage=this.rules.stage01.bomb.damage,sim=this;
    if(this.index>=0){var applied=Math.min(this.hp,damage);this.hp-=applied;this.stats.damage+=applied;this.stats.bombDamage+=applied;}
    else this.mobs.forEach(function(m){
      var radius=sim.rules.stage01.types[m.type].radius*Q;
      if(m.x>=-radius&&m.x<=480*Q+radius&&m.y>=-radius&&m.y<=640*Q+radius)sim.damageMob(m,damage,true);
    });
  };
  Sim.prototype.items=function(input){
    var p=this.player,g=this.rules.stage01.growth,t=this.tick,sim=this;
    var radius=(input.flags&1?g.focusMagnetRadius:g.magnetRadius)*Q;
    this.drops=this.drops.filter(function(item){
      if(t-item.born>=g.dropTtl)return false;
      item.px=item.x;item.py=item.y;
      var dx=p.x-item.x,dy=p.y-item.y;
      if(t>=item.unlock){
        if(sim.index<0&&t>=sim.rules.stage01.gatherTick||dx*dx+dy*dy<=radius*radius)item.attracted=true;
      }
      if(item.attracted){
        var distance=Math.max(Math.abs(dx),Math.abs(dy));
        if(distance<=g.magnetStepQ){item.x=p.x;item.y=p.y;}
        else{item.x+=Math.trunc(dx*g.magnetStepQ/distance);item.y+=Math.trunc(dy*g.magnetStepQ/distance);}
      }else item.y+=t-item.born<g.hoverTicks?-24:g.fallStepQ;
      if(t>=item.unlock&&touches(item,p,g.pickupRadius*Q)){sim.collect(item);return false;}
      return item.y<=672*Q;
    });
  };
  Sim.prototype.fire=function(input){
    var r=this.rules,p=this.player,t=this.tick;
    if((t-r.playerShot.firstPhaseTick)%r.playerShot.intervalTicks!==0)return;
    var powerLevel=level(p.power,r),focused=!!(input.flags&1),lanes=r.stage01.growth.levels[powerLevel-1][focused?'focused':'normal'];
    for(var i=0;i<lanes.length;i++){
      var spec=lanes[i],x=p.x+spec.offsetX*Q,y=p.y-16*Q;
      this.shots.push({id:this.nextShot++,x:x,y:y,px:x,py:y,born:t,vx:spec.vxQ,vy:-r.playerShot.speedStepQ,damage:spec.damage,focused:focused,level:powerLevel});
    }
    if(this.shots.length>r.stage01.shotCap)throw new Error('自机子弹超过关卡上限');
  };
  Sim.prototype.step=function(input,validated){
    if(this.status!=='playing')throw new Error('终局后不能追加输入');
    if(!validated)engine.validateInput(input,this.rules);
    var t=++this.tick,r=this.rules,p=this.player,b=this.boss,sim=this,bounds=r.field.playerBounds;
    p.px=p.x;p.py=p.y;b.px=b.x;b.py=b.y;
    p.x=clamp(p.x+input.dx,bounds.minX*Q,bounds.maxX*Q);p.y=clamp(p.y+input.dy,bounds.minY*Q,bounds.maxY*Q);
    if(this.index>=0)b.x=engine.bossX(t);
    this.fire(input);this.pattern();
    this.enemies.forEach(function(e){e.px=e.x;e.py=e.y;e.x+=e.vx;e.y+=e.vy;});
    this.shots.forEach(function(s){s.px=s.x;s.py=s.y;s.x+=s.vx;s.y+=s.vy;});
    var activated=false;
    if(this.bombMode){
      var config=r.stage01.bomb;
      if((input.flags&2)&&p.bombs>0&&t>=this.bombCooldownUntil){
        p.bombs--;this.stats.bombsUsed++;this.lastBomb=t;activated=true;
        this.bombActiveUntil=t+config.clearTicks;this.bombCooldownUntil=t+config.cooldownTicks;this.bombX=p.x;this.bombY=p.y;
        p.invulUntil=Math.max(p.invulUntil,t+config.invulnerabilityTicks);
      }
      if(t<this.bombActiveUntil){this.stats.bombCleared+=this.enemies.length;this.enemies=[];}
    }else if((input.flags&2)&&p.bombs>0){
      p.bombs--;this.stats.bombsUsed++;this.lastBomb=t;this.enemies=[];
      p.invulUntil=Math.max(p.invulUntil,t+r.player.bombInvulnerabilityTicks);
    }
    var collided=new Set(),bodyHit=false;
    if(t>=p.invulUntil){
      this.enemies.forEach(function(e){if(touches(e,p,(r.player.hitRadius+e.radius)*Q))collided.add(e.id);});
      bodyHit=this.mobs.some(function(m){return touches(m,p,(r.player.hitRadius+r.stage01.types[m.type].radius)*Q);});
      if(collided.size||bodyHit){
        p.lives--;this.stats.hitsTaken++;this.lastHit=t;p.invulUntil=Math.max(p.invulUntil,t+r.player.hitInvulnerabilityTicks);
        var clear=r.player.hitClearRadius*Q;
        this.enemies=this.enemies.filter(function(e){return!collided.has(e.id)&&(e.x-p.x)**2+(e.y-p.y)**2>clear*clear;});
        this.losePower();
      }
    }
    if(p.lives<=0)this.status='dead';
    else{
      if(activated)this.bombDamage();
      this.shots=this.shots.filter(function(s){
        if(sim.index>=0){
          if(touches(s,b,(r.playerShot.radius+r.boss.hitRadius)*Q)){sim.damageBoss(s.damage);return false;}
          return true;
        }
        for(var i=0;i<sim.mobs.length;i++){
          var m=sim.mobs[i],type=r.stage01.types[m.type];
          if(m.hp<=0||!touches(s,m,(r.playerShot.radius+type.radius)*Q))continue;
          sim.damageMob(m,s.damage,false);
          return false;
        }
        return true;
      });
      this.mobs=this.mobs.filter(function(m){return m.hp>0;});
      this.items(input);
      if(this.index<0){if(t>=r.stage01.preludeTicks)this.status='prelude_clear';}
      else this.resolveEnd();
      if(this.status==='playing'&&t>=p.invulUntil)this.enemies.forEach(function(e){
        if(!e.grazed&&touches(e,p,(r.player.grazeCenterRadius+e.radius)*Q)){e.grazed=true;sim.stats.graze++;}
      });
    }
    var margin=r.field.enemyCullMargin*Q;
    function inside(e){return e.x>=-margin&&e.x<=480*Q+margin&&e.y>=-margin&&e.y<=640*Q+margin;}
    this.enemies=this.enemies.filter(function(e){return t-e.born+1<e.ttl&&inside(e);});
    this.shots=this.shots.filter(function(s){return t-s.born+1<r.playerShot.ttlTicks&&inside(s);});
    return this.status;
  };
  Sim.prototype.snapshot=function(){
    var result=engine.Sim.prototype.snapshot.call(this),s=this.stats;
    result.power=[this.player.power,level(this.player.power,this.rules)];result.powerEvents=[this.lastUpgrade,this.lastDowngrade];
    result.growth=[s.mobDamage,s.mobKills,s.mobScore,s.powerCollected,s.powerRecovered,s.powerLost,s.powerOverflow,s.overflowScoreUnits,s.mobSpawned,s.mobPeak,s.dropSpawned,s.dropPeak,s.upgrades];
    result.nextIds=[this.nextEnemy,this.nextShot,this.nextDrop,this.cursor];
    result.enemies=this.enemies.map(function(e){return[e.id,e.x,e.y,e.vx,e.vy,e.radius,e.born,e.grazed?1:0,e.ttl,e.kind];});
    result.shots=this.shots.map(function(s){return[s.id,s.x,s.y,s.born,s.vx,s.vy,s.damage,s.focused?1:0,s.level];});
    result.mobs=this.mobs.map(function(m){return[m.id,m.type,m.born,m.baseX,m.mirror?1:0,m.reward,m.x,m.y,m.hp,m.aim,m.warningUntil,m.warningKind];});
    result.drops=this.drops.map(function(d){return[d.id,d.x,d.y,d.born,d.value,d.recovery?1:0,d.unlock,d.attracted?1:0];});
    if(this.bombMode){
      result.drops.forEach(function(row,i){row.push(this.drops[i].kind);},this);
      result.bomb=[this.bombActiveUntil,this.bombCooldownUntil,this.lastBomb,this.bombX,this.bombY,
        s.bombDamage,s.bombKills,s.bombCleared,s.bombCollected,s.bombOverflowTokens,s.bombItemsSpawned,this.lastBombPickup,this.lastBombOverflow];
    }
    return result;
  };
  function Stage(rules,assist,rule){
    if(typeof assist!=='boolean')throw new Error('辅助模式参数无效');
    if(rule===undefined)rule=RULE;
    if(SUPPORTED.indexOf(rule)<0)throw new Error('未知的关卡规则版本');
    this.rule=rule;this.rules=rules;this.assist=assist;this.tick=0;this.activeTicks=0;this.phaseIndex=-1;this.phaseBreaks=0;
    this.status='playing';this.stage='prelude';this.remaining=rules.stage01.preludeTicks;this.events=[];
    this.sim=new Sim(rules,-1,assist,rule);this.stats=this.sim.stats;
  }
  Stage.prototype.replace=function(index){
    var old=this.sim,next=new Sim(this.rules,index,this.assist,this.rule);
    old.drops.forEach(function(item){old.collect(item);});old.drops=[];
    next.player=Object.assign({},old.player,{px:old.player.x,py:old.player.y,invulUntil:Math.max(0,old.player.invulUntil-old.tick)});
    next.stats=this.stats;next.nextEnemy=old.nextEnemy;next.nextShot=old.nextShot;next.nextDrop=old.nextDrop;
    if(old.bombMode){
      next.bombActiveUntil=Math.max(0,old.bombActiveUntil-old.tick);next.bombCooldownUntil=Math.max(0,old.bombCooldownUntil-old.tick);
      next.lastBomb=Math.max(-999,old.lastBomb-old.tick);next.bombX=old.bombX;next.bombY=old.bombY;
    }
    this.sim=next;this.phaseIndex=index;
  };
  Stage.prototype.step=function(input){
    if(this.status!=='playing')throw new Error('终局后不能追加输入');
    engine.validateInput(input,this.rules);
    if(this.tick>=this.rules.stage01.maxTicks)throw new Error('关卡超过逻辑上限');
    this.tick++;
    if(this.stage==='opening'||this.stage==='transition'){
      var p=this.sim.player,bounds=this.rules.field.playerBounds;p.px=p.x;p.py=p.y;
      p.x=clamp(p.x+input.dx,bounds.minX*Q,bounds.maxX*Q);p.y=clamp(p.y+input.dy,bounds.minY*Q,bounds.maxY*Q);
      p.invulUntil=Math.max(0,p.invulUntil-1);
      if(this.sim.bombMode){
        this.sim.bombActiveUntil=Math.max(0,this.sim.bombActiveUntil-1);this.sim.bombCooldownUntil=Math.max(0,this.sim.bombCooldownUntil-1);
        this.sim.lastBomb=Math.max(-999,this.sim.lastBomb-1);
      }
      if(--this.remaining===0)this.stage='active';
      return this.status;
    }
    var prelude=this.stage==='prelude';if(!prelude)this.activeTicks++;
    var result=this.sim.step(input,true);
    if(prelude)this.remaining=Math.max(0,this.rules.stage01.preludeTicks-this.sim.tick);
    if(result==='dead'||result==='timeout'){this.status=result;this.stage='over';}
    else if(result==='prelude_clear'){
      this.events.push({tick:this.tick,phase:-1,activeTicks:this.activeTicks,lives:this.sim.player.lives,bombs:this.sim.player.bombs});
      this.replace(0);this.stage='opening';this.remaining=this.rules.clock.introTicks;
    }else if(result==='phase_clear'){
      this.phaseBreaks++;this.events.push({tick:this.tick,phase:this.phaseIndex,activeTicks:this.activeTicks,lives:this.sim.player.lives,bombs:this.sim.player.bombs});
      if(this.phaseIndex===2){
        var current=this.sim;current.drops.forEach(function(item){current.collect(item);});current.drops=[];
        this.status='clear';this.stage='over';this.sim.enemies=[];this.sim.shots=[];
      }
      else{this.replace(this.phaseIndex+1);this.stage='transition';this.remaining=this.rules.clock.transitionTicks;}
    }
    return this.status;
  };
  Stage.prototype.score=function(){
    var parts=battle.Battle.prototype.score.call(this);
    parts.mobs=this.stats.mobScore;parts.overflow=this.stats.overflowScoreUnits*this.rules.stage01.growth.overflowPerUnit;
    parts.total+=parts.mobs+parts.overflow;
    if(this.sim.bombMode){parts.bombOverflow=this.stats.bombOverflowTokens*this.rules.stage01.bomb.overflowScore;parts.total+=parts.bombOverflow;}
    return parts;
  };
  Stage.prototype.snapshot=function(){
    return{rule:this.rule,tick:this.tick,activeTicks:this.activeTicks,assist:this.assist,phase:this.phaseIndex,phaseBreaks:this.phaseBreaks,
      stage:this.stage,remaining:this.remaining,status:this.status,hp:this.sim.hp,score:this.score(),events:this.events.map(function(e){return Object.assign({},e);}),sim:this.sim.snapshot()};
  };
  function segment(rules,tick){var list=rules.stage01.segments,found=list[0];for(var i=1;i<list.length;i++)if(tick>=list[i].at)found=list[i];return found.name;}
  function scoreLimit(rules,rule){return rule!==RULE?rules.stage01.bombScoreUpperBound:rules.stage01.scoreUpperBound;}
  return{Stage:Stage,Sim:Sim,rule:RULE,bombRule:BOMB_RULE,patternRule:PATTERN_RULE,supportedRules:SUPPORTED,scoreLimit:scoreLimit,level:level,position:position,segment:segment};
}));
