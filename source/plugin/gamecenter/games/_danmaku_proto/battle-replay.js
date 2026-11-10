/* (C) 2026 Carinoasd. P1 local replay schema: 小典 / Codex. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./battle.js'), require('./replay.js'));
  else root.DanmakuBattleReplay = factory(root.DanmakuBattle, root.DanmakuReplay);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (battle, codec) {
  'use strict';
  function encode(records, rules, sim) {
    return { battle: true, v: 1, rule: battle.rule, assist: sim.assist, ticks: records.length,
      input: codec.encodeInputs(records, rules, rules.clock.standardMaxTicks), score: sim.score().total };
  }
  function decode(payload, rules) {
    var allowed = ['battle', 'v', 'rule', 'assist', 'ticks', 'input', 'score'];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).some(function(k) { return allowed.indexOf(k) < 0; }) ||
        payload.battle !== true || payload.v !== 1 || payload.rule !== battle.rule || typeof payload.assist !== 'boolean' ||
        !Number.isInteger(payload.score) || payload.score < 0 || payload.score > rules.score.upperBound) {
      throw new Error('完整挑战回放格式、版本或分数无效');
    }
    return codec.decodeInputs(payload.ticks, payload.input, rules, rules.clock.standardMaxTicks);
  }
  function run(payload, rules, partial, traceEnabled) {
    var records = decode(payload, rules), sim = new battle.Battle(rules, payload.assist), trace = [];
    records.forEach(function(input) {
      var stage = sim.stage, phase = sim.phaseIndex;
      sim.step(input);
      if (traceEnabled !== false && (sim.tick % 60 === 0 || sim.status !== 'playing' || stage !== sim.stage || phase !== sim.phaseIndex)) trace.push(sim.snapshot());
    });
    if (!partial && sim.status === 'playing') throw new Error('完整挑战尚未自然结束');
    if (sim.score().total !== payload.score) throw new Error('重算分数与回放不符');
    return { snapshot: sim.snapshot(), trace: trace };
  }
  return { encode: encode, decode: decode, run: run };
}));
