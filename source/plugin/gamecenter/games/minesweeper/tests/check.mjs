/**
 * tests/check.mjs — 扫雷的 JS/PHP 对拍与校验用例。
 * 用法：node tests/check.mjs            （默认找 E:/dzx5-env/php/php.exe，或设 PHP_BIN）
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const W = 16, H = 16, CELLS = 256, MINES = 40, SAFE = 216;
const PHP = process.env.PHP_BIN || (fs.existsSync('E:/dzx5-env/php/php.exe') ? 'E:/dzx5-env/php/php.exe' : 'php');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

function runPhp(script, payload) {
  const r = spawnSync(PHP, [path.join(HERE, script)], {
    input: JSON.stringify(payload), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024
  });
  if (r.error) { throw new Error(script + ': ' + r.error.message); }
  if (r.status !== 0) { throw new Error(script + ' exited ' + r.status + ': ' + (r.stderr || '')); }
  return r.stdout;
}

/** 与 game.js / verify.php 相同的盘面生成。 */
function makeBoard(seed, first) {
  const idx = [];
  for (let i = 0; i < CELLS; i++) idx.push(i);
  let s = seed;
  for (let i = 0; i < MINES; i++) {
    s = s * 48271 % 2147483647;
    const j = i + s % (CELLS - i);
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  const mine = new Uint8Array(CELLS);
  for (let i = 0; i < MINES; i++) mine[idx[i]] = 1;
  const fx = first % W, fy = (first - fx) / W;
  const guard = new Set();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = fx + dx, y = fy + dy;
      if (x >= 0 && y >= 0 && x < W && y < H) guard.add(y * W + x);
    }
  }
  if (idx.slice(0, MINES).some(k => guard.has(k))) {
    const free = [];
    for (let i = 0; i < CELLS; i++) if (!mine[i] && !guard.has(i)) free.push(i);
    for (let i = 0; i < MINES; i++) {
      const k = idx[i];
      if (!guard.has(k)) continue;
      s = s * 48271 % 2147483647;
      const p = s % free.length;
      const to = free[p];
      free[p] = free[free.length - 1];
      free.pop();
      mine[k] = 0;
      mine[to] = 1;
    }
  }
  return mine;
}

console.log('\n== 1. JS / PHP 盘面对拍 ==');
const pairs = [
  [1, 0], [12345, 0], [2147483646, 255], [777, 120], [42, 17],
  [999999, 12], [5, 99], [123456789, 200], [2026, 31], [31337, 3]
];
const phpBoards = JSON.parse(runPhp('board-cli.php', pairs.map(([seed, first]) => ({ seed, first }))));
let parityOk = phpBoards.length === pairs.length;
for (let i = 0; i < pairs.length && parityOk; i++) {
  const js = Array.from(makeBoard(pairs[i][0], pairs[i][1]));
  const php = phpBoards[i];
  if (js.length !== CELLS || php.length !== CELLS) { parityOk = false; break; }
  for (let k = 0; k < CELLS; k++) {
    if ((js[k] ? 1 : 0) !== (Number(php[k]) ? 1 : 0)) { parityOk = false; console.log('    差异 @ pair ' + i + ' cell ' + k); break; }
  }
}
check('10 组种子 + 首点的雷位完全一致', parityOk);

console.log('\n== 2. 盘面不变量（200 组随机） ==');
let countOk = true, guardOk = true, dupOk = true;
for (let n = 0; n < 200; n++) {
  const seed = 1000 + (n * 104729) % 2147483000;
  const first = (n * 37) % CELLS;
  const mine = makeBoard(seed, first);
  let c = 0;
  for (let i = 0; i < CELLS; i++) if (mine[i]) c++;
  if (c !== MINES) countOk = false;
  const fx = first % W, fy = (first - fx) / W;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = fx + dx, y = fy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (mine[y * W + x]) guardOk = false;
    }
  }
  const set = new Set();
  for (let i = 0; i < CELLS; i++) if (mine[i]) { if (set.has(i)) dupOk = false; set.add(i); }
}
check('每盘恰好 40 颗雷', countOk);
check('首点九宫格必定无雷', guardOk);

console.log('\n== 3. verify.php 用例 ==');
const seed = 20261026, first = 138;
const board = makeBoard(seed, first);
const safe = [];
for (let i = 0; i < CELLS; i++) if (!board[i]) safe.push(i);
const mineCell = [...Array(CELLS).keys()].find(i => board[i]);

function base(over) {
  return { v: '1', score: '12345', first: String(first), open: safe.join(','), ...(over || {}) };
}
function verify(data, s = seed) {
  return JSON.parse(runPhp('verify-cli.php', { seed: s, data }));
}

const legal = verify(base());
check('正常通关被接受', legal.ok === 1, JSON.stringify(legal));
check('分数记为提交的毫秒数', legal.score === 12345);
check('minms = score（平台据此比对真实耗时）', legal.minms === 12345);

const withMine = safe.slice(0, SAFE - 1).concat(mineCell);
check('开格记录含雷被拒', verify(base({ open: withMine.join(',') })).ok === 0);
check('少一格被拒', verify(base({ open: safe.slice(0, SAFE - 1).join(',') })).ok === 0);
const dup = safe.slice(0, SAFE - 1).concat(safe[0]);
check('重复格子被拒', verify(base({ open: dup.join(',') })).ok === 0);
check('版本号不对被拒', verify(base({ v: '2' })).ok === 0);
check('计时低于 3 秒被拒', verify(base({ score: '1200' })).ok === 0);
check('计时超过 2 小时被拒', verify(base({ score: '7200001' })).ok === 0);
check('计时 0 被拒', verify(base({ score: '0' })).ok === 0);
check('首点越界被拒', verify(base({ first: '300' })).ok === 0);
check('开格记录含非数字被拒', verify(base({ open: safe.join(',') + 'x' })).ok === 0);
check('开格记录过长被拒', verify(base({ open: new Array(SAFE + 1).join('1,').slice(0, -1) })).ok === 0);

// 首点只是「决定盘面」的输入：只有换到真正不同的盘面才该被拒。
function sameBoard(a, b) {
  for (let i = 0; i < CELLS; i++) if ((a[i] ? 1 : 0) !== (b[i] ? 1 : 0)) return false;
  return true;
}
let altFirst = -1;
for (let k = 1; k < CELLS; k++) {
  const cand = (first + k) % CELLS;
  if (!sameBoard(makeBoard(seed, cand), board)) { altFirst = cand; break; }
}
check('换到不同盘面的首点被拒', altFirst > 0 && verify(base({ first: String(altFirst) })).ok === 0, 'altFirst=' + altFirst);
check('换到同一盘面的首点仍接受（盘面一致，不算作弊）', (function () {
  for (let k = 1; k < 30; k++) {
    const cand = (first + k) % CELLS;
    if (sameBoard(makeBoard(seed, cand), board)) return verify(base({ first: String(cand) })).ok === 1;
  }
  return true; // 附近没有同盘面的首点，跳过
})());
check('空数据被拒', verify({}).ok === 0);
check('缺 open 被拒', verify({ v: '1', score: '12345', first: '1' }).ok === 0);

console.log('\n' + (fail === 0 ? '全部通过' : '失败') + '：' + pass + ' 通过 / ' + fail + ' 失败\n');
process.exit(fail === 0 ? 0 : 1);
