/* GameCenter prototype. (C) 2026 Carinoasd. P0 implementation: 小典 / Codex. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DanmakuP0 = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SCENES = ['flower', 'aim', 'wave'];
  var Q = 64;
  function trunc(n) { return Math.trunc(n); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function validateInput(input, rules) {
    if (!input || !Number.isInteger(input.dx) || !Number.isInteger(input.dy) ||
        !Number.isInteger(input.flags) || input.flags < 0 || input.flags > 3) {
      throw new Error('输入格式或操作标记无效');
    }
    var limit = input.flags & 1 ? rules.player.slowStepQ : rules.player.normalStepQ;
    if (Math.abs(input.dx) > limit || Math.abs(input.dy) > limit ||
        input.dx * input.dx + input.dy * input.dy > limit * limit) {
      throw new Error('移动速度超出规则上限');
    }
  }
  // Relative segment versus circle; broad phase bounds all later integer products.
  function sweptHit(x0, y0, x1, y1, radius) {
    if (Math.min(x0, x1) > radius || Math.max(x0, x1) < -radius ||
        Math.min(y0, y1) > radius || Math.max(y0, y1) < -radius) return false;
    var vx = x1 - x0, vy = y1 - y0;
    var length = vx * vx + vy * vy, rr = radius * radius;
    if (!length) return x0 * x0 + y0 * y0 <= rr;
    var dot = x0 * vx + y0 * vy;
    if (dot >= 0) return x0 * x0 + y0 * y0 <= rr;
    if (dot <= -length) return x1 * x1 + y1 * y1 <= rr;
    var cross = x0 * vy - y0 * vx;
    return cross * cross <= rr * length;
  }
  function touches(bullet, actor, radius) {
    return sweptHit(bullet.px - actor.px, bullet.py - actor.py,
      bullet.x - actor.x, bullet.y - actor.y, radius);
  }
  function bossX(tick) {
    var u = (tick - 1) % 480, offset;
    if (u < 120) offset = trunc(4096 * u / 120);
    else if (u < 360) offset = 4096 - trunc(8192 * (u - 120) / 240);
    else offset = -4096 + trunc(4096 * (u - 360) / 120);
    return 240 * Q + offset;
  }
  function Sim(rules, scene, assist) {
    if (SCENES.indexOf(scene) < 0 || typeof assist !== 'boolean') throw new Error('未知的原型场景');
    this.rules = rules;
    this.scene = scene;
    this.assist = assist;
    this.tick = 0;
    this.status = 'playing';
    this.player = { x: 240 * Q, y: 552 * Q, px: 240 * Q, py: 552 * Q,
      lives: assist ? rules.assist.lives : rules.player.standardLives,
      bombs: assist ? rules.assist.bombs : rules.player.standardBombs, invulUntil: 0 };
    this.boss = { x: 240 * Q, y: 88 * Q, px: 240 * Q, py: 88 * Q };
    this.enemies = [];
    this.shots = [];
    this.nextEnemy = 1;
    this.nextShot = 1;
    this.aimAngle = 128;
    this.warningUntil = 0;
    this.lastHit = -999;
    this.lastBomb = -999;
    this.stats = { damage: 0, shotHits: 0, hitsTaken: 0, graze: 0, bombsUsed: 0,
      enemySpawned: 0, enemyPeak: 0 };
  }
  Sim.prototype.spawn = function (x, y, angle, speed, radius) {
    var r = this.rules, vector = r.directionVectors[(angle % 512 + 512) % 512];
    if (this.assist) speed = trunc(speed * r.assist.enemySpeedNumerator / r.assist.enemySpeedDenominator);
    this.enemies.push({ id: this.nextEnemy++, x: x, y: y, px: x, py: y,
      vx: trunc(speed * vector[0] / 1024), vy: trunc(speed * vector[1] / 1024),
      radius: radius, born: this.tick, grazed: false });
    this.stats.enemySpawned++;
    if (this.enemies.length > r.limits.enemyLiveCap || this.stats.enemySpawned > r.limits.enemySpawnCap) {
      throw new Error('弹幕超出设计上限，本局已停止');
    }
    this.stats.enemyPeak = Math.max(this.stats.enemyPeak, this.enemies.length);
  };
  Sim.prototype.pattern = function () {
    var t = this.tick, r = this.rules, pattern = r.patterns[this.scene];
    var q = 1 + (t - 1) % 720, c = trunc((t - 1) / 720), i, j;
    if (this.scene === 'flower' && t >= pattern.firstTick && (t - pattern.firstTick) % pattern.intervalTicks === 0) {
      var n = trunc((t - pattern.firstTick) / pattern.intervalTicks);
      var rotation = pattern.rotationSequence[n % pattern.rotationSequence.length];
      for (i = 0; i < pattern.ringSlots; i++) {
        if (pattern.omittedIndices.indexOf(i) < 0) this.spawn(this.boss.x, this.boss.y,
          rotation + i * pattern.slotAngleUnits, pattern.speedStepQ, pattern.radius);
      }
    }
    if (this.scene === 'aim') {
      if (q === pattern.captureCycleTick) {
        var dx = this.player.x - this.boss.x, dy = this.player.y - this.boss.y, best = -Infinity;
        for (i = 0; i < r.directionVectors.length; i++) {
          var dot = dx * r.directionVectors[i][0] + dy * r.directionVectors[i][1];
          if (dot > best) { best = dot; this.aimAngle = i; }
        }
        this.warningUntil = t + 30;
      }
      if (pattern.fireCycleTicks.indexOf(q) >= 0) {
        for (i = 0; i < pattern.angleOffsets.length; i++) this.spawn(this.boss.x, this.boss.y,
          this.aimAngle + pattern.angleOffsets[i], pattern.speedStepQ, pattern.radius);
      }
    }
    if (this.scene === 'wave') {
      for (i = 0; i < pattern.batchCycleTicks.length; i++) {
        var row = pattern.rowOffsets.indexOf(q - pattern.batchCycleTicks[i]);
        if (row < 0) continue;
        var gap = pattern.gapStartSequence[(2 * c + i) % pattern.gapStartSequence.length];
        for (j = 0; j < pattern.columnsX.length; j++) {
          if (j < gap || j >= gap + pattern.omitColumns) this.spawn(
            (pattern.columnsX[j] + pattern.rowShiftSequence[row]) * Q,
            112 * Q, 128, pattern.speedStepQ, pattern.radius);
        }
      }
    }
  };
  Sim.prototype.step = function (input) {
    if (this.status !== 'playing') throw new Error('终局后不能追加输入');
    validateInput(input, this.rules);
    this.tick++;
    var t = this.tick, r = this.rules, p = this.player, b = this.boss;
    p.px = p.x; p.py = p.y; b.px = b.x; b.py = b.y;
    p.x = clamp(p.x + input.dx, r.field.playerBounds.minX * Q, r.field.playerBounds.maxX * Q);
    p.y = clamp(p.y + input.dy, r.field.playerBounds.minY * Q, r.field.playerBounds.maxY * Q);
    b.x = bossX(t);
    if ((t - r.playerShot.firstPhaseTick) % r.playerShot.intervalTicks === 0) {
      this.shots.push({ id: this.nextShot++, x: p.x, y: p.y - 16 * Q,
        px: p.x, py: p.y - 16 * Q, born: t });
      if (this.shots.length > r.limits.playerShotLiveCap) throw new Error('自机子弹超出设计上限');
    }
    this.pattern();
    this.enemies.forEach(function (e) { e.px = e.x; e.py = e.y; e.x += e.vx; e.y += e.vy; });
    this.shots.forEach(function (s) { s.px = s.x; s.py = s.y; s.y -= r.playerShot.speedStepQ; });
    if ((input.flags & 2) && p.bombs > 0) {
      p.bombs--; this.stats.bombsUsed++; this.lastBomb = t;
      this.enemies = [];
      p.invulUntil = Math.max(p.invulUntil, t + r.player.bombInvulnerabilityTicks);
    }
    if (t >= p.invulUntil) {
      var collided = new Set();
      this.enemies.forEach(function (e) {
        if (touches(e, p, (r.player.hitRadius + e.radius) * Q)) collided.add(e.id);
      });
      if (collided.size) {
        p.lives--; this.stats.hitsTaken++; this.lastHit = t;
        p.invulUntil = Math.max(p.invulUntil, t + r.player.hitInvulnerabilityTicks);
        var clearRadius = r.player.hitClearRadius * Q;
        this.enemies = this.enemies.filter(function (e) {
          return !collided.has(e.id) && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > clearRadius ** 2;
        });
      }
    }
    if (p.lives <= 0) this.status = 'dead';
    else {
      var sim = this;
      this.shots = this.shots.filter(function (s) {
        if (!touches(s, b, (r.playerShot.radius + r.boss.hitRadius) * Q)) return true;
        sim.stats.damage += r.playerShot.damage; sim.stats.shotHits++;
        return false;
      });
      if (t >= r.clock.singlePatternTicks) this.status = 'complete';
      else if (t >= p.invulUntil) this.enemies.forEach(function (e) {
        if (!e.grazed && touches(e, p, (r.player.grazeCenterRadius + e.radius) * Q)) {
          e.grazed = true; sim.stats.graze++;
        }
      });
    }
    var margin = r.field.enemyCullMargin * Q;
    function inside(e) { return e.x >= -margin && e.x <= r.field.width * Q + margin &&
      e.y >= -margin && e.y <= r.field.height * Q + margin; }
    this.enemies = this.enemies.filter(function (e) { return t - e.born + 1 < 480 && inside(e); });
    this.shots = this.shots.filter(function (s) { return t - s.born + 1 < r.playerShot.ttlTicks && inside(s); });
    return this.status;
  };
  Sim.prototype.snapshot = function () {
    var p = this.player, s = this.stats;
    return { tick: this.tick, scene: this.scene, assist: this.assist, status: this.status,
      player: [p.x, p.y, p.lives, p.bombs, p.invulUntil], boss: [this.boss.x, this.boss.y],
      aim: [this.aimAngle, this.warningUntil],
      stats: [s.damage, s.shotHits, s.hitsTaken, s.graze, s.bombsUsed, s.enemySpawned, s.enemyPeak],
      nextIds: [this.nextEnemy, this.nextShot],
      enemies: this.enemies.map(function (e) { return [e.id, e.x, e.y, e.vx, e.vy, e.radius, e.born, e.grazed ? 1 : 0]; }),
      shots: this.shots.map(function (shot) { return [shot.id, shot.x, shot.y, shot.born]; }) };
  };
  return { Sim: Sim, validateInput: validateInput, sweptHit: sweptHit, bossX: bossX, scenes: SCENES };
}));
