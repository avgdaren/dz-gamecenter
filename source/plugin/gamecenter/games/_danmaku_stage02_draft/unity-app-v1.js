/* (C) 2026 Carinoasd. Same-game reference and bounded practice UI: 小典 / Codex. */
(function(){
 'use strict';
 var data=window.Stage02UnityData,$=function(id){return document.getElementById(id);},canvases=[$('field-0'),$('field-1')],contexts=canvases.map(function(c){return c.getContext('2d');}),images={};
 var ready=false,mode='paused',kind='roles',age=0,last=0,accumulator=0,ticket=0,pair=null,actors=[],keys=new Set(),pointer=null,errors=[],focusBinding='Shift',signature='',models=[null,null];
 try{focusBinding=DanmakuControls.fromStored(localStorage.getItem('danmaku.controls.v1'));}catch(e){}
 var managers=data.banks.map(function(bank){return new DanmakuAudio.Manager(bank,{recordedMusic:true,settings:{music:true,sfx:false,musicVolume:.5}});});
 function limit(){return kind==='wave'?1440:kind==='roles'?600:kind==='intro'?450:kind==='phase'?150:180;}
 function soundIndex(){return $('music').value==='off'?-1:Number($('music').value);}
 function soundView(){return{scene:'stage',stage:kind==='wave'?'prelude':'active',phase:kind==='phase'?1:0,status:'playing',mode:mode==='running'&&kind!=='roles'?'running':'paused',foreground:!document.hidden,tick:age,preludeTicks:0,charges:[],shots:0,hits:0,taken:0,bombs:0,breaks:0,supply:0,level:1,power:0,elites:0,kills:0,enemy:0,graze:0};}
 function reset(){
  pair=new Stage02UnitySample.Pair(data.rules,{level:Number($('level').value),invincible:$('invincible').checked});
  actors=[0,1].map(function(){var s=new DanmakuStage01.Sim(data.rules,0,false,DanmakuStage01.cornerRule);s.player.power=pair.second.player.power;return s;});age=0;accumulator=0;keys.clear();pointer=null;signature='';
 }
 function focused(){return $('focused').checked||Array.from(keys).some(function(k){return DanmakuControls.matches(k,focusBinding);});}
 function controls(){
  document.querySelectorAll('[data-kind]').forEach(function(b){b.disabled=!ready;b.setAttribute('aria-pressed',String(b.dataset.kind===kind));});
  $('pause').disabled=!ready;$('pause').textContent=mode==='running'?'暂停':mode==='preparing'?'取消准备':'播放';$('restart').disabled=!ready;$('bomb').disabled=mode!=='running'||kind!=='wave';$('neutral').disabled=kind!=='roles';$('level').disabled=mode==='preparing';$('focus-key').textContent=DanmakuControls.label(focusBinding);
 }
 function hud(index,s){
  $('lives-'+index).textContent='◆ '.repeat(Math.max(0,s.player.lives)).trim()||'—';$('power-'+index).textContent=DanmakuStage01.level(s.player.power,s.rules)+' / 5';$('bombs-'+index).textContent='✦ '.repeat(s.player.bombs).trim()||'—';$('stock-'+index).textContent=s.player.bombs+' / 3';
  $('clock-'+index).textContent=(Math.max(0,limit()-age)/60).toFixed(1)+' 秒';$('fill-'+index).style.width=(100*age/limit())+'%';
  var label=kind==='roles'?'标准战斗姿态':kind==='wave'?(index===0?'第一关原编排 · 前24秒':DanmakuStage01.segment(s.rules,s.tick)):kind==='intro'?'首领登场':kind==='phase'?Stage02UnityShow.themes[index].phases[1]:'击破收尾';
  $('phase-'+index).textContent=label;
 }
 function card(index,m){
  var node=$('intro-'+index);node.hidden=!(m&&m.kind==='intro');if(node.hidden)return;node.style.opacity=m.opacity;
  var shift=$('reduced').checked?0:1-Math.min(1,m.progress*4);node.querySelector('.boss-portrait').style.transform='translateX('+(18*shift)+'px)';node.querySelector('.boss-intro-copy').style.transform='translateX('+(-12*shift)+'px)';
 }
 function draw(){
  if(!ready)return;var stamp=[kind,age,mode,$('neutral').checked,$('reduced').checked,focused(),$('invincible').checked].join('|');if(stamp===signature)return;signature=stamp;
  for(var i=0;i<2;i++){
   var s=kind==='wave'?(i?pair.second:pair.first):actors[i];hud(i,s);models[i]=null;
   if(kind==='roles')Stage02UnityView.roles(contexts[i],i,s,age,$('reduced').checked,$('neutral').checked,focused());
   else if(kind==='wave')Stage02UnityView.wave(contexts[i],i,s,age,$('reduced').checked,focused());
   else models[i]=Stage02UnityView.acting(contexts[i],i,s,kind,age,$('reduced').checked,focused());
   card(i,models[i]);
  }controls();
 }
 function pause(message){ticket++;mode='paused';keys.clear();pointer=null;accumulator=0;managers.forEach(function(m){m.pause();});signature='';controls();draw();if(message)$('status').textContent=message;}
 async function resume(){
  if(!ready)return;if(mode==='running'||mode==='preparing'){pause('已暂停，可查看当前画面。');return;}
  if(age>=limit()||kind==='wave'&&pair.status!=='playing')reset();var token=++ticket;mode='preparing';controls();
  try{var index=soundIndex();if(index>=0&&kind!=='roles'&&!await managers[index].gesture())throw Error('音乐未能启动，可关闭BGM后播放。');if(token!==ticket)return;mode='running';last=performance.now();accumulator=0;managers.forEach(function(m,i){m.reset(soundView());if(i===index)m.update(soundView());});controls();canvases[1].focus({preventScroll:true});$('status').textContent=kind==='wave'?'24秒编队短样：两侧同资源、同输入；右侧为第二关Easy候选。':'正在播放对照片段。';draw();}
  catch(e){pause(e.message);}
 }
 function select(value,autoplay){pause();kind=value;reset();draw();if(autoplay)resume();else $('status').textContent='标准姿态对照：先检查画法与体量，尚未扩展整套动作。';}
 function input(){
  var p=data.rules.player,slow=focused(),dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  var step=dx&&dy?(slow?p.slowDiagonalStepQ:p.normalDiagonalStepQ):(slow?p.slowStepQ:p.normalStepQ);
  if(pointer){var a=pointer.x*64-pair.second.player.x,b=pointer.y*64-pair.second.player.y,d=Math.hypot(a,b),max=slow?p.slowStepQ:p.normalStepQ;dx=d?Math.trunc(a*Math.min(1,max/d)):0;dy=d?Math.trunc(b*Math.min(1,max/d)):0;step=1;}
  return{dx:dx*step,dy:dy*step,flags:(slow?1:0)|(keys.has('BombEdge')?2:0)};
 }
 function step(value){
  if(age>=limit())return;if(kind==='wave'){pair.setInvincible($('invincible').checked);pair.step(value);age=pair.tick;keys.delete('BombEdge');}else age++;
  if(age>=limit()||kind==='wave'&&pair.status!=='playing')pause(kind==='wave'&&pair.status==='dead'?'短样中生命耗尽，可重播本段。':'本段结束，可重播或切换片段。');
 }
 function frame(now){
  if(mode==='running'){accumulator+=Math.max(0,now-last);var count=0;try{while(accumulator>=1000/60&&count<5&&mode==='running'){step(input());accumulator-=1000/60;count++;}if(accumulator>180&&mode==='running')pause('运行暂时跟不上，已暂停。');}catch(e){errors.push(e.message);pause('片段停止：'+e.message);}}
  last=now;if(ready){var index=soundIndex();managers.forEach(function(m,i){if(i===index){m.update(soundView());m.configure({musicVolume:Number($('volume').value)*(kind==='clear'?Math.max(0,1-age/48):1)});}});draw();}requestAnimationFrame(frame);
 }
 document.querySelectorAll('[data-kind]').forEach(function(b){b.addEventListener('click',function(){select(this.dataset.kind,this.dataset.kind!=='roles');});});
 $('pause').addEventListener('click',resume);$('restart').addEventListener('click',function(){select(kind,true);});$('bomb').addEventListener('click',function(){if(kind==='wave'&&mode==='running'){keys.add('BombEdge');canvases[1].focus({preventScroll:true});}});
 ['neutral','reduced','focused'].forEach(function(id){$(id).addEventListener('change',function(){signature='';draw();if(mode==='running')canvases[1].focus({preventScroll:true});});});
 $('level').addEventListener('change',function(){pause();reset();draw();$('status').textContent='起始火力已同步，可重播查看同资源表现。';});$('invincible').addEventListener('change',function(){pair.setInvincible(this.checked);signature='';draw();});
 $('music').addEventListener('change',function(){var running=mode==='running';pause();if(running)resume();});
 document.addEventListener('keydown',function(e){if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input,select'))return;if(e.code==='Escape'){e.preventDefault();pause('已暂停。');return;}if(mode!=='running'||e.target.matches('button'))return;if(!DanmakuControls.matches(e.code,focusBinding)&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','KeyX','Space'].indexOf(e.code)<0)return;e.preventDefault();keys.add(e.code);if(!e.repeat&&(e.code==='KeyX'||e.code==='Space'))keys.add('BombEdge');});
 document.addEventListener('keyup',function(e){keys.delete(e.code);});window.addEventListener('blur',function(){if(mode==='running'||mode==='preparing')pause('离开页面，已暂停。');});document.addEventListener('visibilitychange',function(){if(document.hidden&&(mode==='running'||mode==='preparing'))pause('切到后台，已暂停。');});
 function point(e){var r=canvases[1].getBoundingClientRect();return{x:(e.clientX-r.left)*480/r.width,y:(e.clientY-r.top)*640/r.height};}
 canvases[1].addEventListener('pointerdown',function(e){if(kind!=='wave'||mode!=='running')return;canvases[1].setPointerCapture(e.pointerId);pointer=point(e);e.preventDefault();});canvases[1].addEventListener('pointermove',function(e){if(pointer)pointer=point(e);});['pointerup','pointercancel'].forEach(function(name){canvases[1].addEventListener(name,function(){pointer=null;});});
 window.Stage02Unity={inspect:function(){return{ready:ready,mode:mode,kind:kind,age:age,limit:limit(),models:models,sprites:ready?Stage02UnitySprites.inspect():null,pair:pair?pair.inspect():null,audio:managers.map(function(m){return m.inspect();}),errors:errors.slice(),sharedShowSource:Stage02UnityShow.coreSource,completeStage:false,ranked:false};},
  seekForReview:function(value,ticks){if(['roles','intro','phase','clear','wave'].indexOf(value)<0)throw Error('未知片段');select(value,false);if(!Number.isInteger(ticks)||ticks<0||ticks>limit())throw Error('片段时间无效');if(kind==='wave'){for(var i=0;i<ticks&&pair.status==='playing';i++)step({dx:0,dy:0,flags:1});}else age=ticks;signature='';draw();return this.inspect();},
  advanceForReview:function(count){pause();if(!Number.isInteger(count)||count<0||count>600)throw Error('只允许局部检查');for(var i=0;i<count&&age<limit()&&(kind!=='wave'||pair.status==='playing');i++)step({dx:0,dy:0,flags:1});signature='';draw();return this.inspect();},contactData:function(){return Stage02UnityView.contact().toDataURL();}};
 Promise.all(Object.keys(data.assets).map(function(key){return new Promise(function(resolve,reject){var im=new Image();im.onload=function(){images[key]=im;resolve();};im.onerror=function(){reject(Error('素材载入失败：'+key));};im.src=data.assets[key];});})).then(function(){
  Stage02UnityView.init(images,data);$('portrait-0').src=data.assets.refPortrait;$('portrait-1').src=data.assets.portrait;reset();ready=true;$('loading').hidden=true;$('contact').appendChild(Stage02UnityView.contact());controls();draw();$('status').textContent='角色按第一关实际尺寸显示。可选择登场、换阶段、收尾或24秒短样。';requestAnimationFrame(frame);
 }).catch(function(e){errors.push(e.message);$('loading').textContent=e.message;});
}());
