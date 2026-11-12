/* (C) 2026 Carinoasd. Three-phase P1 battle: 小典 / Codex. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'),require('./boss-patterns.js'));
  else root.DanmakuBattle = factory(root.DanmakuP0,root.DanmakuBossPatterns);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine,patterns) {
  'use strict';
  var RULE = 'danmaku-p1-r1', FOCUS_RULE = 'danmaku-p1-r2', PATTERN_RULE='danmaku-p1-r3';
  function Phase(rules, index, assist, focusFire, patternV3) {
    engine.Sim.call(this, rules, index === 1 ? 'aim' : 'flower', assist, focusFire ? engine.focusRule : engine.rule);
    this.patternV3=!!patternV3;
    this.index = index;
    this.hp = rules.boss.phaseHP[index];
  }
  Phase.prototype = Object.create(engine.Sim.prototype);
  Phase.prototype.constructor = Phase;
  Phase.prototype.damageBoss = function (damage) {
    var applied = Math.min(this.hp, damage);
    this.hp -= applied;
    this.stats.damage += applied;
    if (applied > 0) this.stats.shotHits++;
  };
  Phase.prototype.resolveEnd = function () {
    if (this.hp <= 0) this.status = 'phase_clear';
    else if (this.tick >= this.rules.clock.phaseMaxTicks) this.status = 'timeout';
  };
  Phase.prototype.pattern = function () {
    if(this.patternV3){patterns.pattern(this);return;}
    if (this.index === 0) return engine.Sim.prototype.pattern.call(this);
    if (this.index === 1) {
      this.scene = 'aim'; engine.Sim.prototype.pattern.call(this);
      this.scene = 'wave'; engine.Sim.prototype.pattern.call(this); this.scene = 'aim';
      return;
    }
    var r = this.rules, p = r.patterns.phase3, wave = r.patterns.wave;
    var q = 1 + (this.tick - 1) % p.cycleTicks, c = Math.trunc((this.tick - 1) / p.cycleTicks);
    var j = p.flowerCycleTicks.indexOf(q), i;
    if (j >= 0) {
      var rotations = r.patterns.flower.rotationSequence, rotation = rotations[(3 * c + j) % rotations.length];
      for (i = 0; i < 32; i++) if (p.flowerOmittedIndices.indexOf(i) < 0) {
        this.spawn(this.boss.x, this.boss.y, rotation + i * 16, p.flowerSpeedStepQ, 5);
      }
    }
    for (i = 0; i < p.waveBatchCycleTicks.length; i++) {
      var row = wave.rowOffsets.indexOf(q - p.waveBatchCycleTicks[i]);
      if (row < 0) continue;
      var gap = wave.gapStartSequence[(2 * c + i) % wave.gapStartSequence.length];
      for (j = 0; j < wave.columnsX.length; j++) if (j < gap || j >= gap + p.waveOmitColumns) {
        this.spawn((wave.columnsX[j] + wave.rowShiftSequence[row]) * 64, 112 * 64, 128, p.waveSpeedStepQ, 6);
      }
    }
    if (q === p.aimCaptureCycleTick) {
      var dx = this.player.x - this.boss.x, dy = this.player.y - this.boss.y, best = -Infinity;
      for (i = 0; i < r.directionVectors.length; i++) {
        var dot = dx * r.directionVectors[i][0] + dy * r.directionVectors[i][1];
        if (dot > best) { best = dot; this.aimAngle = i; }
      }
      this.warningUntil = this.tick + 30;
    }
    if (p.aimFireCycleTicks.indexOf(q) >= 0) for (i = 0; i < p.aimAngleOffsets.length; i++) {
      this.spawn(this.boss.x, this.boss.y, this.aimAngle + p.aimAngleOffsets[i], p.aimSpeedStepQ, 4);
    }
  };
  function Battle(rules, assist, rule) {
    if (typeof assist !== 'boolean') throw new Error('辅助模式参数无效');
    if (rule === undefined) rule = RULE;
    if (rule !== RULE && rule !== FOCUS_RULE && rule !== PATTERN_RULE) throw new Error('未知的战斗规则版本');
    this.rule = rule;
    this.rules = rules;
    this.assist = assist;
    this.tick = 0;
    this.activeTicks = 0;
    this.phaseIndex = 0;
    this.phaseBreaks = 0;
    this.status = 'playing';
    this.stage = 'opening';
    this.remaining = rules.clock.introTicks;
    this.sim = new Phase(rules, 0, assist, rule !== RULE, rule === PATTERN_RULE);
    this.stats = this.sim.stats;
    this.events = [];
    this.remainingInvulnerability = 0;
  }
  Battle.prototype.idleMove = function (input) {
    var p = this.sim.player, bounds = this.rules.field.playerBounds;
    p.px = p.x; p.py = p.y;
    p.x = Math.max(bounds.minX * 64, Math.min(bounds.maxX * 64, p.x + input.dx));
    p.y = Math.max(bounds.minY * 64, Math.min(bounds.maxY * 64, p.y + input.dy));
  };
  Battle.prototype.nextPhase = function () {
    var old = this.sim, next = new Phase(this.rules, ++this.phaseIndex, this.assist, this.rule !== RULE, this.rule === PATTERN_RULE);
    next.player.x = next.player.px = old.player.x;
    next.player.y = next.player.py = old.player.y;
    next.player.lives = old.player.lives; next.player.bombs = old.player.bombs;
    next.player.invulUntil = Math.max(0, this.remainingInvulnerability - this.rules.clock.transitionTicks);
    next.stats = this.stats;
    next.nextEnemy = old.nextEnemy; next.nextShot = old.nextShot;
    this.sim = next;
  };
  Battle.prototype.step = function (input) {
    if (this.status !== 'playing') throw new Error('终局后不能追加输入');
    engine.validateInput(input, this.rules);
    if (this.tick >= this.rules.clock.standardMaxTicks) throw new Error('对局超过逻辑上限');
    this.tick++;
    if (this.stage !== 'active') {
      this.idleMove(input);
      this.remaining--;
      if (this.remaining === 0) {
        if (this.stage === 'transition') this.nextPhase();
        this.stage = 'active';
      }
      return this.status;
    }
    this.activeTicks++;
    var status = this.sim.step(input);
    if (status === 'dead' || status === 'timeout') {
      this.status = status; this.stage = 'over';
    } else if (status === 'phase_clear') {
      this.phaseBreaks++;
      this.events.push({ tick: this.tick, phase: this.phaseIndex, activeTicks: this.activeTicks,
        lives: this.sim.player.lives, bombs: this.sim.player.bombs });
      this.sim.enemies = []; this.sim.shots = [];
      if (this.phaseIndex === 2) { this.status = 'clear'; this.stage = 'over'; }
      else {
        this.remainingInvulnerability = Math.max(0, this.sim.player.invulUntil - this.sim.tick);
        this.stage = 'transition'; this.remaining = this.rules.clock.transitionTicks;
      }
    }
    return this.status;
  };
  Battle.prototype.score = function () {
    var r = this.rules.score, clear = this.status === 'clear', p = this.sim.player;
    var parts = { clear: clear ? r.clear : 0, phase: this.phaseBreaks * r.phaseBreak,
      damage: Math.trunc(Math.min(this.stats.damage, r.standardTotalHP) * r.totalDamageBudget / r.standardTotalHP),
      graze: Math.min(this.stats.graze, r.grazeBulletCap) * r.grazePerBullet,
      resources: clear ? p.lives * r.remainingLifeOnClear + p.bombs * r.remainingBombOnClear : 0,
      time: clear ? Math.min(r.timeBonusCap, Math.max(0,
        Math.trunc((r.totalPhaseBudgetTicks - this.activeTicks) * r.timePointsPerSavedSecond / 60))) : 0 };
    parts.total = parts.clear + parts.phase + parts.damage + parts.graze + parts.resources + parts.time;
    return parts;
  };
  Battle.prototype.snapshot = function () {
    return { rule: this.rule, tick: this.tick, activeTicks: this.activeTicks, assist: this.assist,
      phase: this.phaseIndex, phaseBreaks: this.phaseBreaks, stage: this.stage, remaining: this.remaining,
      status: this.status, hp: this.sim.hp, score: this.score(), events: this.events.map(function(e) { return Object.assign({}, e); }),
      sim: this.sim.snapshot() };
  };
  return { Battle: Battle, Phase: Phase, rule: RULE, focusRule: FOCUS_RULE, patternRule: PATTERN_RULE, supportedRules: [RULE, FOCUS_RULE, PATTERN_RULE] };
}));
