/* (C) 2026 Carinoasd. Art preview: 小典 / Codex. */
(function () {
  'use strict';
  var config = window.DanmakuPlayerArtV1;
  var ctx = document.getElementById('arena').getContext('2d');
  var dark = document.getElementById('detail-dark').getContext('2d');
  var light = document.getElementById('detail-light').getContext('2d');
  var source = new Image(), ready = false, paused = false, previous = 0, clock = 0, row = 0;
  var button = document.getElementById('pause'), rowButtons = document.querySelectorAll('[data-row]');
  var frameLabel = document.getElementById('frame-label');
  source.onload = function () {
    if (source.naturalWidth !== config.sourceWidth || source.naturalHeight !== config.sourceHeight) {
      document.getElementById('status').textContent = '素材尺寸与帧配置不一致';
      return;
    }
    ready = true;
    document.getElementById('status').textContent = '12帧 · 每组4帧 · ' + config.fps + '帧/秒';
    if (config.nativePixelFrames) {
      document.getElementById('production-note').textContent = '原生48×48素材对齐预览，默认显示判定点供评审；运行游戏只在Shift或集中模式显示判定点。';
    }
  };
  source.onerror = function () { document.getElementById('status').textContent = '素材加载失败'; };
  source.src = config.source;
  if (config.portrait) document.getElementById('portrait').src = config.portrait;
  button.addEventListener('click', function () {
    paused = !paused;
    button.textContent = paused ? '继续动画' : '暂停动画';
  });
  Array.prototype.forEach.call(rowButtons, function (item) {
    item.addEventListener('click', function () {
      row = Number(item.getAttribute('data-row')); clock = 0;
      Array.prototype.forEach.call(rowButtons, function (peer) {
        peer.setAttribute('aria-pressed', peer === item ? 'true' : 'false');
      });
    });
  });
  function frame(target, column, x, y, scale) {
    target.imageSmoothingEnabled = false;
    if (ready) target.drawImage(source,
      column * config.frameWidth, row * config.frameHeight, config.frameWidth, config.frameHeight,
      x - config.anchor[0] * scale, y - config.anchor[1] * scale,
      config.logicalSize * scale, config.logicalSize * scale);
  }
  function dot(target, x, y, scale) {
    target.beginPath(); target.arc(x, y, 3 * scale, 0, Math.PI * 2);
    target.fillStyle = '#142336'; target.fill(); target.strokeStyle = '#fff4bd';
    target.lineWidth = scale; target.stroke();
    target.fillStyle = '#fff5d6'; target.fillRect(x, y, scale, scale);
  }
  function draw(now) {
    var elapsed = previous ? Math.min(50, now - previous) : 0;
    previous = now;
    if (!paused) clock += elapsed;
    var column = Math.floor(clock * config.fps / 1000) % config.columns;
    ctx.fillStyle = '#111e35'; ctx.fillRect(0, 0, 480, 640);
    for (var i = 0; i < 35; i++) {
      ctx.fillStyle = i % 4 ? '#263951' : '#4b6584';
      ctx.fillRect((i * 137 + 19) % 480, (i * 193 + 31) % 640, 1, 1);
    }
    frame(ctx, column, 240, 510, 1); dot(ctx, 240, 510, 1);
    dark.fillStyle = '#111e35'; dark.fillRect(0, 0, 144, 144);
    light.fillStyle = '#e5e8ed'; light.fillRect(0, 0, 144, 144);
    frame(dark, column, 72, 84, 3); frame(light, column, 72, 84, 3);
    dot(dark, 72, 84, 3); dot(light, 72, 84, 3);
    frameLabel.textContent = config.rows[row].name + ' · 第' + (column + 1) + '/4帧';
    ctx.fillStyle = '#a7bedf'; ctx.font = '12px "Microsoft YaHei",sans-serif';
    ctx.fillText('素材显示预览 · 480×640逻辑场地', 20, 28);
    ctx.fillText('自机画布48×48 · 判定半径3', 20, 50);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}());
