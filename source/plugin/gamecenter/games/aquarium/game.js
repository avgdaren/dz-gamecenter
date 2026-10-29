/** 作者：小蓝（DSH）；原插件 (C) 2026 Carinoasd。天使水族馆玩家界面。 */
(function () {
  'use strict';

  var ASSET_ROOT = 'source/plugin/gamecenter/games/aquarium/assets/';
  var CLIENT = 'aquarium-foundation-1';

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = text; }
    return n;
  }
  function clear(n) { while (n.firstChild) { n.removeChild(n.firstChild); } }

  GameCenter.register('aquarium', function (stage, api) {
    var snap = null, catalog = null, busy = false, note = '', tab = 'book', timer = null, stopped = false;
    var filter = { category: 'all', theme: 'all', owned: 'all' };
    var syncAt = 0, ticker = null, detail = null;

    var formhash = stage.dataset.formhash;
    var url = stage.dataset.url;

    function post(action, extra) {
      var body = new FormData();
      body.append('formhash', formhash);
      body.append('client_version', CLIENT);
      body.append('action', action);
      Object.keys(extra || {}).forEach(function (k) {
        var v = extra[k];
        body.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
      });
      return fetch(url + '&op=aquarium&game=aquarium&inajax=1', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', body: body
      }).then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); });
    }

    function asset(file, v) { return ASSET_ROOT + file + (v ? '?v=' + encodeURIComponent(v) : ''); }
    function version() { return (catalog && (catalog.assets_version || catalog.catalog_version)) || ''; }
    function reduceMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    function call(action, extra) {
      if (busy) { return Promise.resolve(); }
      busy = true; note = '正在同步…'; render();
      return post(action, extra).then(function (r) {
        if (r.snapshot) { snap = r.snapshot; syncAt = Date.now(); }
        if (r.catalog) { catalog = r.catalog; }
        note = r.ok ? '' : (r.msg || '暂时无法同步');
        if (r.ok && action !== 'sync' && action !== 'catalog' && action !== 'init') {
          return post('catalog', {}).then(function (x) {
            if (x.snapshot) { snap = x.snapshot; syncAt = Date.now(); }
            if (x.catalog) { catalog = x.catalog; }
            if (x.ok) { note = ''; }
          });
        }
      }).catch(function () {
        note = '连接中断，操作结果尚未确认。请点「同步」后再决定下一步。';
      }).then(function () { busy = false; render(); schedule(); });
    }

    function schedule() {
      if (timer) { clearTimeout(timer); }
      if (!stopped && !document.hidden) { timer = setTimeout(function () { call('sync'); }, 45000); }
    }

    function findFish(id) {
      if (!catalog) { return null; }
      for (var i = 0; i < catalog.fish.length; i++) { if (catalog.fish[i].id === id) { return catalog.fish[i]; } }
      return null;
    }
    function findDecor(id) {
      if (!catalog) { return null; }
      for (var i = 0; i < catalog.decor.length; i++) { if (catalog.decor[i].id === id) { return catalog.decor[i]; } }
      return null;
    }
    function fishName(id) { var m = findFish(id); return m ? m.name : id; }
    function decorName(id) { var m = findDecor(id); return m ? m.name : id; }
    function waterName(id) { return (catalog && catalog.waters && catalog.waters[id]) || id; }
    function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

    function countdown() {
      if (!snap) { return ''; }
      var period = snap.rules.periods_ms[snap.rod_level];
      var elapsed = (Date.now() - syncAt) + snap.progress_ms;
      var left = Math.max(0, period - (elapsed % period));
      var s = Math.ceil(left / 1000);
      return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
    }

    function background(base) {
      var pic = el('picture');
      var srcM = el('source');
      srcM.media = '(max-width: 760px)';
      srcM.srcset = asset('background/' + base + '_mobile.webp', version());
      pic.appendChild(srcM);
      var img = el('img');
      img.src = asset('background/' + base + '.webp', version());
      img.alt = '';
      img.decoding = 'async';
      pic.appendChild(img);
      return pic;
    }

    function tank() {
      var box = el('div', 'aq-tank');
      var moon = snap.layout && snap.layout.background === 'tank_moon';
      var bg = el('div', 'aq-bg');
      bg.appendChild(background(moon ? 'tank_moon' : 'tank_day'));
      box.appendChild(bg);

      var back = el('div', 'aq-layer aq-layer-back');
      var front = el('div', 'aq-layer aq-layer-front');
      var decor = (snap.layout && snap.layout.decor) || { back: [], front: [] };
      placeDecor(back, decor.back || [], 'back');
      placeDecor(front, decor.front || [], 'front');
      box.appendChild(back);

      var fishWrap = el('div', 'aq-fish');
      var slots = (snap.layout && snap.layout.fish) || [];
      var placed = 0;
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i]) { continue; }
        placed++;
        var f = el('div', 'aq-fish-item ' + (reduceMotion() ? 'aq-still' : (i % 2 === 0 ? 'aq-swim-r' : 'aq-swim-l')));
        f.style.left = (8 + (i + 0.5) / slots.length * 84) + '%';
        f.style.bottom = (20 + (i % 3) * 8) + '%';
        var img = el('img');
        img.src = asset('fish/' + slots[i] + '.webp', version());
        img.alt = fishName(slots[i]);
        f.appendChild(img);
        fishWrap.appendChild(f);
      }
      box.appendChild(fishWrap);
      box.appendChild(front);

      if (!placed) {
        var empty = el('div', 'aq-tank-empty');
        empty.appendChild(el('p', null, '鱼缸还空着'));
        var eb = el('button', 'aq-btn aq-btn-primary', '把收集到的鱼放进来');
        eb.addEventListener('click', function () { tab = 'edit'; render(); });
        empty.appendChild(eb);
        box.appendChild(empty);
      }

      var cta = el('button', 'aq-btn aq-tank-cta', '布置鱼缸');
      cta.addEventListener('click', function () { tab = 'edit'; render(); });
      box.appendChild(cta);
      return box;
    }

    function placeDecor(layer, list, which) {
      for (var i = 0; i < list.length; i++) {
        var d = el('div', 'aq-decor aq-decor-' + which);
        d.style.left = (8 + (i + 1) / (list.length + 1) * 84) + '%';
        var img = el('img');
        img.src = asset('decor/' + list[i] + '.webp', version());
        img.alt = decorName(list[i]);
        d.appendChild(img);
        layer.appendChild(d);
      }
    }

    function stats() {
      var bar = el('div', 'aq-stats');

      var coins = el('div', 'aq-stat');
      coins.appendChild(el('span', 'aq-stat-label', '金币'));
      coins.appendChild(el('b', null, fmt(snap.coins)));
      bar.appendChild(coins);

      var rod = el('div', 'aq-stat');
      rod.appendChild(el('span', 'aq-stat-label', '鱼竿 Lv.' + snap.rod_level));
      var cd = el('b', null, '下一条 ' + countdown());
      cd.setAttribute('data-aq-countdown', '1');
      rod.appendChild(cd);
      bar.appendChild(rod);

      var water = el('div', 'aq-stat');
      water.appendChild(el('span', 'aq-stat-label', '钓点'));
      water.appendChild(el('b', null, waterName(snap.current_water)));
      bar.appendChild(water);

      var found = 0, total = catalog ? catalog.fish.length : 0;
      if (catalog) { catalog.fish.forEach(function (f) { if (f.discovered) { found++; } }); }
      var book = el('div', 'aq-stat');
      book.appendChild(el('span', 'aq-stat-label', '图鉴'));
      book.appendChild(el('b', null, found + ' / ' + total));
      bar.appendChild(book);

      var nextLv = snap.rod_level + 1;
      if (snap.rules.rod_costs[nextLv] !== undefined) {
        var cost = snap.rules.rod_costs[nextLv];
        var shortfall = cost - snap.coins;
        var b = el('button', 'aq-btn aq-upgrade', shortfall > 0
          ? '升到 Lv.' + nextLv + ' · 还差 ' + fmt(shortfall) + ' 金币'
          : '升到 Lv.' + nextLv + '（' + fmt(cost) + ' 金币）');
        b.disabled = shortfall > 0 || busy;
        b.addEventListener('click', function () { call('upgrade', { target_level: nextLv, expected_version: snap.version }); });
        bar.appendChild(b);
      }
      return bar;
    }

    function summaryLine() {
      if (!snap.summary) { return null; }
      var s = snap.summary;
      var p = el('p', 'aq-summary-line');
      p.appendChild(el('span', null, '最近收获：' + s.catch_count + ' 条鱼 · ' + fmt(s.coins) + ' 金币'));
      if (s.discarded_ms > 0) { p.appendChild(el('span', 'aq-muted', '（离线超过 24 小时，超出部分未计入）')); }
      return p;
    }

    function tabs() {
      var bar = el('div', 'aq-tabs');
      [['book', '图鉴'], ['waters', '水域'], ['decor', '装饰'], ['edit', '布置']].forEach(function (t) {
        var b = el('button', 'aq-tab' + (tab === t[0] ? ' is-on' : ''), t[1]);
        b.addEventListener('click', function () { tab = t[0]; render(); });
        bar.appendChild(b);
      });
      return bar;
    }

    function bookPanel() {
      var wrap = el('div', 'aq-panel');
      if (!catalog) { wrap.appendChild(el('p', 'aq-muted', '正在读取图鉴…')); return wrap; }
      var grid = el('div', 'aq-grid aq-grid-book');
      catalog.fish.forEach(function (f) {
        var card = el('button', 'aq-card aq-card-click' + (f.discovered ? ' is-owned' : ' is-locked'));
        card.type = 'button';
        var pic = el('div', 'aq-card-pic');
        var img = el('img');
        img.src = asset('thumbs/fish/' + f.id + '.webp', version());
        img.alt = f.discovered ? f.name : '未发现';
        img.loading = 'lazy'; img.decoding = 'async';
        if (!f.discovered) { img.className = 'aq-silhouette'; }
        pic.appendChild(img);
        card.appendChild(pic);
        var body = el('div', 'aq-card-body');
        body.appendChild(el('strong', null, f.discovered ? f.name : '？？？'));
        var meta = el('div', 'aq-card-meta');
        meta.appendChild(el('span', 'aq-tag', f.rarity));
        meta.appendChild(el('span', 'aq-tag' + (f.discovered ? ' is-on' : ''), f.discovered ? '已收集' : '未发现'));
        body.appendChild(meta);
        card.appendChild(body);
        card.addEventListener('click', function () { detail = f.id; render(); });
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      return wrap;
    }

    function fishDetail() {
      var f = findFish(detail);
      if (!f) { return null; }
      var mask = el('div', 'aq-detail-mask');
      var box = el('div', 'aq-detail');
      var pic = el('div', 'aq-detail-pic');
      var img = el('img');
      img.src = asset('fish/' + f.id + '.webp', version());
      img.alt = f.discovered ? f.name : '';
      if (!f.discovered) { img.className = 'aq-silhouette'; }
      pic.appendChild(img);
      box.appendChild(pic);
      box.appendChild(el('h4', null, f.discovered ? f.name : '？？？'));
      box.appendChild(el('p', 'aq-muted', f.rarity + ' · ' + waterName(f.water) + ' · 单条 ' + f.coins + ' 金币'));
      if (f.discovered && f.description) { box.appendChild(el('p', null, f.description)); }
      box.appendChild(el('p', 'aq-muted', f.discovered ? ('已捕获 ' + f.catch_count + ' 次') : '尚未发现'));
      var close = el('button', 'aq-btn', '关闭');
      close.addEventListener('click', function () { detail = null; render(); });
      box.appendChild(close);
      mask.appendChild(box);
      mask.addEventListener('click', function (e) { if (e.target === mask) { detail = null; render(); } });
      return mask;
    }

    function watersPanel() {
      var wrap = el('div', 'aq-panel');
      var grid = el('div', 'aq-grid aq-grid-2');
      Object.keys(snap.rules.waters).forEach(function (wid) {
        var w = snap.rules.waters[wid];
        var unlocked = snap.unlocked_waters.indexOf(wid) !== -1;
        var card = el('div', 'aq-card aq-card-pad');
        var head = el('div', 'aq-card-head');
        head.appendChild(el('strong', null, waterName(wid)));
        if (wid === snap.current_water) { head.appendChild(el('span', 'aq-tag is-on', '当前')); }
        card.appendChild(head);
        var body = el('div', 'aq-card-body');
        if (unlocked) {
          body.appendChild(el('p', 'aq-muted', '已解锁'));
          if (wid !== snap.current_water) {
            var b = el('button', 'aq-btn', '切换到这里');
            b.addEventListener('click', function () { call('switch', { water_id: wid, expected_version: snap.version }); });
            body.appendChild(b);
          }
        } else {
          var pondFound = 0;
          if (catalog) { catalog.fish.forEach(function (f) { if (f.discovered && f.water === 'pond') { pondFound++; } }); }
          body.appendChild(el('p', 'aq-muted', '需要晴光池塘发现 ' + w.requires_count + ' 种（当前 ' + pondFound + '）'));
          body.appendChild(el('p', 'aq-muted', '解锁费用 ' + fmt(w.cost) + ' 金币'));
          var ok = pondFound >= w.requires_count && snap.coins >= w.cost;
          var ub = el('button', 'aq-btn', '解锁');
          ub.disabled = !ok;
          ub.title = ok ? '' : (pondFound < w.requires_count ? ('还差 ' + (w.requires_count - pondFound) + ' 种鱼') : ('还差 ' + fmt(w.cost - snap.coins) + ' 金币'));
          ub.addEventListener('click', function () { call('unlock', { water_id: wid, expected_version: snap.version }); });
          body.appendChild(ub);
        }
        card.appendChild(body);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      return wrap;
    }

    function decorPanel() {
      var wrap = el('div', 'aq-panel');
      if (!catalog) { wrap.appendChild(el('p', 'aq-muted', '正在读取装饰…')); return wrap; }
      var bar = el('div', 'aq-filters');
      [['all', '全部'], ['plant', '水草'], ['scape', '石景'], ['building', '建筑'], ['trinket', '摆件']].forEach(function (c) {
        var b = el('button', 'aq-chip' + (filter.category === c[0] ? ' is-on' : ''), c[1]);
        b.addEventListener('click', function () { filter.category = c[0]; render(); });
        bar.appendChild(b);
      });
      [['all', '全部主题'], ['nature', '自然'], ['coral', '珊瑚'], ['moon', '月光'], ['ruin', '遗迹']].forEach(function (t) {
        var b = el('button', 'aq-chip' + (filter.theme === t[0] ? ' is-on' : ''), t[1]);
        b.addEventListener('click', function () { filter.theme = t[0]; render(); });
        bar.appendChild(b);
      });
      [['all', '不限'], ['owned', '已拥有'], ['missing', '未拥有']].forEach(function (o) {
        var b = el('button', 'aq-chip' + (filter.owned === o[0] ? ' is-on' : ''), o[1]);
        b.addEventListener('click', function () { filter.owned = o[0]; render(); });
        bar.appendChild(b);
      });
      wrap.appendChild(bar);

      var grid = el('div', 'aq-grid aq-grid-decor');
      var shown = 0;
      catalog.decor.forEach(function (d) {
        if (filter.category !== 'all' && d.category !== filter.category) { return; }
        if (filter.theme !== 'all' && d.themes.indexOf(filter.theme) === -1) { return; }
        if (filter.owned === 'owned' && !d.owned) { return; }
        if (filter.owned === 'missing' && d.owned) { return; }
        shown++;
        var card = el('div', 'aq-card' + (d.owned ? ' is-owned' : ''));
        var pic = el('div', 'aq-card-pic');
        var img = el('img');
        img.src = asset('thumbs/decor/' + d.id + '.webp', version());
        img.alt = d.name; img.loading = 'lazy'; img.decoding = 'async';
        pic.appendChild(img);
        card.appendChild(pic);
        var body = el('div', 'aq-card-body');
        body.appendChild(el('strong', null, d.name));
        body.appendChild(el('span', 'aq-tag', fmt(d.cost) + ' 金币'));
        if (d.owned) {
          body.appendChild(el('span', 'aq-tag is-on', '已拥有'));
        } else {
          var miss = [];
          if (d.missing.coins > 0) { miss.push('还差 ' + fmt(d.missing.coins) + ' 金币'); }
          if (d.missing.pond_fish > 0) { miss.push('池塘还差 ' + d.missing.pond_fish + ' 种鱼'); }
          if (d.missing.total_fish > 0) { miss.push('图鉴还差 ' + d.missing.total_fish + ' 种'); }
          if (d.missing.water) { miss.push('需先解锁' + waterName(d.missing.water)); }
          var b = el('button', 'aq-btn', '购买');
          b.disabled = miss.length > 0;
          if (miss.length) { body.appendChild(el('span', 'aq-muted', miss.slice(0, 2).join('；'))); }
          b.addEventListener('click', function () { call('buy', { decor_id: d.id, expected_version: snap.version }); });
          body.appendChild(b);
        }
        card.appendChild(body);
        grid.appendChild(card);
      });
      if (!shown) { wrap.appendChild(el('p', 'aq-muted', '没有符合条件的装饰')); }
      wrap.appendChild(grid);
      return wrap;
    }

    function editPanel() {
      var wrap = el('div', 'aq-panel');
      if (!catalog) { wrap.appendChild(el('p', 'aq-muted', '正在读取布置…')); return wrap; }
      var discovered = catalog.fish.filter(function (f) { return f.discovered; });
      var owned = catalog.decor.filter(function (d) { return d.owned; });
      var form = el('div', 'aq-form');

      var bgRow = el('div', 'aq-row');
      bgRow.appendChild(el('label', 'aq-label', '背景'));
      var bgSel = el('select', 'aq-select');
      [['tank_day', '日光'], ['tank_moon', '月光']].forEach(function (o) {
        var op = el('option', null, o[1]); op.value = o[0];
        if (snap.layout.background === o[0]) { op.selected = true; }
        bgSel.appendChild(op);
      });
      bgRow.appendChild(bgSel);
      form.appendChild(bgRow);

      var fishRow = el('div', 'aq-row');
      fishRow.appendChild(el('label', 'aq-label', '鱼位（' + snap.fish_capacity + '）'));
      var fishSel = [];
      for (var i = 0; i < snap.fish_capacity; i++) {
        var s = el('select', 'aq-select aq-select-slot');
        var none = el('option', null, '空'); none.value = '';
        s.appendChild(none);
        discovered.forEach(function (f) {
          var o = el('option', null, f.name); o.value = f.id;
          if (snap.layout.fish[i] === f.id) { o.selected = true; }
          s.appendChild(o);
        });
        fishSel.push(s);
        fishRow.appendChild(s);
      }
      form.appendChild(fishRow);

      ['back', 'front'].forEach(function (layer) {
        var row = el('div', 'aq-row');
        row.appendChild(el('label', 'aq-label', (layer === 'back' ? '后景' : '前景') + '（最多 ' + catalog.decor_slots_per_layer + '）'));
        var list = snap.layout.decor[layer] || [];
        for (var k = 0; k < catalog.decor_slots_per_layer; k++) {
          var s2 = el('select', 'aq-select aq-select-slot');
          var none2 = el('option', null, '空'); none2.value = '';
          s2.appendChild(none2);
          owned.forEach(function (d) {
            if (d.layers.indexOf(layer) === -1) { return; }
            var o = el('option', null, d.name); o.value = d.id;
            if (list[k] === d.id) { o.selected = true; }
            s2.appendChild(o);
          });
          s2.dataset.layer = layer;
          s2.dataset.slot = String(k);
          row.appendChild(s2);
        }
        form.appendChild(row);
      });

      var save = el('button', 'aq-btn aq-btn-primary', '保存布置');
      save.addEventListener('click', function () {
        var fish = fishSel.map(function (s) { return s.value || null; });
        var decor = { back: [], front: [] };
        var selects = form.querySelectorAll('select[data-layer]');
        for (var j = 0; j < selects.length; j++) {
          var v = selects[j].value;
          if (v) { decor[selects[j].dataset.layer].push(v); }
        }
        call('layout', { expected_version: snap.version, layout: { fish: fish, decor: decor, background: bgSel.value } });
      });
      form.appendChild(save);

      var caps = snap.rules.fish_capacities || [];
      var idx = caps.indexOf(snap.fish_capacity);
      if (idx >= 0 && idx + 1 < caps.length) {
        var cost = snap.rules.fish_capacity_costs[idx + 1];
        var row2 = el('div', 'aq-row');
        row2.appendChild(el('label', 'aq-label', '扩容'));
        var shortfall = cost - snap.coins;
        var eb = el('button', 'aq-btn', '扩容到 ' + caps[idx + 1] + ' 位' + (shortfall > 0 ? ' · 还差 ' + fmt(shortfall) + ' 金币' : '（' + fmt(cost) + ' 金币）'));
        eb.disabled = shortfall > 0;
        eb.addEventListener('click', function () { call('expand', { expected_version: snap.version }); });
        row2.appendChild(eb);
        form.appendChild(row2);
      }

      wrap.appendChild(form);
      return wrap;
    }

    function tick() {
      if (!snap) { return; }
      var nodes = stage.querySelectorAll('[data-aq-countdown]');
      for (var i = 0; i < nodes.length; i++) { nodes[i].textContent = '下一条 ' + countdown(); }
    }

    function render() {
      if (ticker) { clearInterval(ticker); ticker = null; }
      clear(stage);
      var wrap = el('div', 'aq-wrap');

      var head = el('div', 'aq-head');
      head.appendChild(el('h3', null, '我的鱼缸'));
      head.appendChild(el('p', 'aq-muted', note || '离线也会继续钓鱼，最多累计 24 小时。'));
      wrap.appendChild(head);

      if (!api.uid) {
        var g = el('div', 'aq-empty');
        g.appendChild(el('p', null, '登录论坛账号后即可建立并保存自己的水族馆。'));
        var a = el('a', 'aq-btn', '去登录');
        a.href = stage.dataset.login || 'member.php?mod=logging&action=login';
        g.appendChild(a);
        wrap.appendChild(g);
        stage.appendChild(wrap);
        return;
      }

      if (!snap) {
        var e2 = el('div', 'aq-empty');
        e2.appendChild(el('p', null, note || '还没有你的水族馆。'));
        var b = el('button', 'aq-btn aq-btn-primary', '建立我的水族馆');
        b.disabled = busy;
        b.addEventListener('click', function () { call('init'); });
        e2.appendChild(b);
        wrap.appendChild(e2);
        stage.appendChild(wrap);
        return;
      }

      wrap.appendChild(stats());
      var sl = summaryLine();
      if (sl) { wrap.appendChild(sl); }
      wrap.appendChild(tank());
      wrap.appendChild(tabs());
      if (tab === 'book') { wrap.appendChild(bookPanel()); }
      else if (tab === 'waters') { wrap.appendChild(watersPanel()); }
      else if (tab === 'decor') { wrap.appendChild(decorPanel()); }
      else { wrap.appendChild(editPanel()); }

      var info = el('details', 'aq-note');
      info.appendChild(el('summary', null, '说明与管理员提示'));
      info.appendChild(el('p', null, '离线最多累计 24 小时，超出部分不计入；金币只在本游戏使用。'));
      info.appendChild(el('p', null, '当前仅管理员可见，内容与美术仍在验收中，不发论坛积分。'));
      wrap.appendChild(info);

      var d = detail ? fishDetail() : null;
      if (d) { wrap.appendChild(d); }

      stage.appendChild(wrap);
      ticker = setInterval(tick, 1000);
    }

    document.addEventListener('visibilitychange', function () {
      stage.classList.toggle('aq-paused', !!document.hidden);
      if (document.hidden) { if (timer) { clearTimeout(timer); } }
      else { call('sync'); }
    });
    window.addEventListener('pagehide', function () { stopped = true; if (timer) { clearTimeout(timer); } });
    window.addEventListener('pageshow', function () { if (stopped) { stopped = false; call('sync'); } });

    render();
    if (api.uid) { call('catalog'); }
  });
}());
