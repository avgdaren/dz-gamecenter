/**
 * 遊戲中心 gamecenter — 開發範例「十秒点击」。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 資料夾名稱以底線開頭，平台不會登記它；複製成 games/<你的識別碼>/ 再改內容（見 DEVELOP.md）。
 * 這款沒有 verify.php：成績由瀏覽器回報，可被偽造，後台要發積分時請設「分數上限」。
 */
(function () {
  'use strict';
  GameCenter.register('_example', function (stage, api) {
    stage.insertAdjacentHTML('beforeend',
      '<div style="text-align:center;padding:30px 0">' +
      '<div style="font-size:40px;font-weight:bold" class="ex-n">0</div>' +
      '<div class="ex-t" style="color:#888;margin-bottom:16px">按「开始」</div>' +
      '<button type="button" class="gc-btn ex-go">开始</button></div>');
    var n = 0, timer = 0, info = null, playing = false;
    var $n = stage.querySelector('.ex-n'), $t = stage.querySelector('.ex-t'), go = stage.querySelector('.ex-go');
    go.addEventListener('click', function () {
      if (playing) { n++; $n.textContent = n; return; }
      go.disabled = true;
      api.start().then(function (r) {            // 1. 開局：拿憑證（遊客會拿到 guest:1）
        go.disabled = false;
        if (!r) return;
        info = r; n = 0; $n.textContent = 0; playing = true;
        go.textContent = '点我！';
        var end = Date.now() + 10000;
        timer = setInterval(function () {
          var left = Math.max(0, end - Date.now());
          $t.textContent = '剩 ' + (left / 1000).toFixed(1) + ' 秒';
          if (left > 0) return;
          clearInterval(timer);
          playing = false;
          go.textContent = '再来一次';
          api.submit(info, { score: n }, '时间到');   // 2. 交成績：平台負責送出、顯示結果、刷新排行
        }, 100);
      });
    });
  });
})();
