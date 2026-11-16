/* (C) 2026 Carinoasd. Production layers from the approved spell study: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./spell-preview-v1.js'));else root.DanmakuSpellCanvas=factory(root.DanmakuSpellPreview);}(typeof globalThis!=='undefined'?globalThis:this,function(preview){'use strict';
 const THEMES=preview.THEMES,mix=(a,b,t)=>a+(b-a)*t;
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

 const colors={observer:['#b5deff','#a8ddf2','#d1c2eb'],lingyu:['#b9efda','#f0bdcf','#efd7a2']};
 function palette(m,phase){return Object.assign({},THEMES[m.life.theme],{color:colors[m.life.theme][phase],pink:m.life.theme==='lingyu'?'#f0bdcf':'#a4b9ff'});}
 function fieldRing(ctx,m,phase,weight){if(weight<=0)return;var v=m.life.visual,t=palette(m,phase),scale=(.89+phase*.055)*(1-m.life.closed*.84);
  ctx.save();ctx.translate(m.life.anchor[0],m.life.anchor[1]);ctx.scale(scale,scale);ctx.translate(-260,-231);ctx.globalAlpha=weight;
  // ringLayer owns its alpha, so scale its model rather than relying on outer globalAlpha.
  ringLayer(ctx,Object.assign({},v,{ringAlpha:v.ringAlpha*weight,rotation:v.rotation+(phase-1)*.19}),t);ctx.restore();
 }
 function underlay(ctx,m,portraits){var life=m.life,v=life.visual,t=palette(m,m.phase);ctx.save();ctx.fillStyle=t.dark;ctx.globalAlpha=life.fieldAlpha;ctx.fillRect(0,0,480,640);ctx.globalAlpha=1;
  var g=ctx.createRadialGradient(life.anchor[0],life.anchor[1],12,life.anchor[0],life.anchor[1],330);g.addColorStop(0,t.color+'22');g.addColorStop(1,t.color+'00');ctx.fillStyle=g;ctx.globalAlpha=1-life.closed;ctx.fillRect(0,0,480,640);ctx.globalAlpha=1;
  fieldRing(ctx,m,Math.max(0,m.phase-1),life.oldMix);fieldRing(ctx,m,m.phase,1-life.oldMix);
  bands(ctx,v,t);portrait(ctx,v,{observerPortrait:portraits.observer,lingyuPortrait:portraits.lingyu});
  particles(ctx,Object.assign({},v,{frame:life.clock}),t);
  if(v.flash){ctx.fillStyle='rgba(238,249,255,'+v.flash+')';ctx.fillRect(0,0,480,495);}
  if(life.kind==='clear'&&life.age<84){var p=Math.min(1,life.age/84),o=life.finalOrigin;ctx.save();ctx.globalAlpha=(1-p)*.75;ctx.strokeStyle=t.gold;ctx.lineWidth=1.5;
   circle(ctx,o[0],o[1],14+70*(1-p),t.gold,1.5);circle(ctx,o[0],o[1],9+48*(1-p),t.color,1);
   for(var i=0;i<8;i++){var a=i*Math.PI/4+(v.reduced?0:p*.4);star(ctx,o[0]+Math.cos(a)*(24+46*p),o[1]+Math.sin(a)*(24+46*p),3*(1-p),t.gold);}ctx.restore();}
  ctx.restore();
 }
 function oldTitle(m){var v=Object.assign({},m.life.visual),prev=(m.spellNames||THEMES[m.life.theme].spells)[Math.max(0,m.phase-1)].split(' · ');return Object.assign(v,{spell:Math.max(0,m.phase-1),main:prev.at(-1),prefix:prev.length>1?prev[0]:'',settle:1,titleSize:22,titleY:m.life.cornerY,titleAlpha:m.life.oldTitleAlpha});}
 function notice(ctx,m){var v=m.life.visual,ov=m.life.oldTitleAlpha?oldTitle(m):null;if(v.titleAlpha<=.01&&!ov)return null;
  var display=v.titleAlpha>.01?v:ov;ctx.save();ctx.font='500 '+display.titleSize+'px "Danmaku Spell Serif",serif';var w=Math.max(164,ctx.measureText(display.main).width+20);ctx.restore();
  var x=455-w,y=display.titleY-display.titleSize-35,h=display.titleSize+35+(display.settle<1?38:19);
  return{bounds:[x,y,w+10,h],cutout:[[x,y],[465,y],[465,y+h],[x,y+h]],title:v.titleAlpha>.01?m.title:(m.spellNames||THEMES[m.life.theme].spells)[Math.max(0,m.phase-1)],alpha:display.titleAlpha,theme:m.theme,phase:m.phase,mainTitle:display.main,fontFamily:'Danmaku Spell Serif',titleWidth:w-20,availableWidth:420,persistent:m.life.kind==='active'};
 }
 function titles(ctx,m){if(m.life.oldTitleAlpha)title(ctx,oldTitle(m),palette(m,Math.max(0,m.phase-1)));title(ctx,m.life.visual,palette(m,m.phase));}
 return Object.freeze({underlay:underlay,titles:titles,notice:notice});
}));
