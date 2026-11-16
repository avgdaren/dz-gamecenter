/* (C) 2026 Carinoasd. Local Stage 2 observer and combat practice: 小典 / Codex. */
(function(){
 'use strict';
 var data=window.Stage02DraftData,$=function(id){return document.getElementById(id);},canvas=$('field'),ctx=canvas.getContext('2d'),images={},keys=new Set();
 var ready=false,run=null,mode='paused',last=0,accumulator=0,ticket=0,selection=data.observer?'sample0':'stage',errors=[],pointer=null,focusBinding='Shift',lastRun=null,lastSignature='';
 try{focusBinding=DanmakuControls.fromStored(localStorage.getItem('danmaku.controls.v1'));}catch(e){}
 var sound=new DanmakuAudio.Manager(data.bank,{recordedMusic:true,settings:{music:true,sfx:false,musicVolume:.5}});
 function focused(){return $('focus').checked||Array.from(keys).some(function(k){return DanmakuControls.matches(k,focusBinding);});}
 function view(){var i=run?run.inspect():{};return {scene:'stage',stage:i.index<0?'prelude':'active',phase:Math.max(0,i.index||0),status:'playing',mode:mode==='running'?'running':'paused',foreground:!document.hidden,tick:run?run.time:0,preludeTicks:0,charges:[],shots:0,hits:0,taken:0,bombs:0,breaks:i.breaks||0,supply:0,level:i.power||1,power:0,elites:0,kills:0,enemy:0,graze:0};}
 function controls(){
  $('play').disabled=!ready;$('play').textContent=mode==='running'?'暂停':mode==='preparing'?'取消准备':'开始 / 继续';$('restart').disabled=!ready;
  document.querySelectorAll('[data-select]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.select===selection));});
  $('test-label').hidden=!(run&&run.usedTest);$('focus-key').textContent=DanmakuControls.label(focusBinding);
 }
 function draw(){if(!ready||!run)return;var signature=[run.time,run.index,run.status,run.wait,run.usedTest,$('reduced').checked,focused(),run.sim.testInvincible].join('|');if(lastRun===run&&lastSignature===signature)return;lastRun=run;lastSignature=signature;Stage02DraftView.draw(ctx,images,data.layout,run,$('reduced').checked,focused());var i=run.inspect();
  $('readout').textContent=(i.index<0?'道中':DanmakuStage02.names[i.index])+'  ·  音乐 '+i.time.toFixed(1)+'s  ·  弹体 '+i.enemyCount+'  ·  击破 '+i.stats.mobKills;
  $('progress').min=data.observer?String(data.chart.sampleStarts[i.index]):'0';$('progress').max=data.observer?String(data.chart.sampleStarts[i.index]+data.chart.sampleSeconds):String(data.chart.tracks[i.index<0?'stage':'boss'].seconds);$('progress').value=String(i.time);
 }
 function pause(message){ticket++;mode='paused';accumulator=0;keys.clear();pointer=null;sound.pause();controls();if(message)$('status').textContent=message;draw();}
 function reset(value){if(!ready)return;pause();selection=value;run=new DanmakuStage02.Run(data.rules,data.chart,value,$('invincible').checked);controls();sound.reset(view());$('status').textContent='就绪。点击开始后可以移动，战斗练习自动射击。';draw();}
 async function play(){
  if(!ready)return;if(mode==='running'||mode==='preparing'){pause('已暂停。');return;}if(run.status!=='playing')reset(selection);
  var mine=++ticket;mode='preparing';controls();$('status').textContent='准备音乐……';
  try{if($('music').checked){var ok=await sound.gesture();if(mine!==ticket)return;if(!ok)throw Error('音乐未能启动，可关闭BGM继续。');}
   if(mine!==ticket)return;mode='running';last=performance.now();accumulator=0;sound.reset(view());sound.update(view());controls();$('status').textContent='运行中；Esc 暂停，X 或空格使用大招。';canvas.focus({preventScroll:true});
  }catch(e){pause(e.message);}
 }
 function input(){
  var slow=focused(),p=data.rules.player,dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  var speed=dx&&dy?(slow?p.slowDiagonalStepQ:p.normalDiagonalStepQ):(slow?p.slowStepQ:p.normalStepQ);
  if(pointer){var x=pointer.x*64-run.sim.player.x,y=pointer.y*64-run.sim.player.y,d=Math.hypot(x,y),limit=slow?p.slowStepQ:p.normalStepQ;if(d){dx=Math.trunc(x*Math.min(1,limit/d));dy=Math.trunc(y*Math.min(1,limit/d));speed=1;}}
  return {dx:dx*speed,dy:dy*speed,flags:(slow?1:0)|(keys.has('BombEdge')?2:0)};
 }
 function step(value){run.setTest($('invincible').checked||data.observer);run.step(value);keys.delete('BombEdge');if(run.status!=='playing')pause({sample_end:'本段观察结束，可重播或切换样片。',stage_clear:'道中战斗初稿结束。Boss可从右侧单独进入。',boss_clear:'铃羽三个阶段已击破。',dead:'本轮生命用尽，可重试。',timeout:'当前阶段达到时间上限，可重试。',music_end:'本段音乐结束，可重试。'}[run.status]||'本段结束。');}
 function frame(now){
  if(mode==='running'){
   accumulator+=Math.max(0,now-last);var count=0;
   try{while(accumulator>=1000/60&&count<5&&mode==='running'){step(input());accumulator-=1000/60;count++;}if(accumulator>150&&mode==='running')pause('运行暂时跟不上，已暂停。');}
   catch(e){errors.push(e.message);pause('运行停止：'+e.message);}
  }
  last=now;if(ready){draw();sound.update(view());}requestAnimationFrame(frame);
 }
 $('play').addEventListener('click',play);$('restart').addEventListener('click',function(){reset(selection);});
 document.querySelectorAll('[data-select]').forEach(function(b){b.addEventListener('click',function(){reset(this.dataset.select);});});
 $('invincible').addEventListener('change',function(){if(run)run.setTest(this.checked||data.observer);controls();draw();});$('reduced').addEventListener('change',draw);$('focus').addEventListener('change',draw);
 $('music').addEventListener('change',function(){sound.configure({music:this.checked});if(this.checked&&(mode==='running'||mode==='preparing'))pause('点击开始启用音乐。');});
 $('volume').addEventListener('input',function(){sound.configure({musicVolume:Number(this.value)});});
 $('bomb').addEventListener('click',function(){if(mode==='running'){keys.add('BombEdge');canvas.focus({preventScroll:true});}});
 function seek(seconds){
  if(!data.observer)return;pause();var index=Number(selection.slice(-1)),start=data.chart.sampleStarts[index],offset=Math.max(start,Math.min(start+data.chart.sampleSeconds,Number(seconds)||start));
  run=new DanmakuStage02.Run(data.rules,data.chart,selection,true);for(var n=0;n<Math.round((offset-start)*60)&&run.status==='playing';n++)run.step({dx:0,dy:0,flags:1});sound.reset(view());controls();draw();
 }
 $('progress').addEventListener('input',function(){seek(this.value);});
 document.addEventListener('keydown',function(e){if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input,button'))return;if(e.code==='Escape'){pause('已暂停。');return;}
  if(!DanmakuControls.matches(e.code,focusBinding)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','KeyX','Space'].indexOf(e.code)<0)return;e.preventDefault();if(mode!=='running')return;keys.add(e.code);if(!e.repeat&&(e.code==='KeyX'||e.code==='Space'))keys.add('BombEdge');});
 document.addEventListener('keyup',function(e){keys.delete(e.code);});window.addEventListener('blur',function(){if(mode!=='paused')pause('离开页面，已暂停。');});document.addEventListener('visibilitychange',function(){if(document.hidden&&mode!=='paused')pause('离开页面，已暂停。');});
 canvas.addEventListener('pointerdown',function(e){if(mode!=='running')return;canvas.setPointerCapture(e.pointerId);var r=canvas.getBoundingClientRect();pointer={x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*640/r.height};e.preventDefault();});
 canvas.addEventListener('pointermove',function(e){if(!pointer)return;var r=canvas.getBoundingClientRect();pointer={x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*640/r.height};});canvas.addEventListener('pointerup',function(){pointer=null;});canvas.addEventListener('pointercancel',function(){pointer=null;});
 window.Stage02Draft={inspect:function(){return {ready:ready,mode:mode,observer:data.observer,run:run?run.inspect():null,audio:sound.inspect(),errors:errors.slice()};},select:reset,seek:seek,
  advanceForReview:function(frames){pause();if(frames<0||frames>1800)throw Error('只允许局部检查片段');for(var i=0;i<frames&&run.status==='playing';i++)step({dx:0,dy:0,flags:1});draw();return this.inspect();},snapshot:function(){return run.sim.snapshot();}};
 ['invincible','focus','reduced','music'].forEach(function(id){$(id).addEventListener('change',function(){if(mode==='running')canvas.focus({preventScroll:true});});});
 $('progress').disabled=!data.observer;$('invincible').checked=data.observer;$('invincible').disabled=data.observer;
 Promise.all(Object.keys(data.assets).map(function(key){return new Promise(function(resolve,reject){var im=new Image();im.onload=function(){images[key]=im;resolve();};im.onerror=function(){reject(Error('素材载入失败：'+key));};im.src=data.assets[key];});})).then(function(){
  rootInit();ready=true;$('loading').hidden=true;reset(selection);requestAnimationFrame(frame);
 }).catch(function(e){errors.push(e.message);$('status').textContent=e.message;});
 function rootInit(){window.Stage02DraftImages=images;Stage02DraftView.init(images);}
}());
