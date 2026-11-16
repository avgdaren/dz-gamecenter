/* (C) 2026 Carinoasd. Cast-linked garden projectile presentation v3: 小典 / Codex.
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
   edge.globalCompositeOperation='source-in';edge.fillStyle={petal:'#8b3d60b0',leaf:'#315e4e78',bud:'#826b4670'}[key];edge.fillRect(0,0,outlined.width,outlined.height);
   edge.globalCompositeOperation='source-over';edge.drawImage(c,pad,pad);
   cache[key]=outlined;var center=edge.getImageData(Math.floor(outlined.width/2),Math.floor(outlined.height/2),1,1).data;
   audit[key]={width:outlined.width,height:outlined.height,centerAlpha:center[3],displayOutline:true,integrationVersion:3};
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
  var height=key==='leaf'?17:key==='petal'?18:15.5;
  height+=Math.max(0,e.radius-3);
  var age=Math.max(0,tick-e.born),unfurl=reduced?1:.78+.22*Math.min(1,age/10);
  height*=unfurl;var width=Math.max(e.radius*2.3,height*image.width/image.height);
  var heading=Math.atan2(e.vx,-e.vy);
  var sway=reduced?0:Math.sin(age*.075+e.id*.63)*(key==='leaf'?.11:key==='petal'?.20:.045);
  ctx.save();ctx.translate(e.x/64,e.y/64);ctx.rotate(heading+sway);
  if(e.kind%2)ctx.scale(-1,1);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,-width/2,-height/2,width,height);ctx.restore();counts[key]++;
  return true;
 }
 function ornament(ctx,key,x,y,size,angle,alpha){
  var image=cache[key];if(!image)return;ctx.save();ctx.translate(x,y);ctx.rotate(angle||0);ctx.globalAlpha*=alpha===undefined?1:alpha;ctx.drawImage(image,-size*image.width/image.height/2,-size/2,size*image.width/image.height,size);ctx.restore();
 }
 function emitters(ctx,sim,reduced,acting,phaseName){
  if(sim.index===2&&phaseName!=='epilogue'&&phaseName!=='complete'){
   [112,240,368].forEach(function(x,i){
    var y=i===1?104:124,phase=Math.min(1,Math.max(0,sim.musicTick-(sim.presentationStartMusic||0))/36)*(acting?acting.alpha:1);
    var birth=0;(sim.emitters||[]).forEach(function(e){var age=sim.tick-e.born;if(age>=0&&age<18&&Math.abs(e.x-x)<5&&Math.abs(e.y-y)<5)birth=Math.max(birth,1-age/18);});
    var charge=acting&&acting.sourceBell===i?acting.anticipation:0;
    ornament(ctx,'bud',x,y,18+(reduced?0:birth*3),0,(.6+charge*.3)*phase);
    ctx.save();ctx.strokeStyle='#9a9264';ctx.lineWidth=.8;ctx.globalAlpha=(.1+charge*.3+birth*.28)*phase;ctx.beginPath();ctx.moveTo(sim.boss.x/64-29,sim.boss.y/64-30);ctx.quadraticCurveTo((x+sim.boss.x/64)/2,y-45,x,y);ctx.stroke();
    if(charge>0||birth>0){ctx.globalAlpha=(charge*.4+birth*.5)*phase;ctx.beginPath();ctx.ellipse(x,y,9+birth*12,6+birth*7,0,0,Math.PI*2);ctx.stroke();}ctx.restore();
   });
  }
  (sim.emitters||[]).forEach(function(event){var age=sim.tick-event.born;if(age<0||age>18)return;var key=family(event,sim.index),color={petal:'#c78292',leaf:'#547f65',bud:'#ae9564'}[key],p=age/18;
   ctx.save();ctx.translate(event.x,event.y);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=(1-p)*.40;ctx.beginPath();ctx.ellipse(0,0,4+p*9,2+p*5,-.25,0,Math.PI*2);ctx.stroke();
   if(!reduced){ctx.globalAlpha=(1-p)*.45;ctx.beginPath();ctx.moveTo(-7-p*4,4);ctx.quadraticCurveTo(-3,-6-p*4,8+p*6,-3);ctx.stroke();}ctx.restore();
  });
 }
 root.GardenBulletMaterials={init:init,draw:draw,emitters:emitters,ornament:ornament,family:family,inspect:function(){return{ready:Object.keys(cache).length===3,assets:JSON.parse(JSON.stringify(audit)),drawCounts:Object.assign({},counts)};}};
}(window));
