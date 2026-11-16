/* (C) 2026 Carinoasd. Shared celestial spell and player ribbons: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuNoticeFrames=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';var contexts=new WeakMap();
 function clamp(v){return Math.max(0,Math.min(1,v));}function ease(v){v=clamp(v);return v*v*(3-2*v);}
 function palette(m){return m.theme===1?(m.phase===1?['#e7b4c9','#b3d7c4','#ecd3a1']:['#e6cc96','#b0d9cc','#ecd3a1']):(m.phase===1?['#b2dbea','#c9d9ec','#e4c991']:['#d1c2eb','#b9d5e7','#e4c991']);}
 function path(c,points){c.beginPath();points.forEach(function(p,i){if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);});c.closePath();}
 function line(c,x,y,xx,yy){c.beginPath();c.moveTo(x,y);c.lineTo(xx,yy);c.stroke();}
 function star(c,x,y,r,fill){path(c,[[x,y-r*1.4],[x+r*.25,y-r*.25],[x+r,y],[x+r*.25,y+r*.25],[x,y+r*1.4],[x-r*.25,y+r*.25],[x-r,y],[x-r*.25,y-r*.25]]);if(fill)c.fill();else c.stroke();}
 function blossom(c,x,y,r){c.save();c.translate(x,y);for(var i=0;i<5;i++){c.rotate(Math.PI*2/5);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-r,-r*.7,-r*.4,-r*1.7,0,-r*1.8);c.bezierCurveTo(r*.4,-r*1.7,r,-r*.7,0,0);c.stroke();}c.restore();}
 function wings(c,x,y,r){c.save();c.translate(x,y);for(var side=-1;side<=1;side+=2){for(var f=0;f<3;f++){c.beginPath();c.moveTo(side*5,3);c.quadraticCurveTo(side*(r*.5),-3-f*3,side*(r+f*4),-8-f*2);c.quadraticCurveTo(side*(r*.63),8+f*2,side*6,7-f);c.stroke();}}star(c,0,1,4,true);c.restore();}
 function fit(c,text,max,size){while(size>16){c.font='bold '+size+'px "SimSun",serif';if(c.measureText(text).width<=max)break;size--;}return size;}
 function state(c){if(!contexts.has(c))contexts.set(c,{transition:false,boss:null,bomb:null});return contexts.get(c);}
 function beginFrame(c,m){contexts.set(c,{transition:!!m.spellChange,boss:null,bomb:null});}
 function trackedWidth(c,text,gap){var chars=Array.from(text);return chars.reduce(function(n,ch){return n+c.measureText(ch).width;},0)+Math.max(0,chars.length-1)*gap;}
 function tracked(c,text,x,y,gap){Array.from(text).forEach(function(ch){c.fillText(ch,x,y);x+=c.measureText(ch).width+gap;});}
 function panel(c,points){c.beginPath();for(var i=0;i<points.length;i++){var a=points[(i+points.length-1)%points.length],b=points[i],d=points[(i+1)%points.length],ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bd=Math.hypot(d[0]-b[0],d[1]-b[1]),r=3;c.lineTo(b[0]+(a[0]-b[0])*r/ab,b[1]+(a[1]-b[1])*r/ab);c.quadraticCurveTo(b[0],b[1],b[0]+(d[0]-b[0])*r/bd,b[1]+(d[1]-b[1])*r/bd);}c.closePath();}
 function badge(c,x,y,w,h){c.beginPath();c.moveTo(x+5,y);c.lineTo(x+w-5,y);c.quadraticCurveTo(x+w,y,x+w,y+5);c.lineTo(x+w,y+h-5);c.quadraticCurveTo(x+w,y+h,x+w-5,y+h);c.lineTo(x+5,y+h);c.quadraticCurveTo(x,y+h,x,y+h-5);c.lineTo(x,y+5);c.quadraticCurveTo(x,y,x+5,y);c.closePath();}
 function registerBoss(c,notice){var s=state(c);s.boss=notice;if(notice){var b=notice.bounds,across=b[0]<432&&b[0]+b[2]>48,normal=across&&b[1]<238&&b[1]+b[3]>148,compact=across&&b[1]<414&&b[1]+b[3]>335;if(normal&&!compact)s.transition=true;else if(compact&&!normal)s.transition=false;}return !!notice;}
 function bombLayout(transition){return transition?{x:80,y:343,w:320,h:57,compact:true}:{x:80,y:156,w:320,h:68,compact:false};}
 function clipOutsideBoss(c){var b=state(c).boss;if(!b)return false;c.beginPath();c.rect(0,0,480,640);b.cutout.forEach(function(p,i){if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);});c.closePath();c.clip('evenodd');return true;}
 function ribbon(c,x,y,w,h){c.beginPath();c.moveTo(x+23,y+10);c.quadraticCurveTo(x+w/2,y-2,x+w-23,y+10);c.lineTo(x+w+2,y+h/2);c.lineTo(x+w-23,y+h-10);c.quadraticCurveTo(x+w/2,y+h+1,x+23,y+h-10);c.lineTo(x-2,y+h/2);c.closePath();}
 function featherCap(c,x,y,side){c.save();c.translate(x,y);c.scale(side,1);c.fillStyle='#e4e8cd44';c.strokeStyle='#e5d3a2';c.lineWidth=.85;for(var i=0;i<3;i++){c.beginPath();c.moveTo(2,4);c.bezierCurveTo(-11,-9-i*2,-24-i*6,-12-i*3,-34-i*5,-12-i*3);c.quadraticCurveTo(-28-i*4,0,1,8+i*2);c.closePath();c.fill();c.stroke();}c.restore();}
 function bomb(c,m,name){
  var layout=bombLayout(state(c).transition),x=layout.x,y=layout.y,w=layout.w,h=layout.h,alpha=m.fade;
  state(c).bomb={bounds:[x-32,y-8,w+64,h+14],compact:layout.compact,title:name,alpha:alpha};
  c.save();c.globalAlpha=alpha;
  var ground=c.createLinearGradient(x-3,0,x+w+3,0);ground.addColorStop(0,'#17304400');ground.addColorStop(.14,'#173044e8');ground.addColorStop(.5,'#12293ff5');ground.addColorStop(.86,'#173044e8');ground.addColorStop(1,'#17304400');ribbon(c,x,y,w,h);c.fillStyle=ground;c.fill();
  // Open curved rules, fading tails and translucent plumes replace a closed box.
  featherCap(c,x+18,y+h/2-1,1);featherCap(c,x+w-18,y+h/2-1,-1);
  c.lineWidth=1;c.strokeStyle='#dec995';c.globalAlpha=alpha*.88;c.beginPath();c.moveTo(x+24,y+10);c.quadraticCurveTo(165,y+2,218,y+4);c.moveTo(262,y+4);c.quadraticCurveTo(315,y+2,x+w-24,y+10);c.moveTo(x+24,y+h-10);c.quadraticCurveTo(166,y+h-2,225,y+h-5);c.moveTo(255,y+h-5);c.quadraticCurveTo(316,y+h-2,x+w-24,y+h-10);c.stroke();
  c.globalAlpha=alpha*.3;c.strokeStyle='#a5d5d6';line(c,x+31,y+13,211,y+8);line(c,269,y+8,x+w-31,y+13);
  c.globalAlpha=alpha;c.strokeStyle='#e9d4a2';c.fillStyle='#f3dfb3';wings(c,240,y+4,17);star(c,240,y+h-5,3,true);
  c.textAlign='center';c.fillStyle='#fae8c2';c.font='bold '+(layout.compact?21:25)+'px "SimSun",serif';c.fillText(name,240,y+(layout.compact?27:32));
  c.font='11px "Microsoft YaHei",sans-serif';c.fillStyle='#c5dfe2';c.fillText('清弹  ·  伤害  ·  短暂无敌',240,y+(layout.compact?44:53));
  c.restore();return true;
 }
 return{beginFrame:beginFrame,registerBoss:registerBoss,bomb:bomb,bombLayout:bombLayout,clipOutsideBoss:clipOutsideBoss,inspect:function(c){var s=state(c);return{transition:s.transition,boss:s.boss?Object.assign({},s.boss):null,bomb:s.bomb?Object.assign({},s.bomb):null};}};
}));
