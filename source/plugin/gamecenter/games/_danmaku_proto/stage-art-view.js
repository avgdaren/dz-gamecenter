/* (C) 2026 Carinoasd. Generated stage art presentation: 小典 / Codex.
 * Presentation only. Reads logical ticks; never changes gameplay or replay state.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.DanmakuStageArt=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var names=['fairy','attendant','guardian'];
  var specs=[{w:48,h:48,x:24,y:24},{w:48,h:64,x:24,y:32},{w:80,h:80,x:40,y:40}];
  var assets={corridor:[480,1440],fairy:[192,144],attendant:[192,192],guardian:[320,240]};
  var files={corridor:'assets/stage01-corridor-v1.png',fairy:'assets/stage01-fairy-v1.png',attendant:'assets/stage01-attendant-v1.png',guardian:'assets/stage01-guardian-v1.png'};
  function camera(tick,reduced){
    if(reduced)return 0;
    var t=Math.max(0,Math.min(4320,tick)),d=Math.max(0,t-3720);
    var progress=t<=3720?t/4020:(3720+d-d*d/1200)/4020;
    return 800*(1-progress);
  }
  function ready(image,w,h){return !!(image&&image.complete&&image.naturalWidth===w&&image.naturalHeight===h);}
  function background(ctx,image,tick,reduced){
    if(!ready(image,480,1440))return false;
    ctx.save();ctx.imageSmoothingEnabled=true;
    ctx.drawImage(image,0,camera(tick,reduced),480,640,0,0,480,640);
    ctx.fillStyle='rgba(4,9,20,0.22)';ctx.fillRect(0,0,480,640);ctx.restore();return true;
  }
  function frame(sim,m,reduced){
    var age=Math.max(0,sim.tick-m.born),row=0,col=Math.floor(age/8)%4;
    if(m.type===0){var vx=m.x-m.px;row=vx< -24?1:vx>24?2:0;}
    else{
      var attacks=sim.rules.stage01.types[m.type].attacks,last=-999,warning=null;
      attacks.forEach(function(a){
        if(age>=a.at)last=Math.max(last,a.at);
        if(age>=a.warning&&age<a.at&&(!warning||a.at<warning.at))warning=a;
      });
      if(age-last<18){row=2;col=Math.min(3,Math.floor((age-last)*4/18));}
      else if(warning){row=1;col=Math.min(3,Math.floor((age-warning.warning)*4/Math.max(1,warning.at-warning.warning)));}
    }
    return{row:row,col:reduced?0:col};
  }
  function mob(ctx,images,sim,m,reduced){
    var spec=specs[m.type],image=images&&images[names[m.type]],expected=assets[names[m.type]];
    if(!spec||!ready(image,expected[0],expected[1]))return false;
    var f=frame(sim,m,reduced),x=m.x/64,y=m.y/64;
    ctx.save();ctx.imageSmoothingEnabled=false;
    // Fill tiny transparent skirt corners under the visible physical core.
    ctx.beginPath();ctx.arc(x,y,sim.rules.stage01.types[m.type].radius,0,Math.PI*2);
    ctx.fillStyle=m.type===1?'#3b355d':'#28345d';ctx.fill();
    ctx.drawImage(image,f.col*spec.w,f.row*spec.h,spec.w,spec.h,Math.round(x)-spec.x,Math.round(y)-spec.y,spec.w,spec.h);
    ctx.restore();return true;
  }
  function createEffects(){return{sim:null,tick:-1,prior:[],bursts:[]};}
  function effects(ctx,sim,state,reduced){
    if(state.sim!==sim){state.sim=sim;state.tick=-1;state.prior=[];state.bursts=[];}
    if(state.tick!==sim.tick){
      var alive=new Set(sim.mobs.map(function(m){return m.id;}));
      state.prior.forEach(function(m){
        if(!alive.has(m.id)&&sim.tick-m.born<sim.rules.stage01.types[m.type].life)state.bursts.push({x:m.x/64,y:m.y/64,born:sim.tick,large:m.type===2});
      });
      state.prior=sim.mobs.map(function(m){return{id:m.id,x:m.x,y:m.y,born:m.born,type:m.type};});state.tick=sim.tick;
      state.bursts=state.bursts.filter(function(b){return sim.tick-b.born<24;}).slice(-12);
    }
    if(reduced)return 0;
    ctx.save();ctx.lineWidth=1;
    state.bursts.forEach(function(b){
      var age=sim.tick-b.born,radius=5+age*(b.large?1.3:.8);ctx.globalAlpha=.65*(1-age/24);ctx.strokeStyle=b.large?'#d9c191':'#a8d2ee';
      ctx.beginPath();ctx.arc(b.x,b.y,radius,0,Math.PI*2);ctx.stroke();
      for(var i=0;i<4;i++){var a=i*Math.PI/2+.4;ctx.beginPath();ctx.moveTo(b.x+Math.cos(a)*radius,b.y+Math.sin(a)*radius);ctx.lineTo(b.x+Math.cos(a)*(radius+4),b.y+Math.sin(a)*(radius+4));ctx.stroke();}
    });
    ctx.restore();return state.bursts.length;
  }
  return{assets:assets,files:files,camera:camera,background:background,frame:frame,mob:mob,labelOffset:function(type){return specs[type].y+4;},createEffects:createEffects,effects:effects};
}));
