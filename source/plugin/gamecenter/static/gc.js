/**
 * 遊戲中心 gamecenter — 平台前台腳本：給每款遊戲的共用介面、成績視窗、排行榜分頁、聯機房間、存檔、分段提交。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 遊戲寫法（單機）：
 *   GameCenter.register('<gkey>', function (stage, api) {
 *     api.start()                    → Promise<{guest, token, seed}|null>  開局（拿一次性憑證＋亂數種子）
 *     api.checkpoint(info, piece)    → Promise<{ok, seq}>  長局分段提交：把目前為止的操作紀錄片段先交上去（1.4.0）
 *     api.submit(info, data, title)  → Promise<結果>  交成績（data 至少有 score；有伺服器校驗的遊戲另帶重播資料；可帶 stats）
 *     api.save(obj, slot) / api.load(slot) / api.clearSave(slot)  伺服器存檔（1.4.0；登入會員才有，slot 0～2）
 *     api.best／api.dailyBest／api.mobile／api.visible(el)／api.uid／api.rivals／api.mode
 *   });
 * 遊戲寫法（聯機，game.json 有 room）：
 *   api.room.on('update', fn(room|null))  房間狀態變了（含輪詢、對手動作、結束）
 *   api.room.on('queue', fn(info))        在配對佇列裡（info.waiting 人數）／離開佇列時 null
 *   api.room.on('note', fn(text))         平台要顯示的提示（錯誤、重試）
 *   api.room.on('busy', fn(bool))         請求進行中
 *   api.room.create() / join(code) / match() / cancelMatch() / move(payload) / resign() / refresh() / history() / replay(code) / retry()
 *   api.room.room（目前快照）／seat（我的座位）／myTurn()／active()／pending()／serverNow()／link(code)
 */
