/* (C) 2026 Carinoasd. Pixel player rendering: 小典 / Codex. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DanmakuPlayerView = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function frame(tick, dx) {
    return { column: Math.floor(tick * 8 / 60) % 4, row: dx < 0 ? 1 : dx > 0 ? 2 : 0 };
  }
  function sprite(ctx, image, player, tick) {
    var pose = frame(tick, player.x - player.px);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, pose.column * 48, pose.row * 48, 48, 48,
      player.x / 64 - 24, player.y / 64 - 28, 48, 48);
    ctx.restore();
    return pose;
  }
  function hitpoint(ctx, player, focused) {
    if (!focused) return false;
    var x = player.x / 64, y = player.y / 64;
    ctx.save(); ctx.lineWidth = 1.5; ctx.globalAlpha = .85;
    ctx.strokeStyle = '#caf4ff'; ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(x-15,y);ctx.lineTo(x-11,y);ctx.moveTo(x+11,y);ctx.lineTo(x+15,y);
    ctx.moveTo(x,y-15);ctx.lineTo(x,y-11);ctx.moveTo(x,y+11);ctx.lineTo(x,y+15);
    ctx.lineWidth=3.5;ctx.strokeStyle='#07111f';ctx.stroke();
    ctx.lineWidth=1.5;ctx.strokeStyle='#f9f4df';ctx.stroke();
    ctx.fillStyle='#07111f';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
    // The red core is still the real radius-three hitpoint; outer marks only locate it.
    ctx.fillStyle = '#ff557d'; ctx.strokeStyle = '#fff8df';
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff8df'; ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return true;
  }
  return { frame: frame, sprite: sprite, hitpoint: hitpoint };
}));
