/** 作者：GPT / Codex。五子棋前台只渲染服务端状态，不自行裁决胜负。 */
(function () {
  'use strict';
  GameCenter.register('gomoku', function (stage, api) {
    var root = document.createElement('div');
    root.className = 'gcg';
    root.innerHTML = '<div class="gcg-lobby"><button type="button" class="gc-btn" data-action="create">创建房间</button>' +
      '<form class="gcg-join"><label>房间号<input name="room" maxlength="200" placeholder="12 位房间号" autocomplete="off" spellcheck="false"></label><button type="submit" class="gc-btn gc-ghost" data-action="join">加入</button></form></div>' +
      '<p class="gcg-status" role="status" aria-live="polite"></p>' +
      '<div class="gcg-match" hidden><div class="gcg-seats"><div data-seat="1"></div><b class="gcg-clock"></b><div data-seat="2"></div></div>' +
      '<div class="gcg-board"><svg viewBox="0 0 450 450" aria-hidden="true" class="gcg-lines"></svg><div class="gcg-grid" role="grid" aria-label="15 行 15 列五子棋盘"></div></div>' +
      '<div class="gcg-tools"><span class="gcg-selection">选择落点后确认</span><button type="button" class="gc-btn" data-action="move">确认落子</button><button type="button" class="gc-btn gc-ghost" data-action="resign">认输</button></div>' +
      '<div class="gcg-danger" hidden><span>确认结束这一局？</span><button type="button" class="gc-btn" data-action="confirm-resign">确认</button><button type="button" class="gc-btn gc-ghost" data-action="cancel-resign">继续下棋</button></div>' +
      '<div class="gcg-invite"><label>邀请链接<input readonly aria-label="邀请链接"></label><button type="button" class="gc-btn gc-ghost" data-action="copy">复制</button></div></div>' +
      '<div class="gcg-retry" hidden><span>上次操作尚未确认。</span><button type="button" class="gc-btn" data-action="retry">重试同一操作</button></div>' +
      '<details class="gcg-history"><summary>最近对局</summary><ul></ul><button type="button" class="gc-btn gc-ghost" data-action="history">刷新记录</button></details>';
    stage.appendChild(root);
    var grid = root.querySelector('.gcg-grid'), cells = [];
    var form = root.querySelector('form'), input = form.querySelector('input');
    var room = null, selected = -1, busy = false, pending = null, failures = 0;
    var pollTimer = null, clockTimer = null, offset = 0, note = '', transportFailed = false;
    var blocked = false;
    var uid = +api.uid || 0;
    var lines = '';
    for (var n = 0; n < 15; n++) {
      var p = 15 + n * 30;
      lines += '<path d="M15 ' + p + 'H435M' + p + ' 15V435"/>';
    }
    [3, 7, 11].forEach(function (y) { [3, 7, 11].forEach(function (x) { lines += '<circle cx="' + (15 + x * 30) + '" cy="' + (15 + y * 30) + '" r="2.5"/>'; }); });
    root.querySelector('.gcg-lines').innerHTML = lines;
    for (var i = 0; i < 225; i++) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'gcg-cell'; b.setAttribute('role', 'gridcell'); b.setAttribute('data-cell', i);
      b.innerHTML = '<span aria-hidden="true"></span>'; grid.appendChild(b); cells.push(b);
    }
    function active() { return room && room.status < 2; }
    function mine() { return room && room.status === 1 && room[room.turn === 1 ? 'black_uid' : 'white_uid'] === uid; }
    function rid() {
      var bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      return Array.from(bytes, function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    }
    function link() {
      var u = new URL(stage.dataset.url, location.href);
      u.searchParams.set('mod', 'play'); u.searchParams.set('game', 'gomoku'); u.searchParams.set('room', room.code);
      return u.href;
    }
    function outcome(r) {
      var reason = {five:'连五获胜',draw:'满盘和棋',resign:'认输',timeout:'回合超时',expired:'等待超时',cancelled:'已取消'};
      if (r.status === 3) return reason[r.reason] || '房间已结束';
      return (r.winner ? (r.winner === uid ? '你获胜了' : '对方获胜') : '本局和棋') + ' · ' + (reason[r.reason] || '对局结束');
    }
    function clock() {
      var box = root.querySelector('.gcg-clock');
      if (!active()) { box.textContent = ''; return; }
      var left = Math.max(0, Math.ceil((room.deadline_ms - Date.now() - offset) / 1000));
      box.textContent = left ? (room.status === 0 ? '等待 ' : '剩余 ') + left + ' 秒' : '等待服务端确认';
    }
    function render() {
      root.setAttribute('data-busy', busy ? '1' : '0');
      root.querySelector('.gcg-match').hidden = !room;
      root.querySelector('.gcg-retry').hidden = !pending || busy;
      root.querySelector('[data-action=create]').disabled = !uid || blocked || busy || !!pending || !!active();
      root.querySelector('[data-action=join]').disabled = !uid || blocked || busy || !!pending || !!active();
      root.querySelector('[data-action=history]').disabled = !uid || blocked || busy || !!pending;
      root.querySelector('[data-action=retry]').disabled = blocked || busy || document.hidden;
      var message = !uid ? '请先登录论坛账号，再邀请好友对局。' : (room ? (room.status === 0 ? '房间 ' + room.code + ' · 等待好友加入，你执黑。' : (room.status === 1 ? (mine() ? '轮到你了，选择落点后确认。' : '等待对方落子。') : outcome(room))) : '创建房间，或输入好友的房间号。');
      if (transportFailed) message += ' 连接暂时中断，正在重连。';
      if (pending) message += ' 上次操作未获确认，请重试同一操作。';
      if (note) message += ' ' + note;
      root.querySelector('.gcg-status').textContent = message;
      root.querySelector('[data-action=move]').disabled = blocked || !mine() || busy || !!pending || selected < 0;
      root.querySelector('[data-action=resign]').disabled = blocked || !active() || busy || !!pending;
      root.querySelector('[data-action=resign]').textContent = room && room.status === 0 ? '取消房间' : '认输';
      root.querySelector('[data-action=confirm-resign]').disabled = blocked || !active() || busy || !!pending;
      root.querySelector('[data-action=copy]').disabled = !room;
      root.querySelector('.gcg-selection').textContent = selected < 0 ? '选择落点后确认' : '第 ' + (Math.floor(selected / 15) + 1) + ' 行，第 ' + (selected % 15 + 1) + ' 列';
      if (!room) return;
      root.querySelector('[data-seat="1"]').textContent = '● ' + room.black_name + (room.black_uid === uid ? '（你）' : '');
      root.querySelector('[data-seat="2"]').textContent = room.white_uid ? '○ ' + room.white_name + (room.white_uid === uid ? '（你）' : '') : '○ 等待好友';
      root.querySelector('.gcg-invite input').value = link();
      root.querySelector('.gcg-invite').hidden = room.status >= 2;
      for (var k = 0; k < 225; k++) {
        var stone = room.board[k];
        cells[k].className = 'gcg-cell' + (stone === '1' ? ' black' : stone === '2' ? ' white' : '') + (k === selected ? ' selected' : '') + (k === room.last_cell ? ' last' : '');
        cells[k].setAttribute('aria-disabled', !mine() || !!pending || busy || stone !== '0' ? 'true' : 'false');
        cells[k].setAttribute('aria-label', '第 ' + (Math.floor(k / 15) + 1) + ' 行，第 ' + (k % 15 + 1) + ' 列，' + (stone === '1' ? '黑子' : stone === '2' ? '白子' : '空位'));
        cells[k].tabIndex = k === (selected >= 0 ? selected : 112) ? 0 : -1;
      }
      clock();
    }
    function schedule() {
      clearTimeout(pollTimer); pollTimer = null;
      if (!uid || blocked || document.hidden || busy || (!active() && !transportFailed)) return;
      var delay = Math.min(15000, 2000 * Math.pow(2, Math.min(failures, 3)));
      if (delay < 15000) delay += Math.floor(Math.random() * 250);
      pollTimer = setTimeout(function () { request(room ? {action:'state',room:room.code} : {action:'current'}); }, delay);
    }
    function validRoom(r) {
      return r && typeof r.code === 'string' && /^[A-F0-9]{12}$/.test(r.code) && typeof r.board === 'string' && /^[012]{225}$/.test(r.board) && Number.isInteger(r.version) && Number.isInteger(r.status);
    }
    async function request(data, writing) {
      if (busy || blocked || document.hidden || !uid) return;
      busy = true; clearTimeout(pollTimer); pollTimer = null; render();
      var abort = new AbortController(); var timeout = setTimeout(function () { abort.abort(); }, 10000);
      var sent = Date.now();
      try {
        var fd = new FormData(); fd.append('formhash', stage.dataset.formhash);
        Object.keys(data).forEach(function (key) { fd.append(key, data[key]); });
        var url = stage.dataset.url + '&op=room&game=gomoku&inajax=1';
        var response = await fetch(url, {method:'POST',body:fd,credentials:'same-origin',signal:abort.signal});
        if (!response.ok) throw new Error('network');
        var result = await response.json();
        if (!result || (result.ok !== 0 && result.ok !== 1)) throw new Error('protocol');
        if (Number.isFinite(result.server_ms)) offset = result.server_ms + (Date.now() - sent) / 2 - Date.now();
        if (result.retryable) { throw new Error('retryable'); }
        if (!result.ok && (!result.code || ['login','permission','upgrade'].indexOf(result.code) >= 0)) blocked = true;
        if (writing) pending = null;
        failures = 0; transportFailed = false; note = result.ok ? '' : (result.msg || '操作未成功，请刷新页面后再试。');
        if (data.action === 'history') {
          var list = root.querySelector('.gcg-history ul'); list.textContent = '';
          (result.history || []).forEach(function (r) { var item = document.createElement('li'); item.textContent = r.code + ' · ' + outcome(r); list.appendChild(item); });
          if (!list.children.length) { var empty = document.createElement('li'); empty.textContent = '还没有已结束的对局'; list.appendChild(empty); }
        } else if (validRoom(result.room)) {
          if (!room || room.code !== result.room.code || room.version !== result.room.version) selected = -1;
          room = result.room;
          if (room.status >= 2) root.querySelector('.gcg-danger').hidden = true;
        } else if (result.ok && data.action === 'current') room = null;
      } catch (e) {
        failures++; transportFailed = true;
        note = '暂未确认操作结果，局面以服务端为准。';
      } finally {
        clearTimeout(timeout); busy = false; render(); schedule();
      }
    }
    function write(action, fields) {
      if (busy || blocked || pending || document.hidden) return;
      pending = Object.assign({action:action, request_id:rid()}, fields || {});
      request(pending, true);
    }
    root.querySelector('[data-action=create]').addEventListener('click', function () { if (!active()) write('create'); });
    form.addEventListener('submit', function (event) {
      event.preventDefault(); if (busy || blocked || pending || active()) return;
      var code = input.value.trim();
      try { if (/^https?:/i.test(code)) code = new URL(code).searchParams.get('room') || ''; } catch (e) {}
      code = code.toUpperCase();
      if (!/^[A-F0-9]{12}$/.test(code)) { note = '请输入正确的 12 位房间号。'; render(); return; }
      write('join',{room:code});
    });
    grid.addEventListener('click', function (event) {
      var cell = event.target.closest && event.target.closest('[data-cell]');
      if (!cell || !grid.contains(cell) || blocked || !mine() || busy || pending) return;
      var index = +cell.getAttribute('data-cell');
      if (room.board[index] === '0') { selected = index; note = ''; render(); }
    });
    grid.addEventListener('keydown', function (event) {
      var cell = event.target.closest && event.target.closest('[data-cell]');
      if (!cell || !grid.contains(cell) || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      var index = +cell.getAttribute('data-cell'), next = index;
      if (event.key === 'ArrowLeft' && index % 15 > 0) next--;
      else if (event.key === 'ArrowRight' && index % 15 < 14) next++;
      else if (event.key === 'ArrowUp' && index >= 15) next -= 15;
      else if (event.key === 'ArrowDown' && index < 210) next += 15;
      else return;
      event.preventDefault(); cells.forEach(function (b) { b.tabIndex = -1; }); cells[next].tabIndex = 0; cells[next].focus();
    });
    root.querySelector('[data-action=move]').addEventListener('click', function () { if (mine() && selected >= 0) write('move',{room:room.code,version:room.version,cell:selected}); });
    root.querySelector('[data-action=resign]').addEventListener('click', function () { if (active() && !busy && !pending) root.querySelector('.gcg-danger').hidden = false; });
    root.querySelector('[data-action=cancel-resign]').addEventListener('click', function () { root.querySelector('.gcg-danger').hidden = true; });
    root.querySelector('[data-action=confirm-resign]').addEventListener('click', function () { if (active()) write('resign',{room:room.code,version:room.version}); });
    root.querySelector('[data-action=retry]').addEventListener('click', function () { if (pending && !busy) request(pending,true); });
    root.querySelector('[data-action=history]').addEventListener('click', function () { if (!pending) request({action:'history'}); });
    root.querySelector('[data-action=copy]').addEventListener('click', async function () {
      if (!room) return; var share = root.querySelector('.gcg-invite input');
      try { await navigator.clipboard.writeText(share.value); note = '邀请链接已复制。'; }
      catch (e) { share.focus(); share.select(); note = '请复制已选中的邀请链接。'; }
      render();
    });
    document.addEventListener('visibilitychange', function () {
      clearTimeout(pollTimer); clearInterval(clockTimer); pollTimer = clockTimer = null;
      if (!document.hidden) { clockTimer = setInterval(clock,250); if (!busy) request(room ? {action:'state',room:room.code} : {action:'current'}); }
    });
    try { input.value = new URL(location.href).searchParams.get('room') || ''; } catch (e) {}
    render();
    if (!document.hidden) clockTimer = setInterval(clock,250);
    if (uid) request({action:'current'});
  });
})();
