/**
 * 黑白棋 — 前台。只畫伺服器給的狀態、送「我要下在哪」；規則與勝負都在 rules.php。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 * room.state = { b: 64 字元棋盤, last, turn, passed }
 */
(function () {
  'use strict';
  GameCenter.register('reversi', function (stage, api) {
    var R = api.room, uid = api.uid;
    var root = document.createElement('div');
    root.className = 'gcr';
    root.innerHTML = '<div class="gcr-lobby"><button type="button" class="gc-btn" data-action="match">自动匹配</button><button type="button" class="gc-btn gc-ghost" data-action="create">创建房间</button>' +
      '<form class="gcr-join"><input name="room" maxlength="200" placeholder="房间号或邀请链接" autocomplete="off"><button type="submit" class="gc-btn gc-ghost">加入</button></form></div>' +
      '<p class="gcr-status" role="status" aria-live="polite"></p>' +
      '<div class="gcr-queue" hidden><span></span><button type="button" class="gc-btn gc-ghost" data-action="match-cancel">取消匹配</button></div>' +
      '<div class="gcr-match" hidden><div class="gcr-seats"><div data-seat="1"></div><b class="gcr-clock"></b><div data-seat="2"></div></div>' +
      '<div class="gcr-board" role="grid" aria-label="8 行 8 列黑白棋盘"></div>' +
      '<div class="gcr-tools"><button type="button" class="gc-btn gc-ghost" data-action="resign">认输</button><button type="button" class="gc-btn" data-action="confirm-resign" hidden>确认认输</button></div>' +
      '<div class="gcr-invite" hidden><input readonly aria-label="邀请链接"><button type="button" class="gc-btn gc-ghost" data-action="copy">复制邀请链接</button></div>' +
      '<div class="gcr-result" hidden></div></div>' +
      '<div class="gcr-retry" hidden><span>上次操作尚未确认。</span><button type="button" class="gc-btn" data-action="retry">重试</button></div>';
    stage.appendChild(root);
    var q = function (s) { return root.querySelector(s); };
    var boardEl = q('.gcr-board'), cells = [];
    for (var i = 0; i < 64; i++) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'gcr-cell'; b.setAttribute('data-cell', i); b.innerHTML = '<span></span>';
      boardEl.appendChild(b); cells.push(b);
    }
    var note = '', busy = false, clockTimer = null;
    function room() { return R.room; }
    function bd() { return room() && room().state ? room().state.b : ''; }
    function seatName(s) { var p = room() && room().players[s - 1]; return p ? p.name + (p.uid === uid ? '（你）' : '') : '等待对手'; }
    function count(b, c) { return b.split(c).length - 1; }
    // 合法落點（只用來畫提示；真正判定在伺服器）
    function flips(b, cell, me) {
      var op = me === '1' ? '2' : '1', x = cell % 8, y = Math.floor(cell / 8), out = [];
      if (b[cell] !== '0') return out;
      [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d) {
        var line = [], nx = x + d[0], ny = y + d[1];
        while (nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && b[ny * 8 + nx] === op) { line.push(ny * 8 + nx); nx += d[0]; ny += d[1]; }
        if (line.length && nx >= 0 && nx < 8 && ny >= 0 && ny < 8 && b[ny * 8 + nx] === me) out = out.concat(line);
      });
      return out;
    }
    function outcome(r) {
      var reason = { end: '终局', draw: '和棋', resign: '认输', timeout: '回合超时', expired: '等待超时', cancelled: '已取消' };
      if (r.status === 3) return reason[r.reason] || '房间已结束';
      var b = r.state.b || '', sc = ' ' + count(b, '1') + ' : ' + count(b, '2');
      return (r.winner ? (r.winner === uid ? '你获胜了' : (r.me ? '对方获胜' : seatName(r.winner_seat) + ' 获胜')) : '和棋') + ' · ' + (reason[r.reason] || '') + sc;
    }
    function clock() {
      var box = q('.gcr-clock');
      if (!R.active()) { box.textContent = ''; return; }
      var left = Math.max(0, Math.ceil((room().deadline_ms - R.serverNow()) / 1000));
      box.textContent = (room().status === 0 ? '等待 ' : '剩余 ') + left + ' 秒';
    }
    function render() {
      var r = room(), act = R.active(), pend = R.pending(), mine = R.myTurn();
      q('.gcr-match').hidden = !r;
      q('.gcr-queue').hidden = !R.queued;
      if (R.queued) q('.gcr-queue span').textContent = '正在匹配在线玩家…（队列中 ' + R.queued.waiting + ' 人）';
      q('.gcr-retry').hidden = !pend || busy;
      ['match', 'create'].forEach(function (a) { q('[data-action=' + a + ']').disabled = !uid || R.blocked() || busy || pend || act || !!R.queued; });
      q('.gcr-join button').disabled = !uid || R.blocked() || busy || pend || act || !!R.queued;
      var msg = !uid ? '请先登录论坛账号。' : (r ? (r.status === 0 ? '房间 ' + r.code + ' · 等待对手加入，你执黑。' : (r.status === 1 ? ((r.state.passed === r.me ? '你无子可下，让手。' : '') + (mine ? '轮到你了，点击有圆点的位置落子。' : '等待对方落子。')) : outcome(r))) : (R.queued ? '' : '自动匹配、创建房间，或输入好友的房间号。'));
      if (pend) msg += ' 上次操作未获确认，请重试。';
      if (note) msg += ' ' + note;
      q('.gcr-status').textContent = msg;
      q('[data-action=resign]').disabled = R.blocked() || !act || busy || pend;
      q('[data-action=resign]').textContent = r && r.status === 0 ? '取消房间' : '认输';
      if (!r) return;
      var b = bd();
      q('[data-seat="1"]').textContent = '● ' + seatName(1) + ' ' + count(b, '1');
      q('[data-seat="2"]').textContent = '○ ' + seatName(2) + ' ' + count(b, '2');
      q('.gcr-invite').hidden = r.status !== 0;
      q('.gcr-invite input').value = R.link(r.code);
      var res = q('.gcr-result'); res.hidden = r.status < 2;
      if (r.status >= 2) {
        res.textContent = ''; var h = document.createElement('b'); h.textContent = outcome(r); res.appendChild(h);
        var m = r.ratings && r.ratings.filter(function (x) { return x.uid === uid; })[0];
        if (m) { var s = document.createElement('span'); var d = m.after - m.before; s.textContent = '等级分 ' + m.before + ' → ' + m.after + '（' + (d >= 0 ? '+' : '') + d + '）'; res.appendChild(s); }
        var again = document.createElement('button'); again.type = 'button'; again.className = 'gc-btn'; again.textContent = '再来一局（自动匹配）';
        again.addEventListener('click', function () { R.match(); }); res.appendChild(again);
      }
      for (var k = 0; k < 64; k++) {
        var st = b[k] || '0', hint = mine && !pend && !busy && st === '0' && flips(b, k, String(r.me)).length > 0;
        cells[k].className = 'gcr-cell' + (st === '1' ? ' black' : st === '2' ? ' white' : '') + (hint ? ' hint' : '') + (k === r.state.last ? ' last' : '');
        cells[k].disabled = !hint;
      }
      clock();
    }
    R.on('update', function (r) { if (r && r.status >= 2) { q('[data-action=confirm-resign]').hidden = true; api.refreshBoards(); } render(); });
    R.on('queue', render); R.on('note', function (t) { note = t || ''; render(); }); R.on('busy', function (x) { busy = x; render(); });
    q('[data-action=create]').addEventListener('click', function () { R.create(); });
    q('[data-action=match]').addEventListener('click', function () { R.match(); });
    q('[data-action=match-cancel]').addEventListener('click', function () { R.cancelMatch(); });
    q('.gcr-join').addEventListener('submit', function (e) { e.preventDefault(); R.join(q('.gcr-join input').value); });
    boardEl.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('[data-cell]');
      if (c && !c.disabled) { note = ''; R.move({ cell: +c.getAttribute('data-cell') }); }
    });
    q('[data-action=resign]').addEventListener('click', function () { q('[data-action=confirm-resign]').hidden = false; });
    q('[data-action=confirm-resign]').addEventListener('click', function () { q('[data-action=confirm-resign]').hidden = true; R.resign(); });
    q('[data-action=retry]').addEventListener('click', function () { R.retry(); });
    q('[data-action=copy]').addEventListener('click', async function () {
      var inp = q('.gcr-invite input');
      try { await navigator.clipboard.writeText(inp.value); note = '邀请链接已复制。'; } catch (e) { inp.select(); note = '请复制已选中的邀请链接。'; }
      render();
    });
    document.addEventListener('visibilitychange', function () { clearInterval(clockTimer); if (!document.hidden) clockTimer = setInterval(clock, 250); });
    render();
    if (!document.hidden) clockTimer = setInterval(clock, 250);
  });
})();
