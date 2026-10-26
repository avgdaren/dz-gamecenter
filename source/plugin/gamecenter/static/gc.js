/**
 * 遊戲中心 gamecenter — 平台前台腳本：給每款遊戲的共用介面、成績視窗、排行榜分頁。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 遊戲寫法：
 *   GameCenter.register('<gkey>', function (stage, api) {
 *     api.start()                    → Promise<{guest, token, seed}|null>  開局（拿一次性憑證＋亂數種子）
 *     api.submit(info, data, title)  → Promise<結果>  交成績（data 至少有 score；有伺服器校驗的遊戲另帶重播資料）
 *     api.best / api.mobile / api.visible(el)
 *     api.uid（遊客 0）/ api.rivals  本週排行前 50 名 [{u: uid, n: 用戶名, s: 分數}]，交成績後自動更新
 *   });
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
  function post(cfg, op, body) {
    var fd = new FormData();
    fd.append('formhash', cfg.formhash);
    Object.keys(body || {}).forEach(function (k) { fd.append(k, body[k]); });
    return fetch(cfg.url + '&op=' + op + '&game=' + encodeURIComponent(cfg.game) + '&inajax=1', {
      method: 'POST', body: fd, credentials: 'same-origin'
    }).then(function (r) { return r.json(); }).catch(function () {
      return { ok: 0, msg: '网络错误，请稍后再试' };
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
    fetch(cfg.url + '&op=board&game=' + encodeURIComponent(cfg.game) + '&inajax=1', { credentials: 'same-origin' })
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

  function boot() {
    var stage = document.getElementById('gc-stage');
    if (!stage || stage.dataset.booted) return;
    var cfg = {
      url: stage.dataset.url, game: stage.dataset.game, formhash: stage.dataset.formhash,
      login: stage.dataset.login, unit: stage.dataset.unit || '分'
    };
    var fn = defs[cfg.game];
    if (!fn) return;
    stage.dataset.booted = '1';
    var api = {
      best: stage.dataset.best === '' ? null : +stage.dataset.best,
      uid: +stage.dataset.uid || 0,
      rivals: (function () { try { return JSON.parse(stage.dataset.rivals || '[]'); } catch (e) { return []; } })(),
      mobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) || 'ontouchstart' in window,
      visible: function (x) { var r = x.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; },
      start: function () {
        return post(cfg, 'start').then(function (r) {
          if (!r.ok) { modal(stage, '<h3>无法开始</h3><p>' + esc(r.msg) + '</p>', [{ text: '知道了' }]); return null; }
          return r;
        });
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
        Object.keys(data).forEach(function (k) { body['d[' + k + ']'] = data[k]; });
        return post(cfg, 'submit', body).then(function (r) {
          m.remove();
          if (!r.ok) {
            modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + score + ' <small>' + esc(cfg.unit) + '</small></div><p class="gc-err">' + esc(r.msg) + '</p>', [{ text: '关闭' }]);
            return r;
          }
          var lines = [];
          if (r.newbest) lines.push('<p class="gc-new">🎉 刷新个人最佳纪录！</p>');
          lines.push('<p>个人最佳 <b>' + esc(r.best) + '</b>' + (r.rank ? '　本周排名 <b>第 ' + esc(r.rank) + ' 名</b>' : '') + '</p>');
          if (r.reward) lines.push('<p class="gc-reward">获得奖励 ' + esc(r.rewardtext) + '</p>');
          else if (r.rewardtext) lines.push('<p class="gc-muted">' + esc(r.rewardtext) + '</p>');
          modal(stage, '<h3>' + esc(title) + '</h3><div class="gc-big">' + esc(r.score) + ' <small>' + esc(cfg.unit) + '</small></div>' + lines.join(''), [{ text: '好的' }]);
          api.best = r.best;
          if (r.rivals) api.rivals = r.rivals;
          refreshBoards(cfg);
          return r;
        });
      }
    };
    fn(stage, api);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
