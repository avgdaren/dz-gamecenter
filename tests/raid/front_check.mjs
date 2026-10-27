/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。DOM 子集 + 真实 PHP HTTP，非浏览器布局验收。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Element } from '../gomoku/minidom.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const checks = [];
const check = (yes, name) => { assert.ok(yes, name); checks.push(name); };
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function until(fn) { for(let i=0;i<600;i++) { if(fn()) return; await tick(); } throw new Error('wait timed out'); }
// Extend the existing repo test DOM only with APIs used by the prototype.
Element.prototype.append = function(...nodes) { nodes.forEach(node => this.appendChild(node)); };
Element.prototype.replaceChildren = function(...nodes) { this.children.forEach(child => { child.parentElement = null; }); this.children=[]; this._text=''; this.append(...nodes); };
const originalQuery = Element.prototype.querySelectorAll;
Element.prototype.querySelectorAll = function(selector) { return [...new Set(selector.split(',').flatMap(part => originalQuery.call(this, part.trim())))]; };
Object.defineProperty(Element.prototype, 'classList', {get() { const el=this; return {
  contains:n=>el.className.split(' ').includes(n),
  add(...ns) { el.className=[...new Set([...el.className.split(' ').filter(Boolean),...ns])].join(' '); },
  remove(...ns) { el.className=el.className.split(' ').filter(n=>!ns.includes(n)).join(' '); }
}; }});
const socket = net.createServer(); await new Promise(resolve => socket.listen(0,'127.0.0.1',resolve));
const port=socket.address().port; await new Promise(resolve=>socket.close(resolve));
const sessions=fs.mkdtempSync(path.join(os.tmpdir(),'raid-p1-front-'));
const php=spawn(process.env.PHP_BIN || 'php', ['-n','-d',`session.save_path=${sessions}`,'-S',`127.0.0.1:${port}`,path.join(root,'tests/raid/prototype/router.php')], {cwd:root,stdio:'ignore'});
const base=`http://127.0.0.1:${port}`;
const source=fs.readFileSync(path.join(root,'tests/raid/prototype/app.js'),'utf8');
const feedbackSource=fs.readFileSync(path.join(root,'tests/raid/prototype/feedback.js'),'utf8');
const musicSource=fs.readFileSync(path.join(root,'tests/raid/prototype/music.js'),'utf8');
const fixture=JSON.parse(fs.readFileSync(path.join(root,'docs/raid/P1-REFERENCE.json'),'utf8'));
let cookie='', dropNext=false, inFlight=0, maxFlight=0, posts=[], failAll=false;
const storage=new Map();
const soundStorage=new Map();
async function transport(url, options={}) {
  inFlight++; maxFlight=Math.max(maxFlight,inFlight);
  try {
    if(failAll) throw new Error('offline');
    const body=options.body ? JSON.parse(options.body) : null;
    if(body) posts.push(body);
    const response=await fetch(base+url,{...options,headers:{...(options.headers||{}),...(cookie ? {Cookie:cookie} : {})}});
    const next=response.headers.get('set-cookie'); if(next) cookie=next.split(';')[0];
    if(body && dropNext) { dropNext=false; await response.text(); throw new Error('response deliberately lost'); }
    return response;
  } finally { inFlight--; }
}
function setup(options={}) {
  const doc=new Element('document'); doc.innerHTML=fs.readFileSync(path.join(root,'tests/raid/prototype/index.html'),'utf8');
  doc.documentElement=doc.querySelector('html'); doc.getElementById=id=>doc.querySelector('#'+id);
  doc.createElement=tag=>new Element(tag); doc.activeElement=null; doc.hidden=false;
  Element.prototype.focus=function() {doc.activeElement=this;};
  const intervals=[];
  const windowTarget=new Element('window');
  class AudioDouble {constructor(){this.paused=true;this.volume=1;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
  const context={document:doc, window:{confirm:()=>true,addEventListener:(...args)=>windowTarget.addEventListener(...args),
      Audio:AudioDouble,localStorage:{getItem:k=>soundStorage.get(k)??null,setItem:(k,v)=>soundStorage.set(k,v)}}, fetch:transport, console,
    crypto:webcrypto, Date, AbortController, Uint8Array, setTimeout,clearTimeout,
    setInterval:fn=>{intervals.push(fn); return intervals.length;}, matchMedia:query=>({matches:!!options.reduced && query.includes('reduced-motion')}),
    sessionStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)??null,removeItem:k=>storage.delete(k)}};
  vm.runInNewContext(feedbackSource,context,{filename:'raid-feedback.js'});
  vm.runInNewContext(musicSource,context,{filename:'raid-music.js'});
  vm.runInNewContext(source,context,{filename:'raid-app.js'});
  return {doc,intervals,$:id=>doc.getElementById(id)};
}
async function settled(ui) { await until(()=>inFlight===0 && ui.$('message').textContent!=='正在确认…' && !ui.$('sync').disabled); }
async function command(ui,id) { ui.$(id).click(); await settled(ui); }
async function play(ui,actor,code,target) {
  const card=()=>ui.doc.querySelector(`[data-actor="${actor}"]`);
  const kind={A:'attack',G:'guard',H:'heal'}[code];
  const button=card().querySelector(`[data-kind="${kind}"]`);
  check(!button.disabled,`${actor} ${kind} available`); button.click();
  if(kind!=='attack') {
    const select=card().querySelector('select'); select.value=String(target); select.dispatchEvent({type:'change'});
  }
  card().querySelector('.confirm').click(); await settled(ui);
}
try {
  for(let i=0;i<100;i++) { try { await fetch(base); break; } catch (_) { await tick(); } }
  failAll=true;
  let ui=setup();
  await until(()=>ui.$('message').textContent.includes('连接失败'));
  check(!ui.$('sync').disabled && ui.$('solo').disabled,'bootstrap failure can retry sync before token');
  failAll=false;
  await command(ui,'sync');
  check(!ui.$('empty').hidden && ui.$('battle').hidden,'initial empty state');
  await command(ui,'solo');
  check(ui.$('boss-line').textContent==='你选择一人面对魔女，还是和伙伴一起挑战魔女？','opening line is user text verbatim');
  check(ui.$('players').textContent.includes('蚀月魔女 · 幽月') && ui.$('preview-name').textContent.includes('幽月'),'boss renamed in target and preview');
  check(ui.$('boss-hp').textContent==='120 / 120 生命' && ui.$('players').children.length===1,'solo displayed from PHP');
  check(ui.$('message').textContent==='第 1 轮开始：先看预告再选行动。','start feedback is not action confirmation');
  const started=ui.$('message').textContent;
  ui.intervals[0]();await settled(ui);
  check(ui.$('message').textContent===started && ui.$('connection').textContent.includes('状态已同步'),'background GET preserves start feedback, connection separate');
  check(ui.doc.querySelector('[data-kind="heal"]').disabled,'full health heal disabled');
  check(ui.doc.querySelector('.confirm').disabled,'explicit choice required');
  // One transport in flight even when the user clicks repeatedly.
  ui.doc.querySelector('[data-kind="attack"]').click();
  const confirm=ui.doc.querySelector('.confirm'); const n=posts.length;
  confirm.click(); confirm.click(); ui.$('duo').click(); await settled(ui);
  check(posts.length===n+1 && ui.$('boss-hp').textContent==='110 / 120 生命','rapid clicks send once');
  check(ui.$('round-feedback').textContent.includes('首领 −10') && ui.$('round-feedback').textContent.includes('席位 1 −8'),'actual damage has immediate textual feedback');
  check(ui.doc.querySelectorAll('.fx-float').length===2,'boss and player damage numbers shown once');
  check(ui.$('message').textContent.includes('席位 1已确认：攻击（第 1 轮）') && ui.$('message').textContent.includes('第 1 轮已结算；第 2 轮开始'),'solo confirms correct actor/action/round and immediate resolution');
  const confirmed=ui.$('message').textContent;
  const node=ui.doc.querySelector('[data-kind="guard"]'); node.focus();
  await command(ui,'sync');
  check(ui.doc.querySelector('[data-kind="guard"]')===node && ui.doc.activeElement===node,'unchanged poll preserves DOM and focus');
  check(ui.$('message').textContent===confirmed,'manual GET also preserves confirmation');
  check(ui.doc.querySelectorAll('.fx-float').length<=2,'GET does not duplicate floating numbers');
  // Finish a complete solo fixture through the actual controls.
  await command(ui,'solo');
  for(const row of fixture.cases.solo_reasonable.expected.trace) {
    await play(ui,0,...row.actions[0]);
    if(row.round===8) check(ui.$('boss-line').textContent==='你惹怒我了！','solo phase-two line is verbatim');
  }
  check(ui.$('result-title').textContent==='讨伐成功' && ui.$('log-count').textContent==='16 轮','solo 16-round UI win');
  check(ui.$('boss-line').textContent==='这一次，算你们赢。下次可没这么轻松。','victory quote retained');
  check(ui.$('message').textContent.includes('本局已结束，讨伐成功。') && !ui.$('message').textContent.includes('等待'),'winning act feedback is terminal rather than waiting');
  check(ui.$('boss-hp').textContent==='0 / 120 生命' && ui.$('players').textContent.includes('14 / 40'),'solo final hp displayed');
  check(ui.doc.querySelector('.confirm').disabled && ui.$('advance').disabled,'terminal controls closed');
  await command(ui,'duo');
  check(ui.$('players').children.length===2 && ui.$('boss-hp').textContent==='130 / 130 生命','duo displayed');
  for(const row of fixture.cases.duo_cover.expected.trace) {
    await play(ui,0,...row.actions[0]);
    if(row.round===1) {
      check(ui.$('message').textContent.includes('席位 1已确认：攻击（第 1 轮）。等待席位 2确认。'),'duo first seat feedback identifies waiting seat');
      const first=ui.$('message').textContent;
      ui.intervals[0]();await settled(ui);
      check(ui.$('message').textContent===first,'background poll preserves first-seat acknowledgment');
    }
    check(ui.doc.querySelector('[data-actor="0"] .confirm').disabled,'first seat locks');
    check(!ui.doc.querySelector('[data-actor="1"] [data-kind="attack"]').disabled,'second seat still acts same round');
    await play(ui,1,...row.actions[1]);
    if(row.round===4) check(ui.$('boss-line').textContent==='你们这群蝼蚁！','duo phase-two line is verbatim');
    if(row.round===1) check(ui.$('message').textContent.includes('席位 2已确认：攻击（第 1 轮）。第 1 轮已结算；第 2 轮开始'),'duo second seat names its own confirmation and completed round');
  }
  check(ui.$('result-title').textContent==='讨伐成功' && ui.$('log-count').textContent==='6 轮','duo cooperation wins');
  check(ui.$('players').textContent.includes('19 / 40') && ui.$('players').textContent.includes('22 / 40'),'duo final hp displayed');
  // An accepted operation whose response is lost stays pending, with the exact ID across refresh.
  await command(ui,'duo');
  ui.doc.querySelector('[data-actor="0"] [data-kind="attack"]').click();
  dropNext=true; ui.doc.querySelector('[data-actor="0"] .confirm').click();
  await until(()=>!ui.$('retry-box').hidden && !ui.$('retry').disabled);
  const lost=posts.at(-1); check(ui.$('solo').disabled,'unknown result blocks new commands');
  ui=setup();
  await until(()=>!ui.$('retry-box').hidden && !ui.$('retry').disabled);
  await command(ui,'retry');
  check(posts.at(-1).request_id===lost.request_id && posts.at(-1).round===lost.round,'reload retries exact request ID and round');
  check(ui.doc.querySelector('[data-actor="0"] .intent').textContent.includes('已确认：攻击'),'replayed confirmation visible');
  check(ui.$('message').textContent.includes('重试已确认：席位 1已确认：攻击（第 1 轮）'),'retry keeps original operation and actor context');
  check(ui.$('log-count').textContent==='0 轮','no early double resolution');
  await command(ui,'advance');
  check(ui.$('message').textContent.startsWith('已跳到本轮截止。') && ui.$('message').textContent.includes('第 2 轮开始'),'deadline jump has operation-specific feedback');
  check(ui.$('logs').textContent.includes('超时默认') && ui.$('boss-hp').textContent==='120 / 130 生命','timeout display preserves accepted intent');
  await command(ui,'offline');
  check(ui.$('message').textContent.startsWith('已模拟离线 400 秒') && ui.$('message').textContent.includes('本局已结束'),'offline jump has terminal feedback');
  check(ui.$('result-title').textContent==='挑战结束' && ui.$('result-text').textContent.includes('16 回合'),'long offline shown as limit loss');
  check(ui.$('boss-line').textContent==='别急着认输。记住这轮月光，再来一次。','loss quote retained');
  await command(ui,'solo');
  await play(ui,0,'A',-1);
  const round=ui.$('round').textContent;
  ui=setup(); await settled(ui);
  check(ui.$('round').textContent===round && ui.$('boss-hp').textContent==='110 / 120 生命','refresh restores battle from PHP');
  ui.doc.hidden=true;const before=posts.length; ui.intervals[0]();await tick();
  check(posts.length===before && inFlight===0,'hidden stops polling');
  ui.doc.hidden=false; ui.doc.dispatchEvent({type:'visibilitychange'});await settled(ui);
  const feedbackBeforeFailure=ui.$('message').textContent;
  failAll=true;ui.$('sync').click();await until(()=>ui.$('connection').textContent.includes('连接失败'));failAll=false;
  check(ui.$('message').textContent===feedbackBeforeFailure,'connection failure does not erase action or restored-state feedback');
  check(!ui.$('sync').disabled,'read failure permits retry');
  await command(ui,'sync');
  check(ui.$('message').textContent===feedbackBeforeFailure && !ui.$('connection').textContent.includes('失败'),'reconnected GET clears connection warning without replacing operation feedback');
  ui.$('theme').click();check(ui.doc.documentElement.dataset.theme==='dark','theme toggle');
  ui.doc.querySelector('.retreat').click();await settled(ui);
  check(ui.$('result-text').textContent.includes('已无成员继续挑战'),'retreat result displayed');
  check(ui.$('message').textContent.includes('席位 1撤退操作已确认。') && ui.$('message').textContent.includes('本局已结束'),'retreat feedback identifies actor and end');
  // Another tab advances the same session. The next GET keeps actor/action context,
  // but must stop claiming the previous round is still waiting for another player.
  await command(ui,'duo'); await play(ui,0,'A',-1);
  const previous=posts.at(-1);
  await (await transport('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    op:'advance',ms:25000,generation:previous.generation,token:previous.token,request_id:'f'.repeat(32)
  })})).json();
  ui.intervals[0]();await settled(ui);
  check(ui.$('message').textContent.includes('席位 1已确认：攻击（第 1 轮）') && ui.$('message').textContent.includes('第 1 轮已结算；第 2 轮开始') && !ui.$('message').textContent.includes('等待'),'changed snapshot preserves confirmation and updates round progress');
  await (await transport('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    op:'start',mode:'solo',generation:previous.generation,token:previous.token,request_id:'e'.repeat(32)
  })})).json();
  ui.intervals[0]();await settled(ui);
  check(ui.$('message').textContent.includes('已切换到另一局') && !ui.$('message').textContent.includes('席位 1已确认'),'new generation does not reuse previous battle acknowledgment');
  ui.$('sound').click();
  check(ui.$('sound').getAttribute('aria-pressed')==='false' && soundStorage.get('gcm_sound')==='0','sound toggle shares persisted game preference');
  ui=setup({reduced:true});await settled(ui);
  check(ui.$('sound').textContent==='音效 关','muted preference survives refresh');
  await play(ui,0,'A',-1);
  check(ui.doc.querySelectorAll('.fx-float').length===0 && ui.$('round-feedback').textContent.includes('首领 −10'),'reduced motion keeps summary without floats');
  await command(ui,'duo');
  for(let i=0;i<2;i++) {await play(ui,0,'A',-1);await command(ui,'advance');}
  check(!ui.$('idle-hint').hidden && ui.$('idle-hint').textContent.includes('席位 2连续 2 轮未确认'),'two consecutive misses are visibly identified');
  check(ui.$('idle-hint').textContent.includes('不代表已离线') && !ui.doc.querySelector('[data-actor="0"] .retreat').disabled,'idle reminder avoids false offline status and preserves retreat');
  await play(ui,0,'G',0);await play(ui,1,'A',-1);
  check(ui.$('idle-hint').hidden,'new confirmed action resets consecutive-miss reminder');
  check(ui.$('bgm').textContent==='BGM 关','BGM defaults off independently of SFX');
  ui.$('bgm').click();await tick();
  check(ui.$('bgm').getAttribute('aria-pressed')==='true' && soundStorage.get('gcr_bgm')==='1' && soundStorage.get('gcm_sound')==='0','BGM can enable while sound effects remain muted');
  ui.$('bgm').click();await tick();check(soundStorage.get('gcr_bgm')==='0','BGM can turn off without changing SFX preference');
  check(maxFlight===1,'one network request at a time');
  console.log(JSON.stringify({status:'PASS',checks:checks.length,post_requests:posts.length,max_in_flight:maxFlight}));
} finally {
  php.kill(); await new Promise(resolve=>php.once('exit',resolve)); fs.rmSync(sessions,{recursive:true,force:true});
}
