/**
 * 長局範例 — 前台：開局 → 每點一次「打一下」累積紀錄，每 5 次把這一段先交上去（checkpoint）、同時存檔；
 * 重新打開頁面可從存檔續玩（同一個 token 還在 24 小時內有效）；「结束」交最後一段與成績。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */
(function () {
  'use strict';
  GameCenter.register('_longexample', function (stage, api) {
    var box = document.createElement('div');
    box.innerHTML = '<p class="gc-muted lx-info"></p><div><button type="button" class="gc-btn lx-start">开始 / 续玩</button> ' +
      '<button type="button" class="gc-btn lx-hit" disabled>打一下（x）</button> <button type="button" class="gc-btn gc-ghost lx-end" disabled>结束并交成绩</button> ' +
      '<button type="button" class="gc-btn gc-ghost lx-clear">清除存档</button></div>';
    stage.appendChild(box);
    var info = null, buf = '', total = 0, level = 1;
    var $ = function (s) { return box.querySelector(s); };
    function show(t) { $('.lx-info').textContent = t; }
    function persist() { return api.save({ info: info, buf: buf, total: total, level: level }, 0); }
    $('.lx-start').addEventListener('click', function () {
      api.load(0).then(function (s) {
        if (s && s.data && s.data.info && s.data.info.token) {
          info = s.data.info; buf = s.data.buf || ''; total = s.data.total || 0; level = s.data.level || 1;
          show('从存档续玩：已累计 ' + total + ' 次（存于 ' + new Date(s.dateline * 1000).toLocaleString() + '）');
          $('.lx-hit').disabled = false; $('.lx-end').disabled = false;
          return;
        }
        return api.start().then(function (r) {
          if (!r) return;
          info = r; buf = ''; total = 0; level = 1;
          show(r.guest ? '试玩模式（不记成绩、不存档）' : '新的一局，token 24 小时内有效');
          $('.lx-hit').disabled = false; $('.lx-end').disabled = false;
          if (!r.guest) persist();
        });
      });
    });
    $('.lx-hit').addEventListener('click', function () {
      buf += 'x'; total++;
      if (total % 5 === 0) {
        var piece = buf; buf = '';
        api.checkpoint(info, piece).then(function (r) {
          level = Math.floor(total / 5) + 1;
          show('第 ' + (r && r.seq) + ' 段已交（' + total + ' 次）' + (r && r.ok ? '' : '：' + (r && r.msg)));
          return persist();
        });
      } else show('累计 ' + total + ' 次，未交的这一段有 ' + buf.length + ' 次');
    });
    $('.lx-end').addEventListener('click', function () {
      $('.lx-hit').disabled = true; $('.lx-end').disabled = true;
      api.submit(info, { score: total * 10, tail: buf, level: level }, '长局结束').then(function () { api.clearSave(0); info = null; });
    });
    $('.lx-clear').addEventListener('click', function () { api.clearSave(0).then(function () { show('存档已清除'); }); });
    show('按「开始 / 续玩」');
  });
})();
