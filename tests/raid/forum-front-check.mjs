/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。DOM 子集 + 真 MariaDB/PHP 服务；不是浏览器布局或真论坛。 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import {Element} from '../gomoku/minidom.mjs';
let checks=0,posts=0,maxFlight=0;
const check=(x,n)=>{assert.ok(x,n);checks++;};
const tick=()=>new Promise(r=>setTimeout(r,2));
async function until(fn){for(let i=0;i<1500;i++){if(fn())return;await tick();}throw Error('timed out');}
Element.prototype.append=function(...nodes){nodes.forEach(n=>this.appendChild(n));};
Element.prototype.replaceChildren=function(...nodes){this.children.forEach(x=>x.parentElement=null);this.children=[];this._text='';this.append(...nodes);};
const query=Element.prototype.querySelectorAll;
Element.prototype.querySelectorAll=function(s){return [...new Set(s.split(',').flatMap(x=>query.call(this,x.trim())))];};
Object.defineProperty(Element.prototype,'classList',{get(){const e=this;return {contains:n=>e.className.split(' ').includes(n),add(...ns){e.className=[...new Set([...e.className.split(' ').filter(Boolean),...ns])].join(' ');},remove(...ns){e.className=e.className.split(' ').filter(n=>!ns.includes(n)).join(' ');}};}});
const workerFile=new URL('./db-worker.php',import.meta.url).pathname;
function worker(){const p=spawn(process.env.PHP_BIN||'php',[workerFile],{env:process.env,stdio:['pipe','pipe','inherit']});const queue=[];
 createInterface({input:p.stdout}).on('line',line=>{const job=queue.shift();try{const x=JSON.parse(line);x.test_error?job.reject(Error(line)):job.resolve(x);}catch(e){job.reject(e);}});
 p.on('close',c=>queue.forEach(job=>job.reject(Error('PHP exited '+c))));
 return {send(x){return new Promise((resolve,reject)=>{queue.push({resolve,reject});p.stdin.write(JSON.stringify(x)+'\n');});},close(){p.stdin.end();}};
}
const db=worker();const workers=[db];
const storage=new Map(),prefs=new Map();
const gameDir=new URL('../../source/plugin/gamecenter/games/raid/',import.meta.url);
function setup(uid){
 const w=worker();workers.push(w);
 const doc=new Element('document');doc.createElement=t=>new Element(t);doc.hidden=false;doc.activeElement=null;
 const stage=new Element('div');stage.dataset.url='plugin.php?id=gamecenter';stage.dataset.formhash='test-formhash';doc.append(stage);
 let boot;const timers=new Map();let counter=0,inFlight=0,drop=false,offline=false;const calls=[];
 const target=new Element('window');
 class Audio{constructor(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 const context={document:doc,window:{Audio,confirm:()=>true,localStorage:{getItem:k=>prefs.get(k)??null,setItem:(k,v)=>prefs.set(k,v)},addEventListener:(...a)=>target.addEventListener(...a)},
 GameCenter:{register:(key,fn)=>{check(key==='raid','SDK register raid');boot=fn;}},console,URL,Date,FormData,AbortController,Uint8Array,crypto:webcrypto,location:{href:'http://test.local/forum/plugin.php?id=gamecenter&mod=play&game=raid'},navigator:{clipboard:{writeText:async()=>{}}},
 matchMedia:()=>({matches:true}),setTimeout:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,
 sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 fetch:async(url,opts)=>{inFlight++;maxFlight=Math.max(maxFlight,inFlight);posts++;try{if(offline)throw Error('offline');const data=Object.fromEntries(opts.body.entries());calls.push(data);check(!('actor' in data)&&!('uid' in data),'no client actor/uid');const result=await w.send({uid,data});if(drop&&['create','join','act','retreat','cancel'].includes(data.action)){drop=false;throw Error('lost response');}return {ok:true,json:async()=>result};}finally{inFlight--;}}};
 for(const file of ['feedback.js','music.js','game.js'])vm.runInNewContext(readFileSync(new URL(file,gameDir),'utf8'),context,{filename:file});
 boot(stage,{uid});
 const $=id=>stage.querySelector(`[data-gcr="${id}"]`);
 return {doc,stage,$,calls,timers,storage,drop(){drop=true;},offline(v){offline=v;},async settled(){await until(()=>inFlight===0&&!$('sync').disabled);},async command(id){$(id).click();await this.settled();},async poll(){await this.command('sync');},async play(seat,kind,target=-1){const card=()=>stage.querySelector(`[data-actor="${seat}"]`);const btn=card().querySelector(`[data-kind="${kind}"]`);check(btn&&!btn.disabled,'own action available');btn.click();if(kind!=='attack'){const select=card().querySelector('select');select.value=String(target);select.dispatchEvent({type:'change'});}check(!card().querySelector('.confirm').disabled,'confirm enabled');card().querySelector('.confirm').click();await this.settled();},close(){target.dispatchEvent({type:'pagehide'});}};
}
try{
 await db.send({op:'init'});
 const a=setup(100),b=setup(101);await a.settled();await b.settled();
 check(a.$('battle').hidden&&!a.$('empty').hidden,'initial empty');
 await a.command('duo');
 check(!a.$('room-panel').hidden&&a.$('battle').hidden,'waiting room explicit');
 const code=new URL(a.$('invite').value).searchParams.get('room');
 check(/^[A-F0-9]{12}$/.test(code),'shareable invite contains code');
 check(a.$('solo').disabled,'active qualification blocks new create');
 b.$('join-code').value=a.$('invite').value;b.stage.querySelector('form').dispatchEvent({type:'submit',preventDefault(){}});await b.settled();
 await a.poll();
 check(a.$('players').children.length===2&&b.$('players').children.length===2,'both members rendered');
 check(a.stage.querySelector('[data-actor="0"] .confirm')&&!a.stage.querySelector('[data-actor="1"] .confirm'),'first account controls only own seat');
 check(b.stage.querySelector('[data-actor="1"] .confirm')&&!b.stage.querySelector('[data-actor="0"] .confirm'),'second account controls only own seat');
 await a.play(0,'attack');
 check(a.$('boss-hp').textContent==='130 / 130 生命','one confirmation no premature damage');
 const notice=a.$('message').textContent;await a.poll();check(a.$('message').textContent===notice,'poll preserves action acknowledgment');
 await b.poll();check(b.$('players').textContent.includes('已确认：攻击'),'partner sees locked intent '+b.$('players').textContent+' | '+b.$('connection').textContent+' | '+a.$('message').textContent);
 await b.play(1,'attack');await a.poll();
 check(a.$('boss-hp').textContent==='110 / 130 生命','cooperative round resolves once');
 check(a.$('players').textContent.includes('32 / 40')&&b.$('players').textContent.includes('32 / 40'),'authoritative HP shown');
 // Dropped write response: pending survives poll and reload, retries use the original ID.
 a.drop();await a.play(0,'heal',0);
 check(!a.$('retry-box').hidden,'unknown result exposes retry');const lost=a.calls.at(-1);
 await a.poll();check(!a.$('retry-box').hidden&&a.$('players').textContent.includes('已确认：恢复自己'),'sync shows accepted intent without discarding pending');
 const refreshed=setup(100);await refreshed.settled();check(!refreshed.$('retry-box').hidden,'pending restored under own UID');
 await refreshed.command('retry');const repeated=refreshed.calls.find(x=>x.action==='act');
 check(repeated.request_id===lost.request_id&&repeated.kind===lost.kind&&repeated.target===lost.target,'reload retry keeps full semantic request');
 check(refreshed.$('retry-box').hidden,'successful replay clears pending');
 await b.play(1,'attack');await refreshed.poll();check(refreshed.$('players').textContent.includes('恢复余 1 次'),'one healing charge after retry');
 // Finish remaining rounds following the independent fixture.
 const fixture=JSON.parse(readFileSync(new URL('../../docs/raid/P1-REFERENCE.json',import.meta.url)));
 const route=fixture.cases.duo_cover.expected.trace;
 // This room used a heal in round two, so use another pair to replay the exact fixed route.
 const c=setup(200),d=setup(201);await c.settled();await d.settled();await c.command('duo');
 d.$('join-code').value=c.$('invite').value;d.stage.querySelector('form').dispatchEvent({type:'submit',preventDefault(){}});await d.settled();await c.poll();
 for(const row of route){
   for(let i=0;i<2;i++){const ui=i===0?c:d;await ui.poll();const [k,t]=row.actions[i];await ui.play(i,{A:'attack',G:'guard',H:'heal'}[k],t);}
   await c.poll();check(c.$('boss-hp').textContent.startsWith(String(row.boss)+' /'),'fixture UI boss round '+row.round);
 }
 check(c.$('result-title').textContent==='讨伐成功','real cooperative service wins');
 check(c.$('boss-line').textContent==='这一次，算你们赢。下次可没这么轻松。','terminal quote');
 await c.command('history-refresh');check(c.$('recent-list').textContent.includes('双人 · 胜利 · 6 回合'),'history from DB');
 await c.command('solo');check(c.$('boss-hp').textContent==='120 / 120 生命','new solo after terminal');
 const solo=fixture.cases.solo_reasonable.expected.trace;
 for(const row of solo){const [k,t]=row.actions[0];await c.play(0,{A:'attack',G:'guard',H:'heal'}[k],t);}
 check(c.$('result-title').textContent==='讨伐成功'&&c.$('players').textContent.includes('14 / 40'),'solo 16-round fixture through controls');
 const e=setup(300);await e.settled();await e.command('duo');await e.command('cancel');check(e.$('room-note').textContent.includes('已取消'),'cancel waiting');
 await e.command('duo');
 const pollDelays=[...e.timers.values()].filter(t=>t.ms>=2000&&t.ms<10000);check(pollDelays.every(t=>t.ms>=2000),'normal polling at least two seconds');
 e.offline(true);await e.poll();check([...e.timers.values()].some(t=>t.ms>=4000&&t.ms<=4250),'failure backoff');
 e.doc.hidden=true;e.doc.dispatchEvent({type:'visibilitychange'});check(![...e.timers.values()].some(t=>t.ms>=2000&&t.ms<10000),'hidden stops polling');
 e.offline(false);e.doc.hidden=false;e.doc.dispatchEvent({type:'visibilitychange'});await e.settled();check(e.$('connection').textContent.includes('已连接论坛'),'visible immediately restores');
 const guest=setup(0);check(guest.$('solo').disabled&&guest.$('message').textContent.includes('登录论坛'),'guest can read but not start');
 check(maxFlight===1,'one transport per page in flight');
 check(a.stage.querySelectorAll('[data-gcr]').every(x=>!x.getAttribute('id')),'no generic document IDs');
 console.log(JSON.stringify({status:'PASS',checks,posts,maxFlight,coverage:'DOM subset + PHP service + MariaDB; browser layout not tested'}));
 for(const ui of [a,b,refreshed,c,d,e,guest])ui.close();
}finally{workers.forEach(w=>w.close());}
