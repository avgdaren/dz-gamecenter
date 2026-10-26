/**
 * memory — 4×4 翻牌记忆配对，规则版本 1，无外部依赖。
 * 作者：GPT / Codex。适配 gamecenter（原作者 Carinoasd，(C) 2026）。
 */
(function () {
  'use strict';

  var RULE = 1;
  var MAX_ATTEMPTS = 256;
  var REVEAL_MS = 700;
  var symbols = [
    ['太阳', '<circle cx="24" cy="24" r="9"/><path d="M24 4v5m0 30v5M4 24h5m30 0h5M10 10l4 4m20 20 4 4M10 38l4-4m20-20 4-4"/>'],
    ['月亮', '<path d="M35 33A17 17 0 0 1 15 8a17 17 0 1 0 20 25Z"/>'],
    ['星星', '<path d="m24 5 6 12 13 2-9.5 9.3L36 42l-12-6.4L12 42l2.5-13.7L5 19l13-2Z"/>'],
    ['水滴', '<path d="M24 5C20 14 10 22 10 30a14 14 0 0 0 28 0c0-8-10-16-14-25Z"/><path d="M17 30a7 7 0 0 0 7 7"/>'],
    ['爱心', '<path d="M24 40 7 24C-1 13 13 2 24 15 35 2 49 13 41 24Z"/>'],
    ['树叶', '<path d="M39 8C10 5 4 24 15 34S43 33 39 8Z"/><path d="m10 40 22-22m-13 13-1-9m8 2 9 1"/>'],
    ['菱形', '<path d="m24 5 17 19-17 19L7 24Z"/><path d="m24 14 9 10-9 10-9-10Z"/>'],
    ['花朵', '<path d="M24 15C10-3 0 20 15 24-3 38 20 48 24 33c14 18 24-5 9-9C51 10 28 0 24 15Z"/><circle cx="24" cy="24" r="4"/>']
  ];

  function shuffle(seed) {
    var cards = [];
    for (var n = 0; n < 8; n++) cards.push(n, n);
    var s = seed;
    for (var i = 15; i > 0; i--) {
      s = s * 48271 % 2147483647;
      var j = s % (i + 1);
      var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    return cards;
  }

  function svg(body) {
    return '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  GameCenter.register('memory', function (stage, api) {
    var root = document.createElement('div');
    root.className = 'gcm';
    root.innerHTML = '<div class="gcm-intro"><span>MEMORY · 4 × 4</span><p>翻开两张，找到相同的图案。</p></div>' +
      '<div class="gcm-stats"><div><span>尝试次数</span><b data-stat="attempts">0</b></div>' +
      '<div><span>已配对</span><b><span data-stat="pairs">0</span><small> / 8</small></b></div>' +
      '<div><span>个人最佳</span><b data-stat="best">—</b></div></div>' +
      '<div class="gcm-board"><div class="gcm-grid" role="group" aria-label="4 行 4 列翻牌区"></div>' +
      '<div class="gcm-cover" hidden><b>游戏已暂停</b><span>牌局和翻牌进度都为你保留。</span>' +
      '<button type="button" class="gc-btn" data-action="resume">继续游戏</button></div></div>' +
      '<p class="gcm-status" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<div class="gcm-controls"><button type="button" class="gc-btn" data-action="start">开始游戏</button>' +
      '<button type="button" class="gc-btn gc-ghost" data-action="pause" disabled>暂停</button></div>' +
      '<p class="gcm-note">每翻两张计 1 次，次数越少越好。<br>本游戏不发积分，排行榜仅作展示。</p>';
    stage.appendChild(root);

    var grid = root.querySelector('.gcm-grid');
    var cover = root.querySelector('.gcm-cover');
    var startButton = root.querySelector('[data-action="start"]');
    var pauseButton = root.querySelector('[data-action="pause"]');
    var status = root.querySelector('.gcm-status');
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
    var message = '准备好了吗？配齐 8 对图案，看看你需要几次尝试。';
    var back = svg('<circle cx="18" cy="18" r="3"/><circle cx="30" cy="18" r="3"/><circle cx="18" cy="30" r="3"/><circle cx="30" cy="30" r="3"/>');

    for (var i = 0; i < 16; i++) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'gcm-card';
      button.setAttribute('data-index', i);
      button.innerHTML = '<span class="gcm-back">' + back + '</span><span class="gcm-front"></span><span class="gcm-check" aria-hidden="true">✓</span>';
      grid.appendChild(button);
      buttons.push(button);
      faces.push(button.querySelector('.gcm-front'));
    }

    function active() { return phase === 'playing' || phase === 'resolving'; }
    function paused() { return manualPause || hiddenPause; }

    function render() {
      root.setAttribute('data-phase', phase);
      root.querySelector('[data-stat="attempts"]').textContent = attempts;
      root.querySelector('[data-stat="pairs"]').textContent = pairs;
      root.querySelector('[data-stat="best"]').textContent = api.best == null ? '—' : api.best;
      cover.hidden = !(active() && paused());
      pauseButton.disabled = !active() || hiddenPause;
      pauseButton.textContent = manualPause ? '继续' : '暂停';
      startButton.disabled = active() || phase === 'starting' || phase === 'submitting';
      startButton.textContent = phase === 'starting' ? '正在开局…' : (phase === 'submitting' ? '正在提交…' : (info ? '再玩一局' : '开始游戏'));
      status.textContent = active() && paused() ? '已暂停，回来后继续配对。' : message;
      for (var k = 0; k < 16; k++) {
        var open = !!matched[k] || k === first || k === second;
        var disabled = phase !== 'playing' || paused() || !!matched[k] || k === first;
        buttons[k].classList.toggle('is-open', open);
        buttons[k].classList.toggle('is-matched', !!matched[k]);
        // aria-disabled 保留暂时等待盖牌时的键盘焦点；输入处理仍检查完整状态。
        buttons[k].setAttribute('aria-disabled', disabled ? 'true' : 'false');
        buttons[k].tabIndex = active() && !matched[k] && !paused() ? 0 : -1;
        buttons[k].setAttribute('aria-label', '第 ' + (k + 1) + ' 张，' + (open && cards ? symbols[cards[k]][0] + (matched[k] ? '，已配对' : '') : '未翻开'));
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
      if (phase !== 'resolving' || paused() || timer !== null) return;
      deadline = performance.now() + remaining;
      timer = setTimeout(function () {
        timer = null;
        remaining = 0;
        if (phase !== 'resolving' || paused()) return;
        first = second = -1;
        if (attempts >= MAX_ATTEMPTS) {
          phase = 'limit';
          message = '已达到 256 次尝试，本局未完成，不记成绩。休息一下，再来一局吧。';
        } else {
          phase = 'playing';
          message = '记住这两张的位置，再试一对。';
        }
        render();
      }, remaining);
    }

    function finish() {
      if (submitted) return;
      submitted = true;
      phase = 'submitting';
      message = '全部配对完成，正在提交成绩…';
      render();
      var promise;
      try {
        promise = api.submit(info, { v: RULE, score: attempts, moves: moves.join(',') }, '配对完成');
      } catch (e) {
        promise = Promise.reject(e);
      }
      Promise.resolve(promise).then(function (result) {
        phase = 'finished';
        if (result && result.ok) {
          message = '完成！共用 ' + attempts + ' 次尝试，成绩已记录。';
        } else if (result && result.guest) {
          message = '试玩完成！共用 ' + attempts + ' 次尝试；登录且有排行权限时才记录成绩。';
        } else {
          message = '提交未获确认，请查看平台提示或到“我的纪录”核对，再开始新一局。';
        }
        render();
      }).catch(function () {
        phase = 'finished';
        message = '提交未获确认，请到“我的纪录”核对后重新开局。本局不会重复提交。';
        render();
      });
    }

    function flip(index) {
      if (phase !== 'playing' || paused() || matched[index] || index === first) return;
      moves.push(index);
      if (first < 0) {
        first = index;
        message = '再翻一张，找到相同的图案。';
      } else {
        second = index;
        attempts++;
        if (cards[first] === cards[second]) {
          matched[first] = matched[second] = true;
          pairs++;
          first = second = -1;
          if (pairs === 8) { finish(); return; }
          if (attempts >= MAX_ATTEMPTS) {
            phase = 'limit';
            message = '已达到 256 次尝试，本局未完成，不记成绩。休息一下，再来一局吧。';
          } else {
            message = '配对成功！继续寻找下一对。';
          }
        } else {
          phase = 'resolving';
          remaining = REVEAL_MS;
          message = '这次不同，记住它们的位置。';
          schedule();
        }
      }
      render();
    }

    function begin() {
      if (active() || phase === 'starting' || phase === 'submitting' || stage.querySelector('.gc-modal')) return;
      phase = 'starting';
      message = '正在准备新牌局…';
      render();
      var promise;
      try { promise = api.start(); } catch (e) { promise = Promise.reject(e); }
      Promise.resolve(promise).then(function (result) {
        if (!result) {
          phase = 'ready';
          message = '这次未能开局，请查看平台提示后重试。';
          render();
          return;
        }
        if (!Number.isInteger(result.seed) || result.seed < 1 || result.seed > 2147483646) {
          throw new Error('invalid seed');
        }
        stopTimer();
        info = result;
        cards = shuffle(result.seed);
        matched = cards.map(function () { return false; });
        moves = [];
        attempts = pairs = 0;
        first = second = -1;
        submitted = manualPause = false;
        hiddenPause = document.hidden;
        for (var k = 0; k < 16; k++) {
          faces[k].innerHTML = svg(symbols[cards[k]][1]);
          buttons[k].setAttribute('data-symbol', cards[k]);
        }
        phase = 'playing';
        message = result.guest ? '试玩模式：翻开两张牌开始配对，本局不记录成绩。' : '翻开两张牌，开始这一局。';
        render();
      }).catch(function () {
        phase = 'ready';
        message = '暂时无法开始，请稍后重新开局。';
        render();
      });
    }

    function togglePause() {
      if (!active() || hiddenPause) return;
      manualPause = !manualPause;
      if (paused()) stopTimer(); else schedule();
      render();
    }

    grid.addEventListener('click', function (event) {
      var card = event.target.closest && event.target.closest('.gcm-card');
      if (card && grid.contains(card)) flip(+card.getAttribute('data-index'));
    });
    startButton.addEventListener('click', begin);
    pauseButton.addEventListener('click', togglePause);
    root.querySelector('[data-action="resume"]').addEventListener('click', togglePause);
    document.addEventListener('visibilitychange', function () {
      hiddenPause = document.hidden;
      if (paused()) stopTimer(); else schedule();
      render();
    });
    render();
  });
})();
