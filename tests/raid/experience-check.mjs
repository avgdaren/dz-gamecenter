/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。7 条体验反馈回归：脚本化响应 + DOM 子集；不是浏览器布局或真论坛。 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
// Scripted transport: checks rendering and requests, not PHP/database behavior.
let snapshot=null, now=1000, deniedClipboard=false, copied='', failNetwork=false;
const callsToServer=[];
const w={send:async ({data})=>{
 callsToServer.push(data); if(failNetwork)throw Error('offline');
 if(data.action==='create') snapshot=waiting();
 return {ok:1,server_ms:now,snapshot};
}};
const workers=[];
const storage=new Map(),prefs=new Map();
const gameDir=new URL('../../source/plugin/gamecenter/games/raid/',import.meta.url);
function setup(uid){

 const doc=new Element('document');doc.createElement=t=>new Element(t);doc.hidden=false;doc.activeElement=null;
 const stage=new Element('div');stage.dataset.url='plugin.php?id=gamecenter';stage.dataset.formhash='test-formhash';doc.append(stage);
 let boot;const timers=new Map();let counter=0,inFlight=0,drop=false,offline=false;const calls=[];
 const target=new Element('window');
 class Audio{constructor(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 const context={document:doc,window:{Audio,confirm:()=>true,localStorage:{getItem:k=>prefs.get(k)??null,setItem:(k,v)=>prefs.set(k,v)},addEventListener:(...a)=>target.addEventListener(...a)},
 GameCenter:{register:(key,fn)=>{check(key==='raid','SDK register raid');boot=fn;}},console,URL,Date,FormData,AbortController,Uint8Array,crypto:webcrypto,location:{href:'http://test.local/forum/plugin.php?id=gamecenter&mod=play&game=raid'},navigator:{clipboard:{writeText:async text=>{if(deniedClipboard)throw Error('denied');copied=text;}}},
 matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,
 sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 fetch:async(url,opts)=>{inFlight++;maxFlight=Math.max(maxFlight,inFlight);posts++;try{if(offline)throw Error('offline');const data=Object.fromEntries(opts.body.entries());calls.push(data);check(!('actor' in data)&&!('uid' in data),'no client actor/uid');const result=await w.send({uid,data});if(drop&&['create','join','act','retreat','cancel'].includes(data.action)){drop=false;throw Error('lost response');}return {ok:true,json:async()=>result};}finally{inFlight--;}}};
 for(const file of ['feedback.js','music.js','game.js'])vm.runInNewContext(readFileSync(new URL(file,gameDir),'utf8'),context,{filename:file});
 boot(stage,{uid});
 const $=id=>stage.querySelector(`[data-gcr="${id}"]`);
 return {doc,stage,$,calls,timers,storage,drop(){drop=true;},offline(v){offline=v;},async settled(){await until(()=>inFlight===0&&!$('current').disabled);},async command(id){$(id).click();await this.settled();},async poll(){await this.command('current');},async play(seat,kind,target=-1){const card=()=>stage.querySelector(`[data-actor="${seat}"]`);const btn=card().querySelector(`[data-kind="${kind}"]`);check(btn&&!btn.disabled,'own action available');btn.click();if(kind!=='attack'){const select=card().querySelector('select');select.value=String(target);select.dispatchEvent({type:'change'});}check(!card().querySelector('.confirm').disabled,'confirm enabled');card().querySelector('.confirm').click();await this.settled();},close(){target.dispatchEvent({type:'pagehide'});}};
}
Element.prototype.select=function(){this.selected=true;};
const waiting=()=>({room:'ABCDEF123456',status:0,reason:'',seat:0,version:1,mode:'duo',deadline_ms:299000,
 hp:[40],left:[false],leaving:[false],intents:[null],players:[{name:'甲'}],pots:[2],history:[]});
const battle=(extra={})=>({...waiting(),status:1,version:2,round_no:1,boss:130,boss_max_hp:130,
 hp:[40,40],left:[false,false],leaving:[false,false],intents:[null,null],players:[{name:'甲'},{name:'乙'}],pots:[2,2],
 exposed:false,preview:{phase:1,kind:0,targets:[0,1],damage:8},...extra});
const a=setup(100);await a.settled();
check(!a.$('sync'),'manual sync absent');
check(a.$('connection').hidden,'successful connection hidden');
await a.command('duo');
check(a.$('room-code').value==='ABCDEF123456','room code displayed');
check(a.$('room-note').textContent.includes('4:58'),'waiting countdown uses minutes and seconds');
check(a.$('invite').getAttribute('type')==='hidden','raw invitation hidden');
await a.command('copy-code');check(copied==='ABCDEF123456','copy room code');
await a.command('copy');check(new URL(copied).searchParams.get('room')===snapshot.room,'copy invitation URL');
deniedClipboard=true;await a.command('copy');check(a.$('invite').selected&&a.$('invite').type==='text','clipboard failure offers selectable URL');
snapshot={...waiting(),status:4,reason:'expired',version:2};await a.poll();
check(a.$('room-note').textContent==='邀请已过期，重新建房'&&!a.$('reopen').hidden,'expiry has clear restart');
await a.command('reopen');check(snapshot.status===0&&callsToServer.at(-1).action==='create','restart creates one room');
snapshot=battle();await a.poll();
check(a.$('boss-line').textContent==='人数对于我来说，并没有区别','duo opening line');
check(a.$('players').textContent.includes('你')&&a.$('players').textContent.includes('队友'),'player language');
check(a.stage.querySelector('[data-actor="0"] .confirm')&&!a.stage.querySelector('[data-actor="1"] .confirm'),'only own controls');
const row={round:1,boss:110,hp:[32,32],heals:[0,0],pots:[2,2],defaults:[],actions:[{kind:'attack',target:-1},{kind:'attack',target:-1}],exposed:false,preview:snapshot.preview};
snapshot=battle({version:3,round_no:2,boss:110,hp:[32,32],history:[row]});await a.poll();
check(a.$('logs').children[0].children.length===2,'journal uses two text blocks');
check(a.$('logs').textContent.includes('幽月 −20')&&a.$('logs').textContent.includes('你 → 攻击 ｜ 队友 → 攻击'),'compact relative battle record');
check(a.$('boss-effects').children.some(n=>n.textContent==='−20'),'boss damage floats at health bar');
snapshot=battle({version:4,round_no:3,boss:60,preview:{phase:2,kind:2,targets:[0],damage:30},history:[row]});await a.poll();
check(a.stage.querySelector('.arena').classList.contains('phase-two')&&!a.$('phase-banner').hidden,'phase appearance and banner persist');
check(a.$('boss-line').textContent==='你们这群蝼蚁！','duo second phase line');
snapshot=battle({room:'111111111111',mode:'solo',version:1,hp:[40],pots:[3],left:[false],leaving:[false],intents:[null],players:[{name:'甲'}]});await a.poll();
check(a.$('boss-line').textContent==='凡人……你确定要独自挑战我吗？','solo opening line');
failNetwork=true;await a.poll();check(!a.$('connection').hidden&&a.$('connection').textContent.includes('连接中断'),'connection failure stays visible');
console.log(JSON.stringify({status:'PASS',checks,scope:'scripted transport + MiniDOM; not browser or PHP'}));
