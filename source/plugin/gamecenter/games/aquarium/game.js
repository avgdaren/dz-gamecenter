/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。管理员底盘诊断，非正式游戏画面。 */
(function () {
  'use strict';
  GameCenter.register('aquarium', function (stage, api) {
    var snapshot = null, busy = false, uncertain = false, note = '正在读取测试存档…', timer = null, stopped = false;
    function node(tag, text) { var el = document.createElement(tag); el.textContent = text; return el; }
    function render() {
      stage.replaceChildren();
      stage.appendChild(node('h3', '水族馆 · 底盘诊断'));
      stage.appendChild(node('p', '占位捕获配置，不是最终鱼种/价格；正式画面将使用已确认的二次元方向。'));
      var status = node('p', note); status.setAttribute('role', 'status'); stage.appendChild(status);
      if (!api.uid) { stage.appendChild(node('p', '登录后才能建立存档。')); return; }
      if (snapshot) {
        stage.appendChild(node('p', '测试金币 ' + snapshot.coins + ' · 鱼竿 Lv.' + snapshot.rod_level + ' · 捕获 ' + snapshot.catch_seq + ' 次'));
        stage.appendChild(node('p', '当前水域：' + snapshot.current_water + ' · 已发现 ' + Object.keys(snapshot.fish).length + ' 种占位鱼'));
        if (snapshot.summary) {
          var x = snapshot.summary;
          var receipt = node('details', '');
          receipt.appendChild(node('summary', '最近一笔已入账收获（点击查看）'));
          receipt.appendChild(node('p', x.catch_count + ' 条，' + x.coins + ' 金币。历史记录，重复查看不发奖。'));
          stage.appendChild(receipt);
        }
      }
      function button(label, payload) {
        var b = node('button', label); b.className = 'gc-btn'; b.disabled = busy || (uncertain && payload.action !== 'sync');
        b.addEventListener('click', function () { send(payload); }); stage.appendChild(b);
      }
      if (!snapshot) { button('建立测试存档', { action: 'init' }); }
      button('同步最新状态', { action: 'sync' });
      if (snapshot) {
        if (snapshot.rod_level < 4) {
          button('升到 Lv.' + (snapshot.rod_level + 1) + '（' + snapshot.rules.rod_costs[snapshot.rod_level + 1] + '金币）',
            { action: 'upgrade', target_level: snapshot.rod_level + 1, expected_version: snapshot.version });
        }
        Object.keys(snapshot.rules.waters).forEach(function (water) {
          var owned = snapshot.unlocked_waters.indexOf(water) !== -1;
          if (water === snapshot.current_water) return;
          button((owned ? '切换 ' : '解锁 ') + water,
            { action: owned ? 'switch' : 'unlock', water_id: water, expected_version: snapshot.version });
        });
      }
    }
    function schedule() {
      if (timer) clearTimeout(timer);
      if (!stopped && !document.hidden) timer = setTimeout(function () { send({ action: 'sync' }); }, 45000);
    }
    function post(payload) {
      var body = new FormData();
      body.append('formhash', stage.dataset.formhash); body.append('client_version', 'aquarium-foundation-1');
      Object.keys(payload).forEach(function (k) { body.append(k, payload[k]); });
      return fetch(stage.dataset.url + '&op=aquarium&game=aquarium&inajax=1', { method: 'POST', credentials: 'same-origin', body: body, cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw Error('HTTP'); return r.json(); });
    }
    function send(payload) {
      if (busy || stopped) return Promise.resolve();
      busy = true; note = '正在同步…'; render();
      return post(payload).then(function (r) {
        if (r.snapshot) snapshot = r.snapshot;
        if (payload.action === 'sync' && r.ok) uncertain = false;
        note = r.msg || '暂时无法同步';
        // 购买成功只读最新状态；失败/网络不明绝不换新 version 自动重复购买。
        if (r.ok && payload.action !== 'sync') return post({ action: 'sync' }).then(function (latest) {
          if (latest.snapshot) snapshot = latest.snapshot; if (latest.ok) uncertain = false; note = latest.msg || note;
        });
      }).catch(function () { uncertain = true; note = '连接中断，操作结果尚未确认。请同步最新状态后再决定下一步。'; })
        .finally(function () { busy = false; render(); schedule(); });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (timer) clearTimeout(timer); }
      else send({ action: 'sync' });
    });
    window.addEventListener('pagehide', function () { stopped = true; if (timer) clearTimeout(timer); });
    window.addEventListener('pageshow', function () { if (stopped) { stopped = false; send({ action: 'sync' }); } });
    render(); if (api.uid) send({ action: 'sync' });
  });
}());
