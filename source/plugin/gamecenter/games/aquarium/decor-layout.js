/* Author: GPT / Codex, 2026-10-30. Original plugin (C) 2026 Carinoasd.
 * Geometry helper only; does not fetch, write layouts, buy items or alter saves.
 */
(function(root,factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AquariumDecorLayout=api;
}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function rect(item,width,height,x,y){
  y=y===undefined?item.ground_y_ratio:y;
  x=x===undefined?item.preferred_x[0]:x;
  var b=item.source_visible_bbox,s=item.source_size,a=item.anchor;
  if(![width,height,x,y,item.visible_width_ratio].every(Number.isFinite)||width<=0||height<=0||!b||!s||!a||
    s[0]<=0||s[1]<=0||b[2]<=b[0]||b[3]<=b[1]||item.visible_width_ratio<=0)throw new RangeError('Invalid decor geometry');
  var sw=item.visible_width_ratio*width*s[0]/(b[2]-b[0]);
  var sh=sw*s[1]/s[0],left=x*width-a[0]*sw,top=y*height-a[1]*sh;
  return {sprite:{left:left,top:top,width:sw,height:sh},
   visible:{left:left+b[0]/s[0]*sw,top:top+b[1]/s[1]*sh,
    width:(b[2]-b[0])/s[0]*sw,height:(b[3]-b[1])/s[1]*sh},
   ground:{x:x*width,y:y*height},paintLayer:item.default_layer,
   fogAlpha:item.atmosphere.max_alpha};
 }
 function overlaps(a,b,gap){
  gap=gap||0;return b.left<a.left+a.width+gap&&a.left<b.left+b.width+gap&&
   b.top<a.top+a.height+gap&&a.top<b.top+b.height+gap;
 }
 return {rect:rect,overlaps:overlaps};
}));
