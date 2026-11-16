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
 function boss(c,m,portraits,reduced){
  var alpha=reduced?m.opacity:m.cutIn;if(alpha<=0)return false;var p=palette(m),age=m.phaseAge,slide=reduced?0:32*(1-ease((age-35)/14))-36*ease((age-91)/22),im=portraits[m.theme===1?'lingyu':'observer'];
  state(c).boss={bounds:[12,151,456,180],alpha:alpha,title:m.title,theme:m.theme,phase:m.phase};
  c.save();c.translate(slide,0);c.globalAlpha=alpha;
  var outline=[[12,183],[443,158],[468,171],[468,297],[37,322],[12,309]];
  state(c).boss.cutout=outline.map(function(p){return[p[0]+slide,p[1]];});
  c.save();c.shadowColor='#040c1acc';c.shadowBlur=15;c.shadowOffsetY=5;path(c,outline);c.fillStyle='#101d34';c.fill();c.restore();
  c.save();path(c,outline);c.clip();
  var g=c.createLinearGradient(15,180,460,300);g.addColorStop(0,'#1d304af5');g.addColorStop(.48,'#142338fa');g.addColorStop(1,'#0b192efa');c.fillStyle=g;c.fillRect(10,151,460,180);
  // Fine engraved stars or petals frame the portrait without adding another illustration.
  c.save();c.translate(106,248);c.strokeStyle=p[0];c.globalAlpha=alpha*.23;c.lineWidth=.8;c.beginPath();c.arc(0,0,74,0,Math.PI*2);c.stroke();c.beginPath();c.arc(0,0,66,-2.6,.6);c.stroke();
  if(m.theme===1)blossom(c,0,0,34);else for(var j=0;j<6;j++){var a=j*Math.PI/3;star(c,Math.cos(a)*74,Math.sin(a)*74,3,false);}c.restore();
  if(im&&im.complete){var h=388,w=h*im.naturalWidth/im.naturalHeight;c.save();c.globalAlpha=alpha*.98;c.drawImage(im,-24,172,w,h);c.restore();}
  var shade=c.createLinearGradient(165,0,231,0);shade.addColorStop(0,'#101e3300');shade.addColorStop(1,'#101e33fa');c.fillStyle=shade;c.fillRect(165,160,305,170);
  c.save();c.globalAlpha=alpha*.075;c.fillStyle=p[2];c.textAlign='right';c.font='italic 58px Georgia,serif';c.fillText(m.phase===1?'II':'III',451,229);c.restore();
  c.strokeStyle=p[2];c.lineWidth=1;c.globalAlpha=alpha*.78;line(c,219,181,207,305);c.fillStyle=p[2];star(c,213,242,4,true);
  c.globalAlpha=alpha;c.textAlign='left';c.fillStyle='#c4d2df';c.font='11px "Microsoft YaHei",sans-serif';c.fillText(m.bossName||(m.theme===1?'司风天使·铃羽':'星环观测者'),240,188);
  c.strokeStyle=p[0];c.lineWidth=1;if(m.theme===1)blossom(c,245,209,4);else star(c,245,206,5,false);
  c.fillStyle=p[2];c.font='11px "Microsoft YaHei",sans-serif';c.fillText(['第一式','第二式','第三式'][m.phase]+'  /  宣告',259,211);
  c.strokeStyle=p[2];c.globalAlpha=alpha*.4;line(c,351,207,445,207);c.globalAlpha=alpha;
  var titleSize=fit(c,m.title,207,24);state(c).boss.titleFontSize=titleSize;state(c).boss.titleWidth=c.measureText(m.title).width;state(c).boss.availableWidth=207;c.fillStyle='#f7e9d0';c.shadowColor='#a8c3d52b';c.shadowBlur=5;c.fillText(m.title,239,249);c.shadowBlur=0;
  var rule=c.createLinearGradient(238,0,448,0);rule.addColorStop(0,p[2]);rule.addColorStop(1,p[2]+'00');c.strokeStyle=rule;c.lineWidth=1;line(c,240,266,448,266);
  c.fillStyle=p[0];c.font='10px "Microsoft YaHei",sans-serif';c.fillText(m.theme===1?'风息汇聚 · 铃音再起':'星仪归位 · 星轨重构',240,287);
  c.restore();
  // Broken double borders and tiny wing clasps keep the plaque light at game size.
  c.globalAlpha=alpha;c.lineWidth=1.25;c.strokeStyle=p[2];path(c,outline);c.stroke();c.globalAlpha=alpha*.43;c.strokeStyle=p[0];line(c,23,188,438,164);line(c,41,315,457,291);
  c.globalAlpha=alpha;c.lineWidth=1;c.fillStyle=p[2];c.strokeStyle=p[2];star(c,40,181,4,true);star(c,441,159,4,true);star(c,41,322,3,true);star(c,441,299,3,true);
  c.beginPath();c.moveTo(22,200);c.lineTo(22,190);c.lineTo(65,187);c.moveTo(458,278);c.lineTo(458,290);c.lineTo(416,293);c.stroke();
  c.restore();return true;
 }
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
 return{beginFrame:beginFrame,boss:boss,bomb:bomb,bombLayout:bombLayout,clipOutsideBoss:clipOutsideBoss,inspect:function(c){var s=state(c);return{transition:s.transition,boss:s.boss?Object.assign({},s.boss):null,bomb:s.bomb?Object.assign({},s.bomb):null};}};
}));
