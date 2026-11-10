/* (C) 2026 Carinoasd. P0 local replay codec: 小典 / Codex. No network requests. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.DanmakuReplay = factory(root.DanmakuP0);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  'use strict';
  function base64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    var text = '';
    for (var i = 0; i < bytes.length; i += 4096) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 4096));
    return btoa(text);
  }
  function encode(records, rules, scene, assist) {
    if (!records.length || records.length > rules.clock.singlePatternTicks) throw new Error('回放步数无效');
    var bytes = new Uint8Array(records.length * 5), view = new DataView(bytes.buffer);
    records.forEach(function (input, index) {
      engine.validateInput(input, rules);
      view.setInt16(index * 5, input.dx, true); view.setInt16(index * 5 + 2, input.dy, true);
      view.setUint8(index * 5 + 4, input.flags);
    });
    return { prototype: true, rule: rules.meta.rulesId, scene: scene, assist: assist,
      ticks: records.length, input: base64(bytes) };
  }
  function decode(payload, rules) {
    var allowed = ['prototype', 'rule', 'scene', 'assist', 'ticks', 'input'];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).some(function (key) { return allowed.indexOf(key) < 0; }) ||
        payload.prototype !== true || payload.rule !== rules.meta.rulesId ||
        engine.scenes.indexOf(payload.scene) < 0 || typeof payload.assist !== 'boolean' ||
        !Number.isInteger(payload.ticks) || payload.ticks < 1 || payload.ticks > rules.clock.singlePatternTicks ||
        typeof payload.input !== 'string' || payload.input.length > 4 * Math.ceil(payload.ticks * 5 / 3) ||
        payload.input.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload.input)) {
      throw new Error('回放格式、版本或步数无效');
    }
    var bytes;
    if (typeof Buffer !== 'undefined') bytes = Uint8Array.from(Buffer.from(payload.input, 'base64'));
    else bytes = Uint8Array.from(atob(payload.input), function (x) { return x.charCodeAt(0); });
    if (bytes.length !== payload.ticks * 5 || base64(bytes) !== payload.input) throw new Error('回放字节长度或编码无效');
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), records = [];
    for (var i = 0; i < payload.ticks; i++) {
      var input = { dx: view.getInt16(i * 5, true), dy: view.getInt16(i * 5 + 2, true), flags: view.getUint8(i * 5 + 4) };
      engine.validateInput(input, rules); records.push(input);
    }
    return records;
  }
  function run(payload, rules, partial) {
    var records = decode(payload, rules), sim = new engine.Sim(rules, payload.scene, payload.assist), trace = [];
    records.forEach(function (input) {
      sim.step(input);
      if (sim.tick % 60 === 0 || sim.status !== 'playing') trace.push(sim.snapshot());
    });
    if (!partial && sim.status === 'playing') throw new Error('回放尚未自然结束');
    return { snapshot: sim.snapshot(), trace: trace };
  }
  return { encode: encode, decode: decode, run: run };
}));
