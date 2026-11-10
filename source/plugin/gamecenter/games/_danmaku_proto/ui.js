/* (C) 2026 Carinoasd. P0 interaction and rendering: 小典 / Codex. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var names = { battle: '完整挑战', flower: '花瓣星环', aim: '星雨连射', wave: '交错星幕' };
  var phaseNames = ['星环', '星雨', '星幕'];
  var lessons = {
    battle: ['跟随首领，逐阶段突破。', '自动向上射击，跟随首领保持火力。三阶段共享生命和清屏；击破后清场转场，每阶段最多 70 秒。'],
    flower: ['跟随缺口，小步调整。', '花瓣会向四周展开。先看朝下的宽缺口，再按住慢速轻轻调整位置。'],
    aim: ['先让它瞄准，再换位置。', '出现瞄准提示后，连射方向就锁定了。离开原位，给自己留一点移动空间。'],
    wave: ['先看缺口，再穿过波浪。', '敌弹会分成三排依次落下。提前看清空位，避免临近时才横穿整片弹幕。']
  };
  var canvas = $('arena'), ctx = canvas.getContext('2d'), rules, sim, battle = null, scene = 'battle';
  var mode = 'ready', keys = new Set(), records = [], slowToggle = false, bombEdge = false;
  var pointer = null, target = null, last = 0, accumulator = 0, countdownUntil = 0;
  var frameTimes = [], lastHud = 0, pauseReason = '', loaded = false;
  var buttons = Array.from(document.querySelectorAll('[data-scene]'));
  function setStatus(text, error) { $('status').textContent = text; $('status').classList.toggle('error', !!error); }
  function isEditing(el) { return el && (el.matches('input,select,textarea') || el.isContentEditable); }
  function focused() { return document.activeElement === canvas || document.activeElement.closest('.arena-controls'); }
  function clearInput() { keys.clear(); pointer = null; target = null; bombEdge = false; }
  function controls() {
    var active = mode === 'running' || mode === 'paused' || mode === 'countdown';
    buttons.forEach(function (b) { b.disabled = !loaded; });
    $('assist').disabled = active;
    $('pause').disabled = !active;
    $('restart').disabled = !loaded || mode === 'ready';
    $('export').disabled = mode !== 'over';
    $('bomb').disabled = mode !== 'running' || !sim || sim.player.bombs <= 0 || !!(battle && battle.stage !== 'active');
    $('pause').innerHTML = mode === 'paused' ? '继续 <kbd>Esc</kbd>' : '暂停 <kbd>Esc</kbd>';
    $('slow').setAttribute('aria-pressed', String(slowToggle));
  }
  function overlay(kicker, title, text, button, foot) {
    $('overlay').classList.remove('hidden');
    $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
    $('overlay-text').textContent = text; $('start').textContent = button;
    $('overlay-footnote').textContent = foot || '方向键 / WASD 移动 · Shift 慢速';
    $('start').disabled = false;
  }
  function reset() {
    clearInput(); records = []; frameTimes = []; accumulator = 0; slowToggle = false;
    battle = scene === 'battle' ? new DanmakuBattle.Battle(rules, $('assist').checked) : null;
    sim = battle ? battle.sim : new DanmakuP0.Sim(rules, scene, $('assist').checked);
    mode = 'ready';
    overlay((battle ? '三阶段 / ' : '0' + (DanmakuP0.scenes.indexOf(scene) + 1) + ' / ') + names[scene],
      lessons[scene][0], battle ? '星环 → 星雨 → 星幕\n跟随首领输出，善用清屏。' : '自动射击已经就绪。\n移动躲弹，试着坚持 45 秒。', battle ? '开始挑战' : '开始练习');
    $('arena-name').textContent = names[scene];
    $('lesson-title').textContent = lessons[scene][0]; $('lesson-text').textContent = lessons[scene][1];
    $('mode-label').textContent = sim.assist ? '辅助练习' : (battle ? '标准挑战' : '标准练习');
    $('boss-health').hidden = !battle; $('score-metric').hidden = !battle; $('score-details').hidden = true;
    setStatus(battle ? '每阶段最多 70 秒；结束后可导出本局回放。' : '每场最多 45 秒，结束后可导出回放。'); controls(); updateHud();
  }
  function start() {
    if (!loaded || mode === 'countdown') return;
    if (mode === 'over') reset();
    clearInput(); accumulator = 0; last = performance.now();
    if (mode === 'paused') {
      mode = 'countdown'; countdownUntil = performance.now() + 1500;
      $('start').disabled = true; $('overlay-title').textContent = '准备继续';
      $('overlay-text').textContent = '稍等片刻，重新看清路线。'; controls();
    } else { mode = 'running'; $('overlay').classList.add('hidden'); controls(); }
    canvas.focus({ preventScroll: true });
  }
  function pause(reason) {
    if (mode !== 'running' && mode !== 'countdown') return;
    mode = 'paused'; clearInput(); accumulator = 0; pauseReason = reason || '游戏已暂停';
    overlay('暂停 / ' + names[scene], '先歇一下，星幕会等你。', pauseReason, battle ? '继续挑战' : '继续练习', '点击继续后，倒计时再恢复');
    setStatus(pauseReason); controls(); updateHud();
  }
  function finish() {
    mode = 'over'; clearInput();
    if (battle) {
      var parts = battle.score(), clear = battle.status === 'clear';
      overlay('挑战结束 / ' + (sim.assist ? '辅助练习' : '标准挑战'),
        clear ? '星幕已破，挑战完成。' : (battle.status === 'timeout' ? '阶段时间到，再靠近目标。' : '再试一次，找另一条路。'),
        '本局 ' + parts.total.toLocaleString('zh-CN') + ' 分 · 击破 ' + battle.phaseBreaks + ' / 3 阶段\n' +
        '战斗用时 ' + (battle.activeTicks / 60).toFixed(1) + ' 秒 · 擦弹 ' + sim.stats.graze + ' 次',
        '再挑战一次', '本机候选成绩，不计论坛排行榜与积分');
      $('score-details').hidden = false;
      $('score-details').textContent = '通关 ' + parts.clear + ' · 击破 ' + parts.phase + '\n伤害 ' + parts.damage + ' · 擦弹 ' + parts.graze + '\n资源 ' + parts.resources + ' · 时间 ' + parts.time;
      setStatus(clear ? '本局已通关，可导出回放复验。' : '本局已结束，可导出回放或回练习场熟悉路线。');
      controls(); updateHud(); return;
    }
    var completed = sim.status === 'complete';
    overlay('本场结束 / ' + names[scene], completed ? '这一片星幕，穿过去了。' : '再试一次，找另一条路。',
      '坚持 ' + (sim.tick / 60).toFixed(1) + ' 秒 · 命中 ' + sim.stats.shotHits + ' 次\n擦弹 ' + sim.stats.graze + ' 次 · 使用清屏 ' + sim.stats.bombsUsed + ' 次',
      '再练一次', '本地练习结果，不计排行榜与积分');
    setStatus('本场已结束，可以导出回放或切换弹型。'); controls(); updateHud();
  }
  function input() {
    var slow = slowToggle || keys.has('ShiftLeft') || keys.has('ShiftRight');
    var limit = slow ? rules.player.slowStepQ : rules.player.normalStepQ;
    var dx = 0, dy = 0;
    if (target) {
      dx = target.x - sim.player.x; dy = target.y - sim.player.y;
      var length = Math.hypot(dx, dy);
      if (length > limit) { dx = dx * limit / length; dy = dy * limit / length; }
      dx = Math.trunc(dx); dy = Math.trunc(dy);
    } else {
      dx = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      dy = Number(keys.has('ArrowDown') || keys.has('KeyS')) - Number(keys.has('ArrowUp') || keys.has('KeyW'));
      var speed = dx && dy ? (slow ? rules.player.slowDiagonalStepQ : rules.player.normalDiagonalStepQ) : limit;
      dx *= speed; dy *= speed;
    }
    var value = { dx: dx, dy: dy, flags: (slow ? 1 : 0) | (bombEdge ? 2 : 0) };
    bombEdge = false; return value;
  }
  function updateHud() {
    if (!sim) return;
    var remainingTicks = battle ? (battle.stage === 'active' ? rules.clock.phaseMaxTicks - sim.tick : battle.remaining) : 2700 - sim.tick;
    if (battle && battle.stage === 'over') remainingTicks = Math.max(0, rules.clock.phaseMaxTicks - sim.tick);
    $('clock').innerHTML = (remainingTicks / 60).toFixed(1) + '<small> 秒</small>';
    if (battle) {
      $('phase-progress').textContent = battle.stage === 'opening' ? '准备出发 · 三阶段挑战' : (battle.stage === 'transition' ? '阶段突破 → ' + phaseNames[battle.phaseIndex + 1] : phaseNames[battle.phaseIndex] + ' · 第 ' + (battle.phaseIndex + 1) + ' / 3 阶段');
      var hpMax = rules.boss.phaseHP[battle.phaseIndex];
      $('hp-value').textContent = sim.hp + ' / ' + hpMax;
      $('hp-fill').style.width = Math.max(0, sim.hp / hpMax * 100) + '%';
      $('score').textContent = battle.score().total.toLocaleString('zh-CN');
    }
    $('lives').textContent = sim.player.lives ? Array(sim.player.lives).fill('◆').join(' ') : '—';
    $('bombs').textContent = sim.player.bombs ? Array(sim.player.bombs).fill('✦').join(' ') : '—';
    $('shot-hits').textContent = sim.stats.shotHits; $('graze').textContent = sim.stats.graze;
    $('bomb').disabled = mode !== 'running' || sim.player.bombs <= 0 || !!(battle && battle.stage !== 'active');
    var sorted = frameTimes.slice().sort(function (a,b) { return a-b; });
    var p95 = sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2) : '—';
    $('diagnostic-text').textContent = '规则 ' + (battle ? DanmakuBattle.rule : rules.meta.rulesId) + '\n逻辑 ' + (battle ? battle.tick + ' / 13200' : sim.tick + ' / 2700') + ' 步 · ' + mode +
      '\n当前敌弹 ' + sim.enemies.length + ' · 峰值 ' + sim.stats.enemyPeak + '\n有效伤害 ' + sim.stats.damage +
      ' · 受击 ' + sim.stats.hitsTaken + '\n最近 300 帧绘制与更新耗时 p95 ' + p95 + ' ms（不是显示帧间隔）';
  }
  function circle(x,y,r,fill,stroke) {
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if (fill) { ctx.fillStyle=fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle=stroke; ctx.stroke(); }
  }
  function draw() {
    ctx.clearRect(0,0,480,640);
    var gradient=ctx.createLinearGradient(0,0,0,640); gradient.addColorStop(0,'#111e35'); gradient.addColorStop(1,'#091321');
    ctx.fillStyle=gradient; ctx.fillRect(0,0,480,640);
    ctx.lineWidth=1;
    for (var i=0;i<48;i++) { ctx.globalAlpha=.15+(i%4)*.12; circle((i*137+19)%480,(i*193+31)%640,i%7===0?1.2:.6,'#c4d8f5'); }
    ctx.globalAlpha=1;
    ctx.strokeStyle='#223149'; ctx.beginPath(); ctx.moveTo(22,144); ctx.lineTo(458,144); ctx.stroke();
    ctx.font='9px "Microsoft YaHei",sans-serif'; ctx.fillStyle='#7185a0'; ctx.fillText((battle ? '完整挑战 / ' + phaseNames[battle.phaseIndex] : '星幕练习 / ' + names[scene]),22,26);
    if (!sim) return;
    var b=sim.boss, p=sim.player;
    if (sim.tick < sim.warningUntil && (!battle || battle.stage === 'active')) {
      var v=rules.directionVectors[sim.aimAngle]; ctx.strokeStyle='#efbf83'; ctx.setLineDash([6,8]);
      ctx.beginPath(); ctx.moveTo(b.x/64,b.y/64); ctx.lineTo(b.x/64+v[0],b.y/64+v[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#efbf83'; ctx.fillText('瞄准已锁定',b.x/64-28,b.y/64-45);
    }
    circle(b.x/64,b.y/64,37,null,'#3c4b66');
    ctx.save(); ctx.translate(b.x/64,b.y/64); ctx.rotate(Math.PI/4); ctx.fillStyle='#273d58'; ctx.strokeStyle='#d7bc89';
    ctx.fillRect(-20,-20,40,40); ctx.strokeRect(-20,-20,40,40); ctx.restore();
    circle(b.x/64,b.y/64,10,'#e2c38a'); circle(b.x/64,b.y/64,4,'#fff0cd');
    sim.shots.forEach(function(s) { ctx.fillStyle='#96d8ed'; ctx.fillRect(s.x/64-1.5,s.y/64-6,3,12); });
    sim.enemies.forEach(function(e) {
      var color=e.radius===5?'#efbcbb':e.radius===4?'#e9c47c':'#a7baef';
      if (e.radius===6) {
        var diamondRadius=e.radius*Math.SQRT2;
        ctx.fillStyle=color; ctx.strokeStyle='#e3eaff'; ctx.beginPath();
        ctx.moveTo(e.x/64,e.y/64-diamondRadius);ctx.lineTo(e.x/64+diamondRadius,e.y/64);ctx.lineTo(e.x/64,e.y/64+diamondRadius);ctx.lineTo(e.x/64-diamondRadius,e.y/64);ctx.closePath();ctx.fill();ctx.stroke();
      } else { circle(e.x/64,e.y/64,e.radius,color,'#fff0e2'); circle(e.x/64,e.y/64,1.3,'#6b4b68'); }
    });
    var visualTick=sim.tick+(battle && battle.stage==='transition' ? rules.clock.transitionTicks-battle.remaining : 0);
    var invulnerable=visualTick<p.invulUntil;
    if (slowToggle || keys.has('ShiftLeft') || keys.has('ShiftRight')) circle(p.x/64,p.y/64,18,null,'#6aabbf');
    if (invulnerable) circle(p.x/64,p.y/64,23,null,'#d7d6a5');
    if (!invulnerable || sim.tick%12<8) {
      ctx.fillStyle='#a7dbed'; ctx.strokeStyle='#eff8ff'; ctx.beginPath(); ctx.moveTo(p.x/64,p.y/64-13);
      ctx.lineTo(p.x/64+11,p.y/64+9); ctx.lineTo(p.x/64,p.y/64+4); ctx.lineTo(p.x/64-11,p.y/64+9); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    circle(p.x/64,p.y/64,3,'#142336','#fff4bd'); circle(p.x/64,p.y/64,1,'#fff5d6');
    if (visualTick-sim.lastBomb<18) { ctx.globalAlpha=Math.max(0,.18*(1-(visualTick-sim.lastBomb)/18)); ctx.fillStyle='#aedee9'; ctx.fillRect(0,0,480,640); ctx.globalAlpha=1; }
    if (visualTick-sim.lastHit<16) { ctx.strokeStyle='#f29e9e'; ctx.lineWidth=3; ctx.strokeRect(2,2,476,636); ctx.lineWidth=1; }
    if (battle && (battle.stage === 'opening' || battle.stage === 'transition')) {
      ctx.fillStyle = '#e8c888'; ctx.textAlign = 'center'; ctx.font = '22px "Microsoft YaHei",sans-serif';
      ctx.fillText(battle.stage === 'opening' ? '准备迎接星幕' : '阶段突破', 240, 282);
      ctx.font = '12px "Microsoft YaHei",sans-serif'; ctx.fillStyle = '#b4c3d8';
      ctx.fillText((battle.stage === 'opening' ? '星环 · 第一阶段' : '下一阶段 · ' + phaseNames[battle.phaseIndex + 1]) + ' / ' + Math.ceil(battle.remaining / 60), 240, 313);
      ctx.textAlign = 'start';
    }
  }
  function frame(now) {
    var started=performance.now();
    if (mode === 'countdown' && now>=countdownUntil) { mode='running'; accumulator=0; last=now; $('overlay').classList.add('hidden'); controls(); }
    if (mode === 'running') {
      accumulator += Math.max(0,now-last); var count=0;
      try {
        while (accumulator>=1000/60 && count<5 && mode==='running') {
          var value=input();
          if (battle) { battle.step(value); sim = battle.sim; } else sim.step(value);
          records.push(value); accumulator-=1000/60; count++;
          if ((battle ? battle.status : sim.status)!=='playing') finish();
        }
        if (mode==='running' && accumulator>=1000/60) pause('画面暂时跟不上，已暂停以保持操作与回放一致。');
      } catch(error) { pause('本局遇到规则错误，请重来。'); setStatus(error.message,true); }
    }
    last=now; draw(); frameTimes.push(performance.now()-started); if(frameTimes.length>300) frameTimes.shift();
    if(now-lastHud>150) { updateHud(); lastHud=now; }
    requestAnimationFrame(frame);
  }
  buttons.forEach(function(button) { button.addEventListener('click',function() {
    scene=button.dataset.scene; buttons.forEach(function(b) { var yes=b===button; b.classList.toggle('selected',yes); b.setAttribute('aria-pressed',String(yes)); }); reset();
  }); });
  $('assist').addEventListener('change',reset); $('start').addEventListener('click',start);
  $('pause').addEventListener('click',function(){if(mode==='paused')start();else pause('手动暂停，确认路线后再继续。');});
  $('restart').addEventListener('click',function(){reset();start();});
  $('slow').addEventListener('click',function(){slowToggle=!slowToggle;controls();canvas.focus({preventScroll:true});});
  $('bomb').addEventListener('pointerdown',function(e){if(mode==='running'){e.preventDefault();bombEdge=true;}});
  $('bomb').addEventListener('click',function(e){if(e.detail===0&&mode==='running')bombEdge=true;});
  document.addEventListener('keydown',function(e){
    if(isEditing(e.target)||!focused()||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.code==='Escape'){e.preventDefault();if(!e.repeat){if(mode==='paused')start();else pause('手动暂停，确认路线后再继续。');}return;}
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyX','Space'].includes(e.code))return;
    e.preventDefault(); if(mode!=='running')return;
    if((e.code==='KeyX'||e.code==='Space')&&!e.repeat)bombEdge=true;
    keys.add(e.code);
  });
  document.addEventListener('keyup',function(e){keys.delete(e.code);});
  document.addEventListener('visibilitychange',function(){if(document.hidden)pause('切到后台，游戏已自动暂停。');});
  window.addEventListener('blur',function(){pause('窗口失去焦点，游戏已自动暂停。');});
  canvas.addEventListener('blur',function(){keys.clear();});
  canvas.addEventListener('pointerdown',function(e){if(mode!=='running'||pointer!==null)return;e.preventDefault();canvas.focus({preventScroll:true});pointer={id:e.pointerId,x:e.clientX,y:e.clientY};target={x:sim.player.x,y:sim.player.y};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',function(e){if(!pointer||pointer.id!==e.pointerId)return;var rect=canvas.getBoundingClientRect();target.x+=Math.trunc((e.clientX-pointer.x)*480/rect.width*64);target.y+=Math.trunc((e.clientY-pointer.y)*640/rect.height*64);target.x=Math.max(12*64,Math.min(468*64,target.x));target.y=Math.max(144*64,Math.min(624*64,target.y));pointer.x=e.clientX;pointer.y=e.clientY;});
  canvas.addEventListener('pointerup',function(e){if(pointer&&pointer.id===e.pointerId){pointer=null;target=null;}});
  canvas.addEventListener('pointercancel',function(){pause('触控已中断，游戏已暂停。');});
  canvas.addEventListener('lostpointercapture',function(e){if(pointer&&pointer.id===e.pointerId)pause('触控已中断，游戏已暂停。');});
  $('export').addEventListener('click',function(){
    if(mode!=='over')return;
    var payload=battle ? DanmakuBattleReplay.encode(records,rules,battle) : DanmakuReplay.encode(records,rules,scene,sim.assist);
    var blob=new Blob([JSON.stringify(payload)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download='danmaku-'+scene+'-'+(battle?battle.tick:sim.tick)+(battle?'-p1.json':'-p0.json');a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
    setStatus('已导出本场回放，可在下方复验或用 PHP 本机重算。');
  });
  $('import').addEventListener('change',async function(){
    pause('准备复验本地回放，当前练习已暂停。');
    var file=this.files[0];if(!file)return;
    try{if(file.size>rules.limits.payloadMaxBytes)throw new Error('回放文件超过大小上限');var payload=JSON.parse(await file.text());var result=payload.battle===true?DanmakuBattleReplay.run(payload,rules,false,false):DanmakuReplay.run(payload,rules,false);$('import-result').textContent='浏览器复验通过：'+(payload.battle?'完整挑战':names[result.snapshot.scene])+' · '+result.snapshot.tick+' 步 · '+result.snapshot.status;$('import-result').classList.remove('error');}
    catch(error){$('import-result').textContent='复验失败：'+error.message;$('import-result').classList.add('error');}
  });
  // Read-only diagnostics for local browser QA; no method can change the simulator.
  window.DanmakuPreview={inspect:function(){return sim?{mode:mode,snapshot:battle?battle.snapshot():sim.snapshot(),records:records.length,frameTimes:frameTimes.slice()}:null;},exportReplay:function(){if(mode!=='over')throw new Error('本场尚未结束');return battle?DanmakuBattleReplay.encode(records,rules,battle):DanmakuReplay.encode(records,rules,scene,sim.assist);}};
  fetch('rules.json',{cache:'no-cache'}).then(function(response){if(!response.ok)throw new Error('规则加载失败');return response.json();}).then(function(data){rules=data;loaded=true;reset();last=performance.now();requestAnimationFrame(frame);}).catch(function(error){setStatus(error.message+'；请使用配套本地预览服务打开。',true);$('overlay-title').textContent='练习场尚未就绪';$('overlay-text').textContent='规则文件未能加载，请按交付说明启动本地预览。';$('start').textContent='暂时无法开始';});
}());
