/* (C) 2026 Carinoasd. Complete local garden journey UI: 小典 / Codex. */
(function(){
 'use strict';
 var data=window.Stage02JourneyData,$=function(id){return document.getElementById(id);},canvas=$('field'),ctx=canvas.getContext('2d'),images={},keys=new Set();
 var flow=null,ready=false,mode='paused',ticket=0,last=0,accumulator=0,pointer=null,errors=[],focusBinding='Shift',drawSignature='',volume=.5;
 try{focusBinding=DanmakuControls.fromStored(localStorage.getItem('danmaku.controls.v1'));}catch(e){}
 var sound=new DanmakuAudio.Manager(data.bank,{recordedMusic:true,settings:{music:true,sfx:false,musicVolume:volume}});
 function active(){return flow&&['stage','boss','victory'].indexOf(flow.phase)>=0;}
 function focused(){return $('focus').checked||Array.from(keys).some(function(k){return DanmakuControls.matches(k,focusBinding);});}
 function audioView(){var a=flow.audio();return{scene:'stage',stage:a.track==='stage'?'prelude':'active',phase:Math.max(0,flow.run.index),status:'playing',mode:mode==='running'&&a.active?'running':'paused',foreground:!document.hidden,tick:Math.round(a.offset*60),preludeTicks:0,charges:[],shots:0,hits:0,taken:0,bombs:0,breaks:flow.run.breaks,supply:0,level:1,power:0,elites:0,kills:0,enemy:0,graze:0};}
 function clearInput(){keys.clear();pointer=null;}
 function phaseName(){return {title:'风铃花庭',prologue:'花庭入口',stage:'道中 · 风铃花庭',bossTalk:'与铃羽相遇',boss:'铃羽 · '+DanmakuStage02.names[flow.run.index],victory:'铃声渐远',epilogue:'旧航路的线索',complete:'第二关完成',dead:'本次挑战结束',timeout:'本次挑战结束'}[flow.phase];}
 function controls(){
  if(!ready)return;var p=flow.phase,dialogue=flow.lines(),line=dialogue[flow.line],battle=active(),paused=battle&&mode!=='running',terminal=p==='dead'||p==='timeout'||p==='complete';
  $('play').disabled=!battle;$('play').textContent=mode==='running'?'暂停':mode==='preparing'?'取消准备':'继续';$('restart').disabled=!ready;
  $('bomb').disabled=mode!=='running'||(p!=='stage'&&p!=='boss')||flow.run.wait>0;
  $('test-label').hidden=!flow.usedTest;$('section-title').textContent=phaseName();$('focus-key').textContent=DanmakuControls.label(focusBinding);
  $('overlay').hidden=battle&&!paused;
  $('start').hidden=p!=='title';$('start').disabled=mode==='preparing';$('advance').hidden=!line;$('skip').hidden=!line;
  $('resume').hidden=!paused;$('retry').hidden=!terminal;$('retry-boss').hidden=!(flow.checkpoint&&(p==='dead'||p==='timeout'));
  $('dialogue-speaker').hidden=!line;$('dialogue-counter').hidden=!line;$('speaker-picture').hidden=!(line&&line.speaker==='铃羽');
  $('overlay-title').textContent=paused?'已暂停':line?line.speaker:phaseName();
  $('dialogue-speaker').textContent=line?'风铃花庭 · '+line.speaker:'';
  $('dialogue-counter').textContent=line?(flow.line+1)+' / '+dialogue.length:'';
  $('advance').textContent=flow.line===dialogue.length-1?(p==='epilogue'?'结束本关':'继续前进'):'继续';
  if(line)$('dialogue-text').textContent=line.text;
  else if(p==='title')$('dialogue-text').textContent='穿过悬空花庭，追寻前辈留下的风路。';
  else if(paused)$('dialogue-text').textContent='画面和音乐已暂停。准备好后继续。';
  else if(p==='complete')$('dialogue-text').textContent='线索指向停用的旧航路。击破 '+flow.run.sim.stats.mobKills+' · 擦弹 '+flow.run.sim.stats.graze+' · 剩余生命 '+flow.run.sim.player.lives+'。';
  else if(terminal)$('dialogue-text').textContent=p==='dead'?'生命已用尽。可以重新开始，或从抵达铃羽时的资源重试。':'本阶段时间已结束。可以重新开始，或从抵达铃羽时的资源重试。';
  $('goal').textContent={title:'寻找前辈留下的线索',prologue:'穿过风向紊乱的花庭',stage:'穿过花庭，保留资源',bossTalk:'听清铃羽的立场',boss:'看清风向，突破风铃阵',victory:'花庭的风正在平息',epilogue:'从铃羽处获得线索',complete:'下一段旅程：旧航路',dead:'重试可恢复抵达铃羽时的资源',timeout:'重试可恢复抵达铃羽时的资源'}[p];
 }
 function draw(){
  if(!ready)return;var s=[flow.phase,flow.line,flow.run.time,flow.run.wait,flow.run.index,flow.victoryTicks,flow.usedTest,mode,$('reduced').checked,focused()].join('|');
  if(s===drawSignature)return;drawSignature=s;
  Stage02JourneyBattleView.draw(ctx,images,data.layout,flow.run,$('reduced').checked,focused());
  var i=flow.run.inspect();$('readout').textContent=(i.index<0?'道中':'铃羽战')+' '+i.time.toFixed(1)+'s · 击破 '+i.stats.mobKills+' · 擦弹 '+i.stats.graze;
  $('progress').max=String(data.chart.tracks[i.index<0?'stage':'boss'].seconds);$('progress').value=String(i.time);controls();
 }
 function pause(message){ticket++;mode='paused';accumulator=0;clearInput();sound.pause();if(message)$('status').textContent=message;drawSignature='';controls();draw();}
 async function resume(){
  if(!ready||!active())return;if(mode==='running'||mode==='preparing'){pause('已暂停。');return;}
  var mine=++ticket;mode='preparing';controls();
  try{if($('music').checked&&!await sound.gesture())throw Error('音乐未能启动，可关闭BGM继续。');if(mine!==ticket)return;mode='running';last=performance.now();accumulator=0;sound.reset(audioView());sound.update(audioView());controls();canvas.focus({preventScroll:true});$('status').textContent='方向键／WASD移动，低速集中射击，X使用大招。';draw();}
  catch(e){pause(e.message);}
 }
 async function start(){
  if(!ready||mode==='preparing')return;pause();var mine=++ticket;mode='preparing';controls();
  try{if($('music').checked&&!await sound.gesture())throw Error('音乐未能启动，可关闭BGM继续。');if(mine!==ticket)return;flow.start($('invincible').checked);mode='paused';sound.reset(audioView());$('status').textContent='点击继续或跳过本段对白。';drawSignature='';controls();draw();}
  catch(e){pause(e.message);}
 }
 function dialogue(skip){if(!ready||!flow.lines().length)return;clearInput();if(skip)flow.skip();else flow.advance();if(flow.phase==='complete')$('status').textContent='本关完成，可以从头再试。';drawSignature='';controls();draw();if(active())resume();}
 function input(){
  var slow=focused(),p=data.rules.player,dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  var speed=dx&&dy?(slow?p.slowDiagonalStepQ:p.normalDiagonalStepQ):(slow?p.slowStepQ:p.normalStepQ);
  if(pointer){var x=pointer.x*64-flow.run.sim.player.x,y=pointer.y*64-flow.run.sim.player.y,d=Math.hypot(x,y),limit=slow?p.slowStepQ:p.normalStepQ;if(d){dx=Math.trunc(x*Math.min(1,limit/d));dy=Math.trunc(y*Math.min(1,limit/d));speed=1;}}
  return{dx:dx*speed,dy:dy*speed,flags:(slow?1:0)|(keys.has('BombEdge')?2:0)};
 }
 function step(value){
  var previous=flow.phase;flow.setTest($('invincible').checked);flow.step(value);keys.delete('BombEdge');
  if(flow.phase!==previous){drawSignature='';if(!active()){pause(flow.phase==='bossTalk'?'已抵达铃羽。':flow.phase==='epilogue'?'铃羽有话要说。':'本次挑战结束。');}else controls();}
 }
 function frame(now){
  if(mode==='running'&&active()){
   accumulator+=Math.max(0,now-last);var n=0;
   try{while(accumulator>=1000/60&&n<5&&mode==='running'&&active()){step(input());accumulator-=1000/60;n++;}if(accumulator>150&&mode==='running')pause('运行暂时跟不上，已暂停。');}
   catch(e){errors.push(e.message);pause('运行停止：'+e.message);}
  }
  last=now;if(ready){var a=flow.audio();sound.update(audioView());sound.configure({musicVolume:volume*a.fade});draw();}requestAnimationFrame(frame);
 }
 $('start').addEventListener('click',start);$('restart').addEventListener('click',start);$('retry').addEventListener('click',start);$('play').addEventListener('click',resume);$('resume').addEventListener('click',resume);
 $('advance').addEventListener('click',function(){dialogue(false);});$('skip').addEventListener('click',function(){dialogue(true);});
 $('retry-boss').addEventListener('click',function(){pause();if(flow.retryBoss()){sound.reset(audioView());drawSignature='';resume();}});
 $('bomb').addEventListener('click',function(){if(mode==='running'){keys.add('BombEdge');canvas.focus({preventScroll:true});}});
 $('music').addEventListener('change',function(){sound.configure({music:this.checked});if(this.checked&&mode==='running')pause('点击继续启用音乐。');});
 $('volume').addEventListener('input',function(){volume=Number(this.value);sound.configure({musicVolume:volume});});
 ['reduced','focus','invincible'].forEach(function(id){$(id).addEventListener('change',function(){if(id==='invincible')flow.setTest(this.checked);drawSignature='';controls();draw();if(mode==='running')canvas.focus({preventScroll:true});});});
 document.addEventListener('keydown',function(e){
  if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input'))return;
  if(e.code==='Escape'){if(active()){e.preventDefault();pause('已暂停。');}return;}
  if((e.code==='Enter'||e.code==='Space')&&flow&&flow.lines().length){e.preventDefault();if(!e.repeat)dialogue(false);return;}
  if(mode!=='running'||e.target.matches('button'))return;
  if(!DanmakuControls.matches(e.code,focusBinding)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','KeyX','Space'].indexOf(e.code)<0)return;
  e.preventDefault();keys.add(e.code);if(!e.repeat&&(e.code==='KeyX'||e.code==='Space'))keys.add('BombEdge');
 });
 document.addEventListener('keyup',function(e){keys.delete(e.code);});window.addEventListener('blur',function(){if(mode==='running'||mode==='preparing')pause('离开页面，已暂停。');});document.addEventListener('visibilitychange',function(){if(document.hidden&&(mode==='running'||mode==='preparing'))pause('离开页面，已暂停。');});
 function point(e){var r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*640/r.height};}
 canvas.addEventListener('pointerdown',function(e){if(mode!=='running')return;canvas.setPointerCapture(e.pointerId);pointer=point(e);e.preventDefault();});canvas.addEventListener('pointermove',function(e){if(pointer)pointer=point(e);});canvas.addEventListener('pointerup',function(){pointer=null;});canvas.addEventListener('pointercancel',function(){pointer=null;});
 window.Stage02Journey={inspect:function(){var s=flow&&flow.run.sim,emitters=s&&s.emitters||[];return{ready:ready,mode:mode,flow:flow?flow.inspect():null,audio:sound.inspect(),materials:GardenBulletMaterials.inspect(),presentation:{emitterCount:emitters.length,lastEmitterAge:emitters.length?s.tick-emitters[emitters.length-1].born:null,newbornBullets:s?s.enemies.filter(function(e){return s.tick-e.born<10;}).length:0},errors:errors.slice()};},snapshot:function(){return flow.snapshot();},
  advanceForReview:function(frames){pause();if(!Number.isInteger(frames)||frames<0||frames>1800)throw Error('仅允许局部检查片段');for(var i=0;i<frames&&active();i++)step({dx:0,dy:0,flags:1});drawSignature='';draw();return this.inspect();},
  fixtureForReview:function(name){
   pause();$('invincible').checked=true;flow.start(true);flow.skip();
   if(name==='stage-window'){flow.run.time=128*60;flow.run.sim.musicTick=128*60;}
   else{
    flow.run.sim.player.power=12;flow.run.sim.player.lives=2;flow.run.sim.player.bombs=1;flow.run.time=data.chart.tracks.stage.ticks-1;flow.run.sim.tick=flow.run.time;flow.run.sim.musicTick=flow.run.time;flow.step({dx:0,dy:0,flags:1});
    if(name==='bell-window'||name==='petal-window'){flow.skip();flow.run.wait=0;flow.run.index=name==='bell-window'?2:1;flow.run.time=(name==='bell-window'?172:112)*60;flow.run.sim=new DanmakuStage02.Sim(data.rules,data.chart,flow.run.index,{power:12,invincible:true,shooting:false,musicTick:flow.run.time});DanmakuStage02Journey.trace(flow.run.sim);}
    else if(name==='victory'){flow.skip();flow.run.wait=0;flow.run.index=2;flow.run.time=6000;flow.run.sim=new DanmakuStage02.Sim(data.rules,data.chart,2,{power:12,invincible:true,musicTick:6000});flow.run.sim.hp=0;flow.step({dx:0,dy:0,flags:1});}
    else if(name==='boss-death'){flow.skip();flow.run.wait=0;flow.run.sim.player.lives=1;flow.setTest(false);flow.run.sim.player.invulUntil=0;flow.run.sim.spawn(flow.run.sim.player.x,flow.run.sim.player.y,128,0,4,60,20);flow.step({dx:0,dy:0,flags:1});}
    else if(name!=='boss-entry')throw Error('未知检查场景');
   }
   sound.reset(audioView());drawSignature='';controls();draw();return this.inspect();
  }
 };
 Promise.all(Object.keys(data.assets).map(function(key){return new Promise(function(resolve,reject){var image=new Image();image.onload=function(){images[key]=image;resolve();};image.onerror=function(){reject(Error('素材载入失败：'+key));};image.src=data.assets[key];});})).then(function(){
  window.Stage02DraftImages=images;Stage02JourneyBattleView.init(images,data.materialLayout);flow=new DanmakuStage02Journey.Flow(data.rules,data.chart,data.dialogue);$('speaker-picture').src=data.assets.portrait;ready=true;$('loading').hidden=true;$('start').disabled=false;controls();draw();requestAnimationFrame(frame);
 }).catch(function(e){errors.push(e.message);$('loading').textContent=e.message;});
}());
