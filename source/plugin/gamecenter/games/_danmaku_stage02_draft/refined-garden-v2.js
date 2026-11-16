/* (C) 2026 Carinoasd. Perspective garden presentation: 小典 / Codex. */
(function(global){
  'use strict';
  var W=480,H=640,FOCAL=420,HORIZON=88,HEIGHT=2.25,NEAR=.45,FAR=48;
  var TOUR_END=96,TOUR_RAMP=12,TOUR_SPEED=4.9;
  var BOSS_END=223.35,BOSS_HOLD=6.5,BOSS_RAMP=2.5,BOSS_SPEED=2.45;
  function smooth(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}
  function center(z){return Math.sin(z*.14)*1.35+Math.sin(z*.051)*1.1;}
  function travel(t){
    var start=TOUR_END-TOUR_RAMP;
    t=Math.max(0,Math.min(TOUR_END,t));
    if(t<=start)return t*TOUR_SPEED;
    var u=(t-start)/TOUR_RAMP;
    return start*TOUR_SPEED+TOUR_SPEED*TOUR_RAMP*(u-u*u*u+.5*u*u*u*u);
  }
  function motion(time,tab,reduced){
    var boss=tab==='boss';
    if(reduced)return {distance:travel(boss?TOUR_END:40),speed:0,phase:'static'};
    if(!boss){
      var t=Math.max(0,Math.min(TOUR_END,time));
      return {distance:travel(t),speed:TOUR_SPEED*(1-smooth((t-TOUR_END+TOUR_RAMP)/TOUR_RAMP)),phase:t>=TOUR_END?'stopped':t>TOUR_END-TOUR_RAMP?'slowing':'cruising'};
    }
    var elapsed=Math.max(0,Math.min(BOSS_END,time)-BOSS_HOLD),u=Math.min(1,elapsed/BOSS_RAMP);
    // Integrate the smooth velocity ramp, so pause and seek do not add drift.
    var moved=BOSS_SPEED*BOSS_RAMP*(u*u*u-.5*u*u*u*u)+BOSS_SPEED*Math.max(0,elapsed-BOSS_RAMP);
    return {distance:travel(TOUR_END)+moved,speed:BOSS_SPEED*smooth(u),phase:elapsed===0?'intro-hold':u<1?'starting':'cruising'};
  }
  function width(z){return 1.3+.95*smooth((z-travel(TOUR_END)+18)/18);}
  function project(position,z,side,height){
    var distance=z-position,scale=FOCAL/(distance+1.2);
    var camera=center(position)*.4+center(position+1.2)*.6;
    return {x:W/2+(center(z)+side-camera)*scale,y:HORIZON+(HEIGHT-(height||0))*scale,scale:scale};
  }
  function triangle(ctx,image,uv,points){
    var a=uv[0],b=uv[1],c=uv[2],p=points[0],q=points[1],r=points[2];
    var det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
    if(Math.abs(det)<1e-10)return;
    var A=((q.x-p.x)*(c[1]-a[1])-(r.x-p.x)*(b[1]-a[1]))/det;
    var B=((q.y-p.y)*(c[1]-a[1])-(r.y-p.y)*(b[1]-a[1]))/det;
    var C=((r.x-p.x)*(b[0]-a[0])-(q.x-p.x)*(c[0]-a[0]))/det;
    var D=((r.y-p.y)*(b[0]-a[0])-(q.y-p.y)*(c[0]-a[0]))/det;
    var cx=(p.x+q.x+r.x)/3,cy=(p.y+q.y+r.y)/3;
    ctx.save();ctx.beginPath();points.forEach(function(v,i){
      var dx=v.x-cx,dy=v.y-cy,n=Math.hypot(dx,dy)||1;
      ctx[i?'lineTo':'moveTo'](v.x+dx/n*.25,v.y+dy/n*.25);
    });ctx.closePath();ctx.clip();
    ctx.transform(A,B,C,D,p.x-A*a[0]-C*a[1],p.y-B*a[0]-D*a[1]);
    ctx.drawImage(image,0,0,1,1);ctx.restore();
  }
  function quad(ctx,image,points,uv){
    triangle(ctx,image,[uv[0],uv[1],uv[2]],[points[0],points[1],points[2]]);
    triangle(ctx,image,[uv[0],uv[2],uv[3]],[points[0],points[2],points[3]]);
  }
  function bounds(image,box){
    return [[box[0]/image.naturalWidth,box[1]/image.naturalHeight],[(box[2]+1)/image.naturalWidth,box[1]/image.naturalHeight],[(box[2]+1)/image.naturalWidth,(box[3]+1)/image.naturalHeight],[box[0]/image.naturalWidth,(box[3]+1)/image.naturalHeight]];
  }
  function draw(ctx,images,layout,time,tab,reduced,shade){
    var position=motion(time,tab,reduced).distance,sky=images.sky;
    var drift=reduced?0:Math.sin(position*.017)*6,ratio=Math.max((W+24)/sky.naturalWidth,(H+24)/sky.naturalHeight);
    ctx.imageSmoothingEnabled=true;
    ctx.drawImage(sky,(W-sky.naturalWidth*ratio)/2+drift,(H-sky.naturalHeight*ratio)/2,sky.naturalWidth*ratio,sky.naturalHeight*ratio);
    // Each 0.25 world unit shares a texture row; phase follows absolute distance.
    // Fixed world coordinates keep seeking, pause and perspective repeatable.
    var first=Math.floor((position+NEAR)/.25),last=Math.ceil((position+FAR)/.25);
    for(var i=last;i>=first;i--){
      var a=Math.max(position+NEAR,i*.25),b=(i+1)*.25;
      var va=(i%24+(a-i*.25)/.25)/24,vb=(i%24+1)/24;
      var points=[project(position,b,-width(b)),project(position,b,width(b)),project(position,a,width(a)),project(position,a,-width(a))];
      // A slim stone rim gives the suspended path a readable edge.
      ctx.fillStyle='#d6cfb6';ctx.beginPath();
      [project(position,b,-width(b)-.035),project(position,b,width(b)+.035),project(position,a,width(a)+.035),project(position,a,-width(a)-.035)].forEach(function(p,j){ctx[j?'lineTo':'moveTo'](p.x,p.y);});
      ctx.closePath();ctx.fill();
      quad(ctx,images.paving,points,[[0,vb],[1,vb],[1,va],[0,va]]);
    }
    var objects=[],step=2.4;
    for(var k=Math.floor((position+NEAR)/step);k*step<position+FAR;k++){
      var near=Math.max(k*step,position+NEAR),far=(k+1)*step;
      // Trim the first rail at the near plane instead of popping whole segments.
      objects.push({kind:'rail',z:far,near:near,far:far,start:k*step});
    }
    for(var gate=Math.ceil((position+NEAR-12)/26);gate*26+12<position+FAR;gate++){
      objects.push({kind:'arch',z:gate*26+12});
    }
    objects.sort(function(a,b){return b.z-a.z;});
    var railUV=bounds(images.rail,layout.rail),archUV=bounds(images.arch,layout.arch);
    objects.forEach(function(object){
      var z=object.z;
      if(object.kind==='rail'){
        [-1,1].forEach(function(side){
          var a=object.near,b=object.far,u=(a-object.start)/step;
          var uv=railUV.map(function(v){return v.slice();});
          // Source x runs from near to far; the clipped fraction follows it.
          uv[0][0]=uv[3][0]=railUV[0][0]+(railUV[1][0]-railUV[0][0])*u;
          quad(ctx,images.rail,[project(position,a,side*width(a),.78),project(position,b,side*width(b),.78),project(position,b,side*width(b),-.015),project(position,a,side*width(a),-.015)],uv);
        });
      }else{
        var half=width(z)+.23;
        quad(ctx,images.arch,[project(position,z,-half,3.0),project(position,z,half,3.0),project(position,z,half,-.02),project(position,z,-half,-.02)],archUV);
      }
    });
    if(shade){
      ctx.fillStyle='rgba(29,63,68,.10)';ctx.fillRect(0,0,W,H);
      var tint=ctx.createLinearGradient(0,0,W,0);tint.addColorStop(0,'rgba(18,45,54,0)');tint.addColorStop(.28,'rgba(18,45,54,.12)');tint.addColorStop(.72,'rgba(18,45,54,.12)');tint.addColorStop(1,'rgba(18,45,54,0)');ctx.fillStyle=tint;ctx.fillRect(0,0,W,H);
    }
    if(!reduced)for(var petal=0;petal<32;petal++){
      var depth=((petal*7.713-position)%52+52)%52+NEAR;
      var world=position+depth,offset=Math.sin(petal*12.3)*3.6;
      var p=project(position,world,offset,.2+(petal%5)*.24),size=Math.max(.6,p.scale*.025);
      if(p.x<-20||p.x>W+20||p.y<-20||p.y>H+20)continue;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(petal+position*.12);ctx.scale(size,size);ctx.globalAlpha=.62;
      ctx.fillStyle=petal%3?'#fff1dc':'#edb4b7';ctx.beginPath();ctx.moveTo(-1,0);ctx.bezierCurveTo(0,-1.4,1.8,-.7,1.3,.5);ctx.bezierCurveTo(.5,1.5,-.6,1,-1,0);ctx.fill();ctx.restore();
    }
  }
  global.Stage02Garden={draw:draw,inspect:function(time,tab,reduced){var m=motion(time,tab,reduced),p=m.distance;return {distance:p,speed:m.speed,phase:m.phase,nearScale:project(p,p+1,0).scale,farScale:project(p,p+28,0).scale};}};
}(window));
