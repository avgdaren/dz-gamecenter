/* (C) 2026 Carinoasd. Stage 1 scale/pixel-language reference caches: 小典 / Codex.
 * Original generated PNGs remain unchanged. Rendering uses binary-alpha 32-color caches.
 */
(function(root){
 'use strict';var cache={},audit={};
 var colors=['1A2440','28345D','3D497B','53639D','F9E0AB','ECC38A','C99864','966A48','6B4937','F4F0E8','DCD9E7','B9B8D2','8E96BA','E5B94F','B98632','FAD2BA','ECAE96','1C1F32','FFF2D1','737A98','2F4844','486355','64816A','8FA481','B7C79B','DEE1B6','8F5660','B57278','D18B8C','ECAE9E','F0BDAA','F6D9D3'];
 var palette=colors.map(function(c){return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];});
 var specs={fairy:{key:'fairySource',w:48,h:48,pivot:[24,24],visibleHeight:36,body:[.5,.6]},attendant:{key:'attendantSource',w:48,h:64,pivot:[24,32],visibleHeight:49,body:[.60,.60]},lingyu:{key:'lingyuSource',w:96,h:128,pivot:[48,48],visibleHeight:102,body:[.607,.35]}};
 function init(images,layout){
  cache={};audit={};Object.keys(specs).forEach(function(key){
   var s=specs[key],im=images[s.key],b=layout[s.key],w=b[2]-b[0]+1,h=b[3]-b[1]+1,anchor=[b[0]+w*s.body[0],b[1]+h*s.body[1]];
   var margin=key==='lingyu'?6:2,scale=Math.min(s.visibleHeight/h,(s.pivot[0]-margin)/(anchor[0]-b[0]),(s.w-s.pivot[0]-margin)/(b[2]+1-anchor[0]),(s.pivot[1]-margin)/(anchor[1]-b[1]),(s.h-s.pivot[1]-margin)/(b[3]+1-anchor[1]));
   var c=document.createElement('canvas');c.width=s.w;c.height=s.h;var ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(im,b[0],b[1],w,h,s.pivot[0]+(b[0]-anchor[0])*scale,s.pivot[1]+(b[1]-anchor[1])*scale,w*scale,h*scale);
   var p=ctx.getImageData(0,0,s.w,s.h),used=new Set(),bounds=[s.w,s.h,-1,-1],opaque=0;
   for(var i=0;i<p.data.length;i+=4){
    if(p.data[i+3]<192){p.data[i]=p.data[i+1]=p.data[i+2]=p.data[i+3]=0;continue;}
    var best=0,distance=Infinity;for(var k=0;k<palette.length;k++){var q=palette[k],d=3*Math.pow(q[0]-p.data[i],2)+4*Math.pow(q[1]-p.data[i+1],2)+2*Math.pow(q[2]-p.data[i+2],2);if(d<distance){best=k;distance=d;}}
    p.data[i]=palette[best][0];p.data[i+1]=palette[best][1];p.data[i+2]=palette[best][2];p.data[i+3]=255;used.add(best);opaque++;
    var x=i/4%s.w,y=Math.floor(i/4/s.w);bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x),Math.max(bounds[3],y)];
   }
   if(bounds[0]<1||bounds[1]<1||bounds[2]>=s.w-1||bounds[3]>=s.h-1)throw Error('角色缓存裁切：'+key);
   ctx.putImageData(p,0,0);cache[key]=c;audit[key]={size:[s.w,s.h],visibleBounds:bounds,visibleSize:[bounds[2]-bounds[0]+1,bounds[3]-bounds[1]+1],pivot:s.pivot,opaqueColors:used.size,alpha:[0,255],opaquePixels:opaque,standardPoses:1,sourceUnmodified:true};
  });
 }
 function draw(ctx,key,x,y,tick,reduced,alpha){var s=specs[key],im=cache[key];ctx.save();ctx.translate(Math.round(x),Math.round(y));if(!reduced&&key==='lingyu')ctx.rotate(.012*Math.cos(Math.max(0,tick-1)%480*Math.PI/240));ctx.globalAlpha*=alpha===undefined?1:alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(im,-s.pivot[0],-s.pivot[1]);ctx.restore();}
 root.Stage02UnitySprites={init:init,draw:draw,inspect:function(){return JSON.parse(JSON.stringify(audit));},image:function(key){return cache[key];},palette:colors};
}(window));
