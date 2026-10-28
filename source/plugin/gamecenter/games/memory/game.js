/**
 * memory — 4×4 翻牌记忆配对，规则版本 1，无外部依赖。
 * 玩法与校验：GPT / Codex。视觉、动效与音效：小蓝。适配 gamecenter（Carinoasd，(C) 2026）。
 */
(function () {
  'use strict';

  var RULE = 2;
  var MAX_ATTEMPTS = 512;
  var REVEAL_MS = 700;

  /* 牌面素材：17 位角色，320×320 WebP，白底，位于 games/memory/assets/
     数组顺序即取用顺序：自由模式取前 8 位，每日挑战取前 15 位 */
  var ART = 'source/plugin/gamecenter/games/memory/assets/';
  var symbols = [
    ['claude', 'claude'],
    ['GPT', 'gpt'],
    ['哥伦比亚', 'columbia'],
    ['deepseek', 'deepseek'],
    ['214', 'chr214'],
    ['春日野穹', 'sora'],
    ['远坂凛', 'rin'],
    ['亚丝娜', 'asuna'],
    ['三月七', 'march7'],
    ['加藤惠', 'kato'],
    ['千早爱音', 'anon'],
    ['和泉纱雾', 'sagiri'],
    ['奥黛塔', 'odette'],
    ['山田杏奈', 'anna'],
    ['木之本樱', 'sakura'],
    ['牧濑红莉栖', 'kurisu'],
    ['长崎素世', 'soyo']
  ];

  /* ---------- 音效：Web Audio 实时合成，不依赖任何音频文件 ---------- */
  var Sfx = (function () {
    var actx = null;
    var on = true;
    try { on = window.localStorage.getItem('gcm_sound') !== '0'; } catch (e) { }

    function ctx() {
      if (!actx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return null; }
        try { actx = new AC(); } catch (e) { return null; }
      }
      if (actx.state === 'suspended' && actx.resume) { actx.resume(); }
      return actx;
    }

    function tone(freq, dur, type, vol, delay) {
      if (!on) { return; }
      var c = ctx();
      if (!c) { return; }
      var t0 = c.currentTime + (delay || 0);
      var osc, gain;
      try {
        osc = c.createOscillator();
        gain = c.createGain();
      } catch (e) { return; }
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    return {
      flip: function () { tone(720, 0.06, 'triangle', 0.07); },
      match: function () { tone(660, 0.1, 'sine', 0.11); tone(990, 0.17, 'sine', 0.09, 0.085); },
      miss: function () { tone(320, 0.09, 'sine', 0.08); tone(214, 0.15, 'sine', 0.07, 0.075); },
      win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.24, 'sine', 0.12, i * 0.1); }); },
      error: function () { tone(200, 0.2, 'sawtooth', 0.06); },
      toggle: function () {
        on = !on;
        try { window.localStorage.setItem('gcm_sound', on ? '1' : '0'); } catch (e) { }
        if (on) { tone(880, 0.09, 'sine', 0.1); }
        return on;
      },
      isOn: function () { return on; },
      unlock: function () { ctx(); }
    };
  })();

  /** 牌面图片（素材为白底方图，铺满卡片）。 */
  function art(key, name) {
    return '<img class="gcm-art" src="' + ART + key + '.webp" alt="' + name + '" width="320" height="320" draggable="false" loading="lazy">';
  }

  /** 与 PHP verifier 完全一致的 Fisher–Yates（Park–Miller）；不挂到全局。 */
  function shuffle(seed, pairs) {
    var cards = [];
    for (var n = 0; n < pairs; n++) { cards.push(n, n); }
    var s = seed;
    for (var i = pairs * 2 - 1; i > 0; i--) {
      s = s * 48271 % 2147483647;
      var j = s % (i + 1);
      var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    return cards;
  }

  GameCenter.register('memory', function (stage, api) {
    /* 模式由平台决定：自由模式 8 对（4×4），每日挑战 15 对（6×5） */
    var DAILY = api.mode === 'daily';
    var PAIRS = DAILY ? 15 : 8;
    /* 15 对在窄屏排 6 列会把牌压得太小，改 5 列（6 行）换取更大的单卡。
       注意：Discuz 手机版模板没有 viewport meta，手机浏览器按 980px 布局渲染，
       所以不能只看 window.innerWidth，要取两者较小值。 */
    var VIEW_W = Math.min(window.innerWidth || 0, document.documentElement.clientWidth || 0) || 980;
    var NARROW = VIEW_W < 1000;
    var COLS = PAIRS > 8 ? (NARROW ? 5 : 6) : 4;
    var ROWS = Math.ceil(PAIRS * 2 / COLS);
    var root = document.createElement('div');
    root.className = 'gcm';
    root.setAttribute('data-mode', DAILY ? 'daily' : 'free');
    root.style.setProperty('--gcm-cols', COLS);
    /* 平台的每日挑战横幅是通用文案（写着「同一张地图」），这里换成牌桌的说法 */
    if (DAILY) {
      var banner = document.querySelector('.gc-banner-daily');
      if (banner) {
        banner.innerHTML = banner.innerHTML
          .replace('同一张地图', '同一副牌')
          .replace('不发每局奖励', '不发每局积分');
      }
    }
    root.innerHTML =
      '<div class="gcm-intro"><span>MEMORY · ' + COLS + ' × ' + ROWS + (DAILY ? ' · 每日挑战' : '') + '</span><p>翻开两张，找到相同的图案。</p></div>' +
      '<div class="gcm-stats">' +
      '<div><span>尝试次数</span><b data-stat="attempts">0</b></div>' +
      '<div><span>已配对</span><b><span data-stat="pairs">0</span><small> / ' + PAIRS + '</small></b></div>' +
      '<div><span>个人最佳</span><b data-stat="best">—</b></div></div>' +
      '<div class="gcm-board"><div class="gcm-grid" role="group" aria-label="' + ROWS + ' 行 ' + COLS + ' 列翻牌区"></div>' +
      '<div class="gcm-cover" hidden><b>游戏已暂停</b><span>牌局和翻牌进度都为你保留。</span>' +
      '<button type="button" class="gc-btn" data-action="resume">继续游戏</button></div></div>' +
      '<p class="gcm-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<div class="gcm-controls"><button type="button" class="gc-btn" data-action="start">开始游戏</button>' +
      '<button type="button" class="gc-btn gc-ghost" data-action="pause" disabled>暂停</button>' +
      '<button type="button" class="gcm-sound" data-action="sound" aria-pressed="true">音效 开</button></div>' +
      '<p class="gcm-note">每翻两张计 1 次，次数越少越好。<br>本游戏不发积分，排行榜仅作展示。</p>';
    stage.appendChild(root);

    var board = root.querySelector('.gcm-board');
    var grid = root.querySelector('.gcm-grid');
    var cover = root.querySelector('.gcm-cover');
    var startButton = root.querySelector('[data-action="start"]');
    var pauseButton = root.querySelector('[data-action="pause"]');
    var soundButton = root.querySelector('[data-action="sound"]');
    var status = root.querySelector('.gcm-status');
    var attemptsEl = root.querySelector('[data-stat="attempts"]');
    var buttons = [];
    var faces = [];
    var info = null;
    var cards = null;
    var matched = [];
    var moves = [];
    var first = -1;
    var second = -1;
    var attempts = 0;
    var pairs = 0;
    var phase = 'ready';
    var manualPause = false;
    var hiddenPause = document.hidden;
    var timer = null;
    var deadline = 0;
    var remaining = REVEAL_MS;
    var submitted = false;
    var message = '准备好了吗？配齐 ' + PAIRS + ' 对图案，看看你需要几次尝试。';
    var back = '<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<g transform="translate(0,3)">' +
      '<path d="M17 10h14l-7 10 7 10H17l7-10z"/>' +
      '<path d="M15 6h18M15 34h18" opacity=".5"/>' +
      '<path d="M22 13h4l-2 4z" fill="currentColor" stroke="none" opacity=".55"/>' +
      '</g></svg>';

    for (var i = 0; i < PAIRS * 2; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'gcm-card';
      button.setAttribute('data-index', i);
      button.innerHTML = '<span class="gcm-inner">' +
        '<span class="gcm-face gcm-back">' + back + '</span>' +
        '<span class="gcm-face gcm-front"></span>' +
        '</span><span class="gcm-check" aria-hidden="true">✓</span>';
      grid.appendChild(button);
      buttons.push(button);
      faces.push(button.querySelector('.gcm-front'));
    }

    function active() { return phase === 'playing' || phase === 'resolving'; }
    function paused() { return manualPause || hiddenPause; }

    function bumpStat(el) {
      if (!el) { return; }
      el.classList.remove('is-bump');
      void el.offsetWidth;
      el.classList.add('is-bump');
    }

    function sparkle() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
      var box = document.createElement('div');
      box.className = 'gcm-burst';
      var colors = ['#4fae86', '#d99a2b', '#e0708a', '#3fa6cf', '#8b7fd4', '#e0b53c'];
      for (var k = 0; k < 28; k++) {
        var p = document.createElement('i');
        p.style.left = (Math.random() * 96 + 2) + '%';
        p.style.background = colors[k % colors.length];
        p.style.animationDelay = (Math.random() * 0.45).toFixed(2) + 's';
        box.appendChild(p);
      }
      board.appendChild(box);
      window.setTimeout(function () { if (box.parentNode) { box.parentNode.removeChild(box); } }, 2300);
    }

    function render() {
      root.setAttribute('data-phase', phase);
      attemptsEl.textContent = attempts;
      root.querySelector('[data-stat="pairs"]').textContent = pairs;
      root.querySelector('[data-stat="best"]').textContent = (function () {
        var v = DAILY ? api.dailyBest : api.best;
        return v == null ? '—' : v;
      })();
      cover.hidden = !(active() && paused());
      pauseButton.disabled = !active() || hiddenPause;
      pauseButton.textContent = manualPause ? '继续' : '暂停';
      startButton.disabled = active() || phase === 'starting' || phase === 'submitting';
      startButton.textContent = phase === 'starting' ? '正在开局…' : (phase === 'submitting' ? '正在提交…' : (info ? '再玩一局' : '开始游戏'));
      status.textContent = active() && paused() ? '已暂停，回来后继续配对。' : message;
      for (var k = 0; k < PAIRS * 2; k++) {
        var open = !!matched[k] || k === first || k === second;
        var disabled = phase !== 'playing' || paused() || !!matched[k] || k === first;
        buttons[k].classList.toggle('is-open', open);
        buttons[k].classList.toggle('is-matched', !!matched[k]);
        buttons[k].setAttribute('aria-disabled', disabled ? 'true' : 'false');
        buttons[k].tabIndex = active() && !matched[k] && !paused() ? 0 : -1;
        buttons[k].setAttribute('aria-label', '第 ' + (k + 1) + ' 张，' +
          (open && cards ? symbols[cards[k]][0] + (matched[k] ? '，已配对' : '') : '未翻开'));
      }
    }

    function stopTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, deadline - performance.now());
      }
    }

    function schedule() {
      if (phase !== 'resolving' || paused() || timer !== null) { return; }
      deadline = performance.now() + remaining;
      timer = window.setTimeout(function () {
        timer = null;
        remaining = 0;
        if (phase !== 'resolving' || paused()) { return; }
        first = second = -1;
        if (attempts >= MAX_ATTEMPTS) {
          phase = 'limit';
          message = '已达到 ' + MAX_ATTEMPTS + ' 次尝试，本局未完成，不记成绩。休息一下，再来一局吧。';
        } else {
          phase = 'playing';
          message = '记住这两张的位置，再试一对。';
        }
        render();
      }, remaining);
    }

    function finish() {
      if (submitted) { return; }
      submitted = true;
      phase = 'submitting';
      message = '全部配对完成，正在提交成绩…';
      render();
      var promise;
      try {
        promise = api.submit(info, { v: RULE, score: attempts, moves: moves.join(','), pairs: PAIRS }, '配对完成');
      } catch (e) {
        promise = Promise.reject(e);
      }
      Promise.resolve(promise).then(function (result) {
        phase = 'finished';
        if (result && result.ok) {
          message = '完成！共用 ' + attempts + ' 次尝试，成绩已记录。';
          Sfx.win();
          sparkle();
        } else if (result && result.guest) {
          message = '试玩完成！共用 ' + attempts + ' 次尝试；登录且有排行权限时才记录成绩。';
          Sfx.win();
          sparkle();
        } else {
          message = '提交未获确认，请查看平台提示或到“我的纪录”核对，再开始新一局。';
          Sfx.error();
        }
        render();
      }).catch(function () {
        phase = 'finished';
        message = '提交未获确认，请到“我的纪录”核对后重新开局。本局不会重复提交。';
        Sfx.error();
        render();
      });
    }

    function flip(index) {
      if (phase !== 'playing' || paused() || matched[index] || index === first) { return; }
      Sfx.unlock();
      moves.push(index);
      if (first < 0) {
        first = index;
        message = '再翻一张，找到相同的图案。';
        Sfx.flip();
      } else {
        second = index;
        attempts++;
        if (cards[first] === cards[second]) {
          matched[first] = matched[second] = true;
          pairs++;
          var wa = first, wb = second;
          first = second = -1;
          Sfx.match();
          bumpStat(attemptsEl);
          bumpStat(root.querySelector('[data-stat="pairs"]'));
          if (pairs === PAIRS) {
            render();
            finish();
            return;
          }
          if (attempts >= MAX_ATTEMPTS) {
            phase = 'limit';
            message = '已达到 ' + MAX_ATTEMPTS + ' 次尝试，本局未完成，不记成绩。休息一下，再来一局吧。';
          } else {
            message = '配对成功！继续寻找下一对。';
          }
        } else {
          phase = 'resolving';
          remaining = REVEAL_MS;
          message = '这次不同，记住它们的位置。';
          Sfx.miss();
          var w1 = first, w2 = second;
          buttons[w1].classList.add('is-wrong');
          buttons[w2].classList.add('is-wrong');
          window.setTimeout(function () {
            if (buttons[w1]) { buttons[w1].classList.remove('is-wrong'); }
            if (buttons[w2]) { buttons[w2].classList.remove('is-wrong'); }
          }, 380);
          schedule();
        }
        bumpStat(attemptsEl);
      }
      render();
    }

    function begin() {
      if (active() || phase === 'starting' || phase === 'submitting' || stage.querySelector('.gc-modal')) { return; }
      Sfx.unlock();
      phase = 'starting';
      message = '正在准备新牌局…';
      render();
      var promise;
      try { promise = api.start(); } catch (e) { promise = Promise.reject(e); }
      Promise.resolve(promise).then(function (result) {
        if (!result) {
          phase = 'ready';
          message = '这次未能开局，请查看平台提示后重试。';
          Sfx.error();
          render();
          return;
        }
        if (!Number.isInteger(result.seed) || result.seed < 1 || result.seed > 2147483646) {
          throw new Error('invalid seed');
        }
        stopTimer();
        info = result;
        cards = shuffle(result.seed, PAIRS);
        matched = cards.map(function () { return false; });
        moves = [];
        attempts = pairs = 0;
        first = second = -1;
        submitted = manualPause = false;
        hiddenPause = document.hidden;
        for (var k = 0; k < PAIRS * 2; k++) {
          faces[k].innerHTML = art(symbols[cards[k]][1], symbols[cards[k]][0]);
          buttons[k].setAttribute('data-symbol', cards[k]);
          buttons[k].classList.remove('is-wrong', 'is-matched', 'is-open');
        }
        phase = 'playing';
        message = result.guest ? '试玩模式：翻开两张牌开始配对，本局不记录成绩。' : '翻开两张牌，开始这一局。';
        render();
      }).catch(function () {
        phase = 'ready';
        message = '暂时无法开始，请稍后重新开局。';
        Sfx.error();
        render();
      });
    }

    function togglePause() {
      if (!active() || hiddenPause) { return; }
      manualPause = !manualPause;
      if (paused()) { stopTimer(); } else { schedule(); }
      render();
    }

    function toggleSound() {
      var on = Sfx.toggle();
      soundButton.textContent = on ? '音效 开' : '音效 关';
      soundButton.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    grid.addEventListener('click', function (event) {
      var card = event.target.closest && event.target.closest('.gcm-card');
      if (card && grid.contains(card)) { flip(+card.getAttribute('data-index')); }
    });
    startButton.addEventListener('click', begin);
    pauseButton.addEventListener('click', togglePause);
    soundButton.addEventListener('click', toggleSound);
    root.querySelector('[data-action="resume"]').addEventListener('click', togglePause);
    document.addEventListener('visibilitychange', function () {
      hiddenPause = document.hidden;
      if (paused()) { stopTimer(); } else { schedule(); }
      render();
    });

    soundButton.textContent = Sfx.isOn() ? '音效 开' : '音效 关';
    soundButton.setAttribute('aria-pressed', Sfx.isOn() ? 'true' : 'false');
    render();
  });
})();
