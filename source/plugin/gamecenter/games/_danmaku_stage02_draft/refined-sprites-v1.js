/* (C) 2026 Carinoasd. Registered garden action caches: 小典 / Codex.
 * Source PNGs untouched. Accepted neutral stance remains byte-identical in cache.
 */
(function(root){
 'use strict';var frames={},audit={},palette=[];
 var specs={fairy:{key:'fairyActions',w:48,h:48,pivot:[24,24],height:36,anchors:[[.5,.60],[.5,.60],[.5,.60]]},attendant:{key:'attendantActions',w:48,h:64,pivot:[24,32],height:49,anchors:[[.60,.60],[.60,.60],[.54,.60]]},lingyu:{key:'lingyuActions',w:96,h:128,pivot:[48,48],height:102,anchors:[[.607,.35],[.607,.35],[.52,.35]]},guardian:{key:'enemies',w:80,h:80,pivot:[40,40],height:64,anchors:[[.5,.5]]}};
 function bounds(ctx,w,h){var p=ctx.getImageData(0,0,w,h).data,b=[w,h,-1,-1];for(var i=3;i<p.length;i+=4)if(p[i]>=128){var x=(i-3)/4%w,y=Math.floor((i-3)/4/w);b=[Math.min(b[0],x),Math.min(b[1],y),Math.max(b[2],x),Math.max(b[3],y)];}if(b[2]<0)throw Error('动作帧为空');return b;}
 function make(im,region,s,anchor){
  var source=document.createElement('canvas');source.width=region[2];source.height=region[3];var c=source.getContext('2d',{willReadFrequently:true});c.drawImage(im,region[0],region[1],region[2],region[3],0,0,region[2],region[3]);
  var b=bounds(c,source.width,source.height),w=b[2]-b[0]+1,h=b[3]-b[1]+1,a=[b[0]+w*anchor[0],b[1]+h*anchor[1]],margin=2;
  var scale=Math.min(s.height/h,(s.pivot[0]-margin)/(a[0]-b[0]),(s.w-s.pivot[0]-margin)/(b[2]+1-a[0]),(s.pivot[1]-margin)/(a[1]-b[1]),(s.h-s.pivot[1]-margin)/(b[3]+1-a[1]));
  var out=document.createElement('canvas');out.width=s.w;out.height=s.h;var ctx=out.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,b[0],b[1],w,h,s.pivot[0]+(b[0]-a[0])*scale,s.pivot[1]+(b[1]-a[1])*scale,w*scale,h*scale);
  var p=ctx.getImageData(0,0,s.w,s.h),used=new Set();for(var i=0;i<p.data.length;i+=4){if(p.data[i+3]<192){p.data[i]=p.data[i+1]=p.data[i+2]=p.data[i+3]=0;continue;}
   var best=0,distance=Infinity;for(var k=0;k<palette.length;k++){var q=palette[k],d=3*(q[0]-p.data[i])**2+4*(q[1]-p.data[i+1])**2+2*(q[2]-p.data[i+2])**2;if(d<distance){best=k;distance=d;}}
   p.data[i]=palette[best][0];p.data[i+1]=palette[best][1];p.data[i+2]=palette[best][2];p.data[i+3]=255;used.add(best);
  }ctx.putImageData(p,0,0);b=bounds(ctx,s.w,s.h);if(b[0]<1||b[1]<1||b[2]>=s.w-1||b[3]>=s.h-1)throw Error('动作裁边');
  return{canvas:out,info:{visibleBounds:b,visibleSize:[b[2]-b[0]+1,b[3]-b[1]+1],colors:used.size,alpha:[0,255]}};
 }
 function init(images,layout){
  root.Stage02UnitySprites.init(images,layout);palette=root.Stage02UnitySprites.palette.map(function(c){return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)];});frames={};audit={};
  Object.keys(specs).forEach(function(key){var s=specs[key],im=images[s.key];frames[key]=key==='guardian'?[]:[root.Stage02UnitySprites.image(key)];var info=[];
   if(key==='guardian'){var v=make(im,[im.naturalWidth*2/3,0,im.naturalWidth/3,im.naturalHeight],s,s.anchors[0]);frames[key].push(v.canvas);info.push(v.info);}
   else for(var pose=1;pose<=3;pose++){var w=im.naturalWidth/2,h=im.naturalHeight/2,r=make(im,[pose%2*w,Math.floor(pose/2)*h,w,h],s,s.anchors[pose-1]);frames[key].push(r.canvas);info.push(r.info);}
   audit[key]={size:[s.w,s.h],pivot:s.pivot,poses:frames[key].length,acceptedIdlePreserved:key!=='guardian',newFrames:info};
  });
 }
 function draw(ctx,key,pose,x,y,alpha){var s=specs[key],im=frames[key][Math.min(pose,frames[key].length-1)];ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.globalAlpha*=alpha===undefined?1:alpha;ctx.imageSmoothingEnabled=false;ctx.drawImage(im,-s.pivot[0],-s.pivot[1]);ctx.restore();}
 function contact(){var c=document.createElement('canvas');c.width=960;c.height=500;var ctx=c.getContext('2d');ctx.fillStyle='#152238';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#e7d2ac';ctx.font='14px "Microsoft YaHei",sans-serif';['已确认待机','向左移动','向右移动','施法'].forEach(function(n,i){ctx.fillText(n,i*240+25,25);});
  ['fairy','attendant','lingyu'].forEach(function(key,j){for(var i=0;i<4;i++){ctx.save();ctx.translate(i*240+110,[80,172,310][j]);ctx.scale(2,2);draw(ctx,key,i,0,0,1);ctx.restore();}});return c;
 }
 root.Stage02RefinedSprites={init:init,draw:draw,contact:contact,image:function(key,pose){return frames[key][pose];},inspect:function(){return JSON.parse(JSON.stringify(audit));}};
}(window));
