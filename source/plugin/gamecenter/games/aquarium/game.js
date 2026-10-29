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
      }).then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.json();
      });
    }

    function asset(file, version) {
      return ASSET_ROOT + file + (version ? '?v=' + encodeURIComponent(version) : '');
    }

    function call(action, extra) {
      if (busy) { return Promise.resolve(); }
      busy = true; note = '正在同步…'; render();
      return post(action, extra).then(function (r) {
        if (r.snapshot) { snap = r.snapshot; }
        if (r.catalog) { catalog = r.catalog; }
        note = r.ok ? '' : (r.msg || '暂时无法同步');
        if (r.ok && action !== 'sync' && action !== 'catalog' && action !== 'init') {
          return post('catalog', {}).then(function (x) {
            if (x.snapshot) { snap = x.snapshot; }
            if (x.catalog) { catalog = x.catalog; }
            if (x.ok) { note = ''; }
          });
        }
      }).catch(function () {
        note = '连接中断，操作结果尚未确认。请点「同步」后再决定下一步。';
      }).then(function () {
        busy = false; render(); schedule();
      });
    }

    function schedule() {
      if (timer) { clearTimeout(timer); }
      if (!stopped && !document.hidden) { timer = setTimeout(function () { call('sync'); }, 45000); }
    }

    function fishName(id) { var m = findFish(id); return m ? m.name : id; }
    function decorName(id) { var m = findDecor(id); return m ? m.name : id; }
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
    function waterName(id) {
      if (catalog && catalog.waters && catalog.waters[id]) { return catalog.waters[id]; }
      return id;
    }
    function version() { return (catalog && (catalog.assets_version || catalog.catalog_version)) || ''; }
    function reduceMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

    function tank() {
      var box = el('div', 'aq-tank');
      var moon = snap.layout && snap.layout.background === 'tank_moon';
      var base = moon ? 'tank_moon' : 'tank_day';
      var bg = el('div', 'aq-bg');
      var pic = el('picture');
      var srcM = el('source');
      srcM.media = '(max-width: 760px)';
      srcM.srcset = asset('background/' + base + '_mobile.webp', version());
      pic.appendChild(srcM);
      var bgImg = el('img');
      bgImg.src = asset('background/' + base + '.webp', version());
      bgImg.alt = '';
      bgImg.decoding = 'async';
      pic.appendChild(bgImg);
      bg.appendChild(pic);
      box.appendChild(bg);

      var back = el('div', 'aq-layer aq-layer-back');
      var front = el('div', 'aq-layer aq-layer-front');
      var decor = (snap.layout && snap.layout.decor) || { back: [], front: [] };
      placeDecor(back, decor.back || [], 'back');
      placeDecor(front, decor.front || [], 'front');
      box.appendChild(back);

      var fishWrap = el('div', 'aq-fish');
      var slots = (snap.layout && snap.layout.fish) || [];
      for (var i = 0; i < slots.length; i++) {
        if (!slots[i]) { continue; }
        var f = el('div', 'aq-fish-item ' + (reduceMotion() ? 'aq-still' : (i % 2 === 0 ? 'aq-swim-r' : 'aq-swim-l')));
        f.style.left = ((i + 0.5) / slots.length * 100) + '%';
        f.style.bottom = (20 + (i % 3) * 8) + '%';
        var img = el('img');
        img.src = asset('fish/' + slots[i] + '.webp', version());
        img.alt = fishName(slots[i]);
        f.appendChild(img);
        fishWrap.appendChild(f);
      }
      box.appendChild(fishWrap);
      box.appendChild(front);
      box.appendChild(el('div', 'aq-tip', '点「布置」调整鱼与装饰'));
      return box;
    }

    function placeDecor(layer, list, which) {
      for (var i = 0; i < list.length; i++) {
        var d = el('div', 'aq-decor aq-decor-' + which);
        d.style.left = ((i + 1) / (list.length + 1) * 100) + '%';
        var img = el('img');
        img.src = asset('decor/' + list[i] + '.webp', version());
        img.alt = decorName(list[i]);
        d.appendChild(img);
        layer.appendChild(d);
      }
    }

    function side() {
      var box = el('div', 'aq-side');
      [['金币', String(snap.coins)],
       ['鱼竿', 'Lv.' + snap.rod_level + ' · ' + Math.round(snap.rules.periods_ms[snap.rod_level] / 1000) + ' 秒/条'],
       ['钓点', waterName(snap.current_water)]].forEach(function (row) {
        var n = el('div', 'aq-stat');
        n.appendChild(el('span', 'aq-stat-label', row[0]));
        n.appendChild(el('b', null, row[1]));
        box.appendChild(n);
      });

      var found = 0, total = catalog ? catalog.fish.length : 0;
      if (catalog) { catalog.fish.forEach(function (f) { if (f.discovered) { found++; } }); }
      var book = el('div', 'aq-stat');
      book.appendChild(el('span', 'aq-stat-label', '图鉴'));
      book.appendChild(el('b', null, found + ' / ' + total));
      box.appendChild(book);

      if (snap.summary) {
        var s = el('div', 'aq-summary');
        s.appendChild(el('strong', null, '最近收获'));
        s.appendChild(el('p', null, snap.summary.catch_count + ' 条鱼 · ' + snap.summary.coins + ' 金币'));
        if (snap.summary.discarded_ms > 0) { s.appendChild(el('p', 'aq-muted', '离线超过 24 小时，超出部分未计入')); }
        s.appendChild(el('p', 'aq-muted', '已入账，重复查看不会再次发放'));
        box.appendChild(s);
      }

      var nextLv = snap.rod_level + 1;
      if (snap.rules.rod_costs[nextLv] !== undefined) {
        var cost = snap.rules.rod_costs[nextLv];
        var b = el('button', 'aq-btn', '升到 Lv.' + nextLv + '（' + cost + ' 金币）');
        if (snap.coins < cost) { b.disabled = true; b.title = '还差 ' + (cost - snap.coins) + ' 金币'; }
        b.addEventListener('click', function () { call('upgrade', { target_level: nextLv, expected_version: snap.version }); });
        box.appendChild(b);
      }
      return box;
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
      var grid = el('div', 'aq-grid');
      catalog.fish.forEach(function (f) {
        var card = el('div', 'aq-card' + (f.discovered ? ' is-owned' : ' is-locked'));
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
        body.appendChild(el('span', 'aq-tag', f.rarity));
        body.appendChild(el('span', 'aq-muted', f.discovered ? ('捕获 ' + f.catch_count + ' 次') : ('单条 ' + f.coins + ' 金币')));
        if (f.discovered && f.description) { body.appendChild(el('p', 'aq-desc', f.description)); }
        card.appendChild(body);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
      return wrap;
    }

    function watersPanel() {
      var wrap = el('div', 'aq-panel');
      var grid = el('div', 'aq-grid aq-grid-2');
      Object.keys(snap.rules.waters).forEach(function (wid) {
        var w = snap.rules.waters[wid];
        var unlocked = snap.unlocked_waters.indexOf(wid) !== -1;
        var card = el('div', 'aq-card');
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
          body.appendChild(el('p', 'aq-muted', '解锁费用 ' + w.cost + ' 金币'));
          var ok = pondFound >= w.requires_count && snap.coins >= w.cost;
          var ub = el('button', 'aq-btn', '解锁');
          ub.disabled = !ok;
          ub.title = ok ? '' : (pondFound < w.requires_count ? ('还差 ' + (w.requires_count - pondFound) + ' 种鱼') : ('还差 ' + (w.cost - snap.coins) + ' 金币'));
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
        img.alt = d.name;
        img.loading = 'lazy'; img.decoding = 'async';
        pic.appendChild(img);
        card.appendChild(pic);
        var body = el('div', 'aq-card-body');
        body.appendChild(el('strong', null, d.name));
        body.appendChild(el('span', 'aq-tag', d.cost + ' 金币'));
        if (d.owned) {
          body.appendChild(el('span', 'aq-tag is-on', '已拥有'));
        } else {
          var miss = [];
          if (d.missing.coins > 0) { miss.push('还差 ' + d.missing.coins + ' 金币'); }
          if (d.missing.pond_fish > 0) { miss.push('池塘还差 ' + d.missing.pond_fish + ' 种鱼'); }
          if (d.missing.total_fish > 0) { miss.push('图鉴还差 ' + d.missing.total_fish + ' 种'); }
          if (d.missing.water) { miss.push('需先解锁' + waterName(d.missing.water)); }
          var b = el('button', 'aq-btn', '购买');
          b.disabled = miss.length > 0;
          if (miss.length) { body.appendChild(el('span', 'aq-muted', miss.join('；'))); }
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
        row.appendChild(el('label', 'aq-label', (layer === 'back' ? '后景' : '前景') + '装饰（最多 ' + catalog.decor_slots_per_layer + '）'));
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
        call('layout', {
          expected_version: snap.version,
          layout: { fish: fish, decor: decor, background: bgSel.value }
        });
      });
      form.appendChild(save);

      var caps = snap.rules.fish_capacities || [];
      var idx = caps.indexOf(snap.fish_capacity);
      if (idx >= 0 && idx + 1 < caps.length) {
        var cost = snap.rules.fish_capacity_costs[idx + 1];
        var row2 = el('div', 'aq-row');
        row2.appendChild(el('label', 'aq-label', '扩容'));
        var eb = el('button', 'aq-btn', '扩容到 ' + caps[idx + 1] + ' 位（' + cost + ' 金币）');
        if (snap.coins < cost) { eb.disabled = true; eb.title = '还差 ' + (cost - snap.coins) + ' 金币'; }
        eb.addEventListener('click', function () { call('expand', { expected_version: snap.version }); });
        row2.appendChild(eb);
        form.appendChild(row2);
      }

      wrap.appendChild(form);
      return wrap;
    }

    function render() {
      clear(stage);
      var wrap = el('div', 'aq-wrap');
      var head = el('div', 'aq-head');
      var title = el('div', 'aq-title');
      title.appendChild(el('h3', null, '天使水族馆'));
      title.appendChild(el('p', 'aq-muted', note || '离线也会继续钓鱼，最多累计 24 小时。'));
      head.appendChild(title);
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

      var body = el('div', 'aq-body');
      var main = el('div', 'aq-main');
      main.appendChild(tank());
      main.appendChild(tabs());
      if (tab === 'book') { main.appendChild(bookPanel()); }
      else if (tab === 'waters') { main.appendChild(watersPanel()); }
      else if (tab === 'decor') { main.appendChild(decorPanel()); }
      else { main.appendChild(editPanel()); }
      body.appendChild(main);
      body.appendChild(side());
      wrap.appendChild(body);
      stage.appendChild(wrap);
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
