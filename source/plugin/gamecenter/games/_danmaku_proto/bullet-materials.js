/* (C) 2026 Carinoasd. Original approved imagegen projectile atlas: 小典 / Codex. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuBulletMaterials=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var file='assets/projectile-atlas-v1.png',size=[1536,1024];
  function ready(image){return !!(image&&image.complete&&image.naturalWidth===size[0]&&image.naturalHeight===size[1]);}
  function draw(ctx,image,e){
    if(!ready(image)||e.kind<20||e.kind>25)return false;
    var slot=e.kind-20,row=slot%2,col=Math.floor(slot/2),box=col===2?40:30;
    ctx.save();ctx.translate(e.x/64,e.y/64);if(col===1)ctx.rotate(Math.atan2(e.vx,-e.vy));ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(image,col*512,row*512,512,512,-box/2,-box/2,box,box);ctx.restore();return true;
  }
  return{file:file,size:size,ready:ready,draw:draw};
}));
