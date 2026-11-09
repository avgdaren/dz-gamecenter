/* 作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。纯本地演示，绝不调用游戏 API。 */
(function () {
  'use strict';
  var data = window.BACKGROUND_SHOP_DEMO;
  var dialog = document.getElementById('preview');
  var state, selectedId, opener, returnToPreset = false;
  function node(id) { return document.getElementById(id); }
  function fmt(n) { return n.toLocaleString('en-US'); }
  function find(id) { return data.items.filter(function (item) { return item.id === id; })[0]; }
  function element(tag, cls, value) {
    var result = document.createElement(tag);
    if (cls) { result.className = cls; }
    if (value !== undefined) { result.textContent = value; }
    return result;
  }
  function missing(item) {
    var out = [], requires = item.requires;
    if (requires.pond_discovered > state.pond) { out.push('池塘还差 ' + (requires.pond_discovered - state.pond) + ' 种鱼'); }
    if (requires.total_discovered > state.total) { out.push('图鉴还差 ' + (requires.total_discovered - state.total) + ' 种鱼'); }
    if (requires.water_unlocked && state.waters.indexOf(requires.water_unlocked) < 0) { out.push('需先解锁星潮浅湾'); }
    return out;
  }
  function setNotice(message) { node('notice').textContent = message; }
  function currentImage(item) {
    node('current-image').src = item.main;
    node('current-image').alt = item.name;
    node('current-mobile').srcset = item.mobile;
    node('current-name').textContent = item.name;
  }
  function use(item) {
    if (!state.owned[item.id]) { setNotice('请先拥有这个背景。'); return; }
    state.current = item.id;
    currentImage(item);
    render();
    setNotice('已换成「' + item.name + '」，鱼和装饰保持原样。');
  }
  function render() {
    node('coins').textContent = fmt(state.coins);
    node('owned-count').textContent = '已拥有 ' + Object.keys(state.owned).length + ' / ' + data.items.length;
    var grid = node('background-grid');
    grid.replaceChildren();
    data.items.forEach(function (item) {
      var owned = !!state.owned[item.id], active = state.current === item.id, conditions = owned ? [] : missing(item);
      var card = element('article', 'background-card' + (active ? ' active' : ''));
      card.dataset.backgroundId = item.id;
      var thumb = element('button', 'scene-thumb');
      thumb.type = 'button'; thumb.setAttribute('aria-label', '预览' + item.name);
      var image = element('img'); image.src = item.thumbnail; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      thumb.appendChild(image);
      if (active || owned || item.theme) { thumb.appendChild(element('span', 'badge' + (active ? ' current' : item.theme && !owned ? ' theme' : ''), active ? '使用中' : owned ? '已拥有' : '萤光主题')); }
      thumb.addEventListener('click', function () { open(item.id, thumb); });
      card.appendChild(thumb);
      var content = element('div', 'card-content'), title = element('div', 'card-title');
      title.appendChild(element('h3', '', item.name)); content.appendChild(title);
      content.appendChild(element('p', 'card-description', item.short_description));
      var condition = conditions.join('；');
      if (!owned && state.coins < item.cost) { condition += (condition ? '；' : '') + '还差 ' + fmt(item.cost - state.coins) + ' 金币'; }
      content.appendChild(element('p', 'card-requirements', condition || (owned ? '拥有后免费切换' : '永久拥有')));
      var bottom = element('div', 'card-bottom');
      bottom.appendChild(element('span', 'price' + (item.cost ? '' : ' free'), item.cost ? fmt(item.cost) + ' 金币' : '初始赠送'));
      var action = element('button', owned && !active ? 'primary' : '', active ? '使用中' : owned ? '使用' : conditions.length ? '查看条件' : '查看购买');
      action.type = 'button'; action.disabled = active;
      action.setAttribute('aria-label', active ? item.name + '使用中' : owned ? '使用' + item.name : '查看购买' + item.name);
      action.addEventListener('click', function () { if (owned) { use(item); } else { open(item.id, action); } });
      bottom.appendChild(action); content.appendChild(bottom); card.appendChild(content); grid.appendChild(card);
    });
  }
  function open(id, trigger) {
    selectedId = id; opener = trigger || document.activeElement;
    refreshDialog(); dialog.showModal(); node('close-preview').focus();
  }
  function refreshDialog() {
    var item = find(selectedId), owned = !!state.owned[item.id], active = state.current === item.id;
    node('preview-name').textContent = item.name;
    node('preview-description').textContent = item.description;
    node('preview-image').src = item.main; node('preview-image').alt = item.name + '完整背景';
    node('preview-mobile').srcset = item.mobile;
    node('preview-badge').textContent = active ? '使用中' : owned ? '已拥有' : '未拥有';
    node('purchase-summary').hidden = owned;
    node('purchase-cost').textContent = fmt(item.cost) + ' 金币';
    node('remaining-coins').textContent = fmt(Math.max(0, state.coins - item.cost)) + ' 金币';
    var conditions = owned ? [] : missing(item);
    if (!owned && state.coins < item.cost) { conditions.push('还差 ' + fmt(item.cost - state.coins) + ' 金币'); }
    node('remaining-coins').textContent = !owned && state.coins < item.cost ? '金币不足' : fmt(state.coins - (owned ? 0 : item.cost)) + ' 金币';
    node('preview-condition').textContent = conditions.join('；');
    node('preview-action').disabled = active || conditions.length > 0;
    node('preview-action').textContent = active ? '正在使用' : owned ? '使用此背景' : '确认购买';
    node('cancel-preview').textContent = owned ? '暂不更换' : '取消';
    node('preview-hint').textContent = owned ? '更换背景不会改变鱼、装饰或钓点。' : '购买只加入收藏，不会自动更换当前背景。';
  }
  function close() {
    dialog.close();
    var focus = opener;
    if (focus && focus.isConnected) { focus.focus(); }
    else {
      var replacement = document.querySelector('[data-background-id="' + selectedId + '"] .scene-thumb');
      if (replacement) { replacement.focus(); }
    }
    if (returnToPreset) { returnToPreset = false; showPreset(); }
  }
  function tab(id) {
    ['fish','decor','background'].forEach(function (name) {
      var active = name === id;
      node('tab-' + name).classList.toggle('selected', active);
      node('tab-' + name).setAttribute('aria-selected', String(active));
      node('tab-' + name).tabIndex = active ? 0 : -1;
      node(name + '-panel').hidden = !active;
    });
  }
  function showPreset() {
    var box = node('preset-message'); box.hidden = false; box.replaceChildren();
    var own = !!state.owned.tank_firefly_grove;
    box.appendChild(element('p', '', own ? '背景已拥有。演示会使用萤光秘境；游戏接入时只应用已拥有的装饰。' : '缺少「萤光秘境」背景。本次可只应用已拥有的装饰，继续使用当前背景。'));
    var apply = element('button', 'primary', own ? '应用林泉小居' : '保留当前背景应用');
    apply.type = 'button';
    apply.addEventListener('click', function () {
      if (state.owned.tank_firefly_grove) { use(find('tank_firefly_grove')); }
      else { setNotice('演示已保留「' + find(state.current).name + '」。实际游戏还需按拥有状态筛选装饰。'); }
      box.hidden = true;
    });
    box.appendChild(apply);
    if (!own) {
      var see = element('button', '', '查看缺少的背景'); see.type = 'button';
      see.addEventListener('click', function () { returnToPreset = true; open('tank_firefly_grove', see); });
      box.appendChild(see);
    }
  }
  function reset() {
    var scenario = node('scenario').value;
    state = { coins:scenario === 'poor' ? 260 : 12800, pond:scenario === 'locked' ? 1 : 6, total:scenario === 'locked' ? 1 : 14, waters:scenario === 'locked' ? ['pond'] : ['pond','bay'], owned:{tank_day:true,tank_moon:true}, current:'tank_day' };
    if (scenario === 'owned') { state.owned.tank_firefly_grove = true; state.current = 'tank_firefly_grove'; }
    if (dialog.open) { dialog.close(); }
    selectedId = null; returnToPreset = false;
    node('preset-message').hidden = true;
    setNotice(''); currentImage(find(state.current)); render();
  }
  node('preview-action').addEventListener('click', function () {
    var item = find(selectedId);
    if (state.owned[item.id]) { use(item); close(); return; }
    if (missing(item).length || state.coins < item.cost) { refreshDialog(); return; }
    state.coins -= item.cost; state.owned[item.id] = true;
    render(); refreshDialog();
    setNotice('已购买「' + item.name + '」。可以免费使用，也可以以后再换。');
    node('preview-action').focus();
  });
  node('close-preview').addEventListener('click', close); node('cancel-preview').addEventListener('click', close);
  dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
  ['fish','decor','background'].forEach(function (name, index, names) {
    node('tab-' + name).addEventListener('click', function () { tab(name); });
    node('tab-' + name).addEventListener('keydown', function (event) {
      var next = event.key === 'ArrowRight' ? (index + 1) % names.length
        : event.key === 'ArrowLeft' ? (index + names.length - 1) % names.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? names.length - 1 : -1;
      if (next < 0) { return; }
      event.preventDefault(); tab(names[next]); node('tab-' + names[next]).focus();
    });
  });
  node('preset-demo').addEventListener('click', showPreset);
  node('scenario').addEventListener('change', reset); node('reset').addEventListener('click', reset);
  node('size-toggle').addEventListener('click', function () {
    var phone = node('demo').classList.toggle('phone');
    node('size-toggle').setAttribute('aria-pressed', String(phone));
    node('size-toggle').textContent = phone ? '桌面宽度' : '手机宽度';
  });
  var scenario = new URLSearchParams(window.location.search).get('scenario');
  if (['normal','poor','locked','owned'].indexOf(scenario) >= 0) { node('scenario').value = scenario; }
  reset();
}());
