/* (C) 2026 Carinoasd. Original garden projectile presentation: 小典 / Codex.
 * Reads bullet state only. Never changes motion, collisions or scoring.
 */
(function(root){
 'use strict';
 var cache={},audit={},counts={petal:0,leaf:0,bud:0};
 function init(images,layout){
  cache={};audit={};counts={petal:0,leaf:0,bud:0};
  ['petal','leaf','bud'].forEach(function(key){
   var image=images[key],box=layout[key],width=box[2]-box[0]+1,height=box[3]-box[1]+1;
   if(!image||!image.complete||width<=0||height<=0)throw Error('庭院弹体未就绪：'+key);
   var c=document.createElement('canvas');c.width=Math.max(1,Math.round(96*width/Math.max(width,height)));c.height=Math.max(1,Math.round(96*height/Math.max(width,height)));
   var ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,box[0],box[1],width,height,0,0,c.width,c.height);
   // Source-scale contours disappear at 18px. Cache a subpixel display outline.
   // This changes neither the source PNG nor the logical collision circle.
   var outlined=document.createElement('canvas'),pad=4;outlined.width=c.width+pad*2;outlined.height=c.height+pad*2;
   var edge=outlined.getContext('2d');[-3,0,3].forEach(function(dx){[-3,0,3].forEach(function(dy){edge.drawImage(c,pad+dx,pad+dy);});});
   edge.globalCompositeOperation='source-in';edge.fillStyle={petal:'#8b3d60c0',leaf:'#24594dc0',bud:'#85632bc0'}[key];edge.fillRect(0,0,outlined.width,outlined.height);
   edge.globalCompositeOperation='source-over';edge.drawImage(c,pad,pad);
   cache[key]=outlined;var center=edge.getImageData(Math.floor(outlined.width/2),Math.floor(outlined.height/2),1,1).data;
   audit[key]={width:outlined.width,height:outlined.height,centerAlpha:center[3],displayOutline:true};
  });
 }
 function family(e,phase){
  if(e.kind>=24)return 'bud';
  if(phase===1)return e.kind===22||e.kind===23?'petal':'leaf';
  if(phase===2)return e.kind===20||e.kind===21?'bud':e.kind===23?'petal':'leaf';
  return e.kind===22?'leaf':e.kind===23?'petal':e.kind===20?'bud':'petal';
 }
 function draw(ctx,e,phase,tick,reduced){
  var key=family(e,phase),image=cache[key];if(!image)throw Error('缺少庭院弹体：'+key);
  var height=key==='leaf'?21:key==='petal'?18:20;
  height+=Math.max(0,e.radius-3)*1.5;
  var width=height*image.width/image.height;
  var heading=Math.atan2(e.vx,-e.vy),age=Math.max(0,tick-e.born);
  var sway=reduced?0:Math.sin(age*.075+e.id*.63)*(key==='leaf'?.13:key==='petal'?.20:.07);
  ctx.save();ctx.translate(e.x/64,e.y/64);ctx.rotate(heading+sway);
  if(e.kind%2)ctx.scale(-1,1);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,-width/2,-height/2,width,height);ctx.restore();counts[key]++;
  return true;
 }
 root.GardenBulletMaterials={init:init,draw:draw,family:family,inspect:function(){return{ready:Object.keys(cache).length===3,assets:JSON.parse(JSON.stringify(audit)),drawCounts:Object.assign({},counts)};}};
}(window));
