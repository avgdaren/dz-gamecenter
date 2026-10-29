/** 作者：小蓝（DSH）；原插件 (C) 2026 Carinoasd。天使水族馆玩家界面 V2。 */
(function () {
  'use strict';

  var ASSETS = 'source/plugin/gamecenter/games/aquarium/assets/';
  var CLIENT = 'aquarium-foundation-1';

  GameCenter.register('aquarium', function (stage, api) {
    var formhash = stage.dataset.formhash;
    var url = stage.dataset.url;

    var snap = null, catalog = null, busy = false, note = '';
    var tab = 'book', cat = 'all', background = 'tank_day';
    var MOTION = {}, SPEC = {}, SCENE = null;
    var timer = null, stopped = false, syncAt = 0;

    var fishBySlot = {};     // 槽位 -> 实例
    var decorEls = {};       // id -> 元素
    var fishCards = {}, decorCards = {};
    var dom = null;
    var lastFrame = 0, fadeTick = 0, stageBox = { left: 0, top: 0 };
    var sound = { music: false, sfx: false, bgm: null, lastSelect: 0, lastCoin: 0, playing: [] };

    /* ---------------- 小工具 ---------------- */
    function el(tag, cls, text) {
      var n = document.createElement(tag);
      if (cls) { n.className = cls; }
      if (text !== undefined && text !== null) { n.textContent = text; }
      return n;
    }
    function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
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
    function waterName(id) { return (catalog && catalog.waters && catalog.waters[id]) || id; }
    function version() { return (catalog && (catalog.assets_version || catalog.catalog_version)) || ''; }

    /* ---------------- 传输 ---------------- */
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

    function call(action, extra) {
      if (busy) { return Promise.resolve(); }
      busy = true; note = '正在同步…'; paint();
      return post(action, extra).then(function (r) {
        if (r.snapshot) { snap = r.snapshot; syncAt = Date.now(); background = snap.layout.background; }
        if (r.catalog) { catalog = r.catalog; }
        note = r.ok ? '' : (r.msg || '暂时无法同步');
        if (r.ok && action !== 'sync' && action !== 'catalog' && action !== 'init') {
          return post('catalog', {}).then(function (x) {
            if (x.snapshot) { snap = x.snapshot; syncAt = Date.now(); background = snap.layout.background; }
            if (x.catalog) { catalog = x.catalog; }
            if (x.ok) { note = ''; }
          });
        }
      }).catch(function () {
        note = '连接中断，操作结果尚未确认。点「同步」再看一眼。';
      }).then(function () {
        busy = false; paint(); schedule();
      });
    }

    function schedule() {
      if (timer) { clearTimeout(timer); }
      if (!stopped && !document.hidden) { timer = setTimeout(function () { call('sync'); }, 45000); }
    }

    /* ---------------- 声音 ---------------- */
    var AUDIO1 = ASSETS + 'audio/v1/', AUDIO2 = ASSETS + 'audio/v2/', AUDIO_USER = ASSETS + 'audio/user/';
    var V2_SFX = { splash: 1, water: 1, coin: 1 };
    var extCache = null;
    function pickExt() {
      if (extCache) { return extCache; }
      var probe = document.createElement('audio');
      var can = function (m) { return !!(probe.canPlayType && probe.canPlayType(m)); };
      extCache = can('audio/ogg; codecs="vorbis"') ? '.ogg' : '.mp3';
      return extCache;
    }
    function bgmUrl() {
      return (background === 'tank_moon' ? AUDIO2 + 'bgm_moonlit_garden' : AUDIO1 + 'bgm_sunlit_fish') + pickExt();
    }
    function ensureBgm() {
      var want = bgmUrl();
      if (sound.bgm && sound.bgm.getAttribute('data-src') === want) { return sound.bgm; }
      if (sound.bgm) { sound.bgm.pause(); sound.bgm.remove(); sound.bgm = null; }
      var a = new Audio(want);
      a.loop = true; a.volume = 0.35; a.preload = 'auto'; a.id = 'aq-bgm';
      a.setAttribute('data-src', want);
      a.style.display = 'none';
      document.body.appendChild(a);
      sound.bgm = a;
      return a;
    }
    function playSfx(id, force) {
      if (!sound.sfx && !force) { return; }
      var now = performance.now();
      if (id === 'select') { if (now - sound.lastSelect < 120) { return; } sound.lastSelect = now; }
      if (id === 'coin') { if (now - sound.lastCoin < 1500) { return; } sound.lastCoin = now; }
      var src = id === 'splash' ? (AUDIO_USER + 'sfx_splash_user' + pickExt())
        : ((V2_SFX[id] ? AUDIO2 : AUDIO1) + 'sfx_' + id + pickExt());
      var a = new Audio(src);
      a.volume = 0.5;
      sound.playing.push(a);
      if (sound.playing.length > 3) { sound.playing.shift().pause(); }
      a.addEventListener('ended', function () {
        var i = sound.playing.indexOf(a);
        if (i >= 0) { sound.playing.splice(i, 1); }
      });
      a.play().catch(function () {
        if (id === 'splash') {
          var fb = new Audio(AUDIO2 + 'sfx_splash' + pickExt());
          fb.volume = 0.5;
          fb.play().catch(function () {});
        }
      });
    }
    function toggleMusic() {
      sound.music = !sound.music;
      if (sound.music) {
        var a = ensureBgm();
        a.play().then(function () {
          a.volume = 0;
          var v = 0;
          var t = setInterval(function () { v = Math.min(0.35, v + 0.05); a.volume = v; if (v >= 0.35) { clearInterval(t); } }, 40);
        }).catch(function () { sound.music = false; note = '浏览器拦住了播放，再点一次'; paint(); });
      } else if (sound.bgm) { sound.bgm.pause(); }
      paint();
    }
    function toggleSfx() { sound.sfx = !sound.sfx; if (sound.sfx) { playSfx('select', true); } paint(); }

    /* ---------------- 鱼 ---------------- */
    function mountSprite(host, id) {
      var meta = MOTION[id];
      if (!meta || !window.AquariumFishSprites) {
        host.innerHTML = '<img src="' + ASSETS + 'fish/' + id + '.webp" alt="">';
        return null;
      }
      return window.AquariumFishSprites.mount(host, {
        sheetUrl: ASSETS + 'fish-motion/v1/' + meta.file,
        fallbackUrl: ASSETS + 'fish/' + id + '.webp',
        size: meta.frame_size[0], columns: meta.grid[0], frames: meta.frame_count,
        cycleMs: meta.cycle_ms,
        onError: function () { host.innerHTML = '<img src="' + ASSETS + 'fish/' + id + '.webp" alt="">'; }
      });
    }
    function createFish(id, slot) {
      var box = el('div', 'aq-fish enter');
      box.innerHTML = '<span class="aq-fin"></span><span class="aq-ripple"></span>';
      box.style.width = '10%'; box.style.maxWidth = '160px';
      var sprite = mountSprite(box.querySelector('.aq-fin'), id);
      var a0 = Math.random() * Math.PI * 2;
      box.addEventListener('click', function (ev) { ev.stopPropagation(); removeFish(slot); });
      setTimeout(function () { box.classList.remove('enter'); }, 700);
      setTimeout(function () { var rp = box.querySelector('.aq-ripple'); if (rp) { rp.remove(); } }, 900);
      return {
        id: id, slot: slot, el: box, sprite: sprite,
        nx: 0.12 + ((slot % 4) + 0.5) / 4 * 0.76,
        ny: 0.2 + (Math.floor(slot / 4) % 3 + 0.5) / 3 * 0.52,
        angle: a0, target: a0, speed: NaN, cruiseF: 0.04,
        pause: 0, nextTurn: performance.now() + 1200 + Math.random() * 1800,
        bob: Math.random() * Math.PI * 2, flip: Math.cos(a0) < 0 ? -1 : 1, tilt: 0
      };
    }
    function syncFish() {
      if (!snap || !dom) { return; }
      var layout = snap.layout.fish;
      Object.keys(fishBySlot).forEach(function (k) {
        var slot = Number(k);
        if (layout[slot] !== fishBySlot[k].id) { disposeFish(fishBySlot[k]); delete fishBySlot[k]; }
      });
      layout.forEach(function (id, slot) {
        if (!id || fishBySlot[slot]) { return; }
        var rec = createFish(id, slot);
        fishBySlot[slot] = rec;
        dom.fishLayer.appendChild(rec.el);
      });
    }
    function disposeFish(rec) {
      rec.el.classList.add('out');
      if (rec.sprite) { try { rec.sprite.dispose(); } catch (e) {} }
      var dead = rec.el;
      setTimeout(function () { dead.remove(); }, 320);
    }
    function removeFish(slot) {
      var rec = fishBySlot[slot];
      if (!rec) { return; }
      var next = snap.layout.fish.slice();
      next[slot] = null;
      playSfx('select');
      call('layout', { expected_version: snap.version, layout: { fish: next, decor: snap.layout.decor, background: snap.layout.background } });
    }
    function addFish(id) {
      var next = snap.layout.fish.slice();
      var slot = next.indexOf(null);
      if (slot < 0) { note = '鱼位满了，先收起一条，或扩容'; paint(); return; }
      next[slot] = id;
      playSfx('splash');
      call('layout', { expected_version: snap.version, layout: { fish: next, decor: snap.layout.decor, background: snap.layout.background } });
    }

    /* ---------------- 装饰 ---------------- */
    function specOf(id) { return SPEC[id] || null; }

    function createDecor(id) {
      var art = ASSETS + 'decor/' + id + '.webp';
      var box = el('div', 'aq-decor enter');
      box.dataset.id = id;
      box.innerHTML = '<span class="aq-din"><img src="' + art + '" alt=""></span>'
        + '<span class="aq-tint"></span><span class="aq-fog"></span>';
      box.style.setProperty('--art', 'url("' + art + '")');
      box.addEventListener('click', function (ev) { ev.stopPropagation(); removeDecor(id); });
      setTimeout(function () { box.classList.remove('enter'); }, 600);
      return box;
    }

    function placeDecor() {
      if (!snap || !dom || !window.AquariumDecorLayout) { return; }
      var r = dom.tank.getBoundingClientRect();
      if (!r.width) { return; }
      var scene = (SCENE && SCENE.scenes && SCENE.scenes[background]) || null;
      var override = (SCENE && SCENE.item_overrides) || {};
      var shadow = (SCENE && SCENE.contact_shadow) || {};
      ['back', 'front'].forEach(function (layer) {
        var host = layer === 'back' ? dom.back : dom.front;
        var placed = [];
        snap.layout.decor[layer].forEach(function (id) {
          var box = decorEls[id];
          var spec = specOf(id);
          if (!box || !spec) { return; }
          var probe;
          try { probe = window.AquariumDecorLayout.rect(spec, r.width, r.height, 0.5); } catch (e) { return; }
          var w = probe.sprite.width;
          var prefs = (spec.preferred_x && spec.preferred_x.length) ? spec.preferred_x : [0.5];
          var bestX = prefs[0], bestClear = -Infinity;
          prefs.forEach(function (px) {
            var clear = r.width;
            placed.forEach(function (q) { clear = Math.min(clear, Math.abs(px - q.x) * r.width - (w + q.w) / 2); });
            if (clear > bestClear) { bestClear = clear; bestX = px; }
          });
          placed.push({ x: bestX, w: w });
          var g;
          try { g = window.AquariumDecorLayout.rect(spec, r.width, r.height, bestX); } catch (e) { return; }
          if (box.parentNode !== host) { host.appendChild(box); }
          box.style.left = g.sprite.left + 'px';
          box.style.top = g.sprite.top + 'px';
          box.style.width = g.sprite.width + 'px';
          box.style.height = g.sprite.height + 'px';
          box.style.zIndex = layer === 'front' ? '5' : (spec.depth_band === 'far' ? '1' : '2');
          if (spec.anchor && isFinite(spec.anchor[1])) { box.style.setProperty('--ground', (spec.anchor[1] * 100).toFixed(1) + '%'); }
          var band = spec.depth_band || 'mid';
          var nightA = 0, fogA = 0;
          if (scene && scene.depth && scene.depth[band]) {
            nightA = scene.depth[band].night_tint_alpha || 0;
            fogA = scene.depth[band].fog_alpha || 0;
          }
          var ov = override[id] && override[id][background];
          if (ov) { nightA = ov.night_tint_alpha || 0; fogA = ov.fog_alpha || 0; }
          var tint = box.querySelector('.aq-tint'), fog = box.querySelector('.aq-fog');
          if (tint) { tint.style.background = scene ? scene.night_tint_color : '#213c68'; tint.style.opacity = String(nightA); }
          if (fog) { fog.style.background = scene ? scene.fog_color : '#b0d8e3'; fog.style.opacity = String(fogA); }
          var vis = (g.visible && g.sprite && g.sprite.width) ? (g.visible.width / g.sprite.width) : 1;
          box.style.setProperty('--vis', String(Math.min(2, Math.max(0.2, vis))));
          box.style.setProperty('--sh', String((shadow.opacity_by_depth && shadow.opacity_by_depth[band]) || 0.18));
          box.style.setProperty('--blur', ((shadow.blur_px_at_tank_width_960 || 2) * r.width / 960).toFixed(2) + 'px');
          var img = box.querySelector('img');
          if (img) { img.style.width = '100%'; img.style.height = '100%'; }
        });
      });
    }

    function syncDecor() {
      if (!snap || !dom) { return; }
      var keep = {};
      ['back', 'front'].forEach(function (layer) {
        snap.layout.decor[layer].forEach(function (id) { keep[id] = 1; });
      });
      Object.keys(decorEls).forEach(function (id) {
        if (!keep[id]) {
          var box = decorEls[id];
          box.classList.add('out');
          var dead = box;
          setTimeout(function () { dead.remove(); }, 300);
          delete decorEls[id];
        }
      });
      ['back', 'front'].forEach(function (layer) {
        snap.layout.decor[layer].forEach(function (id) {
          if (!decorEls[id]) { decorEls[id] = createDecor(id); }
        });
      });
      placeDecor();
    }

    function removeDecor(id) {
      var next = { back: snap.layout.decor.back.slice(), front: snap.layout.decor.front.slice() };
      ['back', 'front'].forEach(function (l) {
        var i = next[l].indexOf(id);
        if (i >= 0) { next[l].splice(i, 1); }
      });
      playSfx('select');
      call('layout', { expected_version: snap.version, layout: { fish: snap.layout.fish, decor: next, background: snap.layout.background } });
    }
    function addDecor(id) {
      var meta = findDecor(id);
      if (!meta) { return; }
      if (!meta.owned) { note = '「' + meta.name + '」还没拥有'; paint(); return; }
      var layer = (meta.layers && meta.layers.indexOf('front') >= 0) ? 'front' : 'back';
      var next = { back: snap.layout.decor.back.slice(), front: snap.layout.decor.front.slice() };
      var pos = next[layer].indexOf(id);
      if (pos >= 0) { next[layer].splice(pos, 1); } else {
        if (next[layer].length >= (catalog.decor_slots_per_layer || 3)) { note = (layer === 'back' ? '后景' : '前景') + '已满'; paint(); return; }
        next[layer].push(id);
      }
      playSfx(pos >= 0 ? 'select' : 'place');
      call('layout', { expected_version: snap.version, layout: { fish: snap.layout.fish, decor: next, background: snap.layout.background } });
    }

    /* ---------------- 拼装 ---------------- */
    function buildShell() {
      var wrap = el('div', 'aq-wrap');
      var head = el('div', 'aq-head');
      head.appendChild(el('h3', null, '我的鱼缸'));
      var headNote = el('p', 'aq-muted', '');
      head.appendChild(headNote);
      wrap.appendChild(head);

      var body = el('div', 'aq-body');
      var main = el('div', 'aq-main');

      var tank = el('div', 'aq-tank');
      var bg = el('div', 'aq-bg');
      tank.appendChild(bg);
      var back = el('div', 'aq-layer'); back.style.zIndex = '1';
      var fishLayer = el('div', 'aq-layer'); fishLayer.style.zIndex = '3';
      var front = el('div', 'aq-layer'); front.style.zIndex = '5';
      tank.appendChild(back); tank.appendChild(fishLayer); tank.appendChild(front);
      main.appendChild(tank);

      var tabBar = el('div', 'aq-tabs');
      var panel = el('div', 'aq-panel');
      main.appendChild(tabBar);
      main.appendChild(panel);

      var side = el('div', 'aq-side');
      body.appendChild(main);
      body.appendChild(side);
      wrap.appendChild(body);

      var info = el('details', 'aq-note');
      info.appendChild(el('summary', null, '说明与管理员提示'));
      info.appendChild(el('p', null, '离线最多累计 24 小时，超出部分不计入；金币只在本游戏使用。'));
      wrap.appendChild(info);

      stage.appendChild(wrap);
      dom = { wrap: wrap, headNote: headNote, tank: tank, bg: bg, back: back, fishLayer: fishLayer, front: front,
        tabBar: tabBar, panel: panel, side: side, info: info };
    }

    function buildTabs() {
      var bar = dom.tabBar;
      while (bar.firstChild) { bar.removeChild(bar.firstChild); }
      [['book', '图鉴'], ['decor', '装饰']].forEach(function (t) {
        var b = el('button', 'aq-tab' + (tab === t[0] ? ' is-on' : ''), t[1]);
        b.addEventListener('click', function () { tab = t[0]; buildTabs(); buildPanel(); });
        bar.appendChild(b);
      });
    }

    function buildPanel() {
      dom.panelMode = 'grid';
      var host = dom.panel;
      while (host.firstChild) { host.removeChild(host.firstChild); }
      fishCards = {}; decorCards = {};
      if (!catalog) { host.appendChild(el('p', 'aq-muted', '正在读取…')); return; }
      if (tab === 'book') {
        var grid = el('div', 'aq-grid');
        catalog.fish.forEach(function (f) {
          var card = el('button', 'aq-card' + (f.discovered ? '' : ' is-locked'));
          card.type = 'button';
          var pic = el('div', 'aq-card-pic');
          var img = el('img');
          img.src = ASSETS + 'thumbs/fish/' + f.id + '.webp?v=' + version();
          img.alt = f.discovered ? f.name : '未发现';
          img.loading = 'lazy'; img.decoding = 'async';
          if (!f.discovered) { img.className = 'aq-silhouette'; }
          pic.appendChild(img); card.appendChild(pic);
          var bodyEl = el('div', 'aq-card-body');
          bodyEl.appendChild(el('strong', null, f.discovered ? f.name : '？？？'));
          var meta = el('div', 'aq-card-meta');
          meta.appendChild(el('span', 'aq-tag', f.rarity));
          meta.appendChild(el('span', 'aq-tag', ''));
          bodyEl.appendChild(meta);
          card.appendChild(bodyEl);
          if (f.discovered) { card.addEventListener('click', function () { addFish(f.id); }); }
          fishCards[f.id] = card;
          grid.appendChild(card);
        });
        host.appendChild(grid);
      } else {
        var chips = el('div', 'aq-filters');
        [['all', '全部'], ['plant', '水草'], ['scape', '石景'], ['building', '建筑'], ['trinket', '摆件']].forEach(function (c) {
          var b = el('button', 'aq-chip' + (cat === c[0] ? ' is-on' : ''), c[1]);
          b.addEventListener('click', function () { cat = c[0]; buildPanel(); });
          chips.appendChild(b);
        });
        host.appendChild(chips);
        var grid2 = el('div', 'aq-grid');
        catalog.decor.forEach(function (d) {
          if (cat !== 'all' && d.category !== cat) { return; }
          var card = el('div', 'aq-card' + (d.owned ? '' : ' is-locked'));
          var pic = el('div', 'aq-card-pic');
          var img = el('img');
          img.src = ASSETS + 'thumbs/decor/' + d.id + '.webp?v=' + version();
          img.alt = d.name; img.loading = 'lazy'; img.decoding = 'async';
          pic.appendChild(img); card.appendChild(pic);
          var bodyEl = el('div', 'aq-card-body');
          bodyEl.appendChild(el('strong', null, d.name));
          bodyEl.appendChild(el('span', 'aq-tag', fmt(d.cost) + ' 金币'));
          bodyEl.appendChild(el('span', 'aq-tag', ''));
          if (!d.owned) {
            var miss = [];
            if (d.missing.coins > 0) { miss.push('还差 ' + fmt(d.missing.coins) + ' 金币'); }
            if (d.missing.pond_fish > 0) { miss.push('池塘还差 ' + d.missing.pond_fish + ' 种鱼'); }
            if (d.missing.total_fish > 0) { miss.push('图鉴还差 ' + d.missing.total_fish + ' 种'); }
            if (d.missing.water) { miss.push('需先解锁' + waterName(d.missing.water)); }
            if (miss.length) { bodyEl.appendChild(el('span', 'aq-muted', miss.slice(0, 2).join('；'))); }
            var buy = el('button', 'aq-btn', '购买');
            buy.disabled = miss.length > 0 || busy;
            buy.addEventListener('click', function (ev) {
              ev.stopPropagation();
              call('buy', { decor_id: d.id, expected_version: snap.version });
            });
            bodyEl.appendChild(buy);
          } else {
            card.addEventListener('click', function () { addDecor(d.id); });
          }
          card.appendChild(bodyEl);
          decorCards[d.id] = card;
          grid2.appendChild(card);
        });
        host.appendChild(grid2);
      }
      refreshCards();
    }

    function refreshCards() {
      if (!snap) { return; }
      Object.keys(fishCards).forEach(function (id) {
        var card = fishCards[id];
        var cnt = snap.layout.fish.filter(function (x) { return x === id; }).length;
        card.classList.toggle('is-on', cnt > 0);
        var tags = card.querySelectorAll('.aq-tag');
        if (tags.length > 1) { tags[1].textContent = cnt ? ('已展示 ' + cnt + ' 条') : '点一下放入'; }
      });
      Object.keys(decorCards).forEach(function (id) {
        var card = decorCards[id];
        var d = findDecor(id);
        if (!d || !d.owned) { return; }
        var placed = snap.layout.decor.back.indexOf(id) >= 0 || snap.layout.decor.front.indexOf(id) >= 0;
        card.classList.toggle('is-on', placed);
        var tags = card.querySelectorAll('.aq-tag');
        if (tags.length > 1) { tags[1].textContent = placed ? '已在缸里' : '点一下摆放'; }
      });
    }

    function buildSide() {
      var host = dom.side;
      while (host.firstChild) { host.removeChild(host.firstChild); }
      if (!snap) { return; }

      function stat(label, value, id) {
        var s = el('div', 'aq-stat');
        s.appendChild(el('span', 'aq-stat-label', label));
        var b = el('b', null, value);
        if (id) { b.id = id; }
        s.appendChild(b);
        return s;
      }
      host.appendChild(stat('金币', fmt(snap.coins), 'aq-coins'));
      var rod = stat('鱼竿 Lv.' + snap.rod_level, '下一条 ' + countdown(), 'aq-countdown');
      host.appendChild(rod);
      host.appendChild(stat('钓点', waterName(snap.current_water)));
      host.appendChild(stat('鱼位', snap.layout.fish.filter(Boolean).length + ' / ' + snap.fish_capacity, 'aq-slots'));

      var caps = (snap.rules && snap.rules.fish_capacities) || [];
      var idx = caps.indexOf(snap.fish_capacity);
      if (idx >= 0 && idx + 1 < caps.length) {
        var cost = snap.rules.fish_capacity_costs[idx + 1];
        var shortfall = cost - snap.coins;
        var eb = el('button', 'aq-btn', '扩容到 ' + caps[idx + 1] + ' 位' + (shortfall > 0 ? (' · 还差 ' + fmt(shortfall)) : ('（' + fmt(cost) + '）')));
        eb.disabled = shortfall > 0 || busy;
        eb.addEventListener('click', function () { call('expand', { expected_version: snap.version }); });
        host.appendChild(eb);
      }

      var bgRow = el('div', 'aq-stat aq-inline');
      bgRow.appendChild(el('span', 'aq-stat-label', '背景'));
      var bgSel = el('select', 'aq-select');
      [['tank_day', '日光'], ['tank_moon', '月光']].forEach(function (o) {
        var op = el('option', null, o[1]); op.value = o[0];
        if (background === o[0]) { op.selected = true; }
        bgSel.appendChild(op);
      });
      bgSel.addEventListener('change', function () {
        playSfx('water');
        call('layout', { expected_version: snap.version, layout: { fish: snap.layout.fish, decor: snap.layout.decor, background: bgSel.value } });
      });
      bgRow.appendChild(bgSel);
      host.appendChild(bgRow);

      var audio = el('div', 'aq-audio');
      var mb = el('button', 'aq-btn' + (sound.music ? ' is-on' : ''), '♪ 音乐');
      mb.addEventListener('click', toggleMusic);
      var sb = el('button', 'aq-btn' + (sound.sfx ? ' is-on' : ''), '♬ 音效');
      sb.addEventListener('click', toggleSfx);
      audio.appendChild(mb); audio.appendChild(sb);
      host.appendChild(audio);
      dom.audioBtns = { music: mb, sfx: sb };
      dom.bgSel = bgSel;
    }

    function updateSide() {
      if (!snap || !dom || !dom.side.childNodes.length) { buildSide(); return; }
      var coins = document.getElementById('aq-coins');
      if (coins) { coins.textContent = fmt(snap.coins); }
      var slots = document.getElementById('aq-slots');
      if (slots) { slots.textContent = snap.layout.fish.filter(Boolean).length + ' / ' + snap.fish_capacity; }
      if (dom.audioBtns) {
        dom.audioBtns.music.classList.toggle('is-on', sound.music);
        dom.audioBtns.sfx.classList.toggle('is-on', sound.sfx);
      }
      if (dom.bgSel) { dom.bgSel.value = background; }
    }

    function updateBackground() {
      if (!dom) { return; }
      while (dom.bg.firstChild) { dom.bg.removeChild(dom.bg.firstChild); }
      var pic = el('picture');
      var src = el('source');
      src.media = '(max-width: 760px)';
      src.srcset = ASSETS + 'background/' + background + '_mobile.webp?v=' + version();
      pic.appendChild(src);
      var img = el('img');
      img.src = ASSETS + 'background/' + background + '.webp?v=' + version();
      img.alt = '';
      pic.appendChild(img);
      dom.bg.appendChild(pic);
    }

    function paint() {
      if (!dom) { buildShell(); buildTabs(); }
      if (!snap) {
        dom.headNote.textContent = note || '还没有你的水族馆。';
        if (!stage.querySelector('.aq-empty')) {
          while (dom.panel.firstChild) { dom.panel.removeChild(dom.panel.firstChild); }
          var empty = el('div', 'aq-empty');
          empty.appendChild(el('p', null, note || '还没有你的水族馆。'));
          var b = el('button', 'aq-btn aq-btn-primary', '建立我的水族馆');
          b.disabled = busy;
          b.addEventListener('click', function () { call('init'); });
          empty.appendChild(b);
          dom.panel.appendChild(empty);
          dom.panelMode = 'empty';
        }
        return;
      }
      dom.headNote.textContent = note || '离线也会继续钓鱼，最多累计 24 小时。';
      updateBackground();
      buildSide();
      updateSide();
      if (dom.panelMode !== 'grid') { dom.panelMode = 'grid'; buildPanel(); } else { refreshCards(); }
      syncFish();
      syncDecor();
    }

    function countdown() {
      if (!snap) { return '00:00'; }
      var period = snap.rules.periods_ms[snap.rod_level];
      var elapsed = (Date.now() - syncAt) + snap.progress_ms;
      var left = Math.max(0, period - (elapsed % period));
      var s = Math.ceil(left / 1000);
      return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2);
    }
    function tickCountdown() {
      var n = document.getElementById('aq-countdown');
      if (n) { n.textContent = '下一条 ' + countdown(); }
    }

    /* ---------------- 每帧 ---------------- */
    function frame(now) {
      var dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
      if (dom) {
        var r = dom.tank.getBoundingClientRect();
        var W = r.width, H = r.height;
        stageBox = { left: r.left, top: r.top };
        Object.keys(fishBySlot).forEach(function (k) {
          var f = fishBySlot[k];
          if (!W || !H) { return; }
          var cruise = f.cruiseF * W;
          if (!isFinite(f.speed)) { f.speed = cruise * 0.8; }
          if (now > f.nextTurn) {
            f.target = f.angle + (Math.random() - 0.5) * 1.6;
            f.cruiseF = 0.035 + Math.random() * 0.03;
            f.pause = Math.random() < 0.18 ? now + 500 + Math.random() * 1100 : 0;
            f.nextTurn = now + 1100 + Math.random() * 2400;
          }
          var maxTurn = 2.0 * dt;
          var d = f.target - f.angle;
          while (d > Math.PI) { d -= Math.PI * 2; }
          while (d < -Math.PI) { d += Math.PI * 2; }
          f.angle += Math.max(-maxTurn, Math.min(maxTurn, d));
          var targetSpeed = now < f.pause ? 0 : cruise;
          f.speed += (targetSpeed - f.speed) * Math.min(1, dt * 1.6);
          f.nx += Math.cos(f.angle) * f.speed * dt / W;
          f.ny += Math.sin(f.angle) * f.speed * 0.6 * dt / H;
          f.bob += dt * 2.4;
          f.ny += Math.sin(f.bob) * 6 * dt / H;
          var mx = 0.07, top = 0.12, bottom = 0.82;
          if (f.nx < mx) { f.nx = mx; f.angle = Math.PI - f.angle; f.target = f.angle; }
          if (f.nx > 1 - mx) { f.nx = 1 - mx; f.angle = Math.PI - f.angle; f.target = f.angle; }
          if (f.ny < top) { f.ny = top; f.angle = -f.angle; f.target = f.angle; }
          if (f.ny > bottom) { f.ny = bottom; f.angle = -f.angle; f.target = f.angle; }
          if (Math.cos(f.angle) < -0.22) { f.flip = -1; } else if (Math.cos(f.angle) > 0.22) { f.flip = 1; }
          var tiltTarget = Math.max(-9, Math.min(9, Math.sin(f.angle) * 9 * f.flip));
          f.tilt += (tiltTarget - f.tilt) * Math.min(1, dt * 5);
          f.el.style.left = (f.nx * W) + 'px';
          f.el.style.top = (f.ny * H) + 'px';
          f.el.style.transform = 'translate(-50%,-50%) rotate(' + (f.tilt * f.flip).toFixed(2) + 'deg) scaleX(' + f.flip + ')';
        });
        if (now - fadeTick > 120) {
          fadeTick = now;
          var boxes = Object.keys(fishBySlot).map(function (k) {
            var f = fishBySlot[k];
            return { x: f.nx * W, y: f.ny * H, w: f.el.offsetWidth * 0.7, h: f.el.offsetHeight * 0.7 };
          });
          var fronts = dom.front.children;
          for (var i = 0; i < fronts.length; i++) {
            var box = fronts[i];
            var br = box.getBoundingClientRect();
            var pad = box.classList.contains('occluded') ? 4 * (W / 960) : 0;
            var b = { x: br.left - stageBox.left - pad, y: br.top - stageBox.top - pad, w: br.width + pad * 2, h: br.height + pad * 2 };
            var hit = false;
            for (var j = 0; j < boxes.length; j++) {
              var fb = boxes[j];
              if (fb.x + fb.w / 2 > b.x && fb.x - fb.w / 2 < b.x + b.w &&
                  fb.y + fb.h / 2 > b.y && fb.y - fb.h / 2 < b.y + b.h) { hit = true; break; }
            }
            box.classList.toggle('occluded', hit);
          }
        }
      }
      requestAnimationFrame(frame);
    }

    /* ---------------- 生命周期 ---------------- */
    document.addEventListener('visibilitychange', function () {
      document.body.classList.toggle('aq-paused', !!document.hidden);
      if (document.hidden) {
        if (timer) { clearTimeout(timer); }
        if (sound.bgm && sound.music) { sound.bgm.pause(); }
      } else {
        if (sound.bgm && sound.music) { sound.bgm.play().catch(function () {}); }
        call('sync');
      }
    });
    window.addEventListener('pagehide', function () {
      stopped = true;
      if (timer) { clearTimeout(timer); }
      if (sound.bgm) { sound.bgm.pause(); }
    });
    window.addEventListener('pageshow', function () {
      if (stopped) { stopped = false; call('sync'); }
    });
    window.addEventListener('resize', function () { placeDecor(); });

    // 额外依赖脚本：播放器与装饰几何（不进 gamecenter 的 script 清单，由本文件按需加载）
    function loadScript(src) {
      return new Promise(function (res) {
        var s = document.createElement('script');
        s.src = src; s.async = false;
        s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
    }
    var deps = Promise.all([
      loadScript(ASSETS + '../fish-sprites.js'),
      loadScript(ASSETS + '../decor-layout.js')
    ]);

    var ready = deps.then(function () { return Promise.all([
      fetch(ASSETS + 'fish-motion/v1/manifest.json').then(function (r) { return r.json(); })
        .then(function (j) { (j.items || []).forEach(function (it) { MOTION[it.id] = it; }); }).catch(function () {}),
      fetch(ASSETS + 'layout/decor-layout-v1.json').then(function (r) { return r.json(); })
        .then(function (j) { (j.items || []).forEach(function (it) { SPEC[it.id] = it; }); }).catch(function () {}),
      fetch(ASSETS + 'layout/decor-scene-v1.json').then(function (r) { return r.json(); })
        .then(function (j) { SCENE = j; }).catch(function () {})
    ]);
    });

    ready.then(function () {
      paint();
      setInterval(tickCountdown, 1000);
      requestAnimationFrame(frame);
      if (api.uid) { call('catalog'); }
    });
  });
}());
