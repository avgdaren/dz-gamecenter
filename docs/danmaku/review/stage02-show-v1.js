/* (C) 2026 Carinoasd. Stage 2 art/music presentation: 小典 / Codex. */
(function(){
  'use strict';
  var data=window.Stage02ShowData,canvas=document.getElementById('field'),ctx=canvas.getContext('2d');
  function $(id){return document.getElementById(id);}
  var state={tab:'tour',time:0,mode:'paused',ready:false,pending:false,ticket:0,last:0,errors:[]},images={},battleTexture=null,lastDraw='';
  var audio=new DanmakuAudio.Manager(data.bank,{recordedMusic:true,settings:{music:true,sfx:false,musicVolume:.5,muted:false}});
  var reduced=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);$('reduced').checked=reduced;
  function duration(){return data.seconds[state.tab];}
  function clock(t){t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');}
  function view(){return {scene:state.tab==='tour'?'stage':'preview',stage:state.tab==='tour'?'prelude':'active',mode:state.mode,status:'playing',tick:Math.floor(state.time*60),preludeTicks:0,phase:0,foreground:!document.hidden,charges:[],taken:0,bombs:0,breaks:0,supply:0,level:0,power:0,elites:0,kills:0,shots:0,hits:0,enemy:0,graze:0};}
  function notify(text){$('status').textContent=text;}
  function controls(){
    $('play').textContent=state.pending?'取消准备':state.mode==='running'?'暂停':'播放';
    $('play').disabled=!state.ready;$('restart').disabled=!state.ready;
    $('clock').textContent=clock(state.time)+' / '+clock(duration());$('seek').max=String(duration());$('seek').value=String(state.time);
    $('track-name').textContent=state.tab==='tour'?'道中 · Majestic Bullet Storm':'Boss · Symphonic Storm';
    ['tour','boss'].forEach(function(tab){$(tab).classList.toggle('active',state.tab===tab);$(tab).setAttribute('aria-pressed',String(state.tab===tab));});
  }
  function pause(message){state.ticket++;state.pending=false;state.mode='paused';audio.pause();state.last=0;controls();if(message)notify(message);}
  async function play(){
    if(!state.ready)return;
    if(state.pending||state.mode==='running'){pause('已暂停。');return;}
    if(state.time>=duration()-.02)state.time=0;
    var ticket=++state.ticket;state.pending=true;controls();notify($('music').checked?'正在准备音乐……':'准备播放……');
    if($('music').checked){
      var success=await audio.gesture();
      if(ticket!==state.ticket)return;
      if(!success||Object.keys(audio.buffers).length!==2){state.pending=false;controls();notify('音乐未能读取，可以关闭BGM继续看演出。');return;}
    }
    if(ticket!==state.ticket)return;
    state.pending=false;state.mode='running';state.last=performance.now();audio.reset(view());audio.update(view());controls();notify('正在播放。');
  }
  function seek(time){pause();state.time=Math.max(0,Math.min(duration(),Number(time)||0));audio.reset(view());controls();draw();notify('已定位，点击播放继续。');}
  function select(tab){if(tab!=='tour'&&tab!=='boss')return;pause();state.tab=tab;state.time=0;audio.reset(view());controls();draw();notify('已切换，点击播放。');}
  function smooth(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);}
  function background(){
    var image=images.garden,sourceHeight=Math.min(image.naturalHeight,image.naturalWidth*4/3);
    var progress=state.tab==='tour'?smooth(state.time/duration()):1;
    var sy=(image.naturalHeight-sourceHeight)*(1-progress);
    ctx.drawImage(image,0,sy,image.naturalWidth,sourceHeight,0,0,480,640);
    if($('shade').checked){
      ctx.fillStyle='rgba(7,32,35,.18)';ctx.fillRect(0,0,480,640);
      var shade=ctx.createLinearGradient(0,0,480,0);shade.addColorStop(0,'rgba(6,29,33,0)');shade.addColorStop(.24,'rgba(6,29,33,.24)');shade.addColorStop(.76,'rgba(6,29,33,.24)');shade.addColorStop(1,'rgba(6,29,33,0)');ctx.fillStyle=shade;ctx.fillRect(0,0,480,640);
    }
  }
  function petals(){
    if(reduced)return;
    for(var i=0;i<18;i++){
      var t=state.time,x=(i*137.9+t*(6+i%3*2))%580-50,y=(i*97.7+t*(9+i%5))%760-60;
      ctx.save();ctx.translate(x,y);ctx.rotate(i+Math.sin(t*.7+i)*.6);ctx.globalAlpha=.16+(i%3)*.025;ctx.fillStyle=i%3?'#f4e6d5':'#efb1b7';
      ctx.beginPath();ctx.moveTo(-3,0);ctx.bezierCurveTo(-1,-3,3,-2,4,0);ctx.bezierCurveTo(2,2,-1,3,-3,0);ctx.fill();ctx.restore();
    }
  }
  function deformed(u,v,t){
    var edge=Math.max(0,(Math.abs(u-.54)-.12)/.42),hem=smooth((v-.48)/.28),face=1-smooth((v-.15)/.2);
    return {x:u*110+(reduced?0:Math.sin(t*1.8-v*5)*edge*(1-face)*1.2+Math.sin(t*1.4)*hem*.6),y:v*142+(reduced?0:Math.sin(t*1.5+u*2)*edge*hem*.8)};
  }
  function triangle(image,uv,vertices){
    var a=uv[0],b=uv[1],c=uv[2],p=vertices[0],q=vertices[1],r=vertices[2],det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    var A=((q.x-p.x)*(c[1]-a[1])-(r.x-p.x)*(b[1]-a[1]))/det,B=((q.y-p.y)*(c[1]-a[1])-(r.y-p.y)*(b[1]-a[1]))/det;
    var C=((r.x-p.x)*(b[0]-a[0])-(q.x-p.x)*(c[0]-a[0]))/det,D=((r.y-p.y)*(b[0]-a[0])-(q.y-p.y)*(c[0]-a[0]))/det;
    var cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
    ctx.save();ctx.beginPath();vertices.forEach(function(v,i){var dx=v.x-cx,dy=v.y-cy,n=Math.hypot(dx,dy)||1;ctx[i?'lineTo':'moveTo'](v.x+dx/n*.2,v.y+dy/n*.2);});ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p.x-A*a[0]-C*a[1],p.y-B*a[0]-D*a[1]);ctx.drawImage(image,0,0,1,1);ctx.restore();
  }
  function boss(){
    var t=state.time,alpha=smooth((t-3.2)/1.5),image=battleTexture;if(!alpha)return;
    ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=false;ctx.translate(185,52+(reduced?0:Math.sin(t*1.6)*1.5));
    if(reduced)ctx.drawImage(image,0,0,110,142);
    else for(var y=0;y<10;y++)for(var x=0;x<8;x++){
      var a=[x/8,y/10],b=[(x+1)/8,y/10],c=[(x+1)/8,(y+1)/10],d=[x/8,(y+1)/10];
      triangle(image,[a,b,c],[deformed(a[0],a[1],t),deformed(b[0],b[1],t),deformed(c[0],c[1],t)]);
      triangle(image,[a,c,d],[deformed(a[0],a[1],t),deformed(c[0],c[1],t),deformed(d[0],d[1],t)]);
    }
    ctx.restore();
  }
  function intro(){
    var t=state.time;if(t>6.5)return;
    var alpha=smooth(t/.6)*(1-smooth((t-4.2)/2)),slide=reduced?0:34*(1-smooth(t/1.2));
    ctx.save();ctx.globalAlpha=alpha;
    var dim=ctx.createLinearGradient(0,0,480,0);dim.addColorStop(0,'rgba(10,31,33,.12)');dim.addColorStop(1,'rgba(10,31,33,.75)');ctx.fillStyle=dim;ctx.fillRect(0,0,480,640);
    var image=images.portrait,scale=Math.min(350/image.naturalWidth,520/image.naturalHeight);ctx.drawImage(image,100+slide,56,image.naturalWidth*scale,image.naturalHeight*scale);
    ctx.fillStyle='#e9d6a4';ctx.font='15px "Microsoft YaHei",sans-serif';ctx.fillText('司风天使',28,470);ctx.fillStyle='#fff5dd';ctx.font='34px "Microsoft YaHei",sans-serif';ctx.fillText('铃 羽',26,518);ctx.fillStyle='#ced7be';ctx.fillRect(28,535,112,1);ctx.restore();
  }
  function samples(){
    if(!$('samples').checked)return;
    ctx.save();ctx.fillStyle='rgba(8,28,30,.72)';ctx.fillRect(38,242,404,150);ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillStyle='#e0e4c9';ctx.fillText('弹体尺寸与配色对照',55,266);
    for(var i=0;i<12;i++){
      var bullet={kind:20+i%6,x:(82+(i%6)*64)*64,y:(305+Math.floor(i/6)*52)*64,vx:(i%2?1:-1)*40,vy:150};DanmakuBulletMaterials.draw(ctx,images.bullets,bullet);
    }
    ctx.restore();
  }
  function draw(){
    var signature=[state.ready,state.tab,state.time,reduced,$('shade').checked,$('samples').checked].join('|');
    if(signature===lastDraw)return;lastDraw=signature;
    if(!state.ready){ctx.fillStyle='#173136';ctx.fillRect(0,0,480,640);return;}
    ctx.clearRect(0,0,480,640);background();petals();
    var p={x:240*64,px:240*64,y:550*64,py:550*64};DanmakuPlayerView.sprite(ctx,images.player,p,Math.floor((reduced?0:state.time)*60));
    if(state.tab==='boss'){boss();intro();}
    else if(state.time<5){ctx.save();ctx.globalAlpha=smooth(state.time/.8)*(1-smooth((state.time-3)/2));ctx.fillStyle='#f0e4c4';ctx.font='23px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.fillText('风 铃 花 庭',240,115);ctx.restore();}
    samples();
  }
  function frame(now){
    if(state.mode==='running'){
      var dt=state.last?(now-state.last)/1000:0;state.last=now;
      if(dt>1)pause('已暂停，点击播放继续。');
      else{state.time=Math.min(duration(),state.time+dt);audio.update(view());if(state.time>=duration())pause('本段已结束，可回到开头或切换演出。');controls();}
    }
    draw();requestAnimationFrame(frame);
  }
  $('play').addEventListener('click',play);$('restart').addEventListener('click',function(){seek(0);});$('tour').addEventListener('click',function(){select('tour');});$('boss').addEventListener('click',function(){select('boss');});
  $('seek').addEventListener('input',function(){seek(this.value);});
  $('music').addEventListener('change',async function(){
    if(state.pending)pause('已暂停。');
    audio.configure({music:this.checked});
    if(this.checked&&state.mode==='running'){pause('点击播放启用音乐。');}
  });
  $('volume').addEventListener('input',function(){audio.configure({musicVolume:Number(this.value)});});
  $('reduced').addEventListener('change',function(){reduced=this.checked;draw();});$('shade').addEventListener('change',draw);$('samples').addEventListener('change',draw);
  document.addEventListener('visibilitychange',function(){if(document.hidden)pause('离开页面，已暂停。');});window.addEventListener('blur',function(){if(state.mode==='running'||state.pending)pause('离开页面，已暂停。');});
  window.addEventListener('keydown',function(event){if(event.code==='Space'&&!['INPUT','BUTTON'].includes(document.activeElement.tagName)){event.preventDefault();play();}});
  window.Stage02Show={inspect:function(){return {ready:state.ready,tab:state.tab,time:state.time,mode:state.mode,pending:state.pending,reduced:reduced,shade:$('shade').checked,samples:$('samples').checked,images:Object.keys(images).map(function(k){return {key:k,w:images[k].naturalWidth,h:images[k].naturalHeight};}),audio:audio.inspect(),errors:state.errors.slice()};},seekForReview:function(t){seek(t);return this.inspect();},select:select};
  Promise.all(Object.keys(data.assets).map(function(key){return new Promise(function(resolve,reject){var image=new Image();image.onload=function(){images[key]=image;resolve();};image.onerror=function(){reject(Error('素材载入失败：'+key));};image.src=data.assets[key];});})).then(function(){
    if(!DanmakuBulletMaterials.ready(images.bullets))throw Error('弹体图集尺寸不符');
    battleTexture=document.createElement('canvas');battleTexture.width=110;battleTexture.height=142;
    var bodyContext=battleTexture.getContext('2d');bodyContext.imageSmoothingEnabled=false;bodyContext.drawImage(images.battle,0,0,110,142);
    $('portrait').src=data.assets.portrait;state.ready=true;$('loading').hidden=true;controls();notify('准备好了，点击播放。');draw();
  }).catch(function(e){state.errors.push(e.message);$('loading').textContent=e.message;notify('请重新打开文件。');});
  requestAnimationFrame(frame);
}());