(function () {
  'use strict';
  var defs = {};
  var GC = window.GameCenter = {
    register: function (gkey, fn) { defs[gkey] = fn; boot(); }
  };

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    return d.firstElementChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function post(cfg, op, body, signal) {
    var fd = new FormData();
    fd.append('formhash', cfg.formhash);
    Object.keys(body || {}).forEach(function (k) { fd.append(k, body[k]); });
    return fetch(cfg.url + '&op=' + op + '&game=' + encodeURIComponent(cfg.game) + '&inajax=1', {
      method: 'POST', body: fd, credentials: 'same-origin', signal: signal
    }).then(function (r) { return r.json(); }).catch(function () {
      return { ok: 0, msg: '网络错误，请稍后再试', network: 1 };
    });
  }

  function modal(stage, html, buttons) {
    var old = stage.querySelector('.gc-modal');
    if (old) old.remove();
    var m = el('<div class="gc-modal"><div class="gc-modal-box">' + html + '<div class="gc-modal-btns"></div></div></div>');
    var bar = m.querySelector('.gc-modal-btns');
    buttons.forEach(function (b) {
      var x = b.href ? el('<a class="gc-btn' + (b.ghost ? ' gc-ghost' : '') + '" href="' + esc(b.href) + '">' + esc(b.text) + '</a>')
        : el('<button type="button" class="gc-btn' + (b.ghost ? ' gc-ghost' : '') + '">' + esc(b.text) + '</button>');
      x.addEventListener('click', function () { if (!b.href) m.remove(); if (b.fn) b.fn(); });
      bar.appendChild(x);
    });
    stage.appendChild(m);
    var f = bar.querySelector('.gc-btn');
    if (f) f.focus();
    return m;
  }

  function refreshBoards(cfg) {
    var box = document.getElementById('gc-boards');
    if (!box) return;
    fetch(cfg.url + '&op=board&game=' + encodeURIComponent(cfg.game) + '&mode=' + encodeURIComponent(cfg.mode) + '&inajax=1', { credentials: 'same-origin' })
      .then(function (r) { return r.text(); })
      .then(function (t) {
        var cur = box.querySelector('[data-gc-tab].on');
        box.innerHTML = t;
        if (cur) showTab(box, cur.getAttribute('data-gc-tab'));
      }).catch(function () {});
  }
  function showTab(box, k) {
    box.querySelectorAll('[data-gc-tab]').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-gc-tab') === k); });
    box.querySelectorAll('[data-gc-pane]').forEach(function (p) { p.style.display = p.getAttribute('data-gc-pane') === k ? '' : 'none'; });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-gc-tab]');
    if (t) { e.preventDefault(); showTab(t.closest('.gc-tabsbox'), t.getAttribute('data-gc-tab')); }
  });

  /* ---------- 聯機房間客戶端（1.4.0） ---------- */
  function roomClient(cfg, api) {
    var R = { room: null, seat: 0, queued: null, offset: 0 };
    var handlers = { update: [], queue: [], note: [], busy: [] };
    var busy = false, pending = null, failures = 0, pollTimer = null, blocked = false, abortCtl = null;
    function emit(ev, x) { handlers[ev].forEach(function (f) { try { f(x); } catch (e) {} }); }
    function rid() {
      var bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
      return Array.from(bytes, function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    }
    function validRoom(r) { return r && typeof r.code === 'string' && /^[A-F0-9]{12}$/.test(r.code) && Number.isInteger(r.version) && Number.isInteger(r.status); }
    function active() { return !!R.room && R.room.status < 2; }
    function schedule() {
      clearTimeout(pollTimer); pollTimer = null;
      if (!api.uid || blocked || document.hidden || busy) return;
      if (!active() && !R.queued && failures === 0) return;
      var delay = Math.min(15000, 2000 * Math.pow(2, Math.min(failures, 3)));
      if (delay < 15000) delay += Math.floor(Math.random() * 250);
      pollTimer = setTimeout(function () { request(R.room ? { action: 'state', room: R.room.code } : { action: 'current' }); }, delay);
    }
    function request(data, writing) {
      if (busy || blocked || document.hidden || !api.uid) return Promise.resolve(null);
      busy = true; clearTimeout(pollTimer); pollTimer = null; emit('busy', true);
      abortCtl = new AbortController();
      var timeout = setTimeout(function () { abortCtl.abort(); }, 10000);
      var sent = Date.now();
      return post(cfg, 'room', data, abortCtl.signal).then(function (result) {
        if (!result || (result.ok !== 0 && result.ok !== 1) || result.network) throw new Error('protocol');
        if (Number.isFinite(result.server_ms)) R.offset = result.server_ms + (Date.now() - sent) / 2 - Date.now();
        if (result.retryable) throw new Error('retryable');
        if (!result.ok && (!result.code || ['login', 'permission', 'upgrade', 'norules'].indexOf(result.code) >= 0)) blocked = true;
        if (writing) pending = null;
        failures = 0;
        if (!result.ok) emit('note', result.msg || '操作未成功，请刷新页面后再试。');
        else emit('note', '');
        if (data.action !== 'history' && data.action !== 'replay') {
          if (validRoom(result.room)) {
            R.room = result.room; R.seat = result.room.me || 0; R.queued = null;
            emit('update', R.room);
          } else if (result.ok && result.queued) {
            R.room = null; R.seat = 0; R.queued = { waiting: result.waiting || 1 };
            emit('queue', R.queued);
          } else if (result.ok && (data.action === 'current' || data.action === 'match_cancel')) {
            R.room = null; R.seat = 0; R.queued = null;
            emit('update', null); emit('queue', null);
          }
        }
        return result;
      }).catch(function () {
        failures++;
        emit('note', '暂未确认操作结果，局面以服务端为准。');
        return null;
      }).then(function (r) {
        clearTimeout(timeout); busy = false; emit('busy', false); schedule();
        return r;
      });
    }
    function write(action, fields) {
      if (busy || blocked || pending || document.hidden) return Promise.resolve(null);
      pending = Object.assign({ action: action, request_id: rid() }, fields || {});
      return request(pending, true);
    }
    R.on = function (ev, fn) { if (handlers[ev]) handlers[ev].push(fn); return R; };
    R.active = active;
    R.myTurn = function () { return !!R.room && R.room.status === 1 && R.room.turn === R.seat; };
    R.pending = function () { return !!pending; };
    R.busy = function () { return busy; };
    R.blocked = function () { return blocked; };
    R.serverNow = function () { return Date.now() + R.offset; };
    R.link = function (code) {
      var u = new URL(cfg.url, location.href);
      u.searchParams.set('mod', 'play'); u.searchParams.set('game', cfg.game); u.searchParams.set('room', code || (R.room && R.room.code) || '');
      return u.href;
    };
    R.create = function () { return active() ? Promise.resolve(null) : write('create'); };
    R.join = function (code) {
      code = String(code || '').trim();
      try { if (/^https?:/i.test(code)) code = new URL(code).searchParams.get('room') || ''; } catch (e) {}
      code = code.toUpperCase();
      if (!/^[A-F0-9]{12}$/.test(code)) { emit('note', '请输入正确的 12 位房间号。'); return Promise.resolve(null); }
      return write('join', { room: code });
    };
    R.match = function () { return active() ? Promise.resolve(null) : write('match'); };
    R.cancelMatch = function () { return request({ action: 'match_cancel' }); };
    R.move = function (payload) {
      if (!R.myTurn()) return Promise.resolve(null);
      return write('move', { room: R.room.code, version: R.room.version, data: JSON.stringify(payload || {}) });
    };
    R.resign = function () { return active() ? write('resign', { room: R.room.code, version: R.room.version }) : Promise.resolve(null); };
    R.refresh = function () { return request(R.room ? { action: 'state', room: R.room.code } : { action: 'current' }); };
    R.retry = function () { return pending && !busy ? request(pending, true) : Promise.resolve(null); };
    R.history = function () { return request({ action: 'history' }).then(function (r) { return r && r.ok ? r.history : null; }); };
    R.replay = function (code) { return request({ action: 'replay', room: code }).then(function (r) { return r && r.ok ? r : null; }); };
    document.addEventListener('visibilitychange', function () {
      clearTimeout(pollTimer); pollTimer = null;
      if (!document.hidden && !busy) R.refresh();
    });
    R.boot = function () {
      var code = '';
      try { code = new URL(location.href).searchParams.get('room') || ''; } catch (e) {}
      if (!api.uid) return;
      request({ action: 'current' }).then(function (r) {
        // 帶房間號進來、而且自己沒有進行中的房間：直接加入
        if (code && r && r.ok && !r.room && !r.queued) R.join(code);
      });
    };
    return R;
  }

  function boot() {
    var stage = document.getElementById('gc-stage');
    if (!stage || stage.dataset.booted) return;
    var cfg = {
      url: stage.dataset.url, game: stage.dataset.game, formhash: stage.dataset.formhash,
      login: stage.dataset.login, unit: stage.dataset.unit || '分',
      mode: stage.dataset.mode || '', ref: stage.dataset.ref || '0', room: stage.dataset.room === '1'
    };
    var fn = defs[cfg.game];
    if (!fn) return;
    stage.dataset.booted = '1';
    var api = {
      best: stage.dataset.best === '' ? null : +stage.dataset.best,
      dailyBest: !stage.dataset.dbest ? null : +stage.dataset.dbest,
      uid: +stage.dataset.uid || 0,
      rivals: (function () { try { return JSON.parse(stage.dataset.rivals || '[]'); } catch (e) { return []; } })(),
      mobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) || 'ontouchstart' in window,
      visible: function (x) { var r = x.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; },
      mode: cfg.mode,
      login: cfg.login,
      start: function () {
        return post(cfg, 'start', { mode: cfg.mode, ref: cfg.ref }).then(function (r) {
          if (!r.ok) { modal(stage, '<h3>无法开始</h3><p>' + esc(r.msg) + '</p>', [{ text: '知道了' }]); return null; }
          return r;
        });
      },
      /** 長局分段提交：piece 是字串（遊戲自訂格式，例如一段操作紀錄）；遊客不送。 */
      checkpoint: function (info, piece) {
        if (!info || info.guest) return Promise.resolve({ ok: 0, guest: 1 });
        info._seq = (info._seq || 0) + 1;
        return post(cfg, 'chunk', { token: info.token, seq: info._seq, data: String(piece) });
      },
      save: function (obj, slot) {
        if (!api.uid) return Promise.resolve({ ok: 0, msg: '登录后才能存档' });
        return post(cfg, 'save', { slot: slot || 0, data: JSON.stringify(obj == null ? {} : obj) });
      },
      load: function (slot) {
        if (!api.uid) return Promise.resolve(null);
        return post(cfg, 'load', { slot: slot || 0 }).then(function (r) {
          if (!r.ok || !r.data) return null;
          try { return { data: JSON.parse(r.data), dateline: r.dateline }; } catch (e) { return null; }
        });
      },
      clearSave: function (slot) {
        if (!api.uid) return Promise.resolve({ ok: 0 });
        return post(cfg, 'delsave', { slot: slot || 0 });
      },
      submit: function (info, data, title) {
        title = title || '游戏结束';
        var score = esc(data.score);
        if (!info || info.guest) {
          modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + score + ' <small>' + esc(cfg.unit) + '</small></div><p>' +
            esc(info && info.msg ? info.msg : '登录论坛账号后成绩才会记录') + '</p>',
            cfg.login ? [{ text: '登录', href: cfg.login }, { text: '关闭', ghost: true }] : [{ text: '关闭' }]);
          return Promise.resolve({ ok: 0, guest: 1 });
        }
        var m = modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + score + ' <small>' + esc(cfg.unit) + '</small></div><p>正在提交成绩…</p>', []);
        var body = { token: info.token };
        Object.keys(data).forEach(function (k) {
          body['d[' + k + ']'] = (data[k] !== null && typeof data[k] === 'object') ? JSON.stringify(data[k]) : data[k];
        });
        return post(cfg, 'submit', body).then(function (r) {
          m.remove();
          if (!r.ok) {
            modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + score + ' <small>' + esc(cfg.unit) + '</small></div><p class="gc-err">' + esc(r.msg) + '</p>', [{ text: '关闭' }]);
            return r;
          }
          var lines = [], btns = [{ text: '好的' }];
          if (r.challenge) {
            var c = r.challenge;
            if (c.gone) lines.push('<p class="gc-muted">对手的纪录已经更新，这场不计胜负。</p>');
            else {
              lines.push(c.self ? '<p class="gc-vsline">挑战自己：<b>' + esc(c.score) + '</b> : ' + esc(c.toscore) + '</p>'
                : '<p class="gc-vsline ' + (c.win ? 'gc-reward' : 'gc-err') + '">' + (c.win ? '⚔ 挑战成功！' : '挑战失败') + '　你 <b>' + esc(c.score) + '</b> : ' + esc(c.toscore) + ' ' + esc(c.name) + '</p>');
              if (c.win && !c.self) lines.push('<p class="gc-muted">已通知对方，对方可以回敬你这一局。</p>');
              else if (!c.win) lines.push('<p class="gc-muted">还差 ' + esc(Math.abs(c.toscore - c.score) + (c.score === c.toscore ? 1 : 0)) + ' 分，再来一次？</p>');
            }
            lines.push('<p class="gc-muted">幽灵挑战不进排行、不发奖励。</p>');
            modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + esc(r.score) + ' <small>' + esc(cfg.unit) + '</small></div>' + lines.join(''), btns);
            return r;
          }
          if (r.daily) {
            var d = r.daily;
            if (r.newbest) lines.push('<p class="gc-new">🎉 刷新今日挑战最佳！</p>');
            lines.push('<p>今日最佳 <b>' + esc(r.best) + '</b>　每日挑战排名 <b>第 ' + esc(d.rank) + ' 名</b></p>');
            lines.push('<p class="gc-muted">' + (d.left ? '今天还有 ' + esc(d.left) + ' 次机会' : '今天的 ' + esc(d.tries) + ' 次都用完了，现在可以去挑战今日榜上别人的纪录') + '</p>');
            modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + esc(r.score) + ' <small>' + esc(cfg.unit) + '</small></div>' + lines.join(''), btns);
            refreshBoards(cfg);
            return r;
          }
          if (r.newbest) lines.push('<p class="gc-new">🎉 刷新个人最佳纪录！</p>');
          lines.push('<p>个人最佳 <b>' + esc(r.best) + '</b>' + (r.rank ? '　本周排名 <b>第 ' + esc(r.rank) + ' 名</b>' : '') + '</p>');
          if (r.reward) lines.push('<p class="gc-reward">获得奖励 ' + esc(r.rewardtext) + '</p>');
          else if (r.rewardtext) lines.push('<p class="gc-muted">' + esc(r.rewardtext) + '</p>');
          modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + esc(r.score) + ' <small>' + esc(cfg.unit) + '</small></div>' + lines.join(''), [{ text: '好的' }]);
          if (r.mode === 'daily') api.dailyBest = r.best; else if (r.best != null) api.best = r.best;
          if (r.rivals) api.rivals = r.rivals;
          refreshBoards(cfg);
          return r;
        });
      },
      refreshBoards: function () { refreshBoards(cfg); },
      modal: function (html, buttons) { return modal(stage, html, buttons || [{ text: '好的' }]); },
      esc: esc
    };
    if (cfg.room) api.room = roomClient(cfg, api);
    fn(stage, api);
    if (api.room) api.room.boot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
