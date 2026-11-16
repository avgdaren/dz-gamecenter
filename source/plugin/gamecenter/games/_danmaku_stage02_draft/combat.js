/* (C) 2026 Carinoasd. Offline Stage 2 draft adapter and choreography: 小典 / Codex.
 * No ranked submission or PHP rule registration. Reuses approved player physics.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/stage.js'),require('../_danmaku_proto/engine.js'),require('../_danmaku_proto/hard-choreography.js'));
  else root.DanmakuStage02=factory(root.DanmakuStage01,root.DanmakuP0,root.DanmakuChoreography);
}(typeof globalThis!=='undefined'?globalThis:this,function(stage,engine,choreo){
  'use strict';
  var Q=64,RULE='danmaku-stage02-draft-r1',names=['风廊','花瓣舒展','铃声回响'];
  function pulse(rows,t){var lo=0,hi=rows.length-1;while(lo<=hi){var m=(lo+hi)>>1;if(rows[m][0]===t)return rows[m];if(rows[m][0]<t)lo=m+1;else hi=m-1;}return null;}
  function configure(base,chart){
    var r=Object.assign({},base);
    r.stage01=Object.assign({},base.stage01,{preludeTicks:chart.tracks.stage.ticks,gatherTick:12000,schedule:[],mobCap:14,enemyCap:300,
      types:[{name:'风庭精灵',hp:40,radius:9,life:420,killScore:120,attacks:[]},{name:'司铃风侍',hp:130,radius:12,life:540,killScore:260,attacks:[]},{name:'花铃守卫',hp:600,radius:23,life:780,killScore:1200,attacks:[]}]});
    r.collect08=Object.assign({},base.collect08,{extraPowerIds:[],dropCap:64});
    r.limits=Object.assign({},base.limits,{enemySpawnCap:30000,enemyLiveCap:360});
    r.boss=Object.assign({},base.boss,{phaseHP:[4800,5600,6400]});
    return r;
  }
  function Sim(base,chart,index,options){
    options=options||{};stage.Sim.call(this,configure(base,chart),index,false,stage.cornerRule);
    this.rule=RULE;this.chart=chart;this.observer=!!options.observer;this.choreographyMode=true;this.musicTick=options.musicTick||0;
    this.testInvincible=!!options.invincible;this.shooting=options.shooting!==false;this.wave=0;this.lastCast=-999;this.windGate=240;
    this.hpMax=this.rules.boss.phaseHP[Math.max(0,index)];this.player.power=options.power===undefined?(index<0?0:16):options.power;
    this.maxEnemies=0;
  }
  Sim.prototype=Object.create(stage.Sim.prototype);Sim.prototype.constructor=Sim;
  Sim.prototype.fire=function(input){if(this.shooting)stage.Sim.prototype.fire.call(this,input);};
  Sim.prototype.damageMob=function(m,damage,fromBomb){if(m.hp>0)m.hitTick=this.tick;stage.Sim.prototype.damageMob.call(this,m,damage,fromBomb);};
  Sim.prototype.damageBoss=function(damage){if(this.hp>0)this.hitTick=this.tick;stage.Sim.prototype.damageBoss.call(this,damage);};
  Sim.prototype.step=function(input){engine.validateInput(input,this.rules);if(this.status!=='playing')throw Error('终局后不能追加输入');this.musicTick++;return stage.Sim.prototype.step.call(this,input,true);};
  Sim.prototype.resolveEnd=function(){if(this.observer)return;if(this.hp<=0)this.status='phase_clear';else if(this.tick>=4200)this.status='timeout';};
  function emit(s,x,y,a,speed,radius,ttl,kind,o){return choreo.emit(s,Math.round(x),Math.round(y),Math.round(a),speed,radius,ttl,kind,o);}
  function bossPattern(s){
    var c=pulse(s.chart.tracks.boss.pulses,s.musicTick);if(!c)return;
    var n=c[1],q=n%16,group=Math.floor(n/16),strong=c[2],x=s.boss.x,y=s.boss.y,i,j,a;
    if(s.musicTick<390||s.musicTick>12960)return;
    s.lastCast=s.tick;
    if(s.index===0){
      // Repeated diagonal ribbons, with the near corridor shifting between phrases.
      var sweep=[92,104,116,128,140,152,164,152][Math.floor(n/2)%8];
      s.windGate=[128,192,288,352,288,192][group%6];
      if(q<12&&q%2===0){
        [-1,1].forEach(function(side){for(i=-2;i<=2;i++){
          var angle=side<0?sweep+i*6:256-sweep+i*6;
          emit(s,x+side*48*Q,y+12*Q,angle,144+(i+2)*5,3,330,side<0?22:23,{turn:side*40,changeAge:110,mode:1,nextSpeed:160,nextTurn:-side*24});
        }});
      }
      if(q===12||q===14)for(i=0;i<17;i++){
        a=48+i*10;var opening=choreo.direction(s,x,y,s.windGate*Q,560*Q),d=(a-opening+768)%512-256;
        if(Math.abs(d)>20)emit(s,x,y,a,144,4,330,q===12?20:21,{turn:group%2?20:-20});
      }
    }else if(s.index===1){
      // Five separate petal lobes: speed undulates around each lobe, not a plain ring.
      if(q%4===0){
        var rotation=(group*23+(q===8?18:0))%102,gap=128+(group%3-1)*16;
        for(i=0;i<40;i++){
          a=i*512/40+rotation;var delta=(Math.round(a)-gap+768)%512-256;
          if(Math.abs(delta)<23)continue;
          var speed=[120,138,170,196,210,196,170,138][i%8];
          emit(s,x,y,a,speed,3,360,q%8?23:22,{turn:group%2?48:-48,changeAge:105,mode:1,nextSpeed:156,nextTurn:group%2?-24:24});
        }
      }
      if(strong&&q%4===2)for(i=-3;i<=3;i++){
        emit(s,x,y,128+i*13+(group%2?8:-8),152,4,320,21,{turn:group%2?-36:36});
      }
    }else{
      // Three bell locations share a call, then a delayed quieter answer.
      var bell=(Math.floor(n/4)+group)%3,sourceX=[112,240,368][bell]*Q,sourceY=(104+(bell===1?0:20))*Q;
      if(q%4===0||q%4===2){
        var echo=q%4===2;
        for(i=-7;i<=7;i++){
          if(Math.abs(i)<=1)continue;
          a=128+i*9+(group%2?10:-10);
          emit(s,sourceX,sourceY,a,echo?144:184,echo?3:4,340,echo?23:20,{turn:(bell-1)*(echo?-28:28),changeAge:96,mode:1,nextSpeed:160,nextTurn:0});
        }
      }
      if(strong===2&&q===15)for(j=-1;j<=1;j+=2)for(i=0;i<6;i++)emit(s,(240+j*136)*Q,72*Q,128+j*(24+i*7),148,3,300,21,{turn:-j*24});
    }
  }
  function spawnMob(s,type,x,mirror,reward){
    var id=++s.wave,m={id:id,type:type,born:s.tick,baseX:x*Q,mirror:mirror,reward:reward,hp:s.rules.stage01.types[type].hp,
      aim:128,warningUntil:0,warningKind:0,x:x*Q,y:-32*Q,px:x*Q,py:-32*Q};
    s.mobs.push(m);s.stats.mobSpawned++;s.stats.mobPeak=Math.max(s.stats.mobPeak,s.mobs.length);
  }
  function mobPosition(s,m,age){
    var side=m.mirror?-1:1,x=m.baseX/Q,y;
    if(m.type===0){x+=side*Math.min(160,age*.68);y=-32+age*1.38;}
    else if(m.type===1){x+=Math.sin(Math.min(age,360)*Math.PI/180)*36;y=age<100?-40+age*1.8:age<360?140:140+(age-360)*2.6;}
    else{x+=Math.sin(age*Math.PI/240)*30;y=age<150?-60+age*1.3:age<600?135:135+(age-600)*2;}
    m.x=Math.round(x*Q);m.y=Math.round(y*Q);
  }
  function mobFire(s,m,age){
    var due=m.type===0?[100,172]:m.type===1?[130,208,286]:[170,260,350,440,530];
    if(due.some(function(t){return age===t-30;})){s.capture(m);m.warningUntil=s.tick+30;m.warningKind=1;}
    if(due.indexOf(age)<0)return;m.cast=s.tick;
    if(m.type===0)for(var i=-1;i<=1;i++)emit(s,m.x,m.y,m.aim+i*13,148,3,300,22,{turn:m.mirror?-14:14});
    else if(m.type===1)for(var k=-3;k<=3;k++)emit(s,m.x,m.y,128+k*17+(m.mirror?8:-8),150+Math.abs(k)*5,3,330,23,{turn:m.mirror?-32:32});
    else for(var j=0;j<24;j++){
      var a=j*512/24+(Math.floor(age/90)%2?8:0),d=(Math.round(a)-128+768)%512-256;
      if(Math.abs(d)>23)emit(s,m.x,m.y,a,[132,156,180,156][j%4],4,330,j%2?21:20,{turn:age%180?24:-24});
    }
  }
  function stagePattern(s){
    var c=pulse(s.chart.tracks.stage.pulses,s.musicTick),sec=s.musicTick/60;
    if(c&&sec>=4&&sec<200){
      var n=c[1],quiet=sec>=80&&sec<88||sec>=116&&sec<128||sec>=152&&sec<164;
      if(!quiet&&n%4===0&&s.mobs.length<10){
        var type=sec>=128&&n%16===0?2:sec>=40&&n%8===0?1:0;
        var side=Math.floor(n/4)%2===0;
        spawnMob(s,type,type===2?240:side?80:400,!side,type===2?3:s.wave%4===0?2:0);
        if(sec>=164&&type===0&&s.mobs.length<10)spawnMob(s,0,side?120:360,side,1);
      }
    }
    s.mobs=s.mobs.filter(function(m){return m.hp>0&&s.tick-m.born<s.rules.stage01.types[m.type].life;});
    s.mobs.forEach(function(m){var age=s.tick-m.born;m.px=m.x;m.py=m.y;mobPosition(s,m,age);mobFire(s,m,age);});
    if(s.mobs.length>14)throw Error('第二关小怪超过上限');
  }
  Sim.prototype.pattern=function(){
    if(this.index<0)stagePattern(this);
    else{this.boss.x=engine.bossX(this.musicTick);this.boss.y=88*Q;bossPattern(this);}
  };
  Sim.prototype.snapshot=function(){var out=stage.Sim.prototype.snapshot.call(this);out.rule=RULE;out.musicTick=this.musicTick;out.wave=this.wave;return out;};
  function Run(base,chart,selection,invincible){
    if(['stage','boss','sample0','sample1','sample2'].indexOf(selection)<0)throw Error('未知的第二关练习段落');
    this.base=base;this.chart=chart;this.selection=selection;this.observer=selection.indexOf('sample')===0;
    this.index=selection==='stage'?-1:this.observer?Number(selection.slice(-1)):0;
    this.time=this.observer?Math.round(chart.sampleStarts[this.index]*60):0;this.startTime=this.time;
    this.mode='active';this.wait=selection==='boss'?390:0;this.status='playing';this.breaks=0;this.usedTest=!!invincible||this.observer;
    this.sim=new Sim(base,chart,this.index,{observer:this.observer,shooting:!this.observer,musicTick:this.time,invincible:invincible||this.observer});
    this.events=[];
  }
  Run.prototype.setTest=function(v){this.sim.testInvincible=!!v;if(v)this.usedTest=true;};
  Run.prototype.step=function(input){
    engine.validateInput(input,this.sim.rules);if(this.status!=='playing')return this.status;
    this.time++;
    if(this.wait>0){
      var p=this.sim.player,b=this.sim.rules.field.playerBounds;p.px=p.x;p.py=p.y;p.x=Math.max(b.minX*Q,Math.min(b.maxX*Q,p.x+input.dx));p.y=Math.max(b.minY*Q,Math.min(b.maxY*Q,p.y+input.dy));p.invulUntil=Math.max(0,p.invulUntil-1);
      this.sim.musicTick=this.time;this.wait--;return this.status;
    }
    var status=this.sim.step(input);
    if(this.observer&&this.time-this.startTime>=this.chart.sampleSeconds*60)this.status='sample_end';
    else if(status==='prelude_clear'){this.sim.enemies=[];this.sim.shots=[];this.status='stage_clear';}
    else if(status==='phase_clear'){
      this.breaks++;this.events.push({time:this.time,index:this.index,type:'phase_clear'});
      if(this.index===2)this.status='boss_clear';
      else{
        var old=this.sim,next=new Sim(this.base,this.chart,++this.index,{musicTick:this.time,power:old.player.power,invincible:old.testInvincible});
        old.drops.forEach(function(d){old.collect(d);});
        next.player=Object.assign({},old.player,{invulUntil:Math.max(0,old.player.invulUntil-old.tick)});next.stats=old.stats;
        this.sim=next;this.wait=120;
      }
    }else if(status==='dead'||status==='timeout')this.status=status;
    if(this.time>=this.chart.tracks[this.index<0?'stage':'boss'].ticks&&this.status==='playing')this.status='music_end';
    return this.status;
  };
  Run.prototype.inspect=function(){return{selection:this.selection,index:this.index,time:this.time/60,wait:this.wait,status:this.status,breaks:this.breaks,usedTest:this.usedTest,ranked:false,enemyCount:this.sim.enemies.length,mobCount:this.sim.mobs.length,hp:this.sim.hp,power:stage.level(this.sim.player.power,this.sim.rules),lives:this.sim.player.lives,bombs:this.sim.player.bombs,stats:Object.assign({},this.sim.stats),events:this.events.slice()};};
  return{Sim:Sim,Run:Run,configure:configure,rule:RULE,names:names,pulse:pulse};
}));
