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
    var m={kind:'none',phase:0,title:'',progress:0,opacity:0,bossAlpha:1,origin:null,burst:null,shake:[0,0],flash:0,endingAge:state.endingAge};
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
      m.bossAlpha=reduced?1:ease((t-55)/45);
      var from=state.breakOrigin||[240,88],p=ease(t/Math.max(1,duration-8));
      m.origin=[from[0]+(240-from[0])*p,from[1]+(88-from[1])*p];
      if(t<96)m.burst={origin:from,progress:t/96,clear:false,phase:0};
      if(!reduced&&t<24){var strength=5*(1-t/24);m.shake=[Math.round(Math.sin(t*2.4)*strength),Math.round(Math.cos(t*1.9)*strength*.65)];}
      if(!reduced&&t<10)m.flash=.2*(1-t/10);
    }else if(battle.stage==='over'&&battle.status==='clear'){
      m.kind='clear';m.title='星穹已明';m.bossAlpha=reduced?0:1-ease(state.endingAge/48);
      if(!reduced&&state.endingAge<100)m.burst={origin:state.terminal?state.terminal.origin:[240,88],progress:state.endingAge/100,clear:true};
    }
    return m;
  }
  function effects(ctx,m,reduced){
    if(!m.burst)return false;
    var b=m.burst,p=clamp(b.progress),x=b.origin[0],y=b.origin[1],r=12+144*ease(p),color=b.clear?'#f7daa0':['#84e5f1','#c2a1ff','#f4d38c'][b.phase||0];
    ctx.save();ctx.beginPath();ctx.rect(0,8,480,290);ctx.clip();ctx.globalAlpha=(1-p)*.8;
    if(!reduced){
      var glow=ctx.createRadialGradient(x,y,0,x,y,Math.max(1,r));glow.addColorStop(0,'#f7fcff');glow.addColorStop(.16,color);glow.addColorStop(1,'#13223b00');
      ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,2*r,2*r);
    }
    ctx.strokeStyle=color;ctx.lineWidth=reduced?2:3;ctx.beginPath();ctx.arc(x,y,reduced?52:r,0,Math.PI*2);ctx.stroke();
    if(!reduced){
      ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,r*.63,0,Math.PI*2);ctx.stroke();
      for(var i=0;i<28;i++){
        var a=i*Math.PI*2/28+(b.phase||0)*.25,dist=12+(60+i%4*27)*ease(p),xx=x+Math.cos(a)*dist,yy=y+Math.sin(a)*dist,size=(i%3?3:7)*(1-p*.7);
        ctx.save();ctx.translate(xx,yy);ctx.rotate(a+p);ctx.fillStyle=i%3?color:'#fff3d3';ctx.fillRect(-size,-size*.4,size*2,size*.8);ctx.restore();
      }
    }
    ctx.restore();return true;
  }
  function begin(ctx,m){ctx.save();if(m&&m.shake)ctx.translate(m.shake[0],m.shake[1]);}
  function end(ctx,m){ctx.restore();if(m&&m.flash){ctx.save();ctx.globalAlpha=m.flash;ctx.fillStyle='#e8f8ff';ctx.fillRect(0,0,480,640);ctx.restore();}}
  return{phases:phases,create:create,observe:observe,ending:ending,model:model,effects:effects,begin:begin,end:end};
}));
