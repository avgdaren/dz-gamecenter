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
 // Array order is the persisted left-to-right order within one server layer.
 // Fit visible bboxes, never transparent sprite canvases. Wide full layers scale uniformly.
 function arrange(items,width,height){
  if(!Array.isArray(items)||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
   throw new RangeError('Invalid decor arrangement');
  if(!items.length)return [];
  var padding=width*0.035,gap=width*0.018;
  var widths=items.map(function(item){return rect(item,width,height,0.5).visible.width;});
  var sum=widths.reduce(function(a,b){return a+b;},0);
  var scale=Math.min(1,(width-2*padding-gap*(items.length-1))/sum);
  if(scale<=0)throw new RangeError('Too many decor items');
  widths=widths.map(function(w){return w*scale;});
  var centers=[];
  items.forEach(function(item,i){
   var target=items.length===1 ? ((item.preferred_x||[0.5])[0]) : (i+0.5)/items.length;
   var center=target*width;
   var min=i ? centers[i-1]+(widths[i-1]+widths[i])/2+gap : padding+widths[i]/2;
   centers.push(Math.max(min,center));
  });
  for(var i=items.length-1;i>=0;i--){
   var max=i===items.length-1 ? width-padding-widths[i]/2 : centers[i+1]-(widths[i+1]+widths[i])/2-gap;
   centers[i]=Math.min(centers[i],max);
  }
  return items.map(function(item,i){
   var display=Object.assign({},item,{visible_width_ratio:item.visible_width_ratio*scale});
   var probe=rect(display,width,height,0.5);
   var offset=probe.visible.left+probe.visible.width/2-width/2;
   var x=(centers[i]-offset)/width;
   return {x:x,scale:scale,rect:rect(display,width,height,x)};
  });
 }
 return {rect:rect,overlaps:overlaps,arrange:arrange};
}));
