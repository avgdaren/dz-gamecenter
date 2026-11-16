/* (C) 2026 Carinoasd. Versioned observatory star-road background: 小典 / Codex.
 * The image remains byte-identical to imagegen output; scaling is rendering only.
 */
(function(root){
 'use strict';var prior=root.DanmakuStageArt;
 function background(ctx,image,tick,reduced){
  if(!image||!image.complete||!image.naturalWidth||Math.abs(image.naturalHeight/image.naturalWidth-3)>.01)return false;
  var scale=image.naturalWidth/480;ctx.save();ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,0,prior.camera(tick,reduced)*scale,480*scale,640*scale,0,0,480,640);ctx.fillStyle='rgba(4,9,20,0.22)';ctx.fillRect(0,0,480,640);ctx.restore();return true;
 }
 root.DanmakuStageArt=Object.assign({},prior,{background:background});
}(window));
