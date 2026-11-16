/* (C) 2026 Carinoasd. Read-only phase observer; no score or replay submission: 小典 / Codex. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d'),rules=window.DanmakuRules,keys=new Set();
 const names=['回旋花冠','悬光回响','双岸星河'],copy=['蓝白花冠持续展开，金黄回声错拍织入；飞行中的弹体会弯折并反向回旋。','光玉先扩散减速，悬停后出现锁定预告；随后朝锁定方向散开，移动诱导下一轮。','双岸光源织出弯曲的蓝金流束，交汇处形成移动空隙；收句光环留出下一次换位的开口。'],offsets=[180,1800,3600];
 const images={},files={bg:'assets/stage01-corridor-v1.png',body:'assets/boss-body-atlas-v1.png',back:'assets/boss-ring-back-v1.png',front:'assets/boss-ring-front-v1.png',face:'assets/boss-face-v1.png',player:'assets/player-motion-v1.png',atlas:'assets/projectile-atlas-v1.png'};
 const sound=new DanmakuAudio.Manager(window.DanmakuBgmBank,{recordedMusic:true,settings:{music:true,sfx:false,musicVolume:.55}});
 let ready=false,phase=0,sim=null,mode='paused',last=0,accumulator=0,ticket=0;
 function view(){return{scene:'stage',mode:mode==='running'?'running':'paused',foreground:!document.hidden&&document.hasFocus(),tick:4320+(sim?sim.musicTick:offsets[phase]),stage:'active',phase,status:'playing',preludeTicks:4320,introTicks:180,battle:true,charges:[],shots:0,hits:0,taken:0,enemy:0,graze:0,bombs:0,kills:0,supply:0,elites:0,power:0,level:1,breaks:0};}
 function controls(){
  $('play').disabled=!ready||mode==='preparing';$('play').textContent=mode==='running'?'暂停观察':mode==='preparing'?'准备音乐…':sim&&sim.tick>=1800?'重新观察':'开始 / 继续观察';$('replay').disabled=!ready||mode==='preparing';
  document.querySelectorAll('[data-phase]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.phase)===phase)));
  $('test-badge').hidden=!$('invincible').checked;$('phase-title').textContent=names[phase];$('phase-description').textContent=copy[phase];
 }
 function reset(index){
  ticket++;keys.clear();phase=index;mode='paused';accumulator=0;sim=new DanmakuStage01.Sim(rules,index,false,DanmakuStage01.hardV3Rule);sim.musicTick=offsets[index];sim.player.power=16;sim.fire=function(){};sim.testInvincible=$('invincible').checked;
  sound.reset(view());$('status').textContent='本段就绪，点击开始观察。';controls();draw();
 }
 function pause(){ticket++;mode='paused';keys.clear();accumulator=0;sound.pause();controls();}
 async function start(){
  if(!ready||mode==='preparing')return;if(mode==='running'){pause();return;}if(sim.tick>=1800||sim.status!=='playing')reset(phase);
  const mine=++ticket;if($('music').checked){mode='preparing';controls();await sound.gesture();if(mine!==ticket)return;}
  mode='running';last=performance.now();accumulator=0;controls();$('status').textContent='观察中；可以移动诱导，或暂停看清弹间空隙。';sound.update(view());canvas.focus({preventScroll:true});
 }
 function input(){
  const focused=keys.has('ShiftLeft')||keys.has('ShiftRight'),p=rules.player;
  let dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')),dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  const speed=dx&&dy?(focused?p.slowDiagonalStepQ:p.normalDiagonalStepQ):(focused?p.slowStepQ:p.normalStepQ);return{dx:dx*speed,dy:dy*speed,flags:(focused?1:0)|(keys.has('BombEdge')?2:0)};
 }
 function step(value){sim.testInvincible=$('invincible').checked;sim.step(value);keys.delete('BombEdge');if(sim.tick>=1800||sim.status!=='playing'){pause();$('status').textContent=sim.tick>=1800?'30秒片段结束，可重播或切换阶段。':'本段已受击结束，可开启无敌后重播。';}}
 function draw(){
  if(!ready||!sim)return;ctx.clearRect(0,0,480,640);DanmakuStageArt.background(ctx,images.bg,4320,false);DanmakuBossView.sprite(ctx,images,sim,sim.musicTick,false,'active');DanmakuChoreography.telegraphs(ctx,sim,false);
  const p=sim.player;if($('invincible').checked){ctx.strokeStyle='#e7d69e';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x/64,p.y/64,21,0,Math.PI*2);ctx.stroke();}
  DanmakuPlayerView.sprite(ctx,images.player,p,sim.tick);for(const e of sim.enemies)DanmakuBulletMaterials.draw(ctx,images.atlas,e);DanmakuPlayerView.hitpoint(ctx,p,keys.has('ShiftLeft')||keys.has('ShiftRight'));
  ctx.fillStyle='#c9d7e8';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillText('HARD · '+names[phase],15,23);
  $('readout').textContent='观察 '+(sim.tick/60).toFixed(1)+' / 30.0s  ·  敌弹 '+sim.enemies.length+'\nBGM '+(sim.musicTick/60).toFixed(1)+'s  ·  生命 '+p.lives+'  ·  B '+p.bombs;
 }
 function frame(now){
  if(ready&&mode==='running'){
   accumulator+=Math.max(0,now-last);let count=0;
   while(accumulator>=1000/60&&count<5&&mode==='running'){step(input());accumulator-=1000/60;count++;}
   if(accumulator>=1000/60&&mode==='running'){pause();$('status').textContent='画面暂时跟不上，已暂停。';}
  }
  last=now;if(ready){draw();sound.update(view());}requestAnimationFrame(frame);
 }
 $('play').addEventListener('click',()=>start().catch(e=>{pause();$('status').textContent=e.message;}));$('replay').addEventListener('click',()=>reset(phase));
 document.querySelectorAll('[data-phase]').forEach(b=>b.addEventListener('click',()=>reset(Number(b.dataset.phase))));
 $('invincible').addEventListener('change',()=>{if(sim)sim.testInvincible=$('invincible').checked;controls();canvas.focus({preventScroll:true});});
 $('music').addEventListener('change',()=>{sound.configure({music:$('music').checked});if(mode==='running'&&$('music').checked)sound.gesture();});
 document.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||e.target.matches('input,button'))return;if(e.code==='Escape'){e.preventDefault();pause();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyX','Space'].includes(e.code))return;e.preventDefault();if(mode!=='running')return;keys.add(e.code);if(!e.repeat&&(e.code==='KeyX'||e.code==='Space'))keys.add('BombEdge');});
 document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{if(mode==='running'||mode==='preparing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(mode==='running'||mode==='preparing'))pause();});
 window.ChoreoPreview={inspect:()=>({ready,phase,mode,tick:sim?sim.tick:0,musicTick:sim?sim.musicTick:0,count:sim?sim.enemies.length:0,seedWarnings:sim?sim.enemies.filter(e=>e.motion&&e.motion[5]===4&&e.motion[4]-(sim.tick-e.born)>0&&e.motion[4]-(sim.tick-e.born)<=24).length:0,materialsReady:DanmakuBulletMaterials.ready(images.atlas),audio:sound.inspect()}),select:reset,
  seekForReview(frames){if(!ready)throw Error('素材未就绪');reset(phase);for(let i=0;i<Math.min(1800,Math.max(0,frames))&&sim.status==='playing';i++)step({dx:0,dy:0,flags:1});draw();return this.inspect();}};
 Promise.all(Object.entries(files).map(async([key,file])=>{const image=new Image();image.src=file;await image.decode();images[key]=image;})).then(()=>{
  if(!DanmakuBulletMaterials.ready(images.atlas)||!DanmakuBossView.ready(images))throw Error('素材尺寸不符');ready=true;reset(0);requestAnimationFrame(frame);
 }).catch(e=>{$('status').textContent='观察页未就绪：'+e.message;$('status').className='error';});
}());
