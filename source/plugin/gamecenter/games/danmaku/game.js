/**
 * 遊戲中心 gamecenter — 天使弹幕（前台）。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 純躲避彈幕。遊戲規則全部寫在 SIM-BEGIN／SIM-END 之間的 DK 物件（整數定點數，不用 sin／cos／浮點，
 * 不依賴 DOM、window、GameCenter），與 verify.php 逐步一致：伺服器用同一顆種子重跑全部子彈，
 * 照玩家每一步的位移紀錄判中彈與擦彈，分數以伺服器算的為準。
 * 畫面（draw）只負責好看，不影響邏輯與計分。
 * 平台介面見 static/gc.js：GameCenter.register(gkey, function(stage, api) {...})。
 */
(function () {
  'use strict';
  /* SIM-BEGIN */
  var DK = (function () {
    // 規則版本 1。座標：邏輯像素 360×480；子彈位置與速度用 1/256 像素的整數（FP）。
    // 每一步（固定每秒 60 步，t 從 1 起算）依序：玩家位移 → 發射 → 全部子彈前進並判定（擦彈、中彈）→ 無敵倒數／扣命 → 存活分、階段分。
    var RULE = 1, W = 360, H = 480, FP = 256;
    var STAGE = 1800, MAXT = 36000, LIVES = 3, INV = 120, HIT_R = 3, GRAZE_R = 14, MAXB = 700;
    var X0 = 180, Y0 = 420, MINX = 6, MAXX = 354, MINY = 6, MAXY = 474;
    var LO = -24 * FP, HIX = W * FP + 24 * FP, HIY = H * FP + 24 * FP;
    // 方向表：整數角度 0～359（0＝向右、90＝向下），cos、sin 各乘 1024 取整；算一次後貼成字面量，執行期不算。
    var COS = [
      1024, 1024, 1023, 1023, 1022, 1020, 1018, 1016, 1014, 1011, 1008, 1005, 1002, 998, 994, 989, 984, 979,
      974, 968, 962, 956, 949, 943, 935, 928, 920, 912, 904, 896, 887, 878, 868, 859, 849, 839,
      828, 818, 807, 796, 784, 773, 761, 749, 737, 724, 711, 698, 685, 672, 658, 644, 630, 616,
      602, 587, 573, 558, 543, 527, 512, 496, 481, 465, 449, 433, 416, 400, 384, 367, 350, 333,
      316, 299, 282, 265, 248, 230, 213, 195, 178, 160, 143, 125, 107, 89, 71, 54, 36, 18,
      0, -18, -36, -54, -71, -89, -107, -125, -143, -160, -178, -195, -213, -230, -248, -265, -282, -299,
      -316, -333, -350, -367, -384, -400, -416, -433, -449, -465, -481, -496, -512, -527, -543, -558, -573, -587,
      -602, -616, -630, -644, -658, -672, -685, -698, -711, -724, -737, -749, -761, -773, -784, -796, -807, -818,
      -828, -839, -849, -859, -868, -878, -887, -896, -904, -912, -920, -928, -935, -943, -949, -956, -962, -968,
      -974, -979, -984, -989, -994, -998, -1002, -1005, -1008, -1011, -1014, -1016, -1018, -1020, -1022, -1023, -1023, -1024,
      -1024, -1024, -1023, -1023, -1022, -1020, -1018, -1016, -1014, -1011, -1008, -1005, -1002, -998, -994, -989, -984, -979,
      -974, -968, -962, -956, -949, -943, -935, -928, -920, -912, -904, -896, -887, -878, -868, -859, -849, -839,
      -828, -818, -807, -796, -784, -773, -761, -749, -737, -724, -711, -698, -685, -672, -658, -644, -630, -616,
      -602, -587, -573, -558, -543, -527, -512, -496, -481, -465, -449, -433, -416, -400, -384, -367, -350, -333,
      -316, -299, -282, -265, -248, -230, -213, -195, -178, -160, -143, -125, -107, -89, -71, -54, -36, -18,
      0, 18, 36, 54, 71, 89, 107, 125, 143, 160, 178, 195, 213, 230, 248, 265, 282, 299,
      316, 333, 350, 367, 384, 400, 416, 433, 449, 465, 481, 496, 512, 527, 543, 558, 573, 587,
      602, 616, 630, 644, 658, 672, 685, 698, 711, 724, 737, 749, 761, 773, 784, 796, 807, 818,
      828, 839, 849, 859, 868, 878, 887, 896, 904, 912, 920, 928, 935, 943, 949, 956, 962, 968,
      974, 979, 984, 989, 994, 998, 1002, 1005, 1008, 1011, 1014, 1016, 1018, 1020, 1022, 1023, 1023, 1024
    ];
    var SIN = [
      0, 18, 36, 54, 71, 89, 107, 125, 143, 160, 178, 195, 213, 230, 248, 265, 282, 299,
      316, 333, 350, 367, 384, 400, 416, 433, 449, 465, 481, 496, 512, 527, 543, 558, 573, 587,
      602, 616, 630, 644, 658, 672, 685, 698, 711, 724, 737, 749, 761, 773, 784, 796, 807, 818,
      828, 839, 849, 859, 868, 878, 887, 896, 904, 912, 920, 928, 935, 943, 949, 956, 962, 968,
      974, 979, 984, 989, 994, 998, 1002, 1005, 1008, 1011, 1014, 1016, 1018, 1020, 1022, 1023, 1023, 1024,
      1024, 1024, 1023, 1023, 1022, 1020, 1018, 1016, 1014, 1011, 1008, 1005, 1002, 998, 994, 989, 984, 979,
      974, 968, 962, 956, 949, 943, 935, 928, 920, 912, 904, 896, 887, 878, 868, 859, 849, 839,
      828, 818, 807, 796, 784, 773, 761, 749, 737, 724, 711, 698, 685, 672, 658, 644, 630, 616,
      602, 587, 573, 558, 543, 527, 512, 496, 481, 465, 449, 433, 416, 400, 384, 367, 350, 333,
      316, 299, 282, 265, 248, 230, 213, 195, 178, 160, 143, 125, 107, 89, 71, 54, 36, 18,
      0, -18, -36, -54, -71, -89, -107, -125, -143, -160, -178, -195, -213, -230, -248, -265, -282, -299,
      -316, -333, -350, -367, -384, -400, -416, -433, -449, -465, -481, -496, -512, -527, -543, -558, -573, -587,
      -602, -616, -630, -644, -658, -672, -685, -698, -711, -724, -737, -749, -761, -773, -784, -796, -807, -818,
      -828, -839, -849, -859, -868, -878, -887, -896, -904, -912, -920, -928, -935, -943, -949, -956, -962, -968,
      -974, -979, -984, -989, -994, -998, -1002, -1005, -1008, -1011, -1014, -1016, -1018, -1020, -1022, -1023, -1023, -1024,
      -1024, -1024, -1023, -1023, -1022, -1020, -1018, -1016, -1014, -1011, -1008, -1005, -1002, -998, -994, -989, -984, -979,
      -974, -968, -962, -956, -949, -943, -935, -928, -920, -912, -904, -896, -887, -878, -868, -859, -849, -839,
      -828, -818, -807, -796, -784, -773, -761, -749, -737, -724, -711, -698, -685, -672, -658, -644, -630, -616,
      -602, -587, -573, -558, -543, -527, -512, -496, -481, -465, -449, -433, -416, -400, -384, -367, -350, -333,
      -316, -299, -282, -265, -248, -230, -213, -195, -178, -160, -143, -125, -107, -89, -71, -54, -36, -18
    ];
    // 每步位移的 29 種組合（|d|≤3），依 dy、dx 由小到大編號，對應字母；連續相同的位移壓成「字母＋次數」
    var ALPHA = 'abcdefghijklmnopqrstuvwxyzABC', MV = [], MVI = {};
    (function () {
      for (var dy = -3; dy <= 3; dy++) for (var dx = -3; dx <= 3; dx++) if (dx * dx + dy * dy <= 9) { MVI[dx + ',' + dy] = MV.length; MV.push([dx, dy]); }
    })();
    function isqrt(n) { return Math.floor(Math.sqrt(n)); }
    function ang(a) { return ((a % 360) + 360) % 360; }

    /** 位置紀錄：push(dx, dy) 每步一次，str() 取字串（例如 "a12Bc3"）。 */
    function PosRec() {
      var r = { s: '', last: -1, n: 0 };
      function flush() { if (r.n) r.s += ALPHA.charAt(r.last) + (r.n > 1 ? r.n : ''); }
      return {
        push: function (dx, dy) {
          var c = MVI[dx + ',' + dy];
          if (c === undefined) throw new Error('bad move');
          if (c === r.last) r.n++; else { flush(); r.last = c; r.n = 1; }
        },
        str: function () { var keep = r.s; flush(); var out = r.s; r.s = keep; return out; }
      };
    }
    /** 解位置紀錄：回傳 {dx:[], dy:[]}（長度剛好 ticks）；格式不對或步數不符回傳 null。 */
    function decodePos(str, ticks) {
      if (typeof str !== 'string' || str.length > 120000 || !/^(?:[a-zA-C](?:[1-9][0-9]{0,4})?)+$/.test(str)) return null;
      var re = /([a-zA-C])([1-9][0-9]{0,4})?/g, m, dx = [], dy = [];
      while ((m = re.exec(str))) {
        var mv = MV[ALPHA.indexOf(m[1])], c = m[2] ? +m[2] : 1;
        if (dx.length + c > ticks) return null;
        for (var i = 0; i < c; i++) { dx.push(mv[0]); dy.push(mv[1]); }
      }
      return dx.length === ticks ? { dx: dx, dy: dy } : null;
    }
    /** 鍵盤方向 → 位移：一般直走 3、斜走 (2,2)；低速 1。 */
    function keysMove(kx, ky, slow) {
      var v = slow ? 1 : (kx && ky ? 2 : 3);
      return [kx * v, ky * v];
    }
    /** 觸控：自機朝目標 (gx,gy) 走，每步最多 vmax。 */
    function follow(px, py, gx, gy, vmax) {
      var dx = gx - px, dy = gy - py, d2 = dx * dx + dy * dy;
      if (d2 <= vmax * vmax) return [dx, dy];
      var len = isqrt(d2);
      if (len * len < d2) len++;   // 向上取整，位移長度才一定 ≤ vmax
      return [Math.trunc(dx * vmax / len), Math.trunc(dy * vmax / len)];
    }

    /**
     * 一局的遊戲邏輯（與 verify.php 一致）。玩家與幽靈各跑一個。
     * step(dx, dy)：這一步自機的位移（要合法：dx²+dy²≤9 且落在邊界內；clampMove 會把位移限制到合法）。
     * 回傳這一步發生的事 {hit, graze（這一步新擦到幾顆）, clear（撐完的階段編號，0 起；沒有＝-1）, start（新階段編號；沒有＝-1）}。
     */
    function Sim(seed) {
      var g = {
        s: seed, t: 0, px: X0, py: Y0, lives: LIVES, inv: 0, score: 0, graze: 0, over: false, win: false,
        B: [], p1: 0, p2: -1, stage: 0, boss: false, ex: 180, ey: 70
      };
      function rnd() { g.s = (g.s * 48271) % 2147483647; return g.s; }
      function add(x, y, vx, vy, r, k) {
        if (g.B.length < MAXB) g.B.push({ x: x, y: y, vx: vx, vy: vy, r: r, k: k, g: 0 });
      }
      // 從 (cx,cy) 往角度 a 方向、距離 rad 處射出一顆速度 spd（1/256 像素／步）的子彈
      function shoot(cx, cy, a, spd, rad, r, k) {
        a = ang(a);
        var c = COS[a], s = SIN[a];
        add(cx * FP + Math.trunc(c * rad / 4), cy * FP + Math.trunc(s * rad / 4), Math.trunc(c * spd / 1024), Math.trunc(s * spd / 1024), r, k);
      }
      // 0 放射環：每隔一段時間一圈，圈與圈錯開角度
      function ring(u, lv, boss) {
        var iv = Math.max(34, 64 - 2 * lv);
        if (boss) iv = Math.trunc(iv * 7 / 5);
        if (u % iv !== 0) return;
        var k = Math.trunc(u / iv), n = Math.min(34, 16 + lv), a0 = (k * 13) % 360, spd = 300 + 11 * lv;
        for (var j = 0; j < n; j++) shoot(g.ex, g.ey, a0 + Math.trunc(360 * j / n), spd, 10, 3, 0);
      }
      // 1 螺旋：發射口旋轉，多條臂（越後面越多）
      function spiral(u, lv, boss) {
        var iv = boss ? 9 : 6;
        if (u % iv !== 0) return;
        var arms = lv < 8 ? 2 : lv < 14 ? 3 : 4, spd = 330 + 9 * lv, base = (u * 2) % 360;
        if (g.stage % 2 === 1) base = 360 - base;
        for (var j = 0; j < arms; j++) shoot(g.ex, g.ey, base + Math.trunc(360 * j / arms), spd, 8, 3, 1);
      }
      // 2 瞄準：朝玩家當下的位置連發，後面變成扇形
      function aimed(u, lv, boss) {
        var iv = Math.max(24, 52 - lv);
        if (boss) iv = Math.trunc(iv * 7 / 5);
        var m = u % iv, shots = 3 + (lv >= 10 ? 2 : 0);
        if (m % 5 !== 0 || m >= 5 * shots) return;
        var fan = lv < 5 ? 1 : lv < 12 ? 3 : 5, spd = 420 + 13 * lv;
        var dx = g.px - g.ex, dy = g.py - g.ey, len = isqrt(dx * dx + dy * dy);
        if (len < 1) len = 1;
        var vx = Math.trunc(dx * spd / len), vy = Math.trunc(dy * spd / len);
        for (var j = 0; j < fan; j++) {
          var a = ang((2 * j - (fan - 1)) * 7), c = COS[a], s = SIN[a];
          add(g.ex * FP, g.ey * FP, Math.trunc((vx * c - vy * s) / 1024), Math.trunc((vx * s + vy * c) / 1024), 4, 2);
        }
      }
      // 3 雨幕：從上緣隨機落下
      function rain(u, lv, boss) {
        var iv = boss ? 5 : 4;
        if (u % iv !== 0) return;
        var c = 1 + (lv >= 7 ? 1 : 0) + (lv >= 13 ? 1 : 0);
        for (var i = 0; i < c; i++) {
          var x = rnd() % 360;
          var vx = (rnd() % 81) - 40;
          var vy = 380 + (rnd() % 220) + 8 * lv;
          add(x * FP, -6 * FP, vx, vy, 3, 3);
        }
      }
      // 4 花瓣：在隨機位置炸出五片花瓣，中間快、兩側慢
      function petal(u, lv, boss) {
        var iv = Math.max(52, 110 - 3 * lv);
        if (boss) iv = Math.trunc(iv * 7 / 5);
        if (u % iv !== 0) return;
        var cx = 40 + (rnd() % 280);
        var cy = 30 + (rnd() % 90);
        var a0 = rnd() % 72;
        var half = 2 + Math.min(2, Math.trunc(lv / 6)), spd = 260 + 8 * lv;
        for (var p = 0; p < 5; p++) for (var k = -half; k <= half; k++) {
          shoot(cx, cy, a0 + 72 * p + 6 * k, spd + (half + 1 - Math.abs(k)) * 55, 6, 3, 4);
        }
      }
      function fire(p, u, lv, boss) {
        if (p === 0) ring(u, lv, boss);
        else if (p === 1) spiral(u, lv, boss);
        else if (p === 2) aimed(u, lv, boss);
        else if (p === 3) rain(u, lv, boss);
        else petal(u, lv, boss);
      }
      g.clampMove = function (dx, dy) {
        var nx = Math.min(MAXX, Math.max(MINX, g.px + dx)), ny = Math.min(MAXY, Math.max(MINY, g.py + dy));
        return [nx - g.px, ny - g.py];
      };
      g.step = function (dx, dy) {
        var ev = { hit: false, graze: 0, clear: -1, start: -1 };
        var t = ++g.t;
        g.px += dx; g.py += dy;
        var u = (t - 1) % STAGE, lv = Math.trunc((t - 1) / STAGE);
        g.ex = 180 + Math.trunc(SIN[(t * 2) % 360] * 100 / 1024);
        g.ey = 70;
        if (u === 0) {
          g.stage = lv; g.boss = lv % 4 === 3; ev.start = lv;
          g.p1 = rnd() % 5; g.p2 = -1;
          if (g.boss) g.p2 = (g.p1 + 1 + (rnd() % 4)) % 5;
        }
        fire(g.p1, u, lv, g.boss);
        if (g.p2 >= 0) fire(g.p2, u, lv, g.boss);
        // 全部子彈前進並判定；出界的用「最後一顆換過來」移除（從後往前走，換過來的已處理過）
        var B = g.B, pxf = g.px * FP, pyf = g.py * FP, G = GRAZE_R * FP, G2 = G * G, hitnow = false;
        for (var i = B.length - 1; i >= 0; i--) {
          var b = B[i];
          b.x += b.vx; b.y += b.vy;
          if (b.x < LO || b.x > HIX || b.y < LO || b.y > HIY) {
            var last = B.pop();
            if (i < B.length) B[i] = last;
            continue;
          }
          var ddx = b.x - pxf;
          if (ddx > G || ddx < -G) continue;
          var ddy = b.y - pyf;
          if (ddy > G || ddy < -G) continue;
          var d2 = ddx * ddx + ddy * ddy;
          if (b.g === 0 && d2 <= G2) { b.g = 1; g.graze++; g.score += 5; ev.graze++; }
          var hr = (HIT_R + b.r) * FP;
          if (d2 <= hr * hr) hitnow = true;
        }
        var was = g.inv;
        if (g.inv > 0) g.inv--;
        if (hitnow && was === 0) {
          ev.hit = true;
          g.lives--;
          g.B.length = 0;
          g.inv = INV;
          if (g.lives === 0) { g.over = true; return ev; }
        }
        if (t % 60 === 0) g.score += 10;
        if (t % STAGE === 0) {
          ev.clear = t / STAGE - 1;
          g.score += ev.clear % 4 === 3 ? 1000 : 500;
        }
        if (t === MAXT) { g.over = true; g.win = true; }
        return ev;
      };
      return g;
    }
    return {
      RULE: RULE, W: W, H: H, FP: FP, STAGE: STAGE, MAXT: MAXT, LIVES: LIVES, INV: INV, X0: X0, Y0: Y0,
      MINX: MINX, MAXX: MAXX, MINY: MINY, MAXY: MAXY, MV: MV,
      Sim: Sim, PosRec: PosRec, decodePos: decodePos, keysMove: keysMove, follow: follow, isqrt: isqrt
    };
  })();
  /* SIM-END */

  var STEP_MS = 1000 / 60, READY = 120;   // 開局倒數：120 步（3-2-1，每個數字 40 步），倒數期間不跑規則
  // 子彈顏色：依發射型態 0 放射環、1 螺旋、2 瞄準、3 雨幕、4 花瓣
  var COLORS = ['#ff5d8f', '#b07cff', '#ff9a3d', '#4fc3ff', '#5df2a8'];
  var NAMES = ['放射环', '螺旋', '瞄准', '雨幕', '花瓣'];
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function mmss(sec) { return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }

  GameCenter.register('danmaku', function (stage, api) {
    var W = DK.W, H = DK.H;
    var wrap = document.createElement('div');
    wrap.className = 'gcd';
    wrap.innerHTML =
      '<div class="gcd-hud">' +
      '<span>分数 <b class="gcd-score">0</b></span><span class="gcd-bestbox">最佳 <b class="gcd-best">' + (api.best == null ? '-' : api.best) + '</b></span>' +
      '<span class="gcd-lives"></span><span>阶段 <b class="gcd-stage">1</b></span><span>擦弹 <b class="gcd-graze">0</b></span><span>时间 <b class="gcd-time">0:00</b></span>' +
      '<span class="gcd-tools"><button type="button" class="gcd-tool" data-t="pause" title="暂停（空白键）">Ⅱ</button>' +
      '<button type="button" class="gcd-tool" data-t="full" title="全屏（F）">⛶</button></span></div>' +
      '<div class="gcd-chase"></div>' +
      '<div class="gcd-board"><canvas></canvas>' +
      '<div class="gcd-cover"><div class="gcd-title">天使弹幕</div><div class="gcd-tip"></div><div class="gcd-sum"></div>' +
      '<button type="button" class="gc-btn gcd-go">开始游戏</button></div>' +
      '<div class="gcd-count"></div></div>';
    stage.appendChild(wrap);
    var q = function (sel) { return wrap.querySelector(sel); };
    var cv = q('canvas'), ctx = cv.getContext('2d');
    var board = q('.gcd-board'), hudEl = q('.gcd-hud'), chase = q('.gcd-chase');
    var cover = q('.gcd-cover'), tip = q('.gcd-tip'), go = q('.gcd-go'), sum = q('.gcd-sum'), title = q('.gcd-title'), countEl = q('.gcd-count');
    var $score = q('.gcd-score'), $best = q('.gcd-best'), $bestbox = q('.gcd-bestbox'), $lives = q('.gcd-lives'), $stage = q('.gcd-stage');
    var $graze = q('.gcd-graze'), $time = q('.gcd-time');

    var st = null;            // 一局：{sim, info, rec, acc, lastTs, ready, paused, over, ...}
    var ghost = null;         // 幽靈（幽靈挑戰才有）：一份 Sim 照對手的位置紀錄重播
    var fx = [], shake = 0, flash = 0, banner = null, raf = 0, scale = 1, starting = false, bg = null, sprites = [];
    var keys = {}, touch = null;
    var best = api.best, dbest = api.dailyBest;
    function curBest() { return api.mode === 'daily' ? dbest : best; }
    tip.textContent = api.mobile ? '在画面上拖动，自机会在手指上方跟随' : '按方向键 / WASD 开始，Shift 低速，空白键暂停，F 全屏';
    if (api.mode === 'ghost') { title.textContent = '幽灵挑战'; $bestbox.style.display = 'none'; }
    else if (api.mode === 'daily') {
      title.textContent = '每日挑战';
      $bestbox.firstChild.textContent = '今日最佳 ';
      $best.textContent = dbest == null ? '-' : dbest;
    }
    function setText(el, v) { if (el._v !== v) { el._v = v; el.textContent = v; } }

    /* ---------- 版面：依可用空間放大（3:4 直式） ---------- */
    function isFull() { return document.fullscreenElement === stage || stage.classList.contains('gcd-focus'); }
    // 論壇固定在畫面頂端／底端的列（頂欄、手機底部導航）會蓋住畫面，量出來扣掉
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
      var avail = wrap.clientWidth, bb = bars();
      var h = (isFull() ? innerHeight - 20 : innerHeight - bb[0] - bb[1] - 24) - hudEl.offsetHeight - chase.offsetHeight - 16;
      var w = Math.floor(Math.max(240, Math.min(avail, h * 3 / 4, isFull() ? 1400 : 540)));
      board.style.width = w + 'px';
      board.style.height = Math.round(w * 4 / 3) + 'px';
      var dpr = Math.min(3, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(w * 4 / 3 * dpr);
      scale = cv.width / W;
      bg = null; makeSprites();
      draw(performance.now());
    }
    window.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', function () { setTimeout(fit, 50); });

    /* ---------- 預先畫好的子彈光暈與背景 ---------- */
    function makeSprites() {
      sprites = [];
      for (var k = 0; k < 5; k++) for (var r = 3; r <= 4; r++) {
        var R = r + 6, size = Math.ceil(R * 2 * scale), c = document.createElement('canvas');
        c.width = c.height = size;
        var x = c.getContext('2d'), m = size / 2;
        var g = x.createRadialGradient(m, m, 0, m, m, R * scale);
        g.addColorStop(0, '#fff'); g.addColorStop(r * 0.55 / R, '#fff');
        g.addColorStop(r / R, COLORS[k]); g.addColorStop((r + 2) / R, COLORS[k] + '66'); g.addColorStop(1, COLORS[k] + '00');
        x.fillStyle = g; x.fillRect(0, 0, size, size);
        sprites[k * 2 + (r - 3)] = c;
      }
    }
    function bgCanvas() {
      if (bg) return bg;
      bg = document.createElement('canvas');
      bg.width = cv.width; bg.height = cv.height;
      var b = bg.getContext('2d');
      b.setTransform(scale, 0, 0, scale, 0, 0);
      var g = b.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#070b18'); g.addColorStop(1, '#141c3a');
      b.fillStyle = g; b.fillRect(0, 0, W, H);
      b.strokeStyle = 'rgba(120,150,255,.25)'; b.lineWidth = 2;
      b.strokeRect(1, 1, W - 2, H - 2);
      return bg;
    }
    var STARS = [];
    (function () { var s = 12345; for (var i = 0; i < 60; i++) { s = (s * 48271) % 2147483647; var x = s % W; s = (s * 48271) % 2147483647; var y = s % H; s = (s * 48271) % 2147483647; STARS.push([x, y, 0.15 + (s % 40) / 100, 0.6 + (s % 7) / 10]); } })();

    /* ---------- 追分目標（本週排行） ---------- */
    function others() {
      return (api.rivals || []).filter(function (r) { return r.u !== api.uid; }).sort(function (a, b) { return b.s - a.s; });
    }
    function setChase(html) { if (chase._h !== html) { chase._h = html; chase.innerHTML = html; } }
    function updateChase() {
      if (api.mode === 'ghost') {
        if (!ghost) { setChase('<span>⚔ 幽灵挑战：同一局弹幕，对手的自机会以半透明幽灵同步出现</span>'); return; }
        var me = st ? st.sim.score : 0, diff = me - ghost.score;
        setChase('<span class="gcd-ghost">⚔ 你 <b>' + me + '</b> : <b>' + ghost.score + '</b> ' + esc(ghost.name) +
          '（对手最终 ' + ghost.final + ' 分）' + (ghost.over ? (me > ghost.final ? ' · <b>已经赢了！</b>' : ' · 再 <b>' + (ghost.final - me + 1) + '</b> 分就赢') :
          diff > 0 ? ' · 领先 ' + diff : diff < 0 ? ' · 落后 ' + (-diff) : '') + '</span>');
        return;
      }
      if (api.mode === 'daily') {
        var dd = st && st.info && st.info.daily;
        setChase('<span class="gcd-daily">📅 每日挑战' + (dd ? ' · 第 ' + dd.try + '/' + dd.tries + ' 次' : '') + ' · 今天全站同一局弹幕</span>');
        return;
      }
      if (!api.uid || !st && !(api.rivals || []).length) { setChase(''); return; }
      var list = others(), cur = st ? st.sim.score : 0, tgt = null;
      for (var i = list.length - 1; i >= 0; i--) if (list[i].s >= cur) { tgt = list[i]; break; }
      var rank = tgt ? (api.rivals || []).indexOf(tgt) + 1 : 0;
      if (!list.length) setChase('<span>本周还没有其他人上榜，抢第一！</span>');
      else if (!tgt) setChase('<span class="gcd-top">🏆 已超过本周所有人！</span>');
      else setChase('<span>🎯 再 <b>' + (tgt.s - cur + 1) + '</b> 分超过本周第 ' + rank + ' 名 <b>' + esc(tgt.n) + '</b>（' + tgt.s + '）</span>');
    }

    /* ---------- 一局 ---------- */
    function newGame(info) {
      var sim = DK.Sim(info.seed);
      st = { sim: sim, info: info, rec: DK.PosRec(), acc: 0, lastTs: 0, ready: READY, paused: false, over: false, newBest: false,
        prx: sim.px, pry: sim.py, endAt: 0, bannerAt: 0 };
      ghost = info.ghost ? newGhost(info.seed, info.ghost) : null;
      fx = []; shake = 0; flash = 0; banner = null;
      $graze._v = $score._v = $stage._v = $time._v = $lives._v = undefined;
      showCount();
      hud();
    }
    function newGhost(seed, gi) {
      var d = gi.data || {}, ticks = +d.ticks || 0, pos = DK.decodePos(String(d.pos || ''), ticks);
      if (!pos) return null;   // 對手的資料壞掉就不畫幽靈
      var g = DK.Sim(seed);
      g.name = gi.name || ('UID ' + gi.uid); g.final = +gi.score || 0; g.ticks = ticks; g.pos = pos; g.i = 0;
      return g;
    }
    function showCount() {
      var n = st && st.ready > 0 ? Math.ceil(st.ready / 40) : 0;
      if (n) { countEl.style.display = 'flex'; if (countEl._n !== n) { countEl._n = n; countEl.textContent = n; countEl.classList.remove('gcd-pop'); void countEl.offsetWidth; countEl.classList.add('gcd-pop'); } }
      else { countEl.style.display = 'none'; countEl._n = 0; }
    }
    function inputMove(S) {
      var kx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), ky = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (kx || ky) return DK.keysMove(kx, ky, keys.slow);
      if (touch) return DK.follow(S.px, S.py, Math.round(touch[0]), Math.round(touch[1]) - 40, 3);
      return [0, 0];
    }
    function tick() {
      var S = st.sim;
      if (st.ready > 0) { st.ready--; showCount(); return; }
      var mv = S.clampMove.apply(null, inputMove(S));
      st.prx = S.px; st.pry = S.py;
      st.rec.push(mv[0], mv[1]);
      var ev = S.step(mv[0], mv[1]);
      if (ghost && !ghost.over) {
        if (ghost.i < ghost.ticks) { ghost.step(ghost.pos.dx[ghost.i], ghost.pos.dy[ghost.i]); ghost.i++; }
        if (ghost.i >= ghost.ticks) ghost.over = true;
      }
      if (ev.start >= 0) banner = { t0: performance.now(), text: '第 ' + (ev.start + 1) + ' 阶段', sub: S.boss ? 'BOSS · ' + NAMES[S.p1] + ' + ' + NAMES[S.p2] : NAMES[S.p1], boss: S.boss };
      if (ev.graze) sparks(S.px, S.py, '#fff', Math.min(6, 2 + ev.graze * 2), 0.6);
      if (ev.clear >= 0) floatText(S.px, S.py - 22, '+' + (ev.clear % 4 === 3 ? 1000 : 500), '#ffd54a');
      if (ev.hit) { shake = 1; flash = 1; sparks(S.px, S.py, '#ff8aa8', 26, 1.4); }
      if (S.over) return finish();
      hud();
    }
    function finish() {
      var S = st.sim, win = S.win;
      st.over = true;
      st.endAt = performance.now();
      shake = win ? 0 : 1;
      var payload = { v: DK.RULE, score: S.score, ticks: S.t, pos: st.rec.str() };
      hud();
      api.submit(st.info, payload, win ? '完全制霸！' : '游戏结束').then(function (res) {
        if (res && res.ok && res.best != null) {
          if (res.mode === 'daily') dbest = res.best; else best = res.best;
          $best.textContent = res.best;
        }
        updateChase();
      });
      var g = st;
      setTimeout(function () {
        if (st !== g) return;   // 已經開了下一局，不要把結束畫面蓋回去
        cover.style.display = '';
        title.textContent = win ? '完全制霸！' : '游戏结束';
        tip.textContent = '本局 ' + S.score + ' 分' + (ghost ? (S.score > ghost.final ? ' · 赢了 ' + ghost.name + '！' : ' · 对手 ' + ghost.final + ' 分') : '');
        sum.innerHTML = '<span>存活 <b>' + mmss(Math.floor(S.t / 60)) + '</b></span><span>擦弹 <b>' + S.graze + '</b></span><span>阶段 <b>' +
          (Math.trunc((S.t - 1) / DK.STAGE) + 1) + '</b></span>';
        go.textContent = '再来一局';
      }, 600);
    }
    function hud() {
      var S = st.sim;
      setText($score, S.score);
      setText($stage, Math.trunc(Math.max(0, S.t - 1) / DK.STAGE) + 1);
      setText($graze, S.graze);
      setText($time, mmss(Math.floor(S.t / 60)));
      var lv = S.lives, hearts = '';
      for (var i = 0; i < DK.LIVES; i++) hearts += i < lv ? '♥' : '<i>♥</i>';
      if ($lives._v !== lv) { $lives._v = lv; $lives.innerHTML = hearts; }
      var cb = curBest();
      if (api.mode !== 'ghost' && cb != null && S.score > cb && !st.newBest) { st.newBest = true; $bestbox.classList.add('gcd-flash'); }
      if (st.newBest) $best.textContent = S.score;
      updateChase();
    }

    /* ---------- 特效（只影響畫面，亂數隨便用） ---------- */
    function sparks(x, y, color, n, speed) {
      var now = performance.now();
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, v = (40 + Math.random() * 70) * speed;
        fx.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t0: now, life: 300 + Math.random() * 300, color: color, r: 1 + Math.random() * 1.6 });
      }
    }
    function floatText(x, y, text, color) { fx.push({ x: x, y: y, t0: performance.now(), life: 1000, text: text, color: color }); }

    /* ---------- 繪圖 ---------- */
    function drawShip(x, y, alpha, color, blinkOff) {
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = blinkOff ? alpha * 0.35 : alpha;
      var fl = 4 + (Math.floor(performance.now() / 60) % 3);
      ctx.fillStyle = 'rgba(120,220,255,.55)';
      ctx.beginPath(); ctx.moveTo(-2.5, 6); ctx.lineTo(2.5, 6); ctx.lineTo(0, 6 + fl); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-15, 11); ctx.lineTo(-13, 2); ctx.lineTo(-7, -2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(15, 11); ctx.lineTo(13, 2); ctx.lineTo(7, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eaf7ff';
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 8); ctx.lineTo(0, 4); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    function drawBoss(S, ts) {
      var x = S.ex, y = S.ey, boss = S.boss, R = boss ? 17 : 8;
      var c1 = COLORS[S.p1], c2 = S.p2 >= 0 ? COLORS[S.p2] : c1;
      var g = ctx.createRadialGradient(x, y, 0, x, y, R * 2.6);
      g.addColorStop(0, c1 + 'aa'); g.addColorStop(1, c1 + '00');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 2.6, 0, Math.PI * 2); ctx.fill();
      if (boss) {
        // 翅膀＋旋轉的雙環
        ctx.fillStyle = c2 + '99';
        ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x - 34, y - 14); ctx.lineTo(x - 26, y + 8); ctx.lineTo(x - 8, y + 10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 6, y - 4); ctx.lineTo(x + 34, y - 14); ctx.lineTo(x + 26, y + 8); ctx.lineTo(x + 8, y + 10); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = c2; ctx.lineWidth = 1.5;
        for (var i = 0; i < 8; i++) {
          var a = ts / 500 + i * Math.PI / 4;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * 24, y + Math.sin(a) * 24, 2.2, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, R * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = c1; ctx.lineWidth = boss ? 3 : 2; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
    }
    function draw(ts) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (shake > 0) {
        var m = shake * 7;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
        shake = Math.max(0, shake - 0.05);
      }
      ctx.drawImage(bgCanvas(), 0, 0, W, H);
      ctx.fillStyle = '#fff';
      var sp = st && !st.paused && !st.over ? ts : 0;
      for (var i = 0; i < STARS.length; i++) {
        var s = STARS[i];
        ctx.globalAlpha = 0.25 + s[3] * 0.35;
        ctx.fillRect(s[0], (s[1] + sp * s[2] * 0.04) % H, s[3] * 1.3, s[3] * 1.3);
      }
      ctx.globalAlpha = 1;
      if (!st) { drawShip(DK.X0, DK.Y0, 1, '#69c8ff', false); drawFx(ts); return; }
      var S = st.sim, a = st.paused || st.over || st.ready > 0 ? 1 : Math.max(0, Math.min(1, st.acc / STEP_MS));
      // 階段進度條（頂端細線）
      var u = Math.max(0, S.t - 1) % DK.STAGE;
      ctx.fillStyle = S.boss ? 'rgba(255,93,143,.8)' : 'rgba(125,200,255,.6)';
      ctx.fillRect(0, 0, W * (S.t ? (u + 1) / DK.STAGE : 0), 2.5);
      drawBoss(S, ts);
      // 子彈：畫在「上一步與這一步之間」，與判定的狀態一致
      var B = S.B, k = 1 - a;
      for (var j = 0; j < B.length; j++) {
        var b = B[j], R = b.r + 6, sprite = sprites[b.k * 2 + (b.r - 3)];
        ctx.drawImage(sprite, (b.x - b.vx * k) / DK.FP - R, (b.y - b.vy * k) / DK.FP - R, R * 2, R * 2);
      }
      if (ghost) {
        var gx = ghost.px, gy = ghost.py;
        ctx.globalAlpha = ghost.over ? 0.2 : 0.55;
        drawShip(gx, gy, 1, '#ffd54a', false);
        ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        var label = ghost.name + ' ' + ghost.score + (ghost.over ? '（结束）' : ''), tw = ctx.measureText(label).width + 8;
        var lx = Math.max(tw / 2 + 2, Math.min(W - tw / 2 - 2, gx)), ly = gy < 40 ? gy + 34 : gy - 20;
        ctx.fillStyle = 'rgba(60,45,10,.7)'; ctx.fillRect(lx - tw / 2, ly - 10, tw, 14);
        ctx.fillStyle = '#ffe9a8'; ctx.fillText(label, lx, ly + 1);
        ctx.globalAlpha = 1;
      }
      var sx = st.prx + (S.px - st.prx) * a, sy = st.pry + (S.py - st.pry) * a;
      var dead = st.over && !S.win;
      if (!dead) {
        drawShip(sx, sy, 1, '#69c8ff', S.inv > 0 && Math.floor(S.inv / 4) % 2 === 0);
        if (keys.slow || api.mobile || touch) {
          if (keys.slow) { ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.stroke(); }
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ff4d79'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      if (banner) {
        var bk = (performance.now() - banner.t0) / 2200;
        if (bk >= 1) banner = null;
        else {
          ctx.globalAlpha = bk < 0.15 ? bk / 0.15 : bk > 0.7 ? (1 - bk) / 0.3 : 1;
          ctx.textAlign = 'center';
          ctx.font = 'bold 24px sans-serif'; ctx.fillStyle = banner.boss ? '#ff8aa8' : '#bfe3ff';
          ctx.fillText(banner.text, W / 2, 210);
          ctx.font = 'bold 13px sans-serif'; ctx.fillStyle = '#ffffffcc';
          ctx.fillText(banner.sub, W / 2, 232);
          ctx.globalAlpha = 1;
        }
      }
      drawFx(ts);
      if (flash > 0) { ctx.fillStyle = 'rgba(255,60,100,' + (flash * 0.35) + ')'; ctx.fillRect(0, 0, W, H); flash = Math.max(0, flash - 0.04); }
    }
    function drawFx(ts) {
      var now = performance.now();
      fx = fx.filter(function (p) { return now - p.t0 < p.life; });
      fx.forEach(function (p) {
        var k = (now - p.t0) / p.life, sec = (now - p.t0) / 1000;
        ctx.globalAlpha = 1 - k;
        if (p.text) {
          ctx.fillStyle = p.color; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(p.text, Math.max(30, Math.min(W - 30, p.x)), Math.max(16, p.y - k * 26));
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x + p.vx * sec, p.y + p.vy * sec, p.r * (1 - k * 0.5), 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }

    /* ---------- 主迴圈：固定每秒 60 步（累加器，單幀最多補 5 步），時間用 requestAnimationFrame 給的時間戳 ---------- */
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      if (st && !st.over && !st.paused) {
        if (!st.lastTs) st.lastTs = ts;
        else {
          st.acc += Math.min(ts - st.lastTs, 100);
          st.lastTs = ts;
          var n = 0;
          while (st.acc >= STEP_MS - 1e-6 && n < 5 && !st.over) { tick(); st.acc -= STEP_MS; n++; }
          if (st.acc > STEP_MS) st.acc = 0;
        }
      }
      draw(ts);
    }
    raf = requestAnimationFrame(frame);

    /* ---------- 操作 ---------- */
    function togglePause() {
      if (!st || st.over || starting) return;
      st.paused = !st.paused;
      cover.style.display = st.paused ? '' : 'none';
      keys = {};
      if (st.paused) {
        title.textContent = '暂停中';
        tip.textContent = '按空白键或 P 继续';
        sum.innerHTML = '';
        go.textContent = '继续';
      } else {
        st.lastTs = 0; st.acc = 0;
      }
    }
    function begin() {
      if (starting) return;
      if (st && !st.over && st.paused) return togglePause();
      if (st && !st.over) return;
      // 整個遊戲區捲到頂欄下方
      if (!isFull()) {
        var bb = bars(), top = hudEl.getBoundingClientRect().top, bottom = board.getBoundingClientRect().bottom;
        if (top < bb[0] || bottom > innerHeight - bb[1]) window.scrollBy({ top: top - bb[0] - 8, behavior: 'smooth' });
      }
      starting = true;
      go.disabled = true;
      api.start().then(function (info) {
        starting = false;
        go.disabled = false;
        if (!info) return;
        cover.style.display = 'none';
        sum.innerHTML = '';
        keys = {};
        $bestbox.classList.remove('gcd-flash');
        $best.textContent = curBest() == null ? '-' : curBest();
        newGame(info);
      });
    }
    function toggleFull() {
      if (document.fullscreenElement === stage) { document.exitFullscreen(); return; }
      if (stage.classList.contains('gcd-focus')) { stage.classList.remove('gcd-focus'); document.documentElement.classList.remove('gcd-noscroll'); fit(); return; }
      if (stage.requestFullscreen && !api.mobile) {
        stage.requestFullscreen().catch(function () { stage.classList.add('gcd-focus'); fit(); });
      } else {
        // 手機（iPhone 不支援元素全屏）改用整頁覆蓋的專注模式
        stage.classList.add('gcd-focus');
        document.documentElement.classList.add('gcd-noscroll');
        fit();
      }
    }
    // 可以開新局：沒在玩、沒開成績視窗、結束畫面已經出來
    function idle() { return (!st || st.over) && !starting && !stage.querySelector('.gc-modal') && cover.style.display !== 'none' && api.visible(board); }

    go.addEventListener('click', begin);
    q('.gcd-tools').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.t === 'pause') togglePause();
      else if (b.dataset.t === 'full') toggleFull();
      b.blur();
    });
    var DIRS = { ArrowRight: 'right', ArrowLeft: 'left', ArrowDown: 'down', ArrowUp: 'up', d: 'right', a: 'left', s: 'down', w: 'up' };
    function dirOf(e) { return DIRS[e.key] || DIRS[String(e.key).toLowerCase()]; }
    function typing(e) {
      var tg = e.target && e.target.tagName;
      return tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (e.target && e.target.isContentEditable);
    }
    document.addEventListener('keydown', function (e) {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      var playing = st && !st.over, d = dirOf(e);
      if (e.key === 'Shift') { keys.slow = true; return; }
      if (d) {
        if (playing) { if (api.visible(board)) e.preventDefault(); keys[d] = true; keys.slow = e.shiftKey; }
        else if (idle() && String(e.key).indexOf('Arrow') === 0) { e.preventDefault(); begin(); }
        else if (idle() && e.key.length === 1) begin();
      } else if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (playing && api.visible(board)) { e.preventDefault(); togglePause(); }
        else if (e.key === ' ' && idle()) { e.preventDefault(); begin(); }
      } else if (e.key === 'Enter' && idle() && e.target === document.body) {
        e.preventDefault(); begin();
      } else if ((e.key === 'f' || e.key === 'F') && api.visible(board)) {
        toggleFull();
      } else if (e.key === 'Escape' && stage.classList.contains('gcd-focus')) {
        toggleFull();
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.key === 'Shift') { keys.slow = false; return; }
      var d = dirOf(e);
      if (d) keys[d] = false;
    });
    // 手機：手指按住的位置就是目標，自機（每步最多 3）跟在手指上方 40 邏輯像素處
    function tpos(e) {
      var t = e.touches[0] || e.changedTouches[0], r = board.getBoundingClientRect();
      return [(t.clientX - r.left) * W / r.width, (t.clientY - r.top) * H / r.height];
    }
    board.addEventListener('touchstart', function (e) { if (st && !st.over && !st.paused) { e.preventDefault(); touch = tpos(e); } }, { passive: false });
    board.addEventListener('touchmove', function (e) { if (st && !st.over && !st.paused) { e.preventDefault(); touch = tpos(e); } }, { passive: false });
    board.addEventListener('touchend', function (e) { if (!e.touches.length) touch = null; });
    board.addEventListener('touchcancel', function () { touch = null; });
    document.addEventListener('visibilitychange', function () {
      keys = {}; touch = null;
      if (document.hidden && st && !st.over && !st.paused && !starting) togglePause();
    });
    updateChase();
    fit();
  });
})();
