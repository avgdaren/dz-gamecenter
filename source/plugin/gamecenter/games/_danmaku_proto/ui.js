/* (C) 2026 Carinoasd. One-stage interaction and presentation: 小典 / Codex. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var names = { stage: '星穹回廊', battle: '首领练习', flower: '花瓣星环', aim: '星雨连射', wave: '交错星幕' };
  var phaseNames = DanmakuStageShow.phases;
  var showState=DanmakuStageShow.create();
  function showModel(){return DanmakuStageShow.model(showState,battle,$('low-effects').checked);}
  var lessons = {
    stage: ['收集星光，再迎接观测者。', 'P强化在3点、8点升级火力。两名星仪守卫还会掉B补充大招；最多携带3枚，满库存拾取B转500分。'],
    battle: ['跟随首领，逐阶段突破。', '自动向上射击，跟随首领保持火力。三阶段共享生命和清屏；击破后清场转场，每阶段最多 70 秒。'],
    flower: ['跟随缺口，小步调整。', '花瓣会向四周展开。先看朝下的宽缺口，再按住慢速轻轻调整位置。'],
    aim: ['先让它瞄准，再换位置。', '出现瞄准提示后，连射方向就锁定了。离开原位，给自己留一点移动空间。'],
    wave: ['先看缺口，再穿过波浪。', '敌弹会分成三排依次落下。提前看清空位，避免临近时才横穿整片弹幕。']
  };
  var canvas = $('arena'), ctx = canvas.getContext('2d'), rules, sim, battle = null, scene = 'stage';
  var mode = 'ready', keys = new Set(), records = [], slowToggle = false, bombEdge = false;
  var pointer = null, target = null, last = 0, accumulator = 0, countdownUntil = 0;
  var frameTimes = [], lastHud = 0, pauseReason = '', loaded = false, prepareTicket = 0;
  var buttons = Array.from(document.querySelectorAll('[data-scene]'));
  var savedAudio={};try{savedAudio=JSON.parse(localStorage.getItem('danmaku.audio.v1')||'{}');}catch(error){}
  var soundBank={entries:Object.assign({},(window.DanmakuAudioBank||{entries:{}}).entries,(window.DanmakuBgmBank||{entries:{}}).entries)};
  var sound=new DanmakuAudio.Manager(soundBank,{settings:savedAudio,recordedMusic:!!window.DanmakuBgmBank,musicPlayer:new DanmakuMidi.Player(window.DanmakuMidiBank)});
  function audioState(){
    if(!sim)return null;
    var s=sim.stats,charges=[];
    if(sim.warningUntil>sim.tick)charges.push('boss:'+((battle&&battle.phaseIndex)||0)+':'+sim.warningUntil);
    if(sim.mobs)sim.mobs.forEach(function(m){if(m.warningUntil>sim.tick)charges.push(m.id+':'+m.warningUntil);});
    return{scene:scene,mode:mode,foreground:!document.hidden&&document.hasFocus(),tick:battle?battle.tick:sim.tick,stage:battle?battle.stage:'active',phase:battle?battle.phaseIndex:DanmakuP0.scenes.indexOf(scene),
      battle:!!battle,status:battle?battle.status:sim.status,preludeTicks:rules.stage01.preludeTicks,introTicks:rules.clock.introTicks,
      shots:sim.nextShot,hits:s.shotHits,taken:s.hitsTaken,enemy:s.enemySpawned,graze:s.graze,bombs:s.bombsUsed,kills:s.mobKills||0,
      supply:s.bombCollected||0,elites:s.bombItemsSpawned||0,power:(s.powerCollected||0)+(s.powerRecovered||0),level:isStage()?DanmakuStage01.level(sim.player.power,rules):1,breaks:battle?battle.phaseBreaks:0,charges:charges};
  }
  function audioControls(){
    var a=sound.inspect(),s=a.settings;
    $('audio-music').checked=s.music;$('audio-sfx').checked=s.sfx;$('audio-music-volume').value=Math.round(s.musicVolume*100);$('audio-sfx-volume').value=Math.round(s.sfxVolume*100);
    $('audio-music-value').textContent=Math.round(s.musicVolume*100)+'%';$('audio-sfx-value').textContent=Math.round(s.sfxVolume*100)+'%';
    $('audio-mute').setAttribute('aria-pressed',String(s.muted));$('audio-mute').textContent=s.muted?'取消静音':'静音';
    $('audio-preview').disabled=mode==='running'||mode==='countdown';$('audio-preview').textContent=a.previewing||a.previewPending?'停止试听':'试听6秒';
    var note;
    if(a.errors.length)note=a.errors[a.errors.length-1];
    else if(s.muted)note='声音已静音。';
    else if(!s.music&&!s.sfx)note='声音已关闭。';
    else if(a.previewPending||mode==='preparing'||(mode==='running'&&!a.ready))note='正在准备声音…';
    else if(a.previewing)note='正在试听，点击可停止。';
    else if(mode==='running')note=(s.music?'音乐播放中':'音乐已关闭')+(s.sfx?' · 音效已开启':' · 音效已关闭');
    else if(mode==='countdown')note='准备继续，倒计时后恢复声音。';
    else if(mode==='paused')note='声音已暂停，继续后从本局位置恢复。';
    else if(mode==='over')note=a.musicVoices?'正在播放本局收尾。':'本局声音已收束，可重来或试听。';
    else note=s.sfx?'开始后播放已开启的声音。':'开始后播放音乐；音效默认关闭。';
    $('audio-note').textContent=note;
    $('audio-summary').textContent=s.muted?'已静音':(s.music?'音乐开启':'音乐关闭')+' · '+(s.sfx?'音效开启':'音效关闭');
  }
  function unlockAudio(){var s=sound.settings;if(!s.muted&&(s.music||s.sfx))sound.gesture().then(audioControls);}
  function saveAudio(value){sound.configure(value);try{localStorage.setItem('danmaku.audio.v1',JSON.stringify(sound.settings));}catch(error){}audioControls();}
  audioControls();
  $('low-effects').checked=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var playerImage = new Image(), spriteReady = false, spriteError = '';
  playerImage.onload = function () {
    spriteReady = playerImage.naturalWidth === 192 && playerImage.naturalHeight === 144;
    if (!spriteReady) spriteError = '自机图集尺寸不符';
  };
  playerImage.onerror = function () { spriteError = '自机图集未加载，使用临时轮廓'; };
  playerImage.src = 'assets/player-motion-v1.png';
  var stageImages={},stageArtErrors=[],stageArtState=DanmakuStageArt.createEffects();
  Object.keys(DanmakuStageArt.assets).forEach(function(name){
    var image=new Image(),size=DanmakuStageArt.assets[name];stageImages[name]=image;
    image.onload=function(){if(image.naturalWidth!==size[0]||image.naturalHeight!==size[1])stageArtErrors.push(name+'尺寸不符');};
    image.onerror=function(){stageArtErrors.push(name+'加载失败');};
    image.src=DanmakuStageArt.files[name];
  });
  function stageArtReady(){return Object.keys(DanmakuStageArt.assets).every(function(name){var size=DanmakuStageArt.assets[name],image=stageImages[name];return image.complete&&image.naturalWidth===size[0]&&image.naturalHeight===size[1];});}
  var bossImages={face:$('boss-face')},bossArtErrors=[];
  Object.keys(DanmakuBossView.assets).forEach(function(name){
    var image=bossImages[name]||new Image(),size=DanmakuBossView.assets[name];bossImages[name]=image;
    image.onload=function(){if(image.naturalWidth!==size[0]||image.naturalHeight!==size[1])bossArtErrors.push(name+'尺寸不符');};
    image.onerror=function(){bossArtErrors.push(name+'加载失败');};
    if(name!=='face')image.src=DanmakuBossView.files[name];
  });
  function bossArtReady(){return DanmakuBossView.ready(bossImages);}
  function bossPose(){return sim&&!isPrelude()?DanmakuBossView.frame(sim,battle?battle.tick:sim.tick,$('low-effects').checked,battle?battle.stage:null):null;}
  function isFocused() { return slowToggle || keys.has('ShiftLeft') || keys.has('ShiftRight'); }
  function isStage() { return !!(battle && DanmakuStage01.supportedRules.indexOf(battle.rule)>=0); }
  function isNormal() { return !!(battle&&(battle.rule===DanmakuStage01.normalRule||battle.rule===DanmakuBattle.normalRule)); }
  function difficultyName() { return battle?(isNormal()?'Normal':'Easy'):'弹型练习'; }
  function isBombStage() { return isStage() && sim.bombMode; }
  function isPrelude() { return isStage() && battle.phaseIndex<0; }
  function canAct() { return !battle || battle.stage==='active' || battle.stage==='prelude'; }
  function encodeReplay() { return isStage()?DanmakuStageReplay.encode(records,rules,battle):battle?DanmakuBattleReplay.encode(records,rules,battle):DanmakuReplay.encode(records,rules,scene,sim.assist,sim.rule); }
  function focusControls() {
    var focused = isFocused();
    $('slow').setAttribute('aria-pressed', String(focused));
    $('fire-mode').textContent = (focused ? '低速 · 集中射击' : '普通散射') + (isStage()?' · 火力'+['Ⅰ','Ⅱ','Ⅲ'][DanmakuStage01.level(sim.player.power,rules)-1]:'');
  }
  function setStatus(text, error) { $('status').textContent = text; $('status').classList.toggle('error', !!error); }
  function isEditing(el) { return el && ((typeof el.matches==='function' && el.matches('input,select,textarea')) || el.isContentEditable); }
  function focused() { return document.activeElement === canvas || document.activeElement.closest('.arena-controls'); }
  function clearInput() { keys.clear(); pointer = null; target = null; bombEdge = false; }
  function bombControls() {
    var cooldown=isBombStage()?Math.max(0,sim.bombCooldownUntil-sim.tick):0;
    $('bomb').disabled=mode!=='running'||!sim||sim.player.bombs<=0||!canAct()||cooldown>0;
    $('bomb').innerHTML=isBombStage()?(cooldown>0?'冷却 '+(cooldown/60).toFixed(1)+'s':'大招 <kbd>X</kbd>'):'清屏 <kbd>X</kbd>';
    $('bomb-stock-note').hidden=!isBombStage();
    if(isBombStage())$('bomb-stock-note').textContent='库存 '+sim.player.bombs+' / '+rules.stage01.bomb.stockCap+(mode==='over'?' · 本局结束':sim.player.bombs===0?' · 等待B补给':cooldown>0?' · 冷却中':!canAct()?' · 准备中':' · 已就绪');
  }
  function controls() {
    var active = mode === 'running' || mode === 'paused' || mode === 'countdown';
    buttons.forEach(function (b) { b.disabled = !loaded; });
    $('assist').disabled = active || mode === 'preparing';
    $('difficulty').disabled = active || mode === 'preparing' || !battle;
    $('difficulty-hint').textContent = !battle?'弹型练习沿用基础规则；完整关卡与首领练习可选难度。':isNormal()?'缺口随轮次移动，注意锁定提示和交叉弹。':'较宽缺口，适合熟悉路线。';
    $('pause').disabled = !active;
    $('restart').disabled = !loaded || mode === 'ready';
    $('export').disabled = mode !== 'over';
    $('export').hidden = mode !== 'over';
    $('result-summary').hidden = mode !== 'over' || !battle;
    document.body.dataset.mode=mode;$('overlay').dataset.mode=mode;
    $('run-state').textContent={ready:'准备出发',preparing:'准备声音',running:'飞行中',paused:'已暂停',countdown:'准备继续',over:'本局结束'}[mode]||'';
    bombControls();
    $('pause').innerHTML = mode === 'paused' ? '继续 <kbd>Esc</kbd>' : '暂停 <kbd>Esc</kbd>';
    focusControls();audioControls();
  }
  function overlay(kicker, title, text, button, foot) {
    $('overlay').classList.remove('hidden');
    $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
    $('overlay-text').textContent = text; $('start').textContent = button;
    $('overlay-footnote').textContent = foot || '方向键 / WASD 移动 · Shift 低速集中射击';
    $('start').disabled = false;
  }
  function reset() {
    prepareTicket++;
    clearInput(); records = []; frameTimes = []; accumulator = 0; slowToggle = false;
    stageArtState=DanmakuStageArt.createEffects();
    showState=DanmakuStageShow.create();delete $('overlay').dataset.result;
    var normal=$('difficulty').value==='normal';
    battle = scene === 'stage' ? new DanmakuStage01.Stage(rules,$('assist').checked,normal?DanmakuStage01.normalRule:DanmakuStage01.patternRule) : scene === 'battle' ? new DanmakuBattle.Battle(rules, $('assist').checked,normal?DanmakuBattle.normalRule:DanmakuBattle.patternRule) : null;
    sim = battle ? battle.sim : new DanmakuP0.Sim(rules, scene, $('assist').checked, DanmakuP0.focusRule);
    mode = 'ready';
    sound.reset(audioState());
    overlay((battle?difficultyName()+' / ':'')+(isStage()?'第一关 / ':battle ? '三阶段 / ' : '弹型练习 / ') + names[scene],
      names[scene], isStage()?'穿过72秒回廊，迎接星环观测者。\n拾取P强化，B补充大招。':battle ? '星环 → 星雨 → 星幕\n跟随首领输出，善用清屏。' : '自动射击已经就绪。\n移动躲弹，试着坚持45秒。', isStage()?'开始第一关':battle?'开始首领练习':'开始弹型练习');
    $('selected-mode').textContent=(battle?difficultyName()+' · ':'')+names[scene];$('result-breakdown').open=false;
    document.querySelector('.intro .eyebrow').textContent=isStage()?'第一关 · 星穹回廊':'专项练习 · '+names[scene];
    document.querySelector('.intro h1').textContent=isStage()?'循着星光，抵达观测台。':lessons[scene][0];
    document.querySelector('.route-note').textContent=isStage()?'72秒道中 → 三阶段Boss':battle?'三阶段首领 · 固定火力':'45秒弹型练习';
    $('arena-name').textContent = names[scene];
    $('lesson-title').textContent = lessons[scene][0]; $('lesson-text').textContent = lessons[scene][1];
    $('mode-label').textContent = difficultyName()+' · '+(sim.assist?'辅助练习':'标准');
    $('boss-health').hidden = !battle; $('score-metric').hidden = !battle; $('score-details').hidden = true;
    $('power-metric').hidden=!isStage();
    $('low-effects-row').hidden=!isStage()&&!battle;$('bomb-resource-title').textContent=isBombStage()?'大招库存':'清屏次数';
    $('bomb-rule-title').textContent=isBombStage()?'星翼绽放':'清屏是一次喘息。';
    $('bomb-rule-text').innerHTML=isBombStage()?'X / 空格：全屏伤害，持续清弹1.5秒，护身2秒。<br>最多携带3枚；击破星仪守卫获得B，满库存转500分。':'清除当前敌弹，并短暂无敌。<br>没有清屏时，先找宽一点的路线。';
    setStatus(isStage()?'72秒回廊后迎战观测者；收集P提升火力。':battle ? '每阶段最多 70 秒；结束后可导出本局回放。' : '每场最多 45 秒，结束后可导出回放。'); controls(); updateHud();
  }
  function start() {
    if(!loaded||mode==='countdown'||mode==='preparing'||mode==='running')return;
    if(mode==='over')reset();
    var s=sound.settings;
    if(window.DanmakuBgmBank&&!sound.ready&&!s.muted&&(s.music||s.sfx)){
      var ticket=++prepareTicket,prior=mode;mode='preparing';clearInput();accumulator=0;sound.reset(audioState());
      overlay('准备 / '+names[scene],'正在准备声音','首次加载完成后开始，不会消耗关卡时间。','准备中…');
      $('start').disabled=true;setStatus('正在准备声音，请稍等。');controls();
      sound.gesture().then(function(){
        // AudioBuffer delivery can create a long task. Start with a fresh frame
        // timestamp after decoding, keeping the existing replay guard intact.
        requestAnimationFrame(function(){
          if(ticket!==prepareTicket||mode!=='preparing')return;
          if(document.hidden||!document.hasFocus()){mode='countdown';pause('声音已就绪，点击继续开始。');return;}
          mode=prior;begin();
        });
      });
      return;
    }
    begin();
  }
  function begin() {
    if (!loaded || mode === 'countdown') return;
    if (mode === 'over') reset();
    clearInput(); accumulator = 0; last = performance.now();
    if (mode === 'paused') {
      mode = 'countdown'; countdownUntil = performance.now() + 1500;
      $('start').disabled = true; $('overlay-title').textContent = '准备继续';
      $('overlay-text').textContent = '稍等片刻，重新看清路线。'; controls();
    } else { mode = 'running'; $('overlay').classList.add('hidden'); setStatus(isStage()?'回廊航行中；收集P提升火力。':'挑战进行中；按Esc可暂停。'); controls(); }
    sound.update(audioState());unlockAudio();
    canvas.focus({ preventScroll: true });
  }
  function pause(reason) {
    if (mode !== 'running' && mode !== 'countdown') return;
    mode = 'paused'; clearInput(); accumulator = 0; pauseReason = reason || '游戏已暂停';
    sound.pause();
    overlay('暂停 / ' + names[scene], '先歇一下，星幕会等你。', pauseReason, battle ? '继续挑战' : '继续练习', '点击继续后，倒计时再恢复');
    setStatus(pauseReason); controls(); updateHud();
  }
  function finish() {
    mode = 'over'; clearInput();
    sound.update(audioState());
    if (battle) {
      var parts = battle.score(), clear = battle.status === 'clear';
      $('overlay').dataset.result=clear?'clear':'failed';
      overlay('挑战结束 / ' + (sim.assist ? '辅助练习' : '标准挑战'),
        clear ? '星穹已明，回廊贯通。' : (battle.status === 'timeout' ? '阶段时间已到。' : '调整路线，再试一次。'),
        clear ? (isStage()?'回廊与三重星幕，已全部突破。':'三阶段首领已突破。') : '保留这次经验，下一局重新出发。',
        '再挑战一次', '保存回放后，可在下方重新核对');
      $('result-score').textContent=parts.total.toLocaleString('zh-CN');
      $('result-time').textContent=(battle.tick/60).toFixed(1)+' 秒';$('result-phases').textContent=battle.phaseBreaks+' / 3';$('result-graze').textContent=sim.stats.graze;
      $('score-details').hidden = false;
      $('score-details').textContent = '通关 ' + parts.clear + ' · 阶段击破 ' + parts.phase + '\n伤害 ' + parts.damage + ' · 擦弹 ' + parts.graze + '\n资源 ' + parts.resources + ' · 时间 ' + parts.time + (isStage()?'\n小怪得分 '+parts.mobs+' · 满级强化 '+parts.overflow+'\n击破小怪 '+sim.stats.mobKills+' / 40':'')+(isBombStage()?'\n大招补给溢出 '+parts.bombOverflow:'');
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
    var slow = isFocused();
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
    $('boss-face').hidden=!battle||isPrelude();
    var remainingTicks = battle ? (battle.stage === 'active' ? rules.clock.phaseMaxTicks - sim.tick : battle.remaining) : 2700 - sim.tick;
    if (isPrelude()) remainingTicks=Math.max(0,rules.stage01.preludeTicks-sim.tick);
    else if (battle && battle.stage === 'over') remainingTicks = Math.max(0, rules.clock.phaseMaxTicks - sim.tick);
    var ended=mode==='over';
    $('clock').innerHTML = ((ended?(battle?battle.tick:sim.tick):remainingTicks) / 60).toFixed(1) + '<small> 秒</small>';
    $('clock-label').textContent=ended?'本局用时':isPrelude()?'道中剩余':battle&&battle.stage==='opening'?'登场':battle&&battle.stage==='transition'?'转场':'阶段剩余';
    if (battle) {
      $('phase-progress').textContent = isPrelude()?'第一关 · '+DanmakuStage01.segment(rules,sim.tick):battle.stage === 'opening' ? '观测台 · 准备迎战' : (battle.stage === 'transition' ? '阶段突破 → ' + phaseNames[isStage()?battle.phaseIndex:battle.phaseIndex+1] : phaseNames[battle.phaseIndex] + ' · 第 ' + (battle.phaseIndex + 1) + ' / 3 阶段');
      var hpMax = isPrelude()?rules.stage01.preludeTicks:rules.boss.phaseHP[battle.phaseIndex];
      $('hp-value').textContent = isPrelude()?Math.round(sim.tick / hpMax * 100)+'%':sim.hp + ' / ' + hpMax;
      $('hp-fill').style.width = Math.max(0,(isPrelude()?sim.tick:sim.hp) / hpMax * 100) + '%';
      $('boss-health').dataset.kind=isPrelude()?'route':'boss';
      $('stage-progress').setAttribute('aria-label',isPrelude()?'道中进度':'首领生命');
      $('stage-progress').setAttribute('aria-valuemax',hpMax);$('stage-progress').setAttribute('aria-valuenow',Math.max(0,Math.min(hpMax,isPrelude()?sim.tick:sim.hp)));
      $('stage-progress').setAttribute('aria-valuetext',isPrelude()?(sim.tick/60).toFixed(1)+' / 72 秒':sim.hp+' / '+hpMax);
      $('score').textContent = battle.score().total.toLocaleString('zh-CN');
    }
    $('lives').textContent = sim.player.lives ? Array(sim.player.lives).fill('◆').join(' ') : '—';
    $('bombs').textContent = sim.player.bombs ? Array(sim.player.bombs).fill('✦').join(' ') : '—';
    $('lives').setAttribute('aria-label','剩余'+sim.player.lives+'条生命');$('bombs').setAttribute('aria-label','库存'+sim.player.bombs+'枚'+(isBombStage()?'大招':'清屏'));
    $('shot-hits').textContent = sim.stats.shotHits; $('graze').textContent = sim.stats.graze;
    audioControls();
    bombControls();
    if(isStage()){
      var power=sim.player.power,lv=DanmakuStage01.level(power,rules),next=rules.stage01.growth.thresholds[lv];
      $('power-value').textContent=['Ⅰ','Ⅱ','Ⅲ'][lv-1]+' · '+(lv===3?'MAX':power+' / '+next);
      $('power-note').textContent=lv===3?'额外强化转分；捡回的强化不额外计分':'收集P强化；Shift也可吸取附近道具';
      $('power-progress').max=lv===3?Math.max(1,power):next;$('power-progress').value=power;
      $('power-progress').textContent=lv===3?'最高火力':power+' / '+next;
      focusControls();
    }
    var sorted = frameTimes.slice().sort(function (a,b) { return a-b; });
    var p95 = sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1].toFixed(2) : '—';
    $('diagnostic-text').textContent = '规则 ' + (battle ? battle.rule : sim.rule) + '\n逻辑 ' + (battle ? battle.tick + ' / '+(isStage()?rules.stage01.maxTicks:13200) : sim.tick + ' / 2700') + ' 步 · ' + mode +
      '\n当前敌弹 ' + sim.enemies.length + ' · 峰值 ' + sim.stats.enemyPeak + '\n有效伤害 ' + sim.stats.damage +
      ' · 受击 ' + sim.stats.hitsTaken + '\n自机素材 ' + (spriteReady ? '已加载' : spriteError || '加载中') +
      (isStage()?'\n关卡素材 '+(stageArtReady()?'已加载':stageArtErrors.join(' / ')||'加载中'):'')+
      '\n首领素材 '+(bossArtReady()?'已加载':bossArtErrors.join(' / ')||'加载中')+
      '\n最近 300 帧绘制与更新耗时 p95 ' + p95 + ' ms（不是显示帧间隔）';
  }
  function circle(x,y,r,fill,stroke) {
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); if (fill) { ctx.fillStyle=fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle=stroke; ctx.stroke(); }
  }
  function showCue(m){
    var active=mode==='running'||mode==='paused'||mode==='countdown';
    var intro=$('boss-intro'),cue=$('phase-cue'),reduced=$('low-effects').checked;
    intro.hidden=!active||m.kind!=='intro';cue.hidden=!active||m.kind!=='phase';
    if(!intro.hidden){
      intro.style.opacity=m.opacity;
      $('boss-portrait').style.transform='translateX('+(reduced?0:18*(1-Math.min(1,m.progress*4)))+'px)';
      intro.querySelector('.boss-intro-copy').style.transform='translateX('+(reduced?0:-12*(1-Math.min(1,m.progress*4)))+'px)';
    }
    if(!cue.hidden){
      cue.style.opacity=m.opacity;cue.style.transform='translateY('+(reduced?0:6*(1-Math.min(1,m.progress*4)))+'px)';
      $('phase-cue-title').textContent=m.title;$('phase-cue-count').textContent=['Ⅰ','Ⅱ','Ⅲ'][m.phase]+' / Ⅲ';
    }
  }
  function draw() {
    ctx.clearRect(0,0,480,640);
    var gradient=ctx.createLinearGradient(0,0,0,640); gradient.addColorStop(0,'#111e35'); gradient.addColorStop(1,'#091321');
    ctx.fillStyle=gradient; ctx.fillRect(0,0,480,640);
    var painted=isStage()&&DanmakuStageArt.background(ctx,stageImages.corridor,battle.tick,$('low-effects').checked);
    if(!painted){
    ctx.lineWidth=1;
    for (var i=0;i<48;i++) { ctx.globalAlpha=.15+(i%4)*.12; circle((i*137+19)%480,(i*193+31)%640,i%7===0?1.2:.6,'#c4d8f5'); }
    ctx.globalAlpha=1;
    ctx.strokeStyle='#223149'; ctx.beginPath(); ctx.moveTo(22,144); ctx.lineTo(458,144); ctx.stroke();
    }
    ctx.font='9px "Microsoft YaHei",sans-serif'; ctx.fillStyle='#7185a0'; ctx.fillText((isPrelude()?'星穹回廊 / '+DanmakuStage01.segment(rules,sim?sim.tick:0):battle ? '首领 / ' + phaseNames[battle.phaseIndex] : '星幕练习 / ' + names[scene]),22,26);
    if (!sim) return;
    var show=showModel();showCue(show);
    var b=sim.boss, p=sim.player;
    if (sim.tick < sim.warningUntil && (!battle || battle.stage === 'active')) {
      var v=rules.directionVectors[sim.aimAngle]; ctx.strokeStyle='#efbf83'; ctx.setLineDash([6,8]);
      ctx.beginPath(); ctx.moveTo(b.x/64,b.y/64); ctx.lineTo(b.x/64+v[0],b.y/64+v[1]); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle='#efbf83'; ctx.fillText('瞄准已锁定',b.x/64-28,b.y/64-45);
    }
    if(!isPrelude()&&!DanmakuBossView.sprite(ctx,bossImages,sim,battle?battle.tick:sim.tick,$('low-effects').checked,battle?battle.stage:null,show)){
    circle(b.x/64,b.y/64,37,null,'#3c4b66');
    ctx.save(); ctx.translate(b.x/64,b.y/64); ctx.rotate(Math.PI/4); ctx.fillStyle='#273d58'; ctx.strokeStyle='#d7bc89';
    ctx.fillRect(-20,-20,40,40); ctx.strokeRect(-20,-20,40,40); ctx.restore();
    circle(b.x/64,b.y/64,10,'#e2c38a'); circle(b.x/64,b.y/64,4,'#fff0cd');
    }
    DanmakuStageShow.effects(ctx,show,$('low-effects').checked);
    if(isStage()){DanmakuStageArt.effects(ctx,sim,stageArtState,$('low-effects').checked);DanmakuStageView.field(ctx,sim,stageImages,$('low-effects').checked);}
    sim.shots.forEach(function(s) {
      ctx.save(); ctx.translate(s.x/64,s.y/64);
      if (s.vx) ctx.rotate(Math.atan2(s.vx, -s.vy));
      ctx.fillStyle=s.focused?'#d9f8ff':'#8ec6e8'; ctx.fillRect(-1.5,-6,3,12);
      if(s.focused){ctx.fillStyle='#fff4c9';ctx.fillRect(-.5,-5,1,8);}
      ctx.restore();
    });
    var visualTick=sim.tick+(!isStage() && battle && battle.stage==='transition' ? rules.clock.transitionTicks-battle.remaining : 0);
    var invulnerable=visualTick<p.invulUntil;
    if (invulnerable) circle(p.x/64,p.y/64,23,null,'#d7d6a5');
    if (!invulnerable || sim.tick%12<8) {
      if(spriteReady) DanmakuPlayerView.sprite(ctx,playerImage,p,battle?battle.tick:sim.tick);
      else {
        ctx.fillStyle='#a7dbed'; ctx.strokeStyle='#eff8ff'; ctx.beginPath(); ctx.moveTo(p.x/64,p.y/64-13);
        ctx.lineTo(p.x/64+11,p.y/64+9); ctx.lineTo(p.x/64,p.y/64+4); ctx.lineTo(p.x/64-11,p.y/64+9); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if(isStage())DanmakuStageView.feedback(ctx,sim);
    // Enemy bullets stay readable above the larger character silhouette.
    sim.enemies.forEach(function(e) {
      if(sim.patternV3&&!isPrelude()){DanmakuBossPatterns.bullet(ctx,e,sim.index);return;}
      var color=e.radius===5?'#efbcbb':e.radius===4?'#e9c47c':'#a7baef';
      if(e.kind===1){ctx.fillStyle='#d1b9f0';ctx.fillRect(e.x/64-4,e.y/64-6,8,12);}
      else if (e.radius===6 || e.kind===2) {
        var diamondRadius=e.radius*Math.SQRT2;
        ctx.fillStyle=color; ctx.strokeStyle='#e3eaff'; ctx.beginPath();
        ctx.moveTo(e.x/64,e.y/64-diamondRadius);ctx.lineTo(e.x/64+diamondRadius,e.y/64);ctx.lineTo(e.x/64,e.y/64+diamondRadius);ctx.lineTo(e.x/64-diamondRadius,e.y/64);ctx.closePath();ctx.fill();ctx.stroke();
      } else { circle(e.x/64,e.y/64,e.radius,color,'#fff0e2'); circle(e.x/64,e.y/64,1.3,'#6b4b68'); }
    });
    if (!isBombStage()&&visualTick-sim.lastBomb<18) { ctx.globalAlpha=Math.max(0,.18*(1-(visualTick-sim.lastBomb)/18)); ctx.fillStyle='#aedee9'; ctx.fillRect(0,0,480,640); ctx.globalAlpha=1; }
    if (visualTick-sim.lastHit<16) { ctx.strokeStyle='#f29e9e'; ctx.lineWidth=3; ctx.strokeRect(2,2,476,636); ctx.lineWidth=1; }
    if(isBombStage())DanmakuStageView.bomb(ctx,sim,$('low-effects').checked);
    // Focus marker is independent of sprite blinking and remains above all effects.
    DanmakuPlayerView.hitpoint(ctx,p,isFocused());
  }
  function frame(now) {
    var started=performance.now();
    if(mode==='over')DanmakuStageShow.ending(showState,now-last,!document.hidden&&document.hasFocus(),$('low-effects').checked);
    if (mode === 'countdown' && now>=countdownUntil) { mode='running'; accumulator=0; last=now; pauseReason=''; $('overlay').classList.add('hidden'); setStatus('已继续；按住 Shift 可低速集中射击。'); controls(); }
    if (mode === 'running') {
      accumulator += Math.max(0,now-last); var count=0;
      try {
        while (accumulator>=1000/60 && count<5 && mode==='running') {
          var value=input();
          if (battle) {
            var previous={stage:battle.stage,x:sim.boss.x,y:sim.boss.y};
            battle.step(value);sim=battle.sim;DanmakuStageShow.observe(showState,battle,previous);
          } else sim.step(value);
          records.push(value); accumulator-=1000/60; count++;
          sound.update(audioState());
          if ((battle ? battle.status : sim.status)!=='playing') finish();
        }
        if (mode==='running' && accumulator>=1000/60) pause('画面暂时跟不上，已暂停以保持操作与回放一致。');
      } catch(error) { pause('本局遇到规则错误，请重来。'); setStatus(error.message,true); }
    }
    last=now; draw(); frameTimes.push(performance.now()-started); if(frameTimes.length>300) frameTimes.shift();
    if(now-lastHud>150) { updateHud(); lastHud=now; }
    if(sim)sound.update(audioState());
    requestAnimationFrame(frame);
  }
  buttons.forEach(function(button) { button.addEventListener('click',function() {
    scene=button.dataset.scene; buttons.forEach(function(b) { var yes=b===button; b.classList.toggle('selected',yes); b.setAttribute('aria-pressed',String(yes)); }); reset();
  }); });
  $('assist').addEventListener('change',reset); $('difficulty').addEventListener('change',reset); $('start').addEventListener('click',start);
  $('low-effects').addEventListener('change',function(){canvas.focus({preventScroll:true});});
  function pauseForAudio(){if(mode==='running'||mode==='countdown')pause('调整声音，游戏已暂停。');}
  $('audio-settings').addEventListener('pointerdown',pauseForAudio);$('audio-settings').addEventListener('focusin',pauseForAudio);
  ['practice-settings','help-settings','replay-tools'].forEach(function(id){
    function pauseForPanel(){if(mode==='running'||mode==='countdown')pause('查看设置与提示，游戏已暂停。');}
    $(id).addEventListener('pointerdown',pauseForPanel);$(id).addEventListener('focusin',pauseForPanel);
  });
  $('audio-music').addEventListener('change',function(){saveAudio({music:this.checked});unlockAudio();});
  $('audio-sfx').addEventListener('change',function(){saveAudio({sfx:this.checked});unlockAudio();});
  $('audio-music-volume').addEventListener('input',function(){saveAudio({musicVolume:Number(this.value)/100});});
  $('audio-sfx-volume').addEventListener('input',function(){saveAudio({sfxVolume:Number(this.value)/100});});
  $('audio-mute').addEventListener('click',function(){saveAudio({muted:!sound.settings.muted});if(!sound.settings.muted)unlockAudio();});
  $('audio-preview').addEventListener('click',function(){sound.preview().then(audioControls);audioControls();});
  $('pause').addEventListener('click',function(){if(mode==='paused')start();else pause('手动暂停，确认路线后再继续。');});
  $('restart').addEventListener('click',function(){reset();start();});
  $('slow').addEventListener('click',function(){slowToggle=!slowToggle;controls();sound.menu();canvas.focus({preventScroll:true});});
  $('bomb').addEventListener('pointerdown',function(e){if(mode==='running'){e.preventDefault();bombEdge=true;}});
  $('bomb').addEventListener('click',function(e){if(e.detail===0&&mode==='running')bombEdge=true;});
  document.addEventListener('keydown',function(e){
    if(isEditing(e.target)||!focused()||e.ctrlKey||e.altKey||e.metaKey)return;
    if(e.code==='Escape'){e.preventDefault();if(!e.repeat){if(mode==='paused')start();else pause('手动暂停，确认路线后再继续。');}return;}
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyX','Space'].includes(e.code))return;
    e.preventDefault(); if(mode!=='running')return;
    if((e.code==='KeyX'||e.code==='Space')&&!e.repeat)bombEdge=true;
    keys.add(e.code);
    if(e.code==='ShiftLeft'||e.code==='ShiftRight')focusControls();
  });
  document.addEventListener('keyup',function(e){keys.delete(e.code);if(e.code==='ShiftLeft'||e.code==='ShiftRight')focusControls();});
  document.addEventListener('visibilitychange',function(){if(document.hidden){sound.pause();pause('切到后台，游戏已自动暂停。');}});
  window.addEventListener('blur',function(){sound.pause();pause('窗口失去焦点，游戏已自动暂停。');});
  canvas.addEventListener('blur',function(){keys.clear();focusControls();});
  canvas.addEventListener('pointerdown',function(e){if(mode!=='running'||pointer!==null)return;e.preventDefault();canvas.focus({preventScroll:true});pointer={id:e.pointerId,x:e.clientX,y:e.clientY};target={x:sim.player.x,y:sim.player.y};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',function(e){if(!pointer||pointer.id!==e.pointerId)return;var rect=canvas.getBoundingClientRect();target.x+=Math.trunc((e.clientX-pointer.x)*480/rect.width*64);target.y+=Math.trunc((e.clientY-pointer.y)*640/rect.height*64);target.x=Math.max(12*64,Math.min(468*64,target.x));target.y=Math.max(144*64,Math.min(624*64,target.y));pointer.x=e.clientX;pointer.y=e.clientY;});
  canvas.addEventListener('pointerup',function(e){if(pointer&&pointer.id===e.pointerId){pointer=null;target=null;}});
  canvas.addEventListener('pointercancel',function(){pause('触控已中断，游戏已暂停。');});
  canvas.addEventListener('lostpointercapture',function(e){if(pointer&&pointer.id===e.pointerId)pause('触控已中断，游戏已暂停。');});
  $('export').addEventListener('click',function(){
    if(mode!=='over')return;
    var payload=encodeReplay();
    var blob=new Blob([JSON.stringify(payload)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download='danmaku-'+(battle?difficultyName().toLowerCase()+'-':'')+scene+'-'+(battle?battle.tick:sim.tick)+(isStage()?'-stage01.json':battle?'-p1.json':'-p0.json');a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
    setStatus('已导出本场回放，可在下方复验或用 PHP 本机重算。');
  });
  $('import').addEventListener('change',async function(){
    pause('准备复验本地回放，当前练习已暂停。');
    var file=this.files[0];if(!file)return;
    try{if(file.size>rules.limits.payloadMaxBytes)throw new Error('回放文件超过大小上限');var payload=JSON.parse(await file.text());var result=payload.stage===true?DanmakuStageReplay.run(payload,rules,false,false):payload.battle===true?DanmakuBattleReplay.run(payload,rules,false,false):DanmakuReplay.run(payload,rules,false);$('import-result').textContent='浏览器复验通过：'+(payload.stage?'星穹回廊':payload.battle?'首领练习':names[result.snapshot.scene])+' · '+result.snapshot.tick+' 步 · '+result.snapshot.status;$('import-result').classList.remove('error');}
    catch(error){$('import-result').textContent='复验失败：'+error.message;$('import-result').classList.add('error');}
  });
  // Read-only diagnostics for local browser QA; no method can change the simulator.
  window.DanmakuPreview={inspect:function(){return sim?{mode:mode,rule:battle?battle.rule:sim.rule,focused:isFocused(),hitpointVisible:isFocused(),spriteReady:spriteReady,stageArtReady:stageArtReady(),stageArtErrors:stageArtErrors.slice(),bossArtReady:bossArtReady(),bossArtErrors:bossArtErrors.slice(),bossPose:bossPose(),presentationReady:$('boss-portrait').complete&&$('boss-portrait').naturalWidth===1134&&$('boss-portrait').naturalHeight===1387,presentation:showModel(),stageCamera:isStage()?DanmakuStageArt.camera(battle.tick,$('low-effects').checked):null,audio:sound.inspect(),snapshot:battle?battle.snapshot():sim.snapshot(),records:records.length,frameTimes:frameTimes.slice()}:null;},exportReplay:function(){if(mode!=='over')throw new Error('本场尚未结束');return encodeReplay();}};
  // Classic-script rules also work under file://; PHP still reads canonical rules.json.
  var rulesReady = window.DanmakuRules ? Promise.resolve(window.DanmakuRules) :
    fetch('rules.json',{cache:'no-cache'}).then(function(response){if(!response.ok)throw new Error('规则加载失败');return response.json();});
  rulesReady.then(function(data){rules=data;loaded=true;reset();last=performance.now();requestAnimationFrame(frame);}).catch(function(error){setStatus('启动失败：'+error.message,true);$('overlay-title').textContent='练习场尚未就绪';$('overlay-text').textContent='预览文件可能不完整。请打开单文件试玩版，或重新解压完整交付包。';$('start').textContent='暂时无法开始';});
}());
