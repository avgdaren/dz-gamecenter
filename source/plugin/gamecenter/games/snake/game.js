/**
 * 遊戲中心 gamecenter — 贪食蛇（前台）。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 遊戲邏輯（step）與 verify.php 第 2 版規則逐條一致，伺服器會用種子重播 moves 校驗分數；
 * 畫面（draw）只負責好看：平滑移動、特效、造型、倒數，不影響邏輯與計分。
 * 平台介面見 static/gc.js：GameCenter.register(gkey, function(stage, api) {...})。
 */
(function () {
  'use strict';
  var RULE = 2, W = 30, H = 30, DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
  var BONUS_EVERY = 5, BONUS_LIFE = 50, BONUS_SCORE = 50, FOOD_SCORE = 10;
  var COMBO_STEP = 5, COMBO_MAX = 4, COMBO_SLACK = 2;
  var interval = function (eaten) { return Math.max(55, 115 - eaten * 2); };
  var C = 20, SIZE = W * C;   // 邏輯座標：一格 20、整張 600×600，畫的時候再依實際大小縮放
  // 造型：個人最佳達到 need 分解鎖（純外觀）
  var SKINS = [
    { k: 'classic', name: '经典绿', need: 0, hue: function (q) { return 150 - q * 35; }, head: '#7ef0ad' },
    { k: 'ocean', name: '海蓝', need: 100, hue: function (q) { return 195 + q * 35; }, head: '#8fd8ff' },
    { k: 'flame', name: '烈焰', need: 300, hue: function (q) { return 40 - q * 40; }, head: '#ffc46b' },
    { k: 'rainbow', name: '彩虹', need: 600, hue: function (q, now) { return (q * 360 + now / 8) % 360; }, head: '#ffffff' },
    { k: 'gold', name: '黄金', need: 1000, hue: function () { return 46; }, head: '#ffe58a', gold: true }
  ];
  var store = {
    get: function (k) { try { return localStorage.getItem('gc_snake_' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('gc_snake_' + k, v); } catch (e) {} }
  };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  GameCenter.register('snake', function (stage, api) {
    var wrap = document.createElement('div');
    wrap.className = 'gcs';
    wrap.innerHTML =
      '<div class="gcs-hud">' +
      '<span>分数 <b class="gcs-score">0</b></span><span>长度 <b class="gcs-len">3</b></span>' +
      '<span>速度 <b class="gcs-lv">1</b></span><span class="gcs-bestbox">最佳 <b class="gcs-best">' + (api.best == null ? '-' : api.best) + '</b></span>' +
      '<span class="gcs-combo"></span>' +
      '<span class="gcs-tools"><button type="button" class="gcs-tool" data-t="sound" title="音效"></button>' +
      '<button type="button" class="gcs-tool" data-t="pause" title="暂停（空白键）">Ⅱ</button>' +
      '<button type="button" class="gcs-tool" data-t="full" title="全屏（F）">⛶</button></span></div>' +
      '<div class="gcs-chase"></div>' +
      '<div class="gcs-board"><canvas></canvas>' +
      '<div class="gcs-cover"><div class="gcs-title">贪食蛇</div><div class="gcs-tip"></div><div class="gcs-sum"></div>' +
      '<button type="button" class="gc-btn gcs-go">开始游戏</button><div class="gcs-skins"></div></div>' +
      '<div class="gcs-count"></div></div>' +
      '<div class="gcs-pad"><button type="button" data-d="3">▲</button><button type="button" data-d="2">◀</button>' +
      '<button type="button" data-d="pause">Ⅱ</button><button type="button" data-d="0">▶</button><button type="button" data-d="1">▼</button></div>';
    stage.appendChild(wrap);
    var q = function (sel) { return wrap.querySelector(sel); };
    var cv = q('canvas'), ctx = cv.getContext('2d');
    var board = q('.gcs-board'), hudEl = q('.gcs-hud'), pad = q('.gcs-pad'), chase = q('.gcs-chase');
    var cover = q('.gcs-cover'), tip = q('.gcs-tip'), go = q('.gcs-go'), sum = q('.gcs-sum'), skinsEl = q('.gcs-skins');
    var countEl = q('.gcs-count'), title = q('.gcs-title'), comboEl = q('.gcs-combo');
    var $score = q('.gcs-score'), $len = q('.gcs-len'), $lv = q('.gcs-lv'), $best = q('.gcs-best'), $bestbox = q('.gcs-bestbox');
    var soundBtn = q('[data-t="sound"]');

    var st = null;          // 一局的邏輯狀態
    var fx = [];            // 特效（粒子、飄字）
    var shake = 0, raf = 0, scale = 1, starting = false, bg = null;
    var best = api.best;
    var skin = SKINS[0];
    tip.textContent = api.mobile ? '在棋盘上滑动，或用下方方向键' : '按方向键 / WASD 开始，空白键暂停，F 全屏';

    /* ---------- 版面：棋盤依可用空間放大 ---------- */
    function isFull() { return document.fullscreenElement === stage || stage.classList.contains('gcs-focus'); }
    // 論壇固定在畫面頂端／底端的列（頂欄、手機底部導航）會蓋住棋盤，量出來扣掉
    function fixedBar(y) {
      var e = document.elementFromPoint(innerWidth / 2, y);
      while (e && e !== document.body && e !== document.documentElement) {
        if (stage.contains(e)) return 0;
        var p = getComputedStyle(e).position;
        if (p === 'fixed' || p === 'sticky') { var r = e.getBoundingClientRect(); return y < innerHeight / 2 ? Math.max(0, r.bottom) : Math.max(0, innerHeight - r.top); }
        e = e.parentElement;
      }
      return 0;
    }
    function bars() { return isFull() ? [0, 0] : [fixedBar(2), fixedBar(innerHeight - 2)]; }
    function fit() {
      var w = wrap.clientWidth, bb = bars();
      var padH = getComputedStyle(pad).display === 'none' ? 0 : pad.offsetHeight + 10;
      var h = (isFull() ? innerHeight - 20 : innerHeight - bb[0] - bb[1] - 24) - hudEl.offsetHeight - chase.offsetHeight - padH - 16;
      var s = Math.floor(Math.max(280, Math.min(w, h, isFull() ? 2000 : 760)));
      board.style.width = board.style.height = s + 'px';
      var dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = cv.height = Math.round(s * dpr);
      scale = s * dpr / SIZE;
      bg = null;   // 背景依新尺寸重畫一次
      draw(performance.now());
    }
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', function () { setTimeout(fit, 50); });

    /* ---------- 音效（預設關，記在瀏覽器）與手機震動 ---------- */
    var sound = store.get('sound') === '1', actx = null;
    function soundIcon() { soundBtn.textContent = sound ? '🔊' : '🔇'; soundBtn.title = sound ? '关闭音效' : '开启音效'; }
    function beep(freqs, dur, type) {
      if (!sound) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        var t0 = actx.currentTime;
        freqs.forEach(function (f, i) {
          var o = actx.createOscillator(), g = actx.createGain();
          o.type = type || 'square';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.06, t0 + i * dur);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + (i + 1) * dur);
          o.connect(g); g.connect(actx.destination);
          o.start(t0 + i * dur); o.stop(t0 + (i + 1) * dur);
        });
      } catch (e) {}
    }
    function buzz(p) { if (api.mobile && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }
    soundIcon();

    /* ---------- 造型 ---------- */
    function renderSkins() {
      var b = best || 0, h = '';
      SKINS.forEach(function (s) {
        var lock = b < s.need;
        h += '<button type="button" class="gcs-skin' + (s === skin ? ' on' : '') + (lock ? ' lock' : '') + '" data-k="' + s.k + '" title="' +
          (lock ? '最佳达到 ' + s.need + ' 分解锁' : s.name) + '"><i style="background:' +
          (s.k === 'rainbow' ? 'linear-gradient(90deg,#ff5d73,#ffd54a,#4fd28a,#5b9cf5,#b07cf5)' : 'hsl(' + s.hue(0.3, 0) + ',70%,55%)') + '"></i>' +
          (lock ? '🔒' : esc(s.name)) + '</button>';
      });
      skinsEl.innerHTML = h;
    }
    (function () {
      var k = store.get('skin');
      SKINS.forEach(function (s) { if (s.k === k && (best || 0) >= s.need) skin = s; });
      renderSkins();
    })();
    skinsEl.addEventListener('click', function (e) {
      var b = e.target.closest('.gcs-skin');
      if (!b || b.classList.contains('lock')) return;
      SKINS.forEach(function (s) { if (s.k === b.dataset.k) skin = s; });
      store.set('skin', skin.k);
      renderSkins();
      draw(performance.now());
    });

    /* ---------- 追分目標（本週排行） ---------- */
    function others() {
      return (api.rivals || []).filter(function (r) { return r.u !== api.uid; }).sort(function (a, b) { return b.s - a.s; });
    }
    function updateChase() {
      if (!api.uid || !st && !(api.rivals || []).length) { chase.innerHTML = ''; return; }
      var list = others(), cur = st ? st.score : 0, tgt = null;
      for (var i = list.length - 1; i >= 0; i--) if (list[i].s >= cur) { tgt = list[i]; break; }
      // 名次照本週排行實際的位置（含自己）；平台給的 rivals 已照名次排好
      var rank = tgt ? (api.rivals || []).indexOf(tgt) + 1 : 0;
      if (!list.length) chase.innerHTML = '<span>本周还没有其他人上榜，抢第一！</span>';
      else if (!tgt) chase.innerHTML = '<span class="gcs-top">🏆 已超过本周所有人！</span>';
      else chase.innerHTML = '<span>🎯 再 <b>' + (tgt.s - cur + 1) + '</b> 分超过本周第 ' + rank + ' 名 <b>' + esc(tgt.n) + '</b>（' + tgt.s + '）</span>';
    }

    /* ---------- 遊戲邏輯（與 verify.php 一致） ---------- */
    function place() {
      var free = [];
      for (var i = 0; i < W * H; i++) if (!st.occ[i] && i !== st.food && i !== st.bonus) free.push(i);
      if (!free.length) return -1;
      st.s = (st.s * 48271) % 2147483647;
      return free[st.s % free.length];
    }
    function dist(i, x, y) { return Math.abs(i % W - x) + Math.abs(Math.floor(i / W) - y); }
    function newGame(info) {
      st = {
        info: info, s: info.seed, body: [[15, 15], [14, 15], [13, 15]], prev: null, occ: {}, dir: 0, q: [],
        tick: 0, eaten: 0, score: 0, moves: [], over: false, paused: false, timer: 0,
        food: -1, bonus: -1, bonusExp: 0, last: 0, iv: interval(0), newBest: false, still: true,
        foodTick: 0, foodDist: 0, streak: 0, maxStreak: 0, stars: 0, t0: 0, ms: 0, death: null
      };
      st.body.forEach(function (p) { st.occ[p[1] * W + p[0]] = 1; });
      st.prev = st.body.slice();
      st.food = place();
      st.foodDist = st.food < 0 ? 0 : dist(st.food, 15, 15);
      fx = [];
      hud();
      loop();
    }
    function schedule() {
      clearTimeout(st.timer);
      if (!st.over && !st.paused) {
        st.iv = interval(st.eaten);
        st.last = performance.now();
        st.timer = setTimeout(step, st.iv);
      }
    }
    function step() {
      if (st.over || st.paused) return;
      st.tick++;
      st.still = false;
      while (st.q.length) {
        var d = st.q.shift();
        if (d !== st.dir && d !== (st.dir + 2) % 4) { st.dir = d; st.moves.push(st.tick + ':' + d); break; }
      }
      st.prev = st.body.slice();
      var hx = st.body[0][0] + DX[st.dir], hy = st.body[0][1] + DY[st.dir];
      if (hx < 0 || hy < 0 || hx >= W || hy >= H) return finish(false, [hx, hy]);
      var hi = hy * W + hx, eat = hi === st.food, gotStar = hi === st.bonus, t;
      if (!eat && !gotStar) { t = st.body.pop(); delete st.occ[t[1] * W + t[0]]; }
      if (st.occ[hi]) { if (t) st.body.push(t); return finish(false, [hx, hy]); }
      st.body.unshift([hx, hy]);
      st.occ[hi] = 1;
      if (gotStar) {
        st.score += BONUS_SCORE;
        st.bonus = -1;
        st.stars++;
        burst(hx, hy, '#ffd54a', 22, '+' + BONUS_SCORE);
        beep([660, 880, 1320], 0.06);
        buzz(30);
      }
      if (eat) {
        st.eaten++;
        st.streak = st.tick - st.foodTick <= st.foodDist + COMBO_SLACK ? st.streak + 1 : 0;
        st.maxStreak = Math.max(st.maxStreak, st.streak);
        var gain = FOOD_SCORE + COMBO_STEP * Math.min(st.streak, COMBO_MAX);
        st.score += gain;
        burst(hx, hy, st.streak ? '#ffb86b' : '#ff6b81', 12 + Math.min(st.streak, 4) * 3, '+' + gain + (st.streak ? ' 连击×' + Math.min(st.streak, COMBO_MAX) : ''));
        beep([880 + Math.min(st.streak, 4) * 110], 0.05);
        buzz(12);
        st.food = -1;
        st.food = place();
        if (st.food < 0) { hud(); return finish(true); }
        st.foodTick = st.tick;
        st.foodDist = dist(st.food, hx, hy);
        if (st.eaten % BONUS_EVERY === 0 && st.bonus < 0) {
          st.bonus = place();
          st.bonusExp = st.tick + BONUS_LIFE;
        }
      }
      if (st.bonus >= 0 && st.tick >= st.bonusExp) st.bonus = -1;
      hud();
      schedule();
    }
    function finish(win, at) {
      st.over = true;
      st.win = win;
      st.death = at || null;
      st.endAt = performance.now();
      comboEl.classList.remove('on');
      st.ms += performance.now() - st.t0;
      clearTimeout(st.timer);
      shake = win ? 0 : 1;
      beep(win ? [523, 659, 784, 1047] : [220, 160], win ? 0.09 : 0.14, win ? 'square' : 'sawtooth');
      buzz(win ? [30, 40, 30] : [60, 40, 90]);
      var payload = { v: RULE, score: st.score, ticks: st.tick, moves: st.moves.join(',') };
      api.submit(st.info, payload, win ? '全部吃光，过关！' : '游戏结束').then(function (res) {
        if (res && res.ok && res.best != null) { best = res.best; $best.textContent = res.best; renderSkins(); }
        updateChase();
      });
      var sec = Math.round(st.ms / 1000), g = st;
      setTimeout(function () {
        if (st !== g) return;   // 已經開了下一局（例如馬上按方向鍵），不要把結束畫面蓋回去
        cover.style.display = '';
        title.textContent = win ? '过关！' : '游戏结束';
        tip.textContent = '本局 ' + st.score + ' 分';
        sum.innerHTML = '<span>食物 <b>' + st.eaten + '</b></span><span>金星 <b>' + st.stars + '</b></span><span>最高连击 <b>' + st.maxStreak +
          '</b></span><span>长度 <b>' + st.body.length + '</b></span><span>用时 <b>' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) + '</b></span>';
        go.textContent = '再来一局';
      }, 450);
    }
    function hud() {
      $score.textContent = st.score;
      $len.textContent = st.body.length;
      $lv.textContent = 1 + Math.min(30, st.eaten);
      comboEl.textContent = st.streak ? '连击 ×' + Math.min(st.streak, COMBO_MAX) : '';
      comboEl.classList.toggle('on', !!st.streak);
      if (best != null && st.score > best && !st.newBest) {
        st.newBest = true;
        $bestbox.classList.add('gcs-flash');
      }
      if (st.newBest) $best.textContent = st.score;
      updateChase();
    }

    /* ---------- 特效 ---------- */
    function burst(x, y, color, n, text) {
      var cx = x * C + C / 2, cy = y * C + C / 2, now = performance.now();
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
        fx.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now, life: 450 + Math.random() * 250, color: color, r: 1.5 + Math.random() * 2 });
      }
      if (text) fx.push({ x: cx, y: cy - 6, t0: now, life: 900, text: text, color: color });
    }

    /* ---------- 繪圖 ---------- */
    function lerp(a, b, f) { return a + (b - a) * f; }
    function center(p) { return [p[0] * C + C / 2, p[1] * C + C / 2]; }
    // 背景（漸層＋格點＋外框）只在尺寸改變時畫一次，之後每格畫面直接貼上
    function bgCanvas() {
      if (bg) return bg;
      bg = document.createElement('canvas');
      bg.width = bg.height = cv.width;
      var b = bg.getContext('2d');
      b.setTransform(scale, 0, 0, scale, 0, 0);
      var g = b.createLinearGradient(0, 0, SIZE, SIZE);
      g.addColorStop(0, '#0f1a2b'); g.addColorStop(1, '#16253b');
      b.fillStyle = g;
      b.fillRect(0, 0, SIZE, SIZE);
      b.fillStyle = 'rgba(255,255,255,.05)';
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        b.beginPath(); b.arc(x * C + C / 2, y * C + C / 2, 1.1, 0, Math.PI * 2); b.fill();
      }
      b.strokeStyle = 'rgba(120,170,255,.22)';
      b.lineWidth = 2;
      b.strokeRect(1, 1, SIZE - 2, SIZE - 2);
      return bg;
    }
    function drawFood(i, now) {
      var c = center([i % W, Math.floor(i / W)]), pulse = 1 + Math.sin(now / 180) * 0.08;
      var r = C * 0.36 * pulse;
      var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], C * 0.9);
      g.addColorStop(0, 'rgba(255,93,115,.45)'); g.addColorStop(1, 'rgba(255,93,115,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c[0], c[1], C * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff5d73';
      ctx.beginPath(); ctx.arc(c[0], c[1] + 1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.beginPath(); ctx.arc(c[0] - r * 0.35, c[1] - r * 0.3, r * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4fd28a';
      ctx.beginPath(); ctx.ellipse(c[0] + 3, c[1] - r - 1, 3.2, 1.6, -0.6, 0, Math.PI * 2); ctx.fill();
    }
    function star(cx, cy, R, r, rot) {
      ctx.beginPath();
      for (var k = 0; k < 10; k++) {
        var a = rot + k * Math.PI / 5, rr = k % 2 ? r : R;
        ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.closePath();
    }
    function drawBonus(now) {
      var c = center([st.bonus % W, Math.floor(st.bonus / W)]);
      var left = (st.bonusExp - st.tick) / BONUS_LIFE;
      var blink = left < 0.25 && Math.floor(now / 120) % 2;
      var g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], C * 1.2);
      g.addColorStop(0, 'rgba(255,213,74,.5)'); g.addColorStop(1, 'rgba(255,213,74,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(c[0], c[1], C * 1.2, 0, Math.PI * 2); ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#ffd54a';
        star(c[0], c[1], C * 0.5, C * 0.22, now / 600);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,213,74,.8)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c[0], c[1], C * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, left)); ctx.stroke();
    }
    function drawSnake(f, now) {
      var b = st.body, n = b.length, pv = st.prev;
      // 路徑：插值的頭 → 身體各格中心 → 插值的尾巴（尾巴從上一步的位置滑到這一步）
      var pts = [];
      var h = center(b[0]), h1 = center(n > 1 ? b[1] : b[0]);
      pts.push([lerp(h1[0], h[0], f), lerp(h1[1], h[1], f)]);
      for (var i = 1; i < n; i++) pts.push(center(b[i]));
      var pt = center(pv[pv.length - 1]), nt = center(b[n - 1]);
      if (pv.length === n) pts.push([lerp(pt[0], nt[0], f), lerp(pt[1], nt[1], f)]);
      var dead = st.over && !st.win;
      ctx.lineCap = ctx.lineJoin = 'round';
      for (var k = pts.length - 1; k > 0; k--) {
        var qq = k / Math.max(1, pts.length - 1);
        ctx.strokeStyle = dead ? 'hsl(0,' + (55 - qq * 25) + '%,' + (60 - qq * 18) + '%)'
          : skin.gold ? 'hsl(' + (46 - qq * 8) + ',' + (90 - qq * 20) + '%,' + (62 - qq * 22 + (Math.sin(now / 200 - k * 0.5) + 1) * 6) + '%)'
          : 'hsl(' + skin.hue(qq, now) + ',65%,' + (60 - qq * 22) + '%)';
        ctx.lineWidth = C * (0.82 - qq * 0.3);
        ctx.beginPath(); ctx.moveTo(pts[k][0], pts[k][1]); ctx.lineTo(pts[k - 1][0], pts[k - 1][1]); ctx.stroke();
      }
      var hp = pts[0], ex = DX[st.dir], ey = DY[st.dir];
      // 靠近食物時吐舌頭
      if (!dead && st.food >= 0 && dist(st.food, b[0][0], b[0][1]) <= 3 && Math.floor(now / 160) % 2) {
        ctx.strokeStyle = '#ff5d73';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(hp[0] + ex * 8, hp[1] + ey * 8);
        ctx.lineTo(hp[0] + ex * 14, hp[1] + ey * 14);
        ctx.lineTo(hp[0] + ex * 16 + ey * 3, hp[1] + ey * 16 + ex * 3);
        ctx.moveTo(hp[0] + ex * 14, hp[1] + ey * 14);
        ctx.lineTo(hp[0] + ex * 16 - ey * 3, hp[1] + ey * 16 - ex * 3);
        ctx.stroke();
      }
      ctx.fillStyle = dead ? '#ff8a8a' : skin.k === 'rainbow' ? 'hsl(' + skin.hue(0, now) + ',80%,72%)' : skin.head;
      ctx.beginPath(); ctx.arc(hp[0], hp[1], C * 0.47, 0, Math.PI * 2); ctx.fill();
      var blink = !dead && now % 3600 < 130;
      [-1, 1].forEach(function (s) {
        var ox = ex ? ex * 3.5 : s * 4.5, oy = ex ? s * 4.5 : ey * 3.5;
        if (blink) {
          ctx.strokeStyle = '#0f1a2b'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(hp[0] + ox - 2.5, hp[1] + oy); ctx.lineTo(hp[0] + ox + 2.5, hp[1] + oy); ctx.stroke();
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hp[0] + ox, hp[1] + oy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f1a2b';
        ctx.beginPath(); ctx.arc(hp[0] + ox + ex, hp[1] + oy + ey, dead ? 0.8 : 1.6, 0, Math.PI * 2); ctx.fill();
      });
    }
    function drawDeath(now) {
      if (!st.death) return;
      var x = Math.max(0, Math.min(W - 1, st.death[0])), y = Math.max(0, Math.min(H - 1, st.death[1])), c = center([x, y]);
      var a = 0.55 + Math.sin(now / 150) * 0.35;
      ctx.strokeStyle = 'rgba(255,80,80,' + a + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c[0], c[1], C * 0.75, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c[0] - 5, c[1] - 5); ctx.lineTo(c[0] + 5, c[1] + 5); ctx.moveTo(c[0] + 5, c[1] - 5); ctx.lineTo(c[0] - 5, c[1] + 5); ctx.stroke();
    }
    function drawFx(now) {
      fx = fx.filter(function (p) { return now - p.t0 < p.life; });
      fx.forEach(function (p) {
        var k = (now - p.t0) / p.life, sec = (now - p.t0) / 1000;
        ctx.globalAlpha = 1 - k;
        if (p.text) {
          ctx.fillStyle = p.color;
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(p.text, Math.max(50, Math.min(SIZE - 50, p.x)), Math.max(16, p.y - k * 28));
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x + p.vx * sec, p.y + p.vy * sec, p.r * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }
    function draw(now) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (shake > 0) {
        var m = shake * 6;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
        shake = Math.max(0, shake - 0.06);
      }
      ctx.drawImage(bgCanvas(), 0, 0, SIZE, SIZE);
      if (!st) return;
      // still：剛開局／剛從暫停回來，還沒走下一步前停在原位（不然會倒退半格再滑過來）
      var f = st.over || st.paused || st.still ? 1 : Math.min(1, (now - st.last) / st.iv);
      if (st.food >= 0) drawFood(st.food, now);
      if (st.bonus >= 0) drawBonus(now);
      drawSnake(f, now);
      drawDeath(now);
      drawFx(now);
    }
    function loop() {
      cancelAnimationFrame(raf);
      var tick = function (now) {
        draw(now);
        // 結束後再多跑 1.5 秒讓特效、死亡標記閃完
        if (st && (!st.over || fx.length || shake > 0 || performance.now() - st.endAt < 1500)) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    /* ---------- 操作 ---------- */
    function turn(d) {
      if (!st || st.over || starting) return;
      if (st.paused) togglePause();
      var last = st.q.length ? st.q[st.q.length - 1] : st.dir;
      if (d === last || d === (last + 2) % 4 || st.q.length >= 3) return;
      st.q.push(d);
    }
    function togglePause() {
      if (!st || st.over || starting) return;
      st.paused = !st.paused;
      cover.style.display = st.paused ? '' : 'none';
      if (st.paused) {
        st.ms += performance.now() - st.t0;
        title.textContent = '暂停中';
        tip.textContent = '按空白键或方向键继续';
        sum.innerHTML = '';
        go.textContent = '继续';
      } else {
        st.t0 = performance.now();
        st.still = true;
        loop();
      }
      schedule();
    }
    function countdown(done) {
      starting = true;
      var n = 3;
      countEl.style.display = 'flex';
      (function next() {
        if (n === 0) { countEl.style.display = 'none'; starting = false; return done(); }
        countEl.textContent = n;
        countEl.classList.remove('gcs-pop'); void countEl.offsetWidth; countEl.classList.add('gcs-pop');
        beep([n === 1 ? 660 : 440], 0.08);
        n--;
        setTimeout(next, 550);
      })();
    }
    function begin() {
      if (starting) return;
      if (st && !st.over && st.paused) return togglePause();
      if (st && !st.over) return;
      // 整個遊戲區（分數列＋棋盤＋方向鍵）捲到頂欄下方
      if (!isFull()) {
        var bb = bars(), top = hudEl.getBoundingClientRect().top, bottom = (getComputedStyle(pad).display === 'none' ? board : pad).getBoundingClientRect().bottom;
        if (top < bb[0] || bottom > innerHeight - bb[1]) window.scrollBy({ top: top - bb[0] - 8, behavior: 'smooth' });
      }
      go.disabled = true;
      api.start().then(function (info) {
        go.disabled = false;
        if (!info) return;
        cover.style.display = 'none';
        sum.innerHTML = '';
        $bestbox.classList.remove('gcs-flash');
        $best.textContent = best == null ? '-' : best;
        newGame(info);
        countdown(function () { st.t0 = performance.now(); schedule(); });
      });
    }
    function toggleFull() {
      if (document.fullscreenElement === stage) { document.exitFullscreen(); return; }
      if (stage.classList.contains('gcs-focus')) { stage.classList.remove('gcs-focus'); document.documentElement.classList.remove('gcs-noscroll'); fit(); return; }
      if (stage.requestFullscreen && !api.mobile) {
        stage.requestFullscreen().catch(function () { stage.classList.add('gcs-focus'); fit(); });
      } else {
        // 手機（iPhone 不支援元素全屏）改用整頁覆蓋的專注模式
        stage.classList.add('gcs-focus');
        document.documentElement.classList.add('gcs-noscroll');
        fit();
      }
    }
    // 可以開新局：沒在玩、沒開成績視窗、結束畫面已經出來（死掉那一瞬間還在狂按方向鍵不會誤開下一局）
    function idle() { return (!st || st.over) && !starting && !stage.querySelector('.gc-modal') && cover.style.display !== 'none' && api.visible(board); }

    go.addEventListener('click', begin);
    q('.gcs-tools').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.t === 'sound') { sound = !sound; store.set('sound', sound ? '1' : '0'); soundIcon(); beep([880], 0.05); }
      else if (b.dataset.t === 'pause') togglePause();
      else if (b.dataset.t === 'full') toggleFull();
      b.blur();
    });
    var KEYS = { ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 };
    document.addEventListener('keydown', function (e) {
      var tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (e.target && e.target.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var playing = st && !st.over;
      if (e.key in KEYS) {
        if (playing) { e.preventDefault(); turn(KEYS[e.key]); }
        else if (idle()) { e.preventDefault(); begin(); }   // 方向鍵直接開局
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (playing) { e.preventDefault(); togglePause(); }
        else if (e.key === ' ' && idle()) { e.preventDefault(); begin(); }
      } else if (e.key === 'Enter' && idle() && e.target === document.body) {
        e.preventDefault(); begin();
      } else if ((e.key === 'f' || e.key === 'F') && api.visible(board)) {
        toggleFull();
      } else if (e.key === 'Escape' && stage.classList.contains('gcs-focus')) {
        toggleFull();
      }
    });
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.d === 'pause') togglePause();
      else if (!st || st.over) { if (idle()) begin(); }
      else turn(+b.dataset.d);
    });
    var sx = 0, sy = 0;
    board.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    board.addEventListener('touchmove', function (e) {
      if (!st || st.over || st.paused) return;
      e.preventDefault();
      var t = e.touches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
      // 滑動中就轉向（不必放開手指），可以連續轉彎
      turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3));
      sx = t.clientX; sy = t.clientY;
    }, { passive: false });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && st && !st.over && !st.paused && !starting) togglePause();
    });
    window.addEventListener('blur', function () {
      if (st && !st.over && !st.paused && !starting) togglePause();
    });
    updateChase();
    fit();
  });
})();
