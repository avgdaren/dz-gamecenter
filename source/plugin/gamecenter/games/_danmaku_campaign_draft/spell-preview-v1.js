/* (C) 2026 Carinoasd. Independent spell storyboard / renderer: 小典 / Codex, 2026-11-16. */
(function(root){
 'use strict';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
 const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const THEMES=Object.freeze({
  observer:Object.freeze({name:'星环观测者',chapter:'第一关 · 星穹回廊',color:'#b5deff',gold:'#ecd8a3',pink:'#a4b9ff',dark:'#081529',rune:'STELLAR ORBIT  ·  CELESTIAL SEAL',spells:Object.freeze(['星环 · 周天轨迹','星雨 · 引光连祷','星幕 · 穹顶终章'])}),
  lingyu:Object.freeze({name:'司风天使 · 铃羽',chapter:'第二关 · 风铃花庭',color:'#b9efda',gold:'#f0d5a5',pink:'#f0bdcf',dark:'#0b2226',rune:'GARDEN WIND  ·  BELLFLOWER SEAL',spells:Object.freeze(['风廊','花瓣舒展','铃声回响'])})
 });
 const KEYFRAMES=Object.freeze([{frame:12,label:'收束'},{frame:30,label:'切入'},{frame:62,label:'宣告'},{frame:100,label:'退场'},{frame:150,label:'落位'}].map(Object.freeze));
 function model(theme,spell,frame,reduced){
  if(!THEMES[theme])throw Error('Unknown theme');
  spell=clamp(Math.trunc(Number(spell)||0),0,2);frame=clamp(Number(frame)||0,0,240);
  const enter=ease((frame-18)/18),leave=ease((frame-80)/40),settle=ease((frame-88)/32),seal=ease(frame/24);
  const title=THEMES[theme].spells[spell],parts=title.split(' · ');
  return Object.freeze({theme,spell,frame,reduced:!!reduced,title,prefix:parts.length>1?parts[0]:'',main:parts.at(-1),
   beat:frame<18?'收束蓄势':frame<36?'立绘切入':frame<80?'招名宣告':frame<120?'立绘退场':'战斗落位示意',
   enter,leave,settle,portraitAlpha:enter*(1-leave)*.97,portraitOffset:reduced?0:-72*(1-enter)-54*leave,
   ringAlpha:mix(.08,.58,seal)*(1-.66*leave),bandAlpha:ease((frame-20)/16)*(1-ease((frame-78)/34))*.38,
   rotation:reduced?0:frame*.003,titleAlpha:ease((frame-40)/14),titleY:mix(446,83,settle),titleSize:mix(35,22,settle),
   flash:reduced?0:Math.exp(-Math.pow((frame-42)/6,2))*.13,particleAlpha:ease((frame-14)/22)*(1-.55*leave)});
 }
 function line(ctx,color,width,draw){ctx.beginPath();draw();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 function circle(ctx,x,y,r,color,width){line(ctx,color,width,()=>ctx.arc(x,y,r,0,Math.PI*2));}
 function star(ctx,x,y,r,color){ctx.save();ctx.translate(x,y);line(ctx,color,1,()=>{for(let i=0;i<5;i++){const a=-Math.PI/2+i*4*Math.PI/5;const px=Math.cos(a)*r,py=Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();});ctx.restore();}
 function petal(ctx,x,y,r,a,color){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-r);ctx.bezierCurveTo(r*.9,-r*.5,r*.6,r*.6,0,r);ctx.bezierCurveTo(-r*.6,r*.6,-r*.9,-r*.5,0,-r);ctx.fill();ctx.restore();}
 function bell(ctx,x,y,r,color){line(ctx,color,1.2,()=>{ctx.moveTo(x-r,y+r*.5);ctx.bezierCurveTo(x-r*.5,y,x-r*.7,y-r,x,y-r);ctx.bezierCurveTo(x+r*.7,y-r,x+r*.5,y,x+r,y+r*.5);ctx.closePath();ctx.moveTo(x-r*.7,y+r*.8);ctx.lineTo(x+r*.7,y+r*.8);});circle(ctx,x,y+r,r*.12,color,1);}
 function ringLayer(ctx,m,t){
  ctx.save();ctx.translate(260,231);ctx.globalAlpha=m.ringAlpha;ctx.rotate(m.rotation);
  ctx.shadowColor=t.color;ctx.shadowBlur=9;circle(ctx,0,0,211,t.color,1.4);circle(ctx,0,0,205,t.gold,.65);circle(ctx,0,0,177,t.color,.8);circle(ctx,0,0,164,t.gold,.65);
  for(let i=0;i<60;i++){const a=i*Math.PI/30;line(ctx,i%5?t.color:t.gold,i%5?.65:1.4,()=>{ctx.moveTo(Math.cos(a)*191,Math.sin(a)*191);ctx.lineTo(Math.cos(a)*(i%5?197:203),Math.sin(a)*(i%5?197:203));});}
  ctx.shadowBlur=0;
  if(m.theme==='observer'){
   line(ctx,t.color,1,()=>{for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI*2/3;i?ctx.lineTo(Math.cos(a)*164,Math.sin(a)*164):ctx.moveTo(Math.cos(a)*164,Math.sin(a)*164);}ctx.closePath();});
   ctx.save();ctx.rotate(-m.rotation*2.5);for(let i=0;i<3;i++){ctx.save();ctx.rotate(i*Math.PI/3);line(ctx,t.gold,.8,()=>ctx.ellipse(0,0,157,63,0,0,Math.PI*2));ctx.restore();}ctx.restore();
   for(let i=0;i<12;i++){const a=i*Math.PI/6;star(ctx,Math.cos(a)*149,Math.sin(a)*149,i%3?3:6,t.gold);}
  }else{
   for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);line(ctx,t.color,.9,()=>ctx.ellipse(0,-67,47,89,0,0,Math.PI*2));ctx.restore();}
   for(let i=0;i<3;i++){const a=-Math.PI/2+i*Math.PI*2/3;const x=Math.cos(a)*146,y=Math.sin(a)*146;circle(ctx,x,y,19,t.gold,.8);bell(ctx,x,y,9,t.gold);}
   ctx.save();ctx.rotate(-m.rotation*2);for(let i=0;i<10;i++){const a=i*Math.PI/5;petal(ctx,Math.cos(a)*182,Math.sin(a)*182,4,a,t.pink);}ctx.restore();
  }
  ctx.font='10px Georgia,serif';ctx.fillStyle=t.gold;ctx.textAlign='center';
  const glyphs='✧ + · ◇ · + ✧ · ◇ + · ✧'.split(' ');
  glyphs.forEach((g,i)=>{const a=i/glyphs.length*Math.PI*2;ctx.save();ctx.rotate(a);ctx.translate(0,-183);ctx.fillText(g,0,3);ctx.restore();});
  ctx.restore();
 }
 function bands(ctx,m,t){
  if(m.bandAlpha<=0)return;ctx.save();ctx.globalAlpha=m.bandAlpha;ctx.translate(240,310);ctx.rotate(-.49);
  const drift=m.reduced?0:(m.frame*1.35)%300;
  for(let i=-3;i<=3;i++){const y=i*92;const grad=ctx.createLinearGradient(-470,0,470,0);grad.addColorStop(0,'transparent');grad.addColorStop(.4,t.color);grad.addColorStop(.6,t.color);grad.addColorStop(1,'transparent');
   ctx.fillStyle=grad;ctx.globalAlpha=m.bandAlpha*.1;ctx.fillRect(-500,y-23,1000,42);ctx.globalAlpha=m.bandAlpha;
   ctx.font='italic 17px Georgia,serif';ctx.fillStyle=i%2?t.gold:t.color;ctx.textAlign='left';
   for(let j=-2;j<=2;j++)ctx.fillText(t.rune,-520+j*320+drift*(i%2?-1:1),y);
   line(ctx,t.color,.65,()=>{ctx.moveTo(-520,y+9);ctx.lineTo(520,y+9);});
  }ctx.restore();
 }
 function particles(ctx,m,t){
  ctx.save();ctx.globalAlpha=m.particleAlpha*.55;
  for(let i=0;i<28;i++){const f=m.reduced?62:m.frame;const x=(i*107+f*(m.theme==='lingyu'?.6:.13))%520-20,y=(i*71-f*(.35+i%3*.1)+900)%700-35;
   if(m.theme==='lingyu')petal(ctx,x,y,2.5+i%3,f*.012+i,t.pink);else star(ctx,x,y,1.4+i%3,t.gold);
  }ctx.restore();
 }
 function portrait(ctx,m,assets){
  if(m.portraitAlpha<=0)return;
  const image=assets[m.theme+'Portrait'],h=m.theme==='observer'?541:553,w=h*image.naturalWidth/image.naturalHeight;
  const x=(m.theme==='observer'?-17:14)+m.portraitOffset,y=m.theme==='observer'?40:33;
  ctx.save();ctx.globalAlpha=m.portraitAlpha;ctx.shadowColor=m.theme==='observer'?'#9fbeff':'#aee7d1';ctx.shadowBlur=14;ctx.drawImage(image,x,y,w,h);ctx.restore();
  // Theme veil blends the source aura into the stage while leaving the original bitmap intact.
  ctx.save();ctx.globalAlpha=m.portraitAlpha;const g=ctx.createLinearGradient(0,437,0,610);g.addColorStop(0,'transparent');g.addColorStop(1,THEMES[m.theme].dark);ctx.fillStyle=g;ctx.fillRect(0,437,480,173);ctx.restore();
 }
 function smallActors(ctx,m,t,assets){
  const x=282,y=172;ctx.save();ctx.globalAlpha=.65;circle(ctx,x,y,43,t.color,1);ctx.translate(x,y);ctx.scale(1,.4);circle(ctx,0,0,58,t.gold,1.8);ctx.restore();
  ctx.save();ctx.imageSmoothingEnabled=false;
  if(m.theme==='observer')ctx.drawImage(assets.observerBody,0,0,96,128,x-36,y-47,72,96);
  else ctx.drawImage(assets.lingyuBody,178,195,614,1036,x-25,y-42,50,84);
  ctx.drawImage(assets.player,0,0,48,48,240-24,550-28,48,48);ctx.restore();
  ctx.save();ctx.fillStyle='#fff';ctx.shadowColor='#152335';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(240,550,3,0,Math.PI*2);ctx.fill();circle(ctx,240,550,5,'#24395c',1.3);ctx.restore();
 }
 function title(ctx,m,t){
  if(!m.titleAlpha)return;ctx.save();ctx.globalAlpha=m.titleAlpha;ctx.textAlign='right';ctx.lineJoin='round';ctx.strokeStyle='rgba(3,10,24,.92)';ctx.lineWidth=5;ctx.shadowColor='#030b19';ctx.shadowBlur=10;
  const x=455,y=m.titleY,sz=m.titleSize;
  ctx.font='500 '+sz+'px "Danmaku Spell Serif",serif';ctx.strokeText(m.main,x,y);ctx.fillStyle='#fff9eb';ctx.fillText(m.main,x,y);
  ctx.shadowBlur=0;ctx.font='500 '+mix(16,13,m.settle)+'px "Danmaku Spell Serif",serif';ctx.fillStyle=t.gold;
  const prefix=m.prefix||['第一式','第二式','第三式'][m.spell];ctx.strokeText(prefix,x,y-sz-13);ctx.fillText(prefix,x,y-sz-13);
  const length=mix(232,157,m.settle),g=ctx.createLinearGradient(x-length,0,x,0);g.addColorStop(0,'transparent');g.addColorStop(.5,t.gold);g.addColorStop(1,t.gold);
  ctx.fillStyle=g;ctx.fillRect(x-length,y+13,length,1);ctx.fillRect(x-4,y+10,4,7);
  if(m.settle<1){ctx.globalAlpha=m.titleAlpha*(1-m.settle)*.65;ctx.font='10px Georgia,serif';ctx.fillText('S P E L L   D E C L A R A T I O N',x,y+34);}
  ctx.restore();
 }
 function draw(ctx,m,assets){
  const t=THEMES[m.theme];ctx.save();ctx.clearRect(0,0,480,640);ctx.fillStyle=t.dark;ctx.fillRect(0,0,480,640);
  const bg=assets[m.theme+'Background'];ctx.drawImage(bg,0,560,724,965,0,0,480,640);
  ctx.fillStyle=m.theme==='observer'?'rgba(5,12,30,.78)':'rgba(5,24,27,.77)';ctx.fillRect(0,0,480,640);
  const radial=ctx.createRadialGradient(260,220,15,260,220,350);radial.addColorStop(0,m.theme==='observer'?'rgba(84,111,197,.24)':'rgba(102,170,147,.21)');radial.addColorStop(1,'transparent');ctx.fillStyle=radial;ctx.fillRect(0,0,480,640);
  ringLayer(ctx,m,t);bands(ctx,m,t);portrait(ctx,m,assets);particles(ctx,m,t);
  // Foreground actors and all danger information are always above the cut-in layers.
  smallActors(ctx,m,t,assets);title(ctx,m,t);
  if(m.flash){ctx.fillStyle='rgba(238,249,255,'+m.flash+')';ctx.fillRect(0,0,480,495);}
  ctx.fillStyle='rgba(4,12,25,.68)';ctx.fillRect(0,0,480,27);ctx.fillStyle='#e1e9ef';ctx.font='11px sans-serif';ctx.textAlign='left';ctx.fillText(t.name,15,18);ctx.textAlign='right';ctx.fillStyle=t.gold;ctx.fillText('EASY  ·  演出短样',465,18);
  ctx.fillStyle='rgba(4,12,25,.74)';ctx.fillRect(0,608,480,32);ctx.textAlign='left';ctx.fillStyle='#aebacb';ctx.font='10px sans-serif';ctx.fillText('大立绘退场后，仅示意招名与背景落位',15,628);
  ctx.strokeStyle=t.gold;ctx.globalAlpha=.6;ctx.lineWidth=1;for(const [x,y,sx,sy] of [[7,34,1,1],[473,34,-1,1],[7,600,1,-1],[473,600,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*14);ctx.lineTo(x,y);ctx.lineTo(x+sx*20,y);ctx.stroke();}ctx.restore();
 }
 const api=Object.freeze({THEMES,KEYFRAMES,model,draw,totalFrames:240,introFrames:120});
 if(typeof module==='object'&&module.exports)module.exports=api;else root.DanmakuSpellPreview=api;
})(typeof globalThis==='object'?globalThis:this);
