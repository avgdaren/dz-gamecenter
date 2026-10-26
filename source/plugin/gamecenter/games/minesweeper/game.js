/**
 * minesweeper — 16×16 / 40 雷，规则版本 1，无外部依赖。
 * 玩法、校验与视觉：小蓝。适配 gamecenter（原作者 Carinoasd，(C) 2026）。
 *
 * 盘面完全由「开局种子 + 首个点开的格子」决定（Park–Miller），
 * verify.php 用同一套算法重算；提交时只送翻开的格子，由服务端核对是否恰好是全部安全格。
 */
(function () {
  'use strict';

  var RULE = 1;
  var W = 16;
  var H = 16;
  var MINES = 40;
  var CELLS = W * H;
  var SAFE = CELLS - MINES;
  var LONG_PRESS = 420;

  var NB = [];
  for (var n = 0; n < CELLS; n++) {
    var x0 = n % W, y0 = (n - x0) / W, list = [];
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) { continue; }
        var x = x0 + dx, y = y0 + dy;
        if (x >= 0 && y >= 0 && x < W && y < H) { list.push(y * W + x); }
      }
    }
    NB.push(list);
  }

  /* ---------- 音效：Web Audio 实时合成（偏好与 memory 共用 gcm_sound） ---------- */
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
      try { osc = c.createOscillator(); gain = c.createGain(); } catch (e) { return; }
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    return {
      dig: function () { tone(540, 0.045, 'triangle', 0.05); },
      sweep: function () { tone(300, 0.07, 'sine', 0.05); },
      flag: function () { tone(880, 0.055, 'triangle', 0.06); tone(1240, 0.05, 'sine', 0.035, 0.04); },
      unflag: function () { tone(660, 0.05, 'triangle', 0.045); },
      chord: function () { tone(720, 0.05, 'sine', 0.05); tone(960, 0.07, 'sine', 0.05, 0.05); },
      win: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0.22, 'sine', 0.1, i * 0.09); }); },
      lose: function () { tone(240, 0.16, 'sawtooth', 0.055); tone(168, 0.3, 'sawtooth', 0.05, 0.12); },
      toggle: function () {
        on = !on;
        try { window.localStorage.setItem('gcm_sound', on ? '1' : '0'); } catch (e) { }
        if (on) { tone(880, 0.08, 'sine', 0.09); }
        return on;
      },
      isOn: function () { return on; },
      unlock: function () { ctx(); }
    };
  })();

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  /** 秒表显示：12.34 / 1:02.34 */
  function fmt(ms) {
    var t = Math.max(0, ms) / 1000;
    if (t < 60) { return t.toFixed(2); }
    var m = Math.floor(t / 60);
    return m + ':' + (t - m * 60).toFixed(2).replace(/^(\d)\./, '0$1.');
  }

  function fmtLong(ms) {
    var t = Math.max(0, ms) / 1000;
    if (t < 60) { return t.toFixed(2) + ' 秒'; }
    return Math.floor(t / 60) + ' 分 ' + (t % 60).toFixed(2) + ' 秒';
  }

  /** 与 verify.php 完全一致的盘面：种子 + 首个点开的格子。不挂到全局。 */
  function makeBoard(seed, first) {
    var idx = [];
    for (var i = 0; i < CELLS; i++) { idx.push(i); }
    var s = seed;
    for (i = 0; i < MINES; i++) {
      s = s * 48271 % 2147483647;
      var j = i + s % (CELLS - i);
      var swap = idx[i]; idx[i] = idx[j]; idx[j] = swap;
    }
    var mine = new Uint8Array(CELLS);
    for (i = 0; i < MINES; i++) { mine[idx[i]] = 1; }

    // 首点周围九格清空：把落在九宫格里的雷按同一随机流挪到九宫格外的空格
    var fx = first % W, fy = (first - fx) / W;
    var guard = {};
    for (var gy = -1; gy <= 1; gy++) {
      for (var gx = -1; gx <= 1; gx++) {
        var gxx = fx + gx, gyy = fy + gy;
        if (gxx >= 0 && gyy >= 0 && gxx < W && gyy < H) { guard[gyy * W + gxx] = 1; }
      }
    }
    var hit = false;
    for (i = 0; i < MINES; i++) { if (guard[idx[i]]) { hit = true; break; } }
    if (hit) {
      var free = [];
      for (i = 0; i < CELLS; i++) { if (!mine[i] && !guard[i]) { free.push(i); } }
      for (i = 0; i < MINES; i++) {
        var k = idx[i];
        if (!guard[k]) { continue; }
        s = s * 48271 % 2147483647;
        var p = s % free.length;
        var to = free[p];
        free[p] = free[free.length - 1];
        free.pop();
        mine[k] = 0;
        mine[to] = 1;
      }
    }

    var count = new Uint8Array(CELLS);
    for (i = 0; i < CELLS; i++) {
      if (mine[i]) { continue; }
      var c = 0;
      for (var q = 0; q < NB[i].length; q++) { if (mine[NB[i][q]]) { c++; } }
      count[i] = c;
    }
    return { mine: mine, count: count };
  }

  var FLAG_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 20.2V6.2" stroke="#9a7431" stroke-width="2.1" stroke-linecap="round"/><path d="M9.2 6.6h8l-2.5 3.5 2.5 3.5h-8z" fill="#c8564f"/></svg>';
  var MINE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#2c3746"/><path d="M12 3.4v3.4M12 17.2v3.4M3.4 12h3.4M17.2 12h3.4M5.9 5.9l2.4 2.4M15.7 15.7l2.4 2.4M18.1 5.9l-2.4 2.4M8.3 15.7l-2.4 2.4" stroke="#2c3746" stroke-width="1.7" stroke-linecap="round"/></svg>';

  GameCenter.register('minesweeper', function (stage, api) {
    var root = document.createElement('div');
    root.className = 'msw';
    root.setAttribute('data-phase', 'ready');
    root.innerHTML =
      '<div class="msw-head"><div class="msw-brand"><b>天使扫雷</b><span>ANGEL MINESWEEPER</span></div>' +
      '<div class="msw-fixed">固定盘 · 16 × 16 / 40 雷</div></div>' +
      '<div class="msw-hud">' +
      '<div><span>用时</span><b data-hud="time">0.00</b></div>' +
      '<div><span>剩余雷数</span><b data-hud="left">—</b></div>' +
      '<div><span>个人最佳</span><b data-hud="best">—</b></div></div>' +
      '<div class="msw-board"><div class="msw-grid" role="grid" aria-label="16 行 16 列扫雷棋盘"></div></div>' +
      '<div class="msw-over" hidden><div class="msw-over-txt"><b data-over="title"></b><span data-over="text"></span></div>' +
      '<button type="button" class="gc-btn msw-again" data-action="again">再来一局</button></div>' +
      '<p class="msw-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<div class="msw-tools">' +
      '<button type="button" class="gc-btn msw-btn" data-action="restart">重新开局</button>' +
      '<button type="button" class="msw-chip" data-action="mode" aria-pressed="false">插旗模式 关</button>' +
      '<button type="button" class="msw-chip" data-action="sound" aria-pressed="true">音效 开</button></div>' +
      '<p class="msw-note">左键挖开 · 右键插旗 · 点数字可一次翻开周围<br>第一下周围九格保证安全；本游戏发积分前请在后台确认奖励配置</p>';
    stage.appendChild(root);

    var grid = root.querySelector('.msw-grid');
    var boardBox = root.querySelector('.msw-board');
    var over = root.querySelector('.msw-over');
    var overTitle = over.querySelector('[data-over="title"]');
    var overText = over.querySelector('[data-over="text"]');
    var hudTime = root.querySelector('[data-hud="time"]');
    var hudLeft = root.querySelector('[data-hud="left"]');
    var hudBest = root.querySelector('[data-hud="best"]');
    var statusEl = root.querySelector('.msw-status');
    var startBtn = root.querySelector('[data-action="restart"]');
    var modeBtn = root.querySelector('[data-action="mode"]');
    var soundBtn = root.querySelector('[data-action="sound"]');

    var cells = [];
    for (var i = 0; i < CELLS; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'msw-cell';
      b.setAttribute('data-i', i);
      b.setAttribute('role', 'gridcell');
      b.setAttribute('aria-label', '第 ' + (Math.floor(i / W) + 1) + ' 行第 ' + (i % W + 1) + ' 列，未翻开');
      b.tabIndex = i === 0 ? 0 : -1;
      grid.appendChild(b);
      cells.push(b);
    }

    var info = null;
    var board = null;
    var opened = null;
    var flags = null;
    var openList = [];
    var openCount = 0;
    var flagCount = 0;
    var phase = 'ready';
    var firstCell = -1;
    var startAt = 0;
    var ticker = null;
    var endedMs = 0;
    var submitted = false;
    var flagMode = false;
    var pressTimer = null;
    var pressIndex = -1;
    /* 本次指针手势是否已用长按插过旗：松手后的 click 必须吞掉。
       不能用「插旗后固定等 N 毫秒」来抑制——手指按住超过那个时长，
       松手时的 click 就不在抑制窗口里了，会直接挖到刚插旗的雷。 */
    var gestureFlagged = false;
    /* 局次：每次开局 +1，用来丢弃上一局迟到的提交回调。 */
    var gameNo = 0;
    /* 首次点开格子后才真正开始计时；之前一律显示 0.00。 */
    var clockStarted = false;
    var message = '点任意一格开始，第一下周围九格保证没有雷。';

    function active() { return phase === 'playing'; }

    function setStatus(text) { message = text; statusEl.textContent = text; }

    function renderHud() {
      if (phase === 'playing' && clockStarted) {
        hudTime.textContent = fmt(performance.now() - startAt);
      } else if (endedMs > 0) {
        hudTime.textContent = fmt(endedMs);
      } else {
        /* 开局后尚未首点（或刚重开）：固定 0.00，不显示页面打开时长或上一局用时 */
        hudTime.textContent = fmt(0);
      }
      hudLeft.textContent = phase === 'ready' || phase === 'starting' ? '—' : (MINES - flagCount);
      hudBest.textContent = api.best == null ? '—' : fmtLong(api.best);
    }

    function paint(i) {
      var el = cells[i];
      var open = !!(opened && opened[i]);
      var flag = !!(flags && flags[i] && !open);
      el.classList.toggle('is-open', open);
      el.classList.toggle('is-flag', flag);
      el.classList.toggle('is-mine', !!(board && board.mine[i] && !open && phase === 'lost'));
      el.classList.remove('is-boom', 'is-wrong');
      if (open) {
        el.innerHTML = '';
        var c = board ? board.count[i] : 0;
        el.textContent = c ? String(c) : '';
        el.setAttribute('data-n', c ? String(c) : '0');
      } else if (board && phase === 'lost' && board.mine[i]) {
        el.innerHTML = board.mine[i] ? MINE_SVG : '';
        el.removeAttribute('data-n');
        if (i === firstCell) { el.classList.add('is-boom'); }
      } else if (flag) {
        el.innerHTML = FLAG_SVG;
        el.removeAttribute('data-n');
      } else {
        el.innerHTML = '';
        el.removeAttribute('data-n');
      }
      if (board && phase === 'lost' && !board.mine[i] && flags && flags[i]) {
        el.innerHTML = FLAG_SVG;
        el.classList.add('is-wrong');
      }
      var r = Math.floor(i / W) + 1, cc = i % W + 1;
      var text = open ? (board.count[i] ? String(board.count[i]) : '空白') : (flag ? '已插旗' : '未翻开');
      el.setAttribute('aria-label', '第 ' + r + ' 行第 ' + cc + ' 列，' + text);
    }

    function repaintAll() {
      for (var i = 0; i < CELLS; i++) { paint(i); }
      var cur = root.querySelector('.msw-cell[tabindex="0"]');
      if (cur && !cur.classList.contains('is-open')) { return; }
      for (i = 0; i < CELLS; i++) {
        cells[i].tabIndex = -1;
        if (!cells[i].classList.contains('is-open')) { cells[i].tabIndex = 0; break; }
      }
      if (cur && cur.tabIndex === 0) { cur.tabIndex = -1; }
    }

    function stopClock() {
      if (ticker !== null) { clearInterval(ticker); ticker = null; }
    }

    function startClock() {
      stopClock();
      startAt = performance.now();
      endedMs = 0;
      clockStarted = true;
      ticker = setInterval(function () { hudTime.textContent = fmt(performance.now() - startAt); }, 50);
    }

    function lose(hit) {
      phase = 'lost';
      stopClock();
      endedMs = Math.round(performance.now() - startAt);
      Sfx.lose();
      firstCell = hit;
      repaintAll();
      root.setAttribute('data-phase', 'lost');
      overTitle.textContent = '踩到雷了';
      overText.textContent = '用时 ' + fmt(endedMs) + ' 秒，这局不计成绩。';
      over.hidden = false;
      setStatus('踩到雷了，再来一局吧。');
      renderHud();
      startBtn.textContent = '重新开局';
    }

    function win() {
      phase = 'won';
      stopClock();
      endedMs = Math.round(performance.now() - startAt);
      submitted = true;
      Sfx.win();
      root.setAttribute('data-phase', 'won');
      root.classList.add('is-win');
      hudTime.textContent = fmt(endedMs);
      setStatus('扫清了！用时 ' + fmtLong(endedMs) + '，正在记录成绩…');
      /* 提交是异步的：把「哪一局」「本局用时」固定下来，回调时若已经重开，
         就不能把新局的提示改写成上一局的成绩。 */
      var submitNo = gameNo;
      var submitMs = endedMs;
      var promise;
      try {
        promise = api.submit(info, { v: RULE, score: submitMs, first: firstCell, open: openList.join(',') }, '扫雷完成');
      } catch (e) { promise = Promise.reject(e); }
      Promise.resolve(promise).then(function (res) {
        if (submitNo !== gameNo) { return; }
        if (res && res.ok) {
          setStatus('完成！用时 ' + fmtLong(submitMs) + '，成绩已记录。');
        } else if (res && res.guest) {
          setStatus('试玩完成，用时 ' + fmtLong(submitMs) + '；登录后才会记录成绩。');
        } else {
          setStatus('提交未获确认：' + ((res && res.msg) || '请稍后到「我的纪录」核对。'));
        }
        renderHud();
      }).catch(function () {
        if (submitNo !== gameNo) { return; }
        setStatus('提交未获确认，请到「我的纪录」核对后重新开局。本局不会重复提交。');
      });
    }

    function openCell(i) {
      if (opened[i] || flags[i]) { return true; }
      if (board.mine[i]) { lose(i); return false; }
      var stack = [i];
      while (stack.length) {
        var c = stack.pop();
        if (opened[c]) { continue; }
        if (flags[c]) { flags[c] = 0; flagCount--; }
        opened[c] = 1;
        openCount++;
        openList.push(c);
        paint(c);
        if (board.count[c] === 0) {
          var nb = NB[c];
          for (var q = 0; q < nb.length; q++) { if (!opened[nb[q]]) { stack.push(nb[q]); } }
        }
      }
      return true;
    }

    function finishOrContinue() {
      renderHud();
      if (openCount === SAFE) { win(); }
    }

    function chord(i) {
      var nb = NB[i];
      var around = 0;
      for (var q = 0; q < nb.length; q++) { if (flags[nb[q]]) { around++; } }
      if (around !== board.count[i]) {
        setStatus('周围旗数和数字不一致（' + around + ' / ' + board.count[i] + '）。');
        return;
      }
      Sfx.chord();
      for (q = 0; q < nb.length; q++) {
        var c = nb[q];
        if (opened[c] || flags[c]) { continue; }
        if (!openCell(c)) { return; }
      }
      finishOrContinue();
    }

    function dig(i) {
      if (!active()) { return; }
      Sfx.unlock();
      if (firstCell < 0) {
        firstCell = i;
        board = makeBoard(info.seed, firstCell);
        opened = new Uint8Array(CELLS);
        flags = new Uint8Array(CELLS);
        root.setAttribute('data-phase', 'playing');
        startClock();
      }
      if (opened[i]) { chord(i); return; }
      if (flags[i]) { return; }
      Sfx.dig();
      if (!openCell(i)) { return; }
      if (board.count[i] === 0) { Sfx.sweep(); }
      finishOrContinue();
      if (openCount < SAFE) { setStatus('已翻开 ' + openCount + ' / ' + SAFE + ' 格。'); }
    }

    function toggleFlag(i) {
      if (!active() || firstCell < 0) {
        if (phase === 'playing') { setStatus('先点开一格开始计时，之后就能插旗了。'); }
        return;
      }
      if (opened[i]) { return; }
      flags[i] = flags[i] ? 0 : 1;
      flagCount += flags[i] ? 1 : -1;
      paint(i);
      if (flags[i]) { Sfx.flag(); } else { Sfx.unflag(); }
      renderHud();
    }

    function newGame() {
      if (phase === 'starting') { return; }
      stopClock();
      gameNo++;
      phase = 'starting';
      root.setAttribute('data-phase', 'starting');
      root.classList.remove('is-win');
      over.hidden = true;
      board = null;
      opened = null;
      flags = null;
      openList = [];
      openCount = flagCount = 0;
      firstCell = -1;
      endedMs = 0;
      clockStarted = false;
      gestureFlagged = false;
      pressIndex = -1;
      if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null; }
      submitted = false;
      startBtn.disabled = true;
      startBtn.textContent = '正在开局…';
      setStatus('正在准备棋盘…');
      for (var i = 0; i < CELLS; i++) {
        cells[i].className = 'msw-cell';
        cells[i].innerHTML = '';
        cells[i].removeAttribute('data-n');
        cells[i].setAttribute('aria-label', '第 ' + (Math.floor(i / W) + 1) + ' 行第 ' + (i % W + 1) + ' 列，未翻开');
        cells[i].tabIndex = i === 0 ? 0 : -1;
      }
      renderHud();

      var promise;
      try { promise = api.start(); } catch (e) { promise = Promise.reject(e); }
      Promise.resolve(promise).then(function (res) {
        if (!res) {
          phase = 'ready';
          root.setAttribute('data-phase', 'ready');
          startBtn.disabled = false;
          startBtn.textContent = '重新开局';
          setStatus('这次未能开局，请查看平台提示后重试。');
          return;
        }
        if (!Number.isInteger(res.seed) || res.seed < 1 || res.seed > 2147483646) { throw new Error('invalid seed'); }
        info = res;
        phase = 'playing';
        root.setAttribute('data-phase', 'playing');
        startBtn.disabled = false;
        startBtn.textContent = '重新开局';
        setStatus(res.guest ? '试玩模式：点任意一格开始，本局不记录成绩。' : '点任意一格开始，第一下周围九格保证没有雷。');
        renderHud();
      }).catch(function () {
        phase = 'ready';
        root.setAttribute('data-phase', 'ready');
        startBtn.disabled = false;
        startBtn.textContent = '重新开局';
        setStatus('暂时无法开始，请稍后点「重新开局」。');
      });
    }

    function toggleMode() {
      flagMode = !flagMode;
      modeBtn.textContent = flagMode ? '插旗模式 开' : '插旗模式 关';
      modeBtn.setAttribute('aria-pressed', flagMode ? 'true' : 'false');
      root.classList.toggle('is-flagmode', flagMode);
    }

    function toggleSound() {
      var on = Sfx.toggle();
      soundBtn.textContent = on ? '音效 开' : '音效 关';
      soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    grid.addEventListener('contextmenu', function (e) {
      var cell = e.target.closest && e.target.closest('.msw-cell');
      if (cell) { e.preventDefault(); toggleFlag(+cell.getAttribute('data-i')); }
    });

    grid.addEventListener('click', function (e) {
      var cell = e.target.closest && e.target.closest('.msw-cell');
      if (!cell) { return; }
      /* 长按插旗后松手会补一个 click，必须吞掉它——否则刚插的旗立刻被挖开。
         判定绑定在「本次指针手势」上，不依赖固定毫秒窗口。 */
      if (gestureFlagged) { gestureFlagged = false; return; }
      var i = +cell.getAttribute('data-i');
      if (flagMode || e.shiftKey) { toggleFlag(i); return; }
      dig(i);
    });

    grid.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || !active()) { return; }
      gestureFlagged = false;
      var cell = e.target.closest && e.target.closest('.msw-cell');
      if (!cell) { return; }
      pressIndex = +cell.getAttribute('data-i');
      if (pressTimer !== null) { clearTimeout(pressTimer); }
      pressTimer = setTimeout(function () {
        pressTimer = null;
        if (pressIndex >= 0 && active()) {
          toggleFlag(pressIndex);
          gestureFlagged = true;
        }
      }, LONG_PRESS);
    });

    function clearPress() {
      if (pressTimer !== null) { clearTimeout(pressTimer); pressTimer = null; }
      pressIndex = -1;
    }
    grid.addEventListener('pointerup', clearPress);
    grid.addEventListener('pointercancel', clearPress);
    grid.addEventListener('pointerleave', clearPress);

    grid.addEventListener('keydown', function (e) {
      var cell = e.target.closest && e.target.closest('.msw-cell');
      if (!cell) { return; }
      var i = +cell.getAttribute('data-i');
      var r = Math.floor(i / W), c = i % W, next = -1;
      if (e.key === 'ArrowUp' && r > 0) { next = i - W; }
      else if (e.key === 'ArrowDown' && r < H - 1) { next = i + W; }
      else if (e.key === 'ArrowLeft' && c > 0) { next = i - 1; }
      else if (e.key === 'ArrowRight' && c < W - 1) { next = i + 1; }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFlag(i); return; }
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (flagMode) { toggleFlag(i); } else { dig(i); }
        return;
      } else { return; }
      e.preventDefault();
      cells[i].tabIndex = -1;
      cells[next].tabIndex = 0;
      cells[next].focus();
    });

    startBtn.addEventListener('click', newGame);
    root.querySelector('[data-action="again"]').addEventListener('click', newGame);
    modeBtn.addEventListener('click', toggleMode);
    soundBtn.addEventListener('click', toggleSound);

    soundBtn.textContent = Sfx.isOn() ? '音效 开' : '音效 关';
    soundBtn.setAttribute('aria-pressed', Sfx.isOn() ? 'true' : 'false');
    renderHud();
    newGame();
  });
})();
