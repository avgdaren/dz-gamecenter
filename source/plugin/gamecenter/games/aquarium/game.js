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

    // 布景预设：读 assets/layout/decor-presets-v1.json，读不到就用内置三套
    var PRESETS = [
      { id: 'natural_water', name: '自然水景', background: 'tank_day',
        back: ['scape_wood', 'building_bridge'], front: ['scape_pebbles', 'plant_meadow', 'trinket_star_lamp'] },
      { id: 'ruin_realm', name: '遗迹秘境', background: 'tank_day',
        back: ['building_ruin_arch', 'scape_layers', 'plant_ribbon'], front: ['scape_pebbles', 'trinket_shell'] },
      { id: 'moon_garden', name: '月光庭院', background: 'tank_moon',
        back: ['building_angel_gate'], front: ['scape_pebbles', 'plant_lily', 'trinket_star_lamp'] }
    ];
    var PRESET_HINTS = {};
    var activeHints = null;   // 当前布景给的横向锚点（软提示，玩家手动改动后失效）
    var MOTION = {}, SPEC = {}, SCENE = null;
    var timer = null, stopped = false, syncAt = 0;

    var fishBySlot = {};     // 槽位 -> 实例
    var decorEls = {};       // id -> 元素
    var fishCards = {}, decorCards = {};
    var dom = null;
    var lastFrame = 0, fadeTick = 0, stageBox = { left: 0, top: 0 };
    // 音效默认开（点击后才发声，符合浏览器自动播放策略）；音乐默认关，避免突然出声
    var sound = { music: false, sfx: true, bgm: null, lastSelect: 0, lastCoin: 0, playing: [] };

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
        if (r.ok) {
          note = '';
        } else if (!r.code && r.msg) {
          // 服务端没返回 code、只给了中文提示：多半是插件文件版本不一致（旧 inc.php 不认 op=aquarium）
          note = r.msg + '（服务端插件版本与界面不一致：请确认 gamecenter.inc.php 已覆盖，并重启 PHP / 重新扫描插件）';
        } else {
          note = r.msg || '暂时无法同步';
        }
        if (r.ok && action !== 'sync' && action !== 'catalog' && action !== 'init') {
          return post('catalog', {}).then(function (x) {
            if (x.snapshot) { snap = x.snapshot; syncAt = Date.now(); background = snap.layout.background; }
            if (x.catalog) { catalog = x.catalog; }
            if (x.ok) { note = ''; }
          });
        }
        if (r.ok && action === 'sync') {
          var discovered = snap && snap.fish ? Object.keys(snap.fish).length : 0;
          var known = catalog && catalog.fish ? catalog.fish.filter(function (f) { return f.discovered; }).length : 0;
          var newIds = (snap && snap.summary && snap.summary.new_fish_ids) || [];
          if (newIds.length && catalog) {
            var names = newIds.map(function (id) {
              var f = findFish(id);
              return f ? f.name : id;
            });
            lastCatch = '最近钓到新鱼：' + names.join('、') + '（去图鉴点它就能放进缸）';
          }
          // 图鉴的「已发现」状态只在 catalog 里，同步后对不上就补拉一次
          if (discovered !== known) { needCatalog = true; }
        }
      }).catch(function () {
        note = '连接中断，操作结果尚未确认。点「同步」再看一眼。';
      }).then(function () {
        busy = false;
        // 购买/补给会改变「是否拥有」，卡片需要重建而不是只刷新状态
        if (action === 'buy' || action === 'devgrant' || action === 'expand' || action === 'sell') { dom.panelMode = ''; }
        if (action === 'layout') { syncSceneMusic(); }
        paint(); schedule();
        if (needCatalog) { fetchCatalogQuiet(); }
      });
    }

    var lastCatch = '';
    var needCatalog = false;
    function fetchCatalogQuiet() {
      needCatalog = false;
      return post('catalog', {}).then(function (x) {
        if (x.snapshot) { snap = x.snapshot; syncAt = Date.now(); background = snap.layout.background; }
        if (x.catalog) { catalog = x.catalog; }
        if (dom) { dom.panelMode = ''; paint(); }
      }).catch(function () {});
    }

    function schedule() {
      if (timer) { clearTimeout(timer); }
      if (!stopped && !document.hidden) { timer = setTimeout(function () { call('sync'); }, 45000); }
    }

    /* ---------------- 声音 ---------------- */
    var AUDIO1 = ASSETS + 'audio/v1/', AUDIO2 = ASSETS + 'audio/v2/', AUDIO_USER = ASSETS + 'audio/user/';
    var AUDIO_UPBEAT = ASSETS + 'audio/upbeat-v1/';
    // 场景 → 曲目。月光与星眠用 PR #41 的月光曲；拿不到就回退到轻快曲
    // 默认统一用轻快版《气泡小步舞》；月光曲留作可选，默认不挂
    var SCENE_MUSIC = {
      tank_day: 'bubble_skip',
      tank_moon: 'bubble_skip',
      tank_sakura: 'bubble_skip',
      tank_coral: 'bubble_skip',
      tank_aurora: 'bubble_skip',
      tank_star_ruins: 'bubble_skip'
    };
    var DEFAULT_TRACK = 'bubble_skip';
    var TRACK_URL = {
      bubble_skip: AUDIO_UPBEAT + 'bgm_bubble_skip',
      moonlit: AUDIO2 + 'bgm_moonlit_garden',
      sunlit: AUDIO1 + 'bgm_sunlit_fish'
    };
    var V2_SFX = { splash: 1, water: 1, coin: 1 };
    var extCache = null;
    function pickExt() {
      if (extCache) { return extCache; }
      var probe = document.createElement('audio');
      var can = function (m) { return !!(probe.canPlayType && probe.canPlayType(m)); };
      extCache = can('audio/ogg; codecs="vorbis"') ? '.ogg' : '.mp3';
      return extCache;
    }
    function trackFor(scene) { return SCENE_MUSIC[scene] || 'bubble_skip'; }
    function bgmUrl(scene, track) {
      var key = track || trackFor(scene || background);
      return TRACK_URL[key] + pickExt();
    }
    function ensureBgm(force) {
      var want = bgmUrl();
      if (!force && sound.bgm && sound.bgm.getAttribute('data-src') === want) { return sound.bgm; }
      var old = sound.bgm;
      var a = new Audio(want);
      a.loop = true; a.volume = 0; a.preload = 'auto'; a.id = 'aq-bgm';
      a.setAttribute('data-src', want);
      a.style.display = 'none';
      a.addEventListener('error', function () {
        // 月光曲拿不到就退回轻快曲；再失败就保持静音，不反复重试
        var fallback = bgmUrl(background, 'bubble_skip');
        if (a.getAttribute('data-src') === fallback) { return; }
        a.setAttribute('data-src', fallback);
        a.src = fallback;
        if (sound.music) { a.play().catch(function () {}); }
      });
      document.body.appendChild(a);
      sound.bgm = a;
      if (old) {
        // 交叉淡出旧曲
        var v = old.volume;
        var fade = setInterval(function () {
          v = Math.max(0, v - 0.06);
          old.volume = v;
          if (v <= 0) { clearInterval(fade); old.pause(); old.remove(); }
        }, 40);
      }
      return a;
    }
    function fadeTo(audio, target) {
      var v = audio.volume;
      var t = setInterval(function () {
        v = Math.min(target, v + 0.05);
        audio.volume = v;
        if (v >= target) { clearInterval(t); }
      }, 40);
    }
    /** 场景变了：音乐开着才换曲，绝不因为换背景把音乐打开 */
    function syncSceneMusic() {
      if (!sound.music) { return; }
      var a = ensureBgm();
      if (a.paused) { a.play().then(function () { fadeTo(a, 0.35); }).catch(function () {}); }
      else { fadeTo(a, 0.35); }
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
        a.play().then(function () { fadeTo(a, 0.35); })
          .catch(function () { sound.music = false; note = '浏览器拦住了播放，再点一次'; paint(); });
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
      var next = fishLayout();
      next[slot] = null;
      playSfx('select');
      call('layout', { expected_version: snap.version, layout: { fish: next, decor: snap.layout.decor, background: snap.layout.background } });
    }
    /** 该鱼种最多能放几条＝已钓到的条数 */
    function allowedFor(id) {
      var f = snap && snap.fish ? snap.fish[id] : null;
      return f ? Math.max(0, parseInt(f.catch_count, 10) || 0) : 0;
    }
    function shownFor(id) {
      return snap.layout.fish.filter(function (x) { return x === id; }).length;
    }
    function ownedFor(id) {
      var f = snap && snap.fish ? snap.fish[id] : null;
      return f ? Math.max(0, parseInt(f.owned_count, 10) || 0) : 0;
    }
    /** 可售 = 持有 − max(保留 4 条, 当前展示数) */
    function sellableFor(id) {
      return Math.max(0, ownedFor(id) - Math.max(4, shownFor(id)));
    }
    var SELL_PRICE = { '常见': 1, '少见': 2, '稀有': 5, '珍奇': 10 };
    function priceOf(id) {
      var f = findFish(id);
      return (f && SELL_PRICE[f.rarity]) || 0;
    }
    /** 生成要提交的鱼位数组：旧档超额的部分先收起，避免整次写布置被服务端拒绝 */
    function fishLayout() {
      var list = snap.layout.fish.slice();
      var per = {}, dropped = 0;
      for (var i = 0; i < list.length; i++) {
        var id = list[i];
        if (!id) { continue; }
        per[id] = (per[id] || 0) + 1;
        if (per[id] > allowedFor(id)) { list[i] = null; dropped++; }
      }
      if (dropped > 0) {
        note = '有 ' + dropped + ' 条重复鱼超过已钓数量，已自动收起';
      }
      return list;
    }

    function addFish(id) {
      var limit = allowedFor(id);
      if (shownFor(id) >= limit) {
        note = limit <= 0
          ? '还没钓到过这种鱼'
          : '「' + ((findFish(id) || {}).name || id) + '」只钓到 ' + limit + ' 条，最多放 ' + limit + ' 条';
        paint();
        return;
      }
      var next = fishLayout();
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
          var hint = activeHints && activeHints[id] && typeof activeHints[id].anchor_x === 'number'
            ? activeHints[id].anchor_x : null;
          var prefs = hint !== null ? [Math.min(0.9, Math.max(0.1, hint))]
            : ((spec.preferred_x && spec.preferred_x.length) ? spec.preferred_x : [0.5]);
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

    function clearDecorVisual() {
      Object.keys(decorEls).forEach(function (id) { decorEls[id].classList.add('out'); });
      decorEls = {};
      ['back', 'front'].forEach(function (layer) {
        var host = layer === 'back' ? dom.back : dom.front;
        while (host.firstChild) { host.removeChild(host.firstChild); }
      });
    }

    function applyPreset(pz) {
      var maxSlots = catalog.decor_slots_per_layer || 3;
      var out = { back: [], front: [] };
      var wanted = pz.back.map(function (id) { return [id, 'back']; })
        .concat(pz.front.map(function (id) { return [id, 'front']; }));
      var missing = 0;
      wanted.forEach(function (pair) {
        var id = pair[0], layer = pair[1];
        var d = findDecor(id);
        if (!d || !d.owned) { missing++; return; }
        if (out.back.indexOf(id) >= 0 || out.front.indexOf(id) >= 0) { return; }
        // 服务端只允许摆在素材声明支持的层
        var layers = d.layers || ['back'];
        if (layers.indexOf(layer) < 0) { layer = layers.indexOf('front') >= 0 ? 'front' : 'back'; }
        if (out[layer].length >= maxSlots) { missing++; return; }
        out[layer].push(id);
      });
      var total = out.back.length + out.front.length;
      if (total === 0) {
        note = '「' + pz.name + '」要用的装饰你还没有，先去下面买几件再套布景';
        playSfx('select');
        paint();
        return;
      }
      var next = { fish: fishLayout(), decor: out, background: pz.background };
      activeHints = pz.hints || null;
      // 先把缸里现有的装饰全部收掉，再按预设摆——避免"点完还要手动取消"
      clearDecorVisual();
      playSfx('place');
      note = missing > 0 ? ('「' + pz.name + '」里 ' + missing + ' 件暂时摆不上（未拥有或该层已满）') : '';
      var ver = snap.version;
      call('layout', { expected_version: ver, layout: next }).then(function () {
        // 版本冲突（比如连点两套）：拉一次最新状态，再套一次
        if (/状态已更新|conflict/.test(note || '')) {
          return post('sync', {}).then(function (r) {
            if (r.snapshot) { snap = r.snapshot; background = snap.layout.background; }
            return call('layout', { expected_version: snap.version, layout: next });
          });
        }
      });
    }

    function openSell(fid) {
      var max = sellableFor(fid);
      var price = priceOf(fid);
      if (max < 1 || price < 1) { note = '这场鱼暂时不能卖'; paint(); return; }
      var old = document.querySelector('.aq-modal'); if (old) { old.remove(); }
      var mask = el('div', 'aq-modal');
      var box = el('div', 'aq-modal-box');
      box.appendChild(el('h4', null, '卖出 ' + ((findFish(fid) || {}).name || fid)));
      box.appendChild(el('p', 'aq-muted', '单价 ' + price + ' 金币；每种至少保留 4 条，缸里展示的不会被卖。'));
      var row = el('div', 'aq-modal-row');
      var minus = el('button', 'aq-btn aq-btn-sm', '−');
      var input = el('input', 'aq-qty');
      input.type = 'number'; input.min = '1'; input.max = String(max); input.value = String(Math.min(1, max));
      var plus = el('button', 'aq-btn aq-btn-sm', '+');
      var total = el('b', null, '');
      function clamp() {
        var v = parseInt(input.value, 10) || 1;
        v = Math.max(1, Math.min(max, v));
        input.value = String(v);
        total.textContent = '到账 ' + (v * price) + ' 金币';
      }
      minus.addEventListener('click', function () { input.value = String(Math.max(1, (parseInt(input.value, 10) || 1) - 1)); clamp(); });
      plus.addEventListener('click', function () { input.value = String(Math.min(max, (parseInt(input.value, 10) || 1) + 1)); clamp(); });
      input.addEventListener('input', clamp);
      row.appendChild(minus); row.appendChild(input); row.appendChild(plus); row.appendChild(total);
      box.appendChild(row);
      var acts = el('div', 'aq-modal-acts');
      var cancel = el('button', 'aq-btn', '取消');
      cancel.addEventListener('click', function () { mask.remove(); });
      var ok = el('button', 'aq-btn aq-btn-primary', '确认卖出');
      ok.addEventListener('click', function () {
        var qty = parseInt(input.value, 10) || 1;
        mask.remove();
        playSfx('coin');
        call('sell', { expected_version: snap.version, fish_id: fid, qty: qty });
      });
      acts.appendChild(cancel); acts.appendChild(ok);
      box.appendChild(acts);
      mask.appendChild(box);
      mask.addEventListener('click', function (ev) { if (ev.target === mask) { mask.remove(); } });
      stage.appendChild(mask);
      clamp();
    }

    function removeDecor(id) {
      var next = { back: snap.layout.decor.back.slice(), front: snap.layout.decor.front.slice() };
      ['back', 'front'].forEach(function (l) {
        var i = next[l].indexOf(id);
        if (i >= 0) { next[l].splice(i, 1); }
      });
      playSfx('select');
      call('layout', { expected_version: snap.version, layout: { fish: fishLayout(), decor: next, background: snap.layout.background } });
    }
    function addDecor(id) {
      activeHints = null;
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
      call('layout', { expected_version: snap.version, layout: { fish: fishLayout(), decor: next, background: snap.layout.background } });
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
      info.appendChild(el('summary', null, '玩法说明 · 怎么放鱼和装饰'));
      var tips = [
        ['自动钓鱼', '鱼竿自己下钩，到点自动收。在线离线同速，单次最多累计 24 小时，超出部分不计入；金币只在本游戏使用。'],
        ['怎么赚金币', '每钓到一条鱼都给金币，重复鱼按同规则给，不会因为鱼种重复而变少。升鱼竿能缩短下一条的等待，也能提高每条鱼的收益。'],
        ['怎么放鱼', '在图鉴里点一条鱼，它就直接进缸、占一个鱼位。点缸里的鱼，是把那一条收起来。同一个鱼种只要钓到过就能重复放，但**最多放你钓到的条数**——钓到 5 条彩鳞鱼，才能同时摆 5 条。鱼缸初始可放 4 条，可花费金币扩容升级。'],
        ['怎么放装饰', '切到「装饰」页，点一件装饰就直接摆进缸里；再点一次、或者点缸里那件装饰，就是收起来。每层（后景/前景）最多 3 件。装饰按透视自动定位，前景挡住鱼时会自动变淡，鱼不会凭空消失。'],
        ['布景预设', '「装饰」页最下面的「布景」是整套方案：点一下就把缸里的装饰换成这一套、顺带换背景，不用一件件摆；缺的装饰会被跳过并提示。旁边还有「清空装饰」。'],
        ['钓点与扩容', '在池塘发现足够多种鱼后可以解锁浅湾，那里的鱼更值钱。右侧状态栏能看到下一个钓点的解锁条件和花费。'],
        ['声音', '音效默认开、音乐默认关；两个按钮在右侧，随时可以关。']
      ];
      tips.forEach(function (row) {
        var p2 = el('p', null, '');
        var b2 = el('strong', null, row[0] + '：');
        p2.appendChild(b2);
        p2.appendChild(document.createTextNode(String(row[1]).replace(/\*\*/g, '')));
        info.appendChild(p2);
      });
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
          var sellBtn = el('button', 'aq-btn aq-btn-sm aq-sell', '');
          sellBtn.style.display = 'none';
          sellBtn.addEventListener('click', function (ev) { ev.stopPropagation(); openSell(f.id); });
          bodyEl.appendChild(sellBtn);
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
        var presets = el('div', 'aq-presets');
        presets.appendChild(el('span', 'aq-presets-label', '布景'));
        [['tank_day', '日光'], ['tank_moon', '月光']].forEach(function (grp) {
          var row = el('div', 'aq-preset-row');
          row.appendChild(el('span', 'aq-preset-tag', grp[1]));
          PRESETS.filter(function (pz) { return pz.background === grp[0]; }).forEach(function (pz) {
            var b = el('button', 'aq-chip aq-preset', pz.name);
            if (snap.layout.background === pz.background) { b.classList.add('aq-preset-dim'); }
            b.addEventListener('click', function () { applyPreset(pz); });
            row.appendChild(b);
          });
          presets.appendChild(row);
        });
        var clearBtn = el('button', 'aq-chip aq-preset', '清空装饰');
        clearBtn.addEventListener('click', function () {
          clearDecorVisual();
          playSfx('select');
          call('layout', { expected_version: snap.version, layout: {
            fish: fishLayout(),
            decor: { back: [], front: [] },
            background: snap.layout.background
          } });
        });
        var clearRow = el('div', 'aq-preset-row');
        clearRow.appendChild(clearBtn);
        presets.appendChild(clearRow);
        host.appendChild(presets);
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
        if (tags.length > 1) {
          var owned = ownedFor(id), canSell = sellableFor(id);
          tags[1].textContent = '持有 ' + owned + ' · 展示 ' + cnt;
        }
        var sellBtn = card.querySelector('.aq-sell');
        if (sellBtn) {
          var k = sellableFor(id);
          sellBtn.style.display = k > 0 ? '' : 'none';
          sellBtn.textContent = k > 0 ? ('卖 ' + k + ' 条' + (priceOf(id) ? (' · ' + (k * priceOf(id)) + ' 金币') : '')) : '';
        }
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

      // 鱼竿升级：费用与周期都来自服务端
      var periods = (snap.rules && snap.rules.periods_ms) || [];
      var rodCosts = (snap.rules && snap.rules.rod_costs) || [];
      var nextLv = snap.rod_level + 1;
      if (nextLv < periods.length) {
        var rCost = rodCosts[nextLv];
        var rShort = rCost - snap.coins;
        var rb = el('button', 'aq-btn' + (rShort <= 0 ? ' aq-btn-primary' : ''),
          '升级鱼竿 Lv.' + nextLv + (rShort > 0 ? (' · 还差 ' + fmt(rShort)) : ('（' + fmt(rCost) + ' 金币）')));
        rb.disabled = rShort > 0 || busy;
        rb.addEventListener('click', function () { call('upgrade', { expected_version: snap.version, target_level: nextLv }); });
        host.appendChild(rb);
      }

      // 钓点：当前的点位 + 其它点位的解锁/切换
      var waters = (snap.rules && snap.rules.waters) || {};
      var waterBox = el('div', 'aq-stat aq-waters');
      waterBox.appendChild(el('span', 'aq-stat-label', '钓点 · ' + waterName(snap.current_water)));
      Object.keys(waters).forEach(function (wid) {
        if (wid === snap.current_water) { return; }
        var unlocked = (snap.unlocked_waters || []).indexOf(wid) >= 0;
        var need = (waters[wid] || {}).requires_count || 0;
        var wcost = (waters[wid] || {}).cost || 0;
        var btn = el('button', 'aq-btn aq-btn-sm');
        if (unlocked) {
          btn.textContent = '切换到' + waterName(wid);
          btn.addEventListener('click', function () { call('switch', { expected_version: snap.version, water_id: wid }); });
        } else {
          var short = wcost - snap.coins;
          btn.textContent = '解锁' + waterName(wid) + (short > 0 ? (' · 还差 ' + fmt(short)) : ('（' + fmt(wcost) + '）'));
          btn.disabled = short > 0 || busy;
          if (need > 0) {
            waterBox.appendChild(el('span', 'aq-muted',
              waterName(wid) + '：需在' + waterName(snap.current_water) + '发现 ' + need + ' 种鱼'));
          }
          btn.addEventListener('click', function () { call('unlock', { expected_version: snap.version, water_id: wid }); });
        }
        waterBox.appendChild(btn);
      });
      host.appendChild(waterBox);
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
        call('layout', { expected_version: snap.version, layout: { fish: fishLayout(), decor: snap.layout.decor, background: bgSel.value } });
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
      var head = note || '离线也会继续钓鱼，最多累计 24 小时。';
      if (lastCatch) { head += ' · ' + lastCatch; }
      dom.headNote.textContent = head;
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
    var settledPending = false;
    function tickCountdown() {
      var n = document.getElementById('aq-countdown');
      if (!n || !snap) { return; }
      var period = snap.rules.periods_ms[snap.rod_level];
      var elapsed = (Date.now() - syncAt) + snap.progress_ms;
      var left = period - (elapsed % period);
      n.textContent = '下一条 ' + countdown();
      // 到点就直接拉一次，别让玩家自己刷新
      if (left <= 900 && !settledPending && !busy) {
        settledPending = true;
        call('sync');
        setTimeout(function () { settledPending = false; }, 4000);
      }
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
    var BUILD = (function () {
      try {
        var s = document.currentScript;
        var m = s && s.src ? s.src.match(/[?&]v=([^&]+)/) : null;
        return m ? m[1] : '';
      } catch (e) { return ''; }
    }());
    function withBuild(url) { return BUILD ? (url + (url.indexOf('?') < 0 ? '?' : '&') + 'v=' + BUILD) : url; }

    var deps = Promise.all([
      loadScript(withBuild(ASSETS + '../fish-sprites.js')),
      loadScript(withBuild(ASSETS + '../decor-layout.js'))
    ]);

    var ready = deps.then(function () { return Promise.all([
      fetch(ASSETS + 'fish-motion/v1/manifest.json').then(function (r) { return r.json(); })
        .then(function (j) { (j.items || []).forEach(function (it) { MOTION[it.id] = it; }); }).catch(function () {}),
      fetch(ASSETS + 'layout/decor-layout-v1.json').then(function (r) { return r.json(); })
        .then(function (j) { (j.items || []).forEach(function (it) { SPEC[it.id] = it; }); }).catch(function () {}),
      fetch(ASSETS + 'layout/decor-scene-v1.json').then(function (r) { return r.json(); })
        .then(function (j) { SCENE = j; }).catch(function () {}),
      fetch(withBuild(ASSETS + 'layout/decor-presets-v1.json')).then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.schema === 'aquarium-decor-presets-v1' && j.items && j.items.length) {
            PRESETS = j.items.map(function (it) {
              return { id: it.id, name: it.name, background: it.background,
                back: it.back || [], front: it.front || [], hints: it.placement_hints || null };
            });
            PRESETS.forEach(function (pz) { PRESET_HINTS[pz.id] = pz.hints; });
            if (dom) { dom.panelMode = ''; }
          }
        }).catch(function () {})
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
