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
  function encodeInputs(records, rules, maxTicks) {
    if (!records.length || records.length > maxTicks) throw new Error('回放步数无效');
    var bytes = new Uint8Array(records.length * 5), view = new DataView(bytes.buffer);
    records.forEach(function (input, index) {
      engine.validateInput(input, rules);
      view.setInt16(index * 5, input.dx, true); view.setInt16(index * 5 + 2, input.dy, true);
      view.setUint8(index * 5 + 4, input.flags);
    });
    return base64(bytes);
  }
  function encode(records, rules, scene, assist) {
    return { prototype: true, rule: rules.meta.rulesId, scene: scene, assist: assist,
      ticks: records.length, input: encodeInputs(records, rules, rules.clock.singlePatternTicks) };
  }
  function decode(payload, rules) {
    var allowed = ['prototype', 'rule', 'scene', 'assist', 'ticks', 'input'];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).some(function (key) { return allowed.indexOf(key) < 0; }) ||
        payload.prototype !== true || payload.rule !== rules.meta.rulesId ||
        engine.scenes.indexOf(payload.scene) < 0 || typeof payload.assist !== 'boolean') {
      throw new Error('回放格式、版本或步数无效');
    }
    return decodeInputs(payload.ticks, payload.input, rules, rules.clock.singlePatternTicks);
  }
  function decodeInputs(ticks, input, rules, maxTicks) {
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > maxTicks || typeof input !== 'string' ||
        input.length > 4 * Math.ceil(ticks * 5 / 3) || input.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) {
      throw new Error('回放格式、版本或步数无效');
    }
    var bytes;
    if (typeof Buffer !== 'undefined') bytes = Uint8Array.from(Buffer.from(input, 'base64'));
    else bytes = Uint8Array.from(atob(input), function (x) { return x.charCodeAt(0); });
    if (bytes.length !== ticks * 5 || base64(bytes) !== input) throw new Error('回放字节长度或编码无效');
    var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), records = [];
    for (var i = 0; i < ticks; i++) {
      var value = { dx: view.getInt16(i * 5, true), dy: view.getInt16(i * 5 + 2, true), flags: view.getUint8(i * 5 + 4) };
      engine.validateInput(value, rules); records.push(value);
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
  return { encode: encode, decode: decode, run: run, encodeInputs: encodeInputs, decodeInputs: decodeInputs };
}));
