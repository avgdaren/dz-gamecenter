/**
 * 好友五子棋 — 前台。介面原作者 GPT / Codex（1.3.0）；1.4.0 改接平台 api.room，自己不再發請求、不裁決勝負。
 * 房間狀態 room.state = { b: 225 字元棋盤, last: 最後落子, turn: 輪到的座位 }
 */
(function () {
  'use strict';
  GameCenter.register('gomoku', function (stage, api) {
    var R = api.room;
    var root = document.createElement('div');
    root.className = 'gcg';
    root.innerHTML = '<div class="gcg-lobby"><div class="gcg-lobby-btns"><button type="button" class="gc-btn" data-action="match">自动匹配</button><button type="button" class="gc-btn gc-ghost" data-action="create">创建房间</button></div>' +
      '<form class="gcg-join"><label>房间号<input name="room" maxlength="200" placeholder="12 位房间号或邀请链接" autocomplete="off" spellcheck="false"></label><button type="submit" class="gc-btn gc-ghost" data-action="join">加入</button></form></div>' +
      '<p class="gcg-status" role="status" aria-live="polite"></p>' +
      '<div class="gcg-queue" hidden><span class="gcg-queue-text"></span><button type="button" class="gc-btn gc-ghost" data-action="match-cancel">取消匹配</button></div>' +
      '<div class="gcg-match" hidden><div class="gcg-seats"><div data-seat="1"></div><b class="gcg-clock"></b><div data-seat="2"></div></div>' +
      '<div class="gcg-board"><svg viewBox="0 0 450 450" aria-hidden="true" class="gcg-lines"></svg><div class="gcg-grid" role="grid" aria-label="15 行 15 列五子棋盘"></div></div>' +
      '<div class="gcg-tools"><span class="gcg-selection">选择落点后确认</span><button type="button" class="gc-btn" data-action="move">确认落子</button><button type="button" class="gc-btn gc-ghost" data-action="resign">认输</button></div>' +
      '<div class="gcg-danger" hidden><span>确认结束这一局？</span><button type="button" class="gc-btn" data-action="confirm-resign">确认</button><button type="button" class="gc-btn gc-ghost" data-action="cancel-resign">继续下棋</button></div>' +
      '<div class="gcg-invite"><label>邀请链接<input readonly aria-label="邀请链接"></label><button type="button" class="gc-btn gc-ghost" data-action="copy">复制</button></div>' +
      '<div class="gcg-result" hidden></div></div>' +
      '<div class="gcg-retry" hidden><span>上次操作尚未确认。</span><button type="button" class="gc-btn" data-action="retry">重试同一操作</button></div>' +
      '<details class="gcg-history"><summary>最近对局</summary><ul></ul><button type="button" class="gc-btn gc-ghost" data-action="history">刷新记录</button></details>' +
      '<div class="gcg-replay" hidden><div class="gcg-replay-bar"><b></b><button type="button" class="gc-btn gc-ghost" data-action="rp-prev">‹ 上一步</button><span class="gcg-replay-pos"></span><button type="button" class="gc-btn gc-ghost" data-action="rp-next">下一步 ›</button><button type="button" class="gc-btn gc-ghost" data-action="rp-close">关闭回放</button></div>' +
      '<div class="gcg-board"><svg viewBox="0 0 450 450" aria-hidden="true" class="gcg-lines"></svg><div class="gcg-grid gcg-grid-rp" aria-hidden="true"></div></div></div>';
    stage.appendChild(root);
    var q = function (s) { return root.querySelector(s); };
    var grid = q('.gcg-grid'), cells = [], rpCells = [];
    var form = q('form'), input = form.querySelector('input');
    var selected = -1, note = '', clockTimer = null, busy = false;
    var uid = api.uid;
    var lines = '';
    for (var n = 0; n < 15; n++) { var p = 15 + n * 30; lines += '<path d="M15 ' + p + 'H435M' + p + ' 15V435"/>'; }
    [3, 7, 11].forEach(function (y) { [3, 7, 11].forEach(function (x) { lines += '<circle cx="' + (15 + x * 30) + '" cy="' + (15 + y * 30) + '" r="2.5"/>'; }); });
    root.querySelectorAll('.gcg-lines').forEach(function (s) { s.innerHTML = lines; });
    for (var i = 0; i < 225; i++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'gcg-cell'; b.setAttribute('role', 'gridcell'); b.setAttribute('data-cell', i);
      b.innerHTML = '<span aria-hidden="true"></span>'; grid.appendChild(b); cells.push(b);
      var c = document.createElement('div'); c.className = 'gcg-cell'; c.innerHTML = '<span></span>'; q('.gcg-grid-rp').appendChild(c); rpCells.push(c);
    }
    function room() { return R.room; }
    function board() { return room() && room().state && room().state.b ? room().state.b : ''; }
    function seatName(s) { var p = room() && room().players[s - 1]; return p ? p.name + (p.uid === uid ? '（你）' : '') : '等待好友'; }
    function outcome(r) {
      var reason = { five: '连五获胜', draw: '满盘和棋', resign: '认输', timeout: '回合超时', expired: '等待超时', cancelled: '已取消', end: '终局' };
      if (r.status === 3) return reason[r.reason] || '房间已结束';
      return (r.winner ? (r.winner === uid ? '你获胜了' : (r.me ? '对方获胜' : seatName(r.winner_seat) + ' 获胜')) : '本局和棋') + ' · ' + (reason[r.reason] || '对局结束');
    }
    function ratingText(r) {
      if (!r.ratings) return '';
      var mine = r.ratings.filter(function (x) { return x.uid === uid; })[0];
      if (!mine) return '';
      var d = mine.after - mine.before;
      return '等级分 ' + mine.before + ' → ' + mine.after + '（' + (d >= 0 ? '+' : '') + d + '）';
    }
    function clock() {
      var box = q('.gcg-clock');
      if (!R.active()) { box.textContent = ''; return; }
      var left = Math.max(0, Math.ceil((room().deadline_ms - R.serverNow()) / 1000));
      box.textContent = left ? (room().status === 0 ? '等待 ' : '剩余 ') + left + ' 秒' : '等待服务端确认';
    }
    function render() {
      var r = room(), act = R.active(), pend = R.pending(), mine = R.myTurn();
      root.setAttribute('data-busy', busy ? '1' : '0');
      q('.gcg-match').hidden = !r;
      q('.gcg-queue').hidden = !R.queued;
      if (R.queued) q('.gcg-queue-text').textContent = '正在匹配在线玩家…（队列中 ' + R.queued.waiting + ' 人）';
      q('.gcg-retry').hidden = !pend || busy;
      ['match', 'create', 'join'].forEach(function (a) { q('[data-action=' + a + ']').disabled = !uid || R.blocked() || busy || pend || act || !!R.queued; });
      q('[data-action=history]').disabled = !uid || R.blocked() || busy || pend;
      q('[data-action=retry]').disabled = R.blocked() || busy || document.hidden;
      var message = !uid ? '请先登录论坛账号，再邀请好友对局。' : (r ? (r.status === 0 ? '房间 ' + r.code + ' · 等待好友加入，你执黑。' : (r.status === 1 ? (mine ? '轮到你了，选择落点后确认。' : '等待对方落子。') : outcome(r))) : (R.queued ? '' : '自动匹配、创建房间，或输入好友的房间号。'));
      if (pend) message += ' 上次操作未获确认，请重试同一操作。';
      if (note) message += ' ' + note;
      q('.gcg-status').textContent = message;
      q('[data-action=move]').disabled = R.blocked() || !mine || busy || pend || selected < 0;
      q('[data-action=resign]').disabled = R.blocked() || !act || busy || pend;
      q('[data-action=resign]').textContent = r && r.status === 0 ? '取消房间' : '认输';
      q('[data-action=confirm-resign]').disabled = R.blocked() || !act || busy || pend;
      q('[data-action=copy]').disabled = !r;
      q('.gcg-selection').textContent = selected < 0 ? '选择落点后确认' : '第 ' + (Math.floor(selected / 15) + 1) + ' 行，第 ' + (selected % 15 + 1) + ' 列';
      if (!r) return;
      q('[data-seat="1"]').textContent = '● ' + seatName(1);
      q('[data-seat="2"]').textContent = '○ ' + seatName(2);
      q('.gcg-invite input').value = R.link(r.code);
      q('.gcg-invite').hidden = r.status !== 0;
      var res = q('.gcg-result');
      res.hidden = r.status < 2;
      if (r.status >= 2) {
        res.textContent = '';
        var h = document.createElement('b'); h.textContent = outcome(r); res.appendChild(h);
        var rt = ratingText(r); if (rt) { var s = document.createElement('span'); s.textContent = rt; res.appendChild(s); }
        var again = document.createElement('button'); again.type = 'button'; again.className = 'gc-btn'; again.textContent = '再来一局（自动匹配）';
        again.addEventListener('click', function () { R.match(); });
        res.appendChild(again);
      }
      var bd = board();
      for (var k = 0; k < 225; k++) {
        var stone = bd[k] || '0';
        cells[k].className = 'gcg-cell' + (stone === '1' ? ' black' : stone === '2' ? ' white' : '') + (k === selected ? ' selected' : '') + (k === r.state.last ? ' last' : '');
        cells[k].setAttribute('aria-disabled', !mine || pend || busy || stone !== '0' ? 'true' : 'false');
        cells[k].setAttribute('aria-label', '第 ' + (Math.floor(k / 15) + 1) + ' 行，第 ' + (k % 15 + 1) + ' 列，' + (stone === '1' ? '黑子' : stone === '2' ? '白子' : '空位'));
        cells[k].tabIndex = k === (selected >= 0 ? selected : 112) ? 0 : -1;
      }
      clock();
    }
    R.on('update', function (r) { selected = -1; if (r && r.status >= 2) q('.gcg-danger').hidden = true; if (r && r.status >= 2) api.refreshBoards(); render(); });
    R.on('queue', function () { render(); });
    R.on('note', function (t) { note = t || ''; render(); });
    R.on('busy', function (b) { busy = b; render(); });

    q('[data-action=create]').addEventListener('click', function () { R.create(); });
    q('[data-action=match]').addEventListener('click', function () { R.match(); });
    q('[data-action=match-cancel]').addEventListener('click', function () { R.cancelMatch(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); R.join(input.value); });
    grid.addEventListener('click', function (e) {
      var cell = e.target.closest && e.target.closest('[data-cell]');
      if (!cell || !grid.contains(cell) || !R.myTurn() || busy || R.pending()) return;
      var index = +cell.getAttribute('data-cell');
      if (board()[index] === '0') { selected = index; note = ''; render(); }
    });
    grid.addEventListener('keydown', function (e) {
      var cell = e.target.closest && e.target.closest('[data-cell]');
      if (!cell || !grid.contains(cell) || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      var index = +cell.getAttribute('data-cell'), next = index;
      if (e.key === 'ArrowLeft' && index % 15 > 0) next--;
      else if (e.key === 'ArrowRight' && index % 15 < 14) next++;
      else if (e.key === 'ArrowUp' && index >= 15) next -= 15;
      else if (e.key === 'ArrowDown' && index < 210) next += 15;
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cell.click(); return; }
      else return;
      e.preventDefault(); cells.forEach(function (b) { b.tabIndex = -1; }); cells[next].tabIndex = 0; cells[next].focus();
    });
    q('[data-action=move]').addEventListener('click', function () { if (selected >= 0) R.move({ cell: selected }); });
    q('[data-action=resign]').addEventListener('click', function () { if (R.active() && !busy && !R.pending()) q('.gcg-danger').hidden = false; });
    q('[data-action=cancel-resign]').addEventListener('click', function () { q('.gcg-danger').hidden = true; });
    q('[data-action=confirm-resign]').addEventListener('click', function () { R.resign(); });
    q('[data-action=retry]').addEventListener('click', function () { R.retry(); });
    q('[data-action=copy]').addEventListener('click', async function () {
      var share = q('.gcg-invite input');
      try { await navigator.clipboard.writeText(share.value); note = '邀请链接已复制。'; }
      catch (e) { share.focus(); share.select(); note = '请复制已选中的邀请链接。'; }
      render();
    });

    /* 最近對局＋回放 */
    var rp = null;
    function showHistory(list) {
      var ul = q('.gcg-history ul'); ul.textContent = '';
      (list || []).forEach(function (r) {
        var li = document.createElement('li');
        li.textContent = r.players.map(function (p) { return p.name; }).join(' vs ') + ' · ' + outcome(r) + ' ';
        var b = document.createElement('a'); b.href = 'javascript:;'; b.textContent = '回放';
        b.addEventListener('click', function () { openReplay(r.code); });
        li.appendChild(b); ul.appendChild(li);
      });
      if (!ul.children.length) { var empty = document.createElement('li'); empty.textContent = '还没有已结束的对局'; ul.appendChild(empty); }
    }
    q('[data-action=history]').addEventListener('click', function () { R.history().then(showHistory); });
    q('.gcg-history summary').addEventListener('click', function () { if (!q('.gcg-history').open) R.history().then(showHistory); });
    function openReplay(code) {
      R.replay(code).then(function (r) {
        if (!r) return;
        rp = { moves: r.moves, pos: 0, title: r.room.players.map(function (p) { return p.name; }).join(' vs ') + ' · ' + outcome(r.room) };
        q('.gcg-replay').hidden = false; drawReplay();
        q('.gcg-replay').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    function drawReplay() {
      var bd = new Array(225).fill('0'), last = -1;
      for (var i = 0; i < rp.pos; i++) { var m = rp.moves[i]; if (m.data.cell >= 0) { bd[m.data.cell] = String(m.seat); last = m.data.cell; } }
      q('.gcg-replay-bar b').textContent = rp.title;
      q('.gcg-replay-pos').textContent = rp.pos + ' / ' + rp.moves.length;
      for (var k = 0; k < 225; k++) rpCells[k].className = 'gcg-cell' + (bd[k] === '1' ? ' black' : bd[k] === '2' ? ' white' : '') + (k === last ? ' last' : '');
    }
    q('[data-action=rp-prev]').addEventListener('click', function () { if (rp && rp.pos > 0) { rp.pos--; drawReplay(); } });
    q('[data-action=rp-next]').addEventListener('click', function () { if (rp && rp.pos < rp.moves.length) { rp.pos++; drawReplay(); } });
    q('[data-action=rp-close]').addEventListener('click', function () { q('.gcg-replay').hidden = true; rp = null; });

    document.addEventListener('visibilitychange', function () {
      clearInterval(clockTimer); clockTimer = null;
      if (!document.hidden) clockTimer = setInterval(clock, 250);
    });
    render();
    if (!document.hidden) clockTimer = setInterval(clock, 250);
  });
})();
