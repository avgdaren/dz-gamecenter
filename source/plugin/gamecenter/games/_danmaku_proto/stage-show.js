/* (C) 2026 Carinoasd. One-stage entrances, breaks and ending: 小典 / Codex.
 * Presentation state only. Never changes simulation, timing, input or replay.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.DanmakuStageShow=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var phases=['星环 · 周天轨迹','星雨 · 引光连祷','星幕 · 穹顶终章'];
  function clamp(v){return Math.max(0,Math.min(1,v));}
  function ease(v){v=clamp(v);return v*v*(3-2*v);}
  function create(){return{breakOrigin:null,breakTick:-1,endingAge:0,terminal:null};}
  function observe(state,battle,previous){
    if(!battle)return;
    if(previous&&previous.stage==='active'&&battle.stage==='transition'){
      state.breakOrigin=[previous.x/64,previous.y/64];state.breakTick=battle.tick;
    }
    if(battle.stage==='over'&&!state.terminal){
      state.terminal={status:battle.status,origin:[battle.sim.boss.x/64,battle.sim.boss.y/64]};state.endingAge=0;
    }
  }
  function ending(state,milliseconds,foreground,reduced){
    if(!state.terminal||!foreground)return;
    state.endingAge=reduced?180:Math.min(180,state.endingAge+Math.max(0,Math.min(50,milliseconds))*60/1000);
  }
  function model(state,battle,reduced){
    var m={kind:'none',phase:0,title:'',progress:0,opacity:0,bossAlpha:1,origin:null,burst:null,endingAge:state.endingAge};
    if(!battle)return m;
    m.phase=Math.max(0,battle.phaseIndex);m.title=phases[m.phase];
    if(battle.stage==='prelude')return m;
    if(battle.stage==='opening'){
      var intro=battle.rules.clock.introTicks,age=intro-battle.remaining;
      m.kind='intro';m.progress=clamp(age/intro);
      m.opacity=reduced?1:ease(age/18)*ease((battle.remaining-4)/28);
      m.bossAlpha=reduced?1:ease((age-10)/42);
    }else if(battle.stage==='transition'){
      var duration=battle.rules.clock.transitionTicks,t=duration-battle.remaining;
      // Stage01 creates the next sim at the break; legacy Battle creates it at
      // the end. Use the already-earned phase count for the same display cue.
      m.phase=Math.min(2,battle.phaseBreaks);m.title=phases[m.phase];m.kind='phase';
      m.progress=clamp(t/duration);m.opacity=reduced?1:ease(t/14)*ease((battle.remaining-3)/22);
      m.bossAlpha=reduced?1:ease((t-25)/45);
      var from=state.breakOrigin||[240,88],p=ease(t/Math.max(1,duration-8));
      m.origin=[from[0]+(240-from[0])*p,from[1]+(88-from[1])*p];
      if(!reduced&&t<65)m.burst={origin:from,progress:t/65,clear:false};
    }else if(battle.stage==='over'&&battle.status==='clear'){
      m.kind='clear';m.title='星穹已明';m.bossAlpha=reduced?0:1-ease(state.endingAge/48);
      if(!reduced&&state.endingAge<100)m.burst={origin:state.terminal?state.terminal.origin:[240,88],progress:state.endingAge/100,clear:true};
    }
    return m;
  }
  function effects(ctx,m,reduced){
    if(reduced||!m.burst)return false;
    var b=m.burst,p=clamp(b.progress),x=b.origin[0],y=b.origin[1],r=22+50*ease(p);
    ctx.save();ctx.beginPath();ctx.rect(0,12,480,180);ctx.clip();ctx.globalAlpha=(1-p)*.65;
    ctx.strokeStyle=b.clear?'#f5dfad':'#aabddd';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
    for(var i=0;i<12;i++){
      var a=i*Math.PI/6+.3,dist=12+58*ease(p),xx=x+Math.cos(a)*dist,yy=y+Math.sin(a)*dist;
      var size=(i%3===0?3:1.5)*(1-p*.6);
      ctx.beginPath();ctx.moveTo(xx-size,yy);ctx.lineTo(xx+size,yy);ctx.moveTo(xx,yy-size);ctx.lineTo(xx,yy+size);ctx.stroke();
    }
    ctx.restore();return true;
  }
  return{phases:phases,create:create,observe:observe,ending:ending,model:model,effects:effects};
}));
