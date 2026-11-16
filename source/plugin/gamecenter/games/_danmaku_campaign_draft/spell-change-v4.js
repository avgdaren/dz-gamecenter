/* (C) 2026 Carinoasd. Shared staged spell declaration: 小典 / Codex.
 * All motion is derived from the existing transition clock; gameplay is read-only.
 */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./spell-change-v2.js'));
 else root.DanmakuStageShow=factory(root.DanmakuStageShow);
}(typeof globalThis!=='undefined'?globalThis:this,function(common){
 'use strict';var portraits={};
 function clamp(v){return Math.max(0,Math.min(1,v));}function ease(v){v=clamp(v);return v*v*(3-2*v);}
 function model(state,battle,reduced){
  var m=common.model(state,battle,reduced);if(!m.spellChange)return m;
  var a=battle.rules.clock.transitionTicks-battle.remaining,from=state.breakOrigin||[240,88],p=ease(a/44);
  m.phaseAge=a;m.sequence=a<22?'收招':a<52?'蓄势':a<96?'宣告':'释放';
  m.charge=ease((a-16)/34)*(1-ease((a-96)/24));m.gesture=ease((a-18)/18)*(1-ease((a-102)/18));
  m.cutIn=ease((a-35)/14)*(1-ease((a-91)/22));m.release=ease((a-94)/10)*(1-ease((a-111)/9));
  m.envelope=ease(a/12)*(1-ease((a-108)/12));m.origin=[from[0]+(240-from[0])*p,from[1]+(88-from[1])*p-(reduced?0:4*Math.sin(Math.PI*clamp((a-18)/102)))];
  m.bossAlpha=1;m.burst=null;m.flash=0;m.shake=[0,0];return m;
 }
 function palette(m){return m.theme===1?(m.phase===1?['#f3bdcf','#b0cebc','#edd6a3']:['#efdaa5','#a7d2c5','#efd8c2']):(m.phase===1?['#a8ddf2','#d6e7fa','#e9cf96']:['#cdbcec','#adcde5','#e8d2a4']);}
 function line(ctx,x0,y0,x1,y1){ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();}
 function ring(ctx,r,ratio){ctx.beginPath();ctx.ellipse(0,0,r,r*ratio,0,0,Math.PI*2);ctx.stroke();}
 function star(ctx,x,y,r){ctx.beginPath();ctx.moveTo(x-r,y);ctx.lineTo(x,y-r*1.5);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r*1.5);ctx.closePath();ctx.stroke();}
 function petal(ctx,x,y,r,a){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-r*.7,-r*.65,-r*.35,-r*1.9,0,-r*2);ctx.bezierCurveTo(r*.35,-r*1.9,r*.7,-r*.65,0,0);ctx.stroke();ctx.restore();}
 function sigil(ctx,m,reduced){var a=m.phaseAge,c=m.charge,p=palette(m),r=48+c*28;
  ctx.save();ctx.translate(m.origin[0],m.origin[1]+7);ctx.strokeStyle=p[0];ctx.lineWidth=1.2;ctx.globalAlpha=m.envelope*(.28+c*.5);
  if(m.theme!==1){
   ctx.save();ctx.rotate(reduced?0:a*.012);ring(ctx,r,.55);ctx.rotate(Math.PI/2.7);ring(ctx,r,.55);ctx.restore();ring(ctx,r*.7,1);
   var points=[];for(var i=0;i<8;i++){var angle=i*Math.PI/4+(reduced?0:a*.004),x=Math.cos(angle)*r,y=Math.sin(angle)*r;points.push([x,y]);star(ctx,x,y,3+c*2);}
   ctx.globalAlpha*=.55;points.forEach(function(q,i){var n=points[(i+3)%8];line(ctx,q[0],q[1],n[0],n[1]);});
  }else{
   ring(ctx,r,.58);ctx.strokeStyle=p[1];ctx.save();ctx.rotate(reduced?0:-a*.008);
   for(var j=0;j<5;j++)petal(ctx,0,0,18+c*12,j*Math.PI*2/5);ctx.restore();
   if(m.phase===2){ctx.strokeStyle=p[2];[-1,0,1].forEach(function(side){ctx.save();ctx.translate(side*43,-12+(side===0?-15:8));ctx.beginPath();ctx.moveTo(-7,-8);ctx.quadraticCurveTo(-10,3,-13,8);ctx.quadraticCurveTo(0,13,13,8);ctx.quadraticCurveTo(10,3,7,-8);ctx.closePath();ctx.stroke();line(ctx,0,10,0,15);ctx.restore();});}
  }
  if(!reduced){ctx.strokeStyle=p[2];ctx.globalAlpha=m.envelope*c*.44;for(var k=0;k<12;k++){var q=(a*.018+k/12)%1,angle=k*Math.PI/6+a*.006,d=132-q*81;line(ctx,Math.cos(angle)*d,Math.sin(angle)*d*.65,Math.cos(angle)*(d-9),Math.sin(angle)*(d-9)*.65);}}
  ctx.restore();
 }
 function underlay(ctx,m,reduced){if(!m.spellChange)return false;var p=palette(m);ctx.save();ctx.beginPath();ctx.rect(0,55,480,310);ctx.clip();
  var dim=ctx.createLinearGradient(0,50,0,365);dim.addColorStop(0,'#071126');dim.addColorStop(1,'#07112600');ctx.globalAlpha=m.envelope*(reduced?.13:.3);ctx.fillStyle=dim;ctx.fillRect(0,55,480,310);
  ctx.globalAlpha=1;sigil(ctx,m,reduced);
  if(!reduced&&m.phaseAge<24){ctx.strokeStyle=p[0];ctx.globalAlpha=(1-m.phaseAge/24)*.45;ctx.lineWidth=1;ctx.save();ctx.translate(m.origin[0],m.origin[1]);ctx.rotate(-m.phaseAge*.018);ring(ctx,92-m.phaseAge*1.7,.38);ctx.restore();}
  ctx.restore();return true;
 }
 function release(ctx,m,reduced){if(reduced||m.release<=0)return;var p=palette(m),r=m.release;ctx.save();ctx.strokeStyle=p[0];ctx.globalAlpha=r*.58;ctx.lineWidth=1.5;
  [-1,1].forEach(function(side){for(var i=0;i<3;i++){var x=m.origin[0],y=m.origin[1]+20+i*10;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+side*50,y-38,x+side*(100+r*28),y+35,x+side*(140+r*32),y-6+i*7);ctx.stroke();}});ctx.restore();
 }
 function declaration(ctx,m,reduced){var p=palette(m),alpha=reduced?m.opacity:m.cutIn;if(alpha<=0)return;var age=m.phaseAge,slide=reduced?0:32*(1-ease((age-35)/14))-36*ease((age-91)/22),im=portraits[m.theme===1?'lingyu':'observer'];
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(slide,0);ctx.beginPath();ctx.moveTo(-36,174);ctx.lineTo(500,151);ctx.lineTo(500,300);ctx.lineTo(-36,323);ctx.closePath();ctx.clip();
  var ground=ctx.createLinearGradient(0,170,470,300);ground.addColorStop(0,'#14233bf5');ground.addColorStop(.5,'#0b172df2');ground.addColorStop(1,'#14243bf5');ctx.fillStyle=ground;ctx.fillRect(-40,145,550,185);
  if(!reduced){ctx.strokeStyle=p[1];ctx.lineWidth=1;ctx.globalAlpha=alpha*.18;for(var i=0;i<10;i++)line(ctx,-40+i*64+age*.9,155,-110+i*64+age*.9,325);ctx.globalAlpha=alpha;}
  if(im&&im.complete){var h=388,w=h*im.naturalWidth/im.naturalHeight;ctx.save();ctx.globalAlpha=alpha*.96;ctx.drawImage(im,-24,172,w,h);ctx.restore();}
  var shade=ctx.createLinearGradient(175,0,280,0);shade.addColorStop(0,'#0b172d00');shade.addColorStop(1,'#0b172df5');ctx.fillStyle=shade;ctx.fillRect(175,155,340,170);
  ctx.strokeStyle=p[0];ctx.lineWidth=2;line(ctx,-20,175,490,153);line(ctx,-20,322,490,300);ctx.fillStyle=p[2];ctx.fillRect(230,195,3,76);
  ctx.textAlign='left';ctx.fillStyle='#b9c7db';ctx.font='11px "Microsoft YaHei",sans-serif';ctx.fillText(m.bossName||(m.theme===1?'司风天使·铃羽':'星环观测者'),249,192,210);
  ctx.fillStyle=p[2];ctx.font='12px "Microsoft YaHei",sans-serif';ctx.fillText('宣告 · '+['第一式','第二式','第三式'][m.phase],249,217);
  ctx.fillStyle='#f2e6cf';ctx.font='bold 22px "Microsoft YaHei",sans-serif';ctx.fillText(m.title,249,250,208);
  ctx.strokeStyle=p[1];ctx.lineWidth=1;line(ctx,249,269,442,269);ctx.font='9px "Microsoft YaHei",sans-serif';ctx.fillStyle=p[0];ctx.fillText(m.theme===1?'风息汇聚 · 铃音再起':'星仪归位 · 星轨重构',249,288,205);ctx.restore();
 }
 function effects(ctx,m,reduced){if(!m.spellChange)return common.effects(ctx,m,reduced);release(ctx,m,reduced);declaration(ctx,m,reduced);return true;}
 return Object.assign({},common,{model:model,underlay:underlay,effects:effects,setPortraits:function(images){portraits=images;},spellChangeVersion:4});
}));
