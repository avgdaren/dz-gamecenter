/** 作者：GPT / Codex。Node/PHP 标准库自测，无 npm 包、无数据库。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const php = process.env.PHP_BIN || 'php';
const manifest = JSON.parse(readFileSync(path.join(dir, '../game.json'), 'utf8'));
assert.equal(manifest.order, 'asc');
assert.equal(manifest.unit, '次');
assert.equal(manifest.script, 'game.js');
execFileSync(process.execPath, ['--check', path.join(dir, '../game.js')]);
for (const file of ['../verify.php', 'verify-cli.php']) {
  execFileSync(php, ['-n', '-l', path.join(dir, file)]);
}

// 固定向量锁定 shuffle 次序，不能用 verifier 自己生成的牌组作期望。
const vectors = [
  [1, [3, 4, 0, 3, 1, 5, 2, 1, 2, 6, 7, 0, 5, 6, 4, 7]],
  [2, [5, 4, 2, 7, 6, 1, 0, 3, 0, 2, 5, 3, 6, 4, 1, 7]],
  [42, [3, 0, 7, 5, 5, 6, 2, 7, 4, 2, 4, 1, 0, 1, 6, 3]],
  [123456789, [0, 4, 4, 3, 0, 3, 6, 7, 2, 7, 2, 5, 1, 6, 5, 1]],
  [2147483645, [6, 1, 4, 7, 4, 5, 3, 7, 6, 1, 2, 0, 5, 3, 2, 0]],
  [2147483646, [1, 5, 0, 4, 4, 7, 3, 2, 2, 5, 7, 3, 6, 1, 6, 0]]
];
const cases = [];
const expected = [];
function add(name, request, result) { cases.push(request); expected.push([name, result]); }
function solution(cards) {
  return Array.from({ length: 8 }, (_, value) => cards.flatMap((card, index) => card === value ? [index] : []));
}
for (const [seed, cards] of vectors) {
  add(`deck ${seed}`, { op: 'deck', seed }, cards);
  const pairs = solution(cards);
  const mismatch = [0, cards.findIndex(value => value !== cards[0])];
  for (const misses of [0, 1, 19, 248]) {
    const moves = Array.from({ length: misses }, () => mismatch).flat().concat(pairs.flat());
    const score = misses + 8;
    add(`valid seed=${seed} attempts=${score}`, { seed, data: { v: '1', score: String(score), moves: moves.join(',') } }, { ok: 1, score });
  }
}

const seed = vectors[0][0];
const pairs = solution(vectors[0][1]);
const valid = { v: '1', score: '8', moves: pairs.flat().join(',') };
const bad = (name, data, badSeed = seed) => add(name, { seed: badSeed, data }, { ok: 0 });
for (const key of ['v', 'score', 'moves']) {
  const data = { ...valid }; delete data[key]; bad(`missing ${key}`, data);
  bad(`array ${key}`, { ...valid, [key]: [] });
  bad(`null ${key}`, { ...valid, [key]: null });
}
for (const score of ['7', '257', '08', '+8', '-8', '8.0', '8\n', ' 8', '999999999999999999999999']) {
  bad(`bad score ${JSON.stringify(score)}`, { ...valid, score });
}
for (const v of ['2', '01', '1.0', '1\n']) bad(`bad version ${JSON.stringify(v)}`, { ...valid, v });
for (const raw of ['', valid.moves + '\n', ' ' + valid.moves, '00,' + valid.moves, '16,' + valid.moves,
  '-1,' + valid.moves, valid.moves + ',', valid.moves.replace(',', ',,'), valid.moves + '\0',
  valid.moves.split(',').slice(1).join(','), Array(514).fill(0).join(','), '0,'.repeat(1100)]) {
  bad(`bad moves ${JSON.stringify(raw).slice(0, 60)}`, { ...valid, moves: raw });
}
bad('same card twice', { ...valid, score: '9', moves: [0, 0, ...pairs.flat()].join(',') });
bad('reuse matched card', { ...valid, score: '9', moves: [...pairs[0], ...pairs[0], ...pairs.slice(1).flat()].join(',') });
bad('unfinished at 8 attempts', { ...valid, moves: Array(8).fill([0, 1]).flat().join(',') });
bad('operations after completion', { ...valid, score: '9', moves: [...pairs.flat(), 0, 1].join(',') });
bad('score forgery', { ...valid, score: '9' });
for (const value of [0, 2147483647, '1', 1.5]) bad(`bad seed ${value}`, valid, value);

const results = JSON.parse(execFileSync(php, ['-n', path.join(dir, 'verify-cli.php')], {
  input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 1024 * 1024
}));
assert.equal(results.length, cases.length);
expected.forEach(([name, result], index) => {
  if (Array.isArray(result) || result.ok === 1) assert.deepEqual(results[index], result, name);
  else {
    assert.equal(results[index].ok, 0, name);
    assert.equal(typeof results[index].reason, 'string', name);
    assert.ok(results[index].reason.length, name);
  }
});
assert.equal(execFileSync(php, ['-n', path.join(dir, '../verify.php')], { encoding: 'utf8' }), 'Access Denied');
console.log(`PASS: syntax / manifest / access guard; ${cases.length} shuffle and replay cases (${vectors.length} fixed seeds, 8–256 attempts).`);
