/* (C) 2026 Carinoasd. Star-Ring Observer presentation: 小典 / Codex.
 * Read-only rendering; animation follows logical ticks, including pause/resume.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.DanmakuBossView=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var assets={body:[384,512],back:[128,128],front:[64,64],face:[512,512]};
  var files={body:'assets/boss-body-atlas-v1.png',back:'assets/boss-ring-back-v1.png',front:'assets/boss-ring-front-v1.png',face:'assets/boss-face-v1.png'};
  function ready(images){
    return Object.keys(assets).every(function(k){var i=images&&images[k],s=assets[k];return !!(i&&i.complete&&i.naturalWidth===s[0]&&i.naturalHeight===s[1]);});
  }
  function smooth(v){v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);}
  function deform(x,y,tick,reduced){
    if(reduced)return{x:x,y:y};
    var t=tick/60,d=Math.abs(x-48),side=Math.max(0,Math.min(1,(d-8)/22));
    var hair=side*smooth((y-24)/58)*(1-smooth((y-94)/18));
    var sleeve=side*Math.exp(-Math.pow((y-54)/16,2));
    var hem=smooth((y-64)/38)*(1-smooth((y-108)/10));
    var chest=(1-side)*Math.max(0,1-Math.abs(y-37)/9);
    return{x:x+2.8*Math.sin(t*2.15-y*.055)*hair+1.8*Math.sin(t*1.7+y*.045)*hem*Math.min(1,d/16)+(x-48)*.012*Math.sin(t*2.2)*chest,
      y:y+2.5*Math.sin(t*1.9+d*.035)*sleeve+.9*Math.cos(t*2.1+d*.04)*hem+.4*Math.sin(t*2.2)*chest};
  }
  var meshX=[8,20,32,40,48,56,64,76,88],meshY=[8,22,34,48,56,70,86,102,120];
  function triangle(ctx,image,uv,vertices){
    var a=uv[0],b=uv[1],c=uv[2],p=vertices[0],q=vertices[1],r=vertices[2];
    var det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    var A=((q.x-p.x)*(c[1]-a[1])-(r.x-p.x)*(b[1]-a[1]))/det;
    var B=((q.y-p.y)*(c[1]-a[1])-(r.y-p.y)*(b[1]-a[1]))/det;
    var C=((r.x-p.x)*(b[0]-a[0])-(q.x-p.x)*(c[0]-a[0]))/det;
    var D=((r.y-p.y)*(b[0]-a[0])-(q.y-p.y)*(c[0]-a[0]))/det;
    var cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
    ctx.save();ctx.beginPath();
    vertices.forEach(function(v,i){var dx=v.x-cx,dy=v.y-cy,n=Math.sqrt(dx*dx+dy*dy)||1;ctx[i?'lineTo':'moveTo'](v.x+dx/n*.3,v.y+dy/n*.3);});
    ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,p.x-A*a[0]-C*a[1],p.y-B*a[0]-D*a[1]);
    ctx.drawImage(image,0,0,96,128,0,0,96,128);ctx.restore();
  }
  function body(ctx,image,tick,reduced){
    if(reduced){ctx.drawImage(image,0,0,96,128,0,0,96,128);return;}
    var points=meshY.map(function(y){return meshX.map(function(x){return deform(x,y,tick,false);});});
    for(var j=0;j<meshY.length-1;j++)for(var i=0;i<meshX.length-1;i++){
      var a=[meshX[i],meshY[j]],b=[meshX[i+1],meshY[j]],c=[meshX[i+1],meshY[j+1]],d=[meshX[i],meshY[j+1]];
      triangle(ctx,image,[a,b,c],[points[j][i],points[j][i+1],points[j+1][i+1]]);
      triangle(ctx,image,[a,c,d],[points[j][i],points[j+1][i+1],points[j+1][i]]);
    }
  }
  function frame(sim,tick,reduced,stage){
    var row=0;
    if(!reduced&&(!stage||stage==='active')){
      var dx=sim.boss.x-sim.boss.px;
      row=sim.tick<sim.warningUntil?3:dx<0?1:dx>0?2:0;
    }
    // The first generated movement cycles change silhouette too much. Keep one
    // registered stance and lean continuously through the existing 480-tick path.
    var enter=Math.max(0,Math.min(1,sim.tick/24));enter=enter*enter*(3-2*enter);
    var lean=!reduced&&(!stage||stage==='active')?.012*Math.cos(Math.max(0,sim.tick-1)%480*Math.PI/240)*enter:0;
    return {row:row,column:0,ringAngle:reduced?0:(Math.max(0,tick)%3600)*Math.PI*2/3600,lean:lean};
  }
  function sprite(ctx,images,sim,tick,reduced,stage,show){
    if(!ready(images))return false;
    show=show||{};
    var f=frame(sim,tick,reduced,stage),x=show.origin?show.origin[0]:sim.boss.x/64,y=show.origin?show.origin[1]:sim.boss.y/64;
    var alpha=show.bossAlpha===undefined?1:show.bossAlpha;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=alpha;
    ctx.save();ctx.translate(x,y);ctx.rotate(f.ringAngle);ctx.globalAlpha*=f.row===3?.7:.48;
    ctx.drawImage(images.back,-64,-64,128,128);ctx.restore();
    ctx.save();ctx.translate(x,y);ctx.rotate(f.lean);
    ctx.translate(-48,-48);body(ctx,images.body,tick,reduced);ctx.restore();
    // Near-side arc remains upright, keeping its empty upper half above the belt.
    ctx.globalAlpha=alpha*.6;ctx.drawImage(images.front,x-32,y-32,64,64);
    ctx.restore();return f;
  }
  return {assets:assets,files:files,ready:ready,frame:frame,sprite:sprite,deform:deform,body:body};
}));
