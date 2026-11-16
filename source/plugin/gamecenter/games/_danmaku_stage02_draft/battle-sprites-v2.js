/* (C) 2026 Carinoasd. Registered garden action sprites: 小典 / Codex. */
(function(root){
 'use strict';
 var cache={},audit={};
 // Each pivot is the body centre in its generated cell, not the transparent cell centre.
 // Sources remain untouched. Runtime crops are registered before rendering to game pixels.
 var specs={
  fairy:{key:'fairyActions',height:56,pivots:[[.51,.51],[.40,.52],[.51,.55],[.54,.56]]},
  attendant:{key:'attendantActions',height:72,pivots:[[.53,.51],[.53,.52],[.51,.53],[.56,.55]]},
  lingyu:{key:'lingyuActions',height:128,pivots:[[.59,.34],[.47,.34],[.57,.38],[.59,.38]]}
 };
 function init(images){
  cache={};audit={};
  Object.keys(specs).forEach(function(key){
   var spec=specs[key],image=images[spec.key],w=image.naturalWidth/2,h=image.naturalHeight/2;
   if(!Number.isInteger(w)||!Number.isInteger(h))throw Error('动作图集必须为2×2：'+key);
   var sheet=document.createElement('canvas');sheet.width=image.naturalWidth;sheet.height=image.naturalHeight;var src=sheet.getContext('2d',{willReadFrequently:true});src.drawImage(image,0,0);
   var pixels=src.getImageData(0,0,sheet.width,sheet.height).data,frames=[],extent=[0,0,0,0];
   for(var j=0;j<4;j++){
    var ox=j%2*w,oy=Math.floor(j/2)*h,b=[w,h,0,0];
    for(var y=0;y<h;y++)for(var x=0;x<w;x++)if(pixels[((oy+y)*sheet.width+ox+x)*4+3]>=128){b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x+1);b[3]=Math.max(b[3],y+1);}
    if(b[2]<=b[0]||b[3]<=b[1])throw Error('动作帧为空：'+key+'/'+j);
    var scale=spec.height/(b[3]-b[1]),pivot=spec.pivots[j],dx=(b[0]-pivot[0]*w)*scale,dy=(b[1]-pivot[1]*h)*scale,dw=(b[2]-b[0])*scale;
    frames.push({source:[ox+b[0],oy+b[1],b[2]-b[0],b[3]-b[1]],x:dx,y:dy,width:dw,height:spec.height});
    extent=[Math.min(extent[0],dx),Math.min(extent[1],dy),Math.max(extent[2],dx+dw),Math.max(extent[3],dy+spec.height)];
   }
   var left=Math.floor(extent[0])-2,top=Math.floor(extent[1])-2,cw=Math.ceil(extent[2])-left+2,ch=Math.ceil(extent[3])-top+2;
   cache[key]=frames.map(function(f){var c=document.createElement('canvas');c.width=cw;c.height=ch;var cx=c.getContext('2d');cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(image,f.source[0],f.source[1],f.source[2],f.source[3],f.x-left,f.y-top,f.width,f.height);return c;});
   cache[key].pivot=[-left,-top];audit[key]={frames:4,gameHeight:spec.height,cacheSize:[cw,ch],pivot:[-left,-top],sourceSize:[image.naturalWidth,image.naturalHeight],sourceFrames:frames,meshDeformation:false};
  });
 }
 function draw(ctx,key,pose,x,y,alpha,lean){
  var frames=cache[key];if(!frames)throw Error('战斗动作图未就绪：'+key);
  var image=frames[pose],pivot=frames.pivot;ctx.save();ctx.globalAlpha*=alpha===undefined?1:alpha;ctx.translate(Math.round(x),Math.round(y));if(lean)ctx.rotate(lean);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,-pivot[0],-pivot[1]);ctx.restore();
 }
 function inspect(){return JSON.parse(JSON.stringify(audit));}
 root.Stage02BattleSprites={init:init,draw:draw,inspect:inspect};
}(window));
