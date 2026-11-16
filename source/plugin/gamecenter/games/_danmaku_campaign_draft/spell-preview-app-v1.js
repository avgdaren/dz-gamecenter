/* (C) 2026 Carinoasd. Offline preview transport: 小典 / Codex. */
(function(){
 'use strict';
 const api=window.DanmakuSpellPreview,$=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d'),assets={};
 let theme='observer',spell=1,frame=62,playing=false,ready=false,rate=1,last=null;
 const reducedMedia=matchMedia('(prefers-reduced-motion: reduce)');$('reduced').checked=reducedMedia.matches;
 const status=text=>$('status').textContent=text;
 function current(){return api.model(theme,spell,frame,$('reduced').checked);}
 function render(){
  if(!ready)return;const m=current();api.draw(ctx,m,assets);$('timeline').value=String(Math.round(frame));$('time').value=(frame/60).toFixed(2)+'秒 / '+Math.round(frame)+'帧';$('beat').textContent=m.beat;
  $('state').textContent=playing?'播放中 · '+rate+'×':'已暂停 · 可逐帧查看';$('toggle').textContent=playing?'暂停':'继续播放';$('toggle').setAttribute('aria-pressed',String(playing));
  document.querySelectorAll('[data-frame]').forEach(b=>b.setAttribute('aria-pressed',String(Math.round(frame)===Number(b.dataset.frame))));
 }
 function pause(reason){playing=false;last=null;if(reason)status(reason);render();}
 function seek(value){frame=Math.max(0,Math.min(240,Number(value)||0));pause('已定格，可以切换角色对照。');}
 function play(fromStart){if(!ready)return;if(fromStart||frame>=240)frame=0;playing=true;last=null;status('切换窗口会自动暂停。');render();}
 function chooseTheme(value){if(!api.THEMES[value])throw Error('Unknown theme');theme=value;document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===theme)));$('chapter').textContent=api.THEMES[theme].chapter;
  $('spell').replaceChildren(...api.THEMES[theme].spells.map((title,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=title;return o;}));$('spell').value=String(spell);render();
 }
 document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>chooseTheme(b.dataset.theme)));
 for(const key of api.KEYFRAMES){const b=document.createElement('button');b.type='button';b.textContent=key.label;b.dataset.frame=String(key.frame);b.addEventListener('click',()=>seek(key.frame));$('keys').appendChild(b);}
 $('replay').addEventListener('click',()=>play(true));$('toggle').addEventListener('click',()=>playing?pause('已暂停。'):play(false));
 $('previous').addEventListener('click',()=>seek(Math.round(frame)-1));$('next').addEventListener('click',()=>seek(Math.round(frame)+1));
 $('timeline').addEventListener('input',()=>seek($('timeline').value));$('rate').addEventListener('change',()=>{rate=Number($('rate').value);last=null;render();});
 $('spell').addEventListener('change',()=>{spell=Number($('spell').value);render();});$('reduced').addEventListener('change',render);
 window.addEventListener('blur',()=>{if(playing)pause('窗口失去焦点，已暂停。');});document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause('页面进入后台，已暂停。');});
 function animate(now){if(ready&&playing){if(last!==null)frame=Math.min(240,frame+Math.max(0,now-last)*.06*rate);last=now;if(frame>=240){playing=false;last=null;status('演出结束，已停住。');}render();}requestAnimationFrame(animate);}
 // Test/review surface is transport-only; no battle engine, attacks, RNG or resources are loaded.
 window.SpellPreview=Object.freeze({inspect:()=>({ready,theme,spell,frame,playing,rate,reduced:$('reduced').checked,model:current()}),seek,setTheme:chooseTheme});
 chooseTheme(theme);requestAnimationFrame(animate);
 Promise.all([Promise.all(Object.entries(window.SpellPreviewAssets).map(([key,url])=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{assets[key]=img;resolve();};img.onerror=()=>reject(Error('素材载入失败：'+key));img.src=url;}))),document.fonts.load('500 35px "Danmaku Spell Serif"','引光连祷')]).then(result=>{
  if(!result[1].length)throw Error('招名字体未载入');ready=true;$('loading').hidden=true;status('已定格在宣告画面。');render();
 }).catch(error=>{$('loading').textContent=error.message;status('载入失败，请重新打开本地文件。');});
})();
