/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。纯色对比度公式与浏览器审计共享。 */
export function ratio(a,b){const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function audit(root){
 const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),results=[];
 for(const selector of ['[data-gcr=preview-name]','.notice','[data-gcr=message]','.turn-help','.player small','.primary'])for(const el of root.querySelectorAll(selector)){
  if(!el.getClientRects().length)continue;
  let bg=el;while(bg&&getComputedStyle(bg).backgroundColor==='rgba(0, 0, 0, 0)')bg=bg.parentElement;
  const style=getComputedStyle(el),contrast=ratio(rgb(style.color),rgb(getComputedStyle(bg).backgroundColor));
  results.push({selector,contrast,pass:contrast>=4.5});
 }
 return results;
}
// Formula checks are not computed-style acceptance.
if(typeof document==='undefined'){
 const fs=(await import('node:fs')).default,assert=(await import('node:assert/strict')).default;
 const css=fs.readFileSync(new URL('../../source/plugin/gamecenter/games/raid/style.css',import.meta.url),'utf8');
 assert.ok(ratio([244,237,247],[72,52,83])>=4.5);
 assert.ok(ratio([109,106,120],[245,242,237])>=4.5);
 assert.ok(ratio([109,106,120],[255,253,249])>=4.5);
 assert.ok(css.includes('--muted:#6d6a78'));
 assert.ok(/--soft:#483453;--bad:#ffb4c3;color:var\(--ink\)/.test(css));
 assert.ok(/boss-art\{isolation:isolate;box-shadow:none;border-radius:14px;overflow:hidden\}/.test(css));
 assert.ok(css.includes('border-radius:0;mask-image:none;-webkit-mask-image:none'));
 assert.ok(css.includes('.primary:hover:not(:disabled){background:var(--accent);color:var(--paper)}'));
 console.log(JSON.stringify({status:'PASS',checks:8,scope:'formula and CSS guards only; computed style needs browser audit'}));
}
