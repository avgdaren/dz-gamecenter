/* (C) 2026 Carinoasd. A small prayer between sky corridor and garden: 小典 / Codex. */
(function(root){
 'use strict';
 function ellipse(c,x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
 function star(c,x,y,r){c.beginPath();c.moveTo(x,y-r);c.lineTo(x+r*.28,y-r*.28);c.lineTo(x+r,y);c.lineTo(x+r*.28,y+r*.28);c.lineTo(x,y+r);c.lineTo(x-r*.28,y+r*.28);c.lineTo(x-r,y);c.lineTo(x-r*.28,y-r*.28);c.closePath();c.fill();}
 function draw(c,age,reduced){
  c.save();var g=c.createLinearGradient(0,0,300,640);g.addColorStop(0,'#111c39');g.addColorStop(.6,'#1d3448');g.addColorStop(1,'#38534e');c.fillStyle=g;c.fillRect(0,0,480,640);
  c.strokeStyle='#9cb9c422';c.lineWidth=1;ellipse(c,240,279,151,151,null,'#c5c69c28');ellipse(c,240,279,140,140,null,'#c5c69c18');
  c.fillStyle='#c4d7df';for(var i=0;i<21;i++){c.globalAlpha=.18+(i%4)*.1;star(c,38+(i*97)%408,62+(i*43)%267,1+i%3);}c.globalAlpha=1;
  // Cloud shelves connect the corridor's cool sky to the garden's warm green.
  for(var row=0;row<4;row++){c.fillStyle=['#dbe6dd09','#c7ded014','#c7ded01b','#d4e5ce22'][row];c.beginPath();c.moveTo(-30,410+row*46);for(var k=0;k<7;k++)c.quadraticCurveTo(k*85-5,367+row*46,k*85+50,410+row*46);c.lineTo(510,640);c.lineTo(-30,640);c.fill();}
  var lift=reduced?0:Math.sin(Math.PI*Math.min(1,age/100))*3;c.translate(240,270-lift);
  c.fillStyle='#d7e5df';c.strokeStyle='#6e91a1';c.lineWidth=2;
  for(var side=-1;side<=1;side+=2){c.beginPath();c.moveTo(side*17,12);c.bezierCurveTo(side*44,-27,side*88,-43,side*82,0);c.bezierCurveTo(side*70,23,side*45,36,side*24,34);c.closePath();c.fill();c.stroke();for(var f=0;f<3;f++){c.beginPath();c.moveTo(side*(32+f*12),15-f*9);c.lineTo(side*(51+f*10),4-f*12);c.stroke();}}
  ellipse(c,0,-58,25,7,null,'#efd5a2');ellipse(c,0,-56,19,4,null,'#efd5a24d');
  c.beginPath();c.moveTo(-15,8);c.lineTo(-29,67);c.quadraticCurveTo(0,81,29,67);c.lineTo(15,8);c.closePath();c.fillStyle='#e5e9e1';c.fill();c.strokeStyle='#7298a9';c.stroke();
  c.fillStyle='#6591b1';c.fillRect(-16,26,32,7);c.fillStyle='#e7cea8';c.fillRect(-4,27,8,5);
  ellipse(c,0,-17,23,29,'#e5d7c4','#8198a4');
  c.beginPath();c.moveTo(-25,-12);c.quadraticCurveTo(-30,-52,2,-50);c.quadraticCurveTo(28,-48,26,-12);c.lineTo(17,-23);c.lineTo(8,-31);c.lineTo(1,-19);c.lineTo(-8,-28);c.lineTo(-17,-15);c.closePath();c.fillStyle='#e6edf1';c.fill();c.strokeStyle='#849daf';c.stroke();
  c.strokeStyle='#526479';c.lineWidth=1.5;for(var e=-1;e<=1;e+=2){c.beginPath();c.moveTo(e*5,-10);c.quadraticCurveTo(e*10,-6,e*15,-10);c.stroke();}
  c.strokeStyle='#a38e7c';c.lineWidth=1;ellipse(c,0,1,3,1,null,'#a38e7c');
  // Joined hands and folded sleeves identify prayer at the small on-screen size.
  c.fillStyle='#cadce1';for(var s=-1;s<=1;s+=2){c.beginPath();c.moveTo(s*17,10);c.lineTo(s*29,29);c.lineTo(s*9,40);c.lineTo(0,18);c.closePath();c.fill();c.strokeStyle='#7798a8';c.stroke();}ellipse(c,-3,20,4,12,'#ead7bd');ellipse(c,3,20,4,12,'#ead7bd');
  c.restore();c.save();c.textAlign='center';c.fillStyle='#f1dcad';c.font='19px "Microsoft YaHei",sans-serif';c.fillText('【小天使祈祷中】',240,415);c.fillStyle='#bed1d1';c.font='12px "Microsoft YaHei",sans-serif';c.fillText('星穹回廊  ·  风铃花庭',240,449);c.strokeStyle='#c5be9144';c.beginPath();c.moveTo(143,471);c.lineTo(337,471);c.stroke();c.fillStyle='#e2d5ad';star(c,240,471,4);
  var fade=Math.max(0,1-age/12,(age-88)/12);if(!reduced&&fade>0){c.globalAlpha=Math.min(1,fade);c.fillStyle='#0b162b';c.fillRect(0,0,480,640);}c.restore();
 }
 root.DanmakuJourneyView={draw:draw};
}(typeof globalThis!=='undefined'?globalThis:this));
