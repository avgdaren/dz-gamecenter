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
const callsToServer=[],receipts=new Map();
let roomNumber=0,joinOnCancel=false,createCount=0;
const w={send:async ({data})=>{
 callsToServer.push(data); if(failNetwork)throw Error('offline');
 if(receipts.has(data.request_id))return {ok:1,server_ms:now,snapshot,replayed:1};
 if(data.action==='cancel') {
   if(joinOnCancel) {joinOnCancel=false;snapshot=battle({room:snapshot.room});return {ok:0,code:'conflict',server_ms:now,snapshot};}
   if(snapshot.status!==0 || Number(data.expected_version)!==snapshot.version)return {ok:0,code:'conflict',server_ms:now,snapshot};
   snapshot={...snapshot,status:4,reason:'cancelled',version:snapshot.version+1};
 }
 if(data.action==='retreat'){snapshot=snapshot.mode==='solo'?{...snapshot,status:3,reason:'retreated',version:snapshot.version+1}:{...snapshot,leaving:[true,false],version:snapshot.version+1};}
 if(data.action==='create') {
   if(snapshot && snapshot.status<2&&!snapshot.left?.[snapshot.seat])return {ok:0,code:'active',server_ms:now,snapshot};
   const room=(0xABCDEF123456n+BigInt(roomNumber++)).toString(16).toUpperCase();
   snapshot=data.mode==='solo'?battle({room,mode:'solo',hp:[40],pots:[4],round_limit:18,rules_version:'raid-v3-solo110-p4-duo150-r18',left:[false],leaving:[false],intents:[null],players:[{name:'甲'}]}):{...waiting(),room};
   createCount++;
 }
 if(data.request_id)receipts.set(data.request_id,true);
 return {ok:1,server_ms:now,snapshot};
}};
const workers=[];
const storage=new Map(),prefs=new Map();
const audioInstances=[];
const gameDir=new URL('../../source/plugin/gamecenter/games/raid/',import.meta.url);
function setup(uid,suffix=''){

 const doc=new Element('document');doc.createElement=t=>new Element(t);doc.hidden=false;doc.activeElement=null;
 const stage=new Element('div');stage.dataset.url='plugin.php?id=gamecenter';stage.dataset.formhash='test-formhash';doc.append(stage);
 let answer=true;const confirmations=[];
 let boot;const timers=new Map();let counter=0,inFlight=0,drop=false,offline=false;const calls=[];
 const target=new Element('window');
 class Audio{constructor(){this.paused=true;audioInstances.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
 const context={document:doc,window:{Audio,confirm:text=>{confirmations.push(text);return answer;},localStorage:{getItem:k=>prefs.get(k)??null,setItem:(k,v)=>prefs.set(k,v)},addEventListener:(...a)=>target.addEventListener(...a)},
 GameCenter:{register:(key,fn)=>{check(key==='raid','SDK register raid');boot=fn;}},console,URL,Date,FormData,AbortController,Uint8Array,crypto:webcrypto,location:{href:'http://test.local/forum/plugin.php?id=gamecenter&mod=play&game=raid'+suffix},navigator:{clipboard:{writeText:async text=>{if(deniedClipboard)throw Error('denied');copied=text;}}},
 matchMedia:()=>({matches:false}),setTimeout:(fn,ms)=>{const id=++counter;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>0,
 sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 fetch:async(url,opts)=>{inFlight++;maxFlight=Math.max(maxFlight,inFlight);posts++;try{if(offline)throw Error('offline');const data=Object.fromEntries(opts.body.entries());calls.push(data);check(!('actor' in data)&&!('uid' in data)&&!('next_mode' in data),'no actor/uid/local continuation sent');const result=await w.send({uid,data});if(drop&&(drop===true||drop===data.action)&&['create','join','act','retreat','cancel'].includes(data.action)){drop=false;throw Error('lost response');}return {ok:true,json:async()=>result};}finally{inFlight--;}}};
 for(const file of ['feedback.js','music.js','game.js'])vm.runInNewContext(readFileSync(new URL(file,gameDir),'utf8'),context,{filename:file});
 boot(stage,{uid});
 const $=id=>stage.querySelector(`[data-gcr="${id}"]`);
 return {doc,stage,$,calls,timers,storage,drop(action=true){drop=action;},confirmations,answer(v){answer=v;},offline(v){offline=v;},async settled(){await until(()=>inFlight===0&&!$('current').disabled);},async command(id){$(id).click();await this.settled();},async poll(){await this.command('current');},async play(seat,kind,target=-1){const card=()=>stage.querySelector(`[data-actor="${seat}"]`);const btn=card().querySelector(`[data-kind="${kind}"]`);check(btn&&!btn.disabled,'own action available');btn.click();if(kind!=='attack'){const select=card().querySelector('select');select.value=String(target);select.dispatchEvent({type:'change'});}check(!card().querySelector('.confirm').disabled,'confirm enabled');card().querySelector('.confirm').click();await this.settled();},close(){target.dispatchEvent({type:'pagehide'});}};
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
await a.command('bgm');check(new URL(audioInstances.at(-1).src).pathname.endsWith('/battle.mp3'),'game selects phase one music');
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
check(new URL(audioInstances.at(-1).src).pathname.endsWith('/battle-phase2.mp3')&&audioInstances.length===1,'phase transition changes music without overlap');
check(a.$('phase-art').src.endsWith('assets/boss-phase2.webp'),'second phase asset requested');
a.$('phase-art').dispatchEvent({type:'load'});
check(a.stage.querySelector('.boss-art').classList.contains('phase-art-ready'),'loaded variation enables crossfade');
a.$('phase-art').dispatchEvent({type:'error'});
check(!a.stage.querySelector('.boss-art').classList.contains('phase-art-ready'),'failed variation preserves base portrait');
snapshot=battle({room:'111111111111',mode:'solo',version:1,hp:[40],pots:[3],left:[false],leaving:[false],intents:[null],players:[{name:'甲'}]});await a.poll();
check(a.$('boss-line').textContent==='凡人……你确定要独自挑战我吗？','solo opening line');
check(a.$('room-panel').hidden&&a.$('room-note').hidden&&a.$('join-code').hidden&&a.$('join').hidden,'solo combat hides all room controls');
check(new URL(audioInstances.at(-1).src).pathname.endsWith('/battle.mp3'),'new solo restores first track');
snapshot={...snapshot,status:3,reason:'knockout',version:2};await a.poll();
check(a.$('boss-line').textContent==='胜败乃兵家常事，少侠请重新来过','requested defeat quote');
check(a.$('room-panel').hidden&&a.$('join-code').hidden&&!a.$('solo').disabled,'solo terminal hides room controls and enables new attempt');
failNetwork=true;await a.poll();check(!a.$('connection').hidden&&a.$('connection').textContent.includes('连接中断'),'connection failure stays visible');
// Fresh entries must request phase-two art even if the battle has ended.
failNetwork=false;
for(const [index,[status,reason]] of [[1,''],[2,'defeated'],[3,'knockout'],[3,'retreated'],[3,'round_limit']].entries()) {
 snapshot=battle({status,reason,preview:{phase:2,kind:2,targets:[0],damage:28}});
 const fresh=setup(500+index);await fresh.settled();
 check(fresh.$('phase-art').src?.endsWith('boss-phase2.webp'),'fresh phase-two asset requested: '+reason);
 check(fresh.stage.querySelector('.arena').classList.contains('phase-two'),'fresh phase-two style: '+reason);
 fresh.$('phase-art').dispatchEvent({type:'load'});
 check(fresh.stage.querySelector('.boss-art').classList.contains('phase-art-ready'),'fresh phase-two loaded: '+reason);
 fresh.close();
}
// One-player waiting room can be replaced directly; cancel/create stay serial.
snapshot=waiting();const swap=setup(600);await swap.settled();
check(!swap.$('solo').disabled&&!swap.$('duo').disabled,'waiting modes remain directly clickable');
let start=callsToServer.length,created=createCount;
swap.$('solo').click();swap.$('duo').click();await swap.settled();
check(callsToServer.slice(start).map(x=>x.action).join(',')==='cancel,create','rapid mode clicks issue only one cancel/create chain');
check(snapshot.mode==='solo'&&createCount===created+1,'waiting to solo creates exactly once');
// Active battle is returned to, never cancelled by a mode click.
start=callsToServer.length;await swap.command('duo');
check(swap.$('solo').disabled&&swap.$('duo').disabled&&callsToServer.length===start,'mode entries disabled during active battle');
swap.answer(false);start=callsToServer.length;await swap.command('duo');check(callsToServer.length===start,'declining return sends no request');swap.answer(true);
// Lost cancellation response: reload and retry use the same cancel request and continuation.
snapshot=waiting();await swap.poll();start=callsToServer.length;created=createCount;swap.drop('cancel');await swap.command('solo');
const cancelled=callsToServer.at(-1);
check(!swap.$('retry-box').hidden&&createCount===created,'unknown cancellation cannot create early');
const resumed=setup(600);await resumed.settled();await resumed.command('retry');
const after=callsToServer.slice(start),retry=after.filter(x=>x.action==='cancel');
check(retry.length===2&&retry[0].request_id===retry[1].request_id,'cancel retry retains ID across reload');
check(snapshot.mode==='solo'&&createCount===created+1,'replayed cancel resumes desired mode once');
// Lost create response: retry that create, without cancelling again or creating twice.
snapshot=waiting();await resumed.poll();created=createCount;start=callsToServer.length;resumed.drop('create');await resumed.command('duo');
const lostCreate=callsToServer.at(-1);check(lostCreate.action==='create'&&!resumed.$('retry-box').hidden,'lost replacement create is retryable');
await resumed.command('retry');check(createCount===created+1&&callsToServer.at(-1).request_id===lostCreate.request_id,'create retry cannot duplicate room');
// A teammate joins between click and cancellation: no follow-up create or retreat.
snapshot=waiting();await resumed.poll();joinOnCancel=true;start=callsToServer.length;created=createCount;await resumed.command('solo');
check(snapshot.status===1&&createCount===created&&callsToServer.slice(start).map(x=>x.action).join(',')==='cancel','join/cancel conflict preserves active battle');
check(maxFlight===1,'all replacement chains keep one request per page in flight');

// Entry intent: clean lobby landing preserves the authoritative room pointer.
snapshot={...battle(),status:3,reason:'knockout'};
const entry=setup(801,'&fresh=1');await entry.settled();
check(!entry.$('empty').hidden&&entry.$('battle').hidden&&entry.$('result').hidden&&entry.$('boss-hp').textContent==='','fresh terminal lands idle with no old health/result');
check(!entry.$('solo').disabled&&!entry.$('duo').disabled&&entry.$('resume-prompt').hidden,'fresh terminal offers both modes without old-room prompt');
await entry.command('solo');check(snapshot.mode==='solo'&&snapshot.status===1,'fresh idle starts a real new solo');entry.close();
const existing=snapshot.room;
const ongoing=setup(802,'&fresh=1');await ongoing.settled();
check(!ongoing.$('resume-prompt').hidden&&ongoing.$('battle').hidden&&snapshot.room===existing,'fresh active pointer preserved with explicit choice');
ongoing.answer(false);start=callsToServer.length;await ongoing.command('restart');check(callsToServer.length===start&&snapshot.room===existing,'declining abandonment leaves room untouched');
await ongoing.command('resume');check(!ongoing.$('battle').hidden&&snapshot.room===existing,'continue restores original room');ongoing.close();
const abandon=setup(803,'&fresh=1');await abandon.settled();start=callsToServer.length;await abandon.command('restart');
check(callsToServer.slice(start).map(x=>x.action).join(',')==='retreat,create'&&snapshot.room!==existing,'explicit solo abandonment serializes retreat then create');abandon.close();
const refresh=setup(804);await refresh.settled();check(!refresh.$('battle').hidden&&refresh.$('resume-prompt').hidden,'no-fresh refresh keeps current battle');refresh.close();
const invite=setup(805,'&fresh=1&room=ABCDEF987654');await invite.settled();check(invite.calls[0].action==='state'&&invite.calls[0].room==='ABCDEF987654'&&invite.$('resume-prompt').hidden,'room takes precedence over fresh and requests exact room');invite.close();
snapshot={...snapshot,status:3,reason:'knockout',version:snapshot.version+1};const end=setup(806);await end.settled();
check(!end.$('result').hidden&&end.$('again').textContent.includes('再来一局'),'terminal card has primary new-game button');await end.command('again');check(snapshot.status===1&&snapshot.mode==='solo','terminal primary starts new game in one click');end.close();
snapshot=battle();const deferred=setup(807,'&fresh=1');await deferred.settled();start=callsToServer.length;const oldDuo=snapshot.room;
await deferred.command('restart');check(callsToServer.slice(start).map(x=>x.action).join(',')==='retreat'&&snapshot.room===oldDuo,'duo restart cannot create before deferred departure settles');deferred.close();
const resumedDuo=setup(807);await resumedDuo.settled();check(snapshot.room===oldDuo,'reload preserves deferred restart intent without early create');
snapshot={...snapshot,left:[true,false],leaving:[false,false],version:snapshot.version+1};await resumedDuo.poll();
check(snapshot.status===0&&snapshot.room!==oldDuo,'settled departure serially creates the chosen new room after reload');resumedDuo.close();
snapshot=null;const cta=setup(901,'&fresh=1');await cta.settled();
check(!cta.$('empty').hidden&&!cta.$('empty-start').disabled&&cta.$('empty-start').textContent==='开始游戏','idle has an enabled native primary start button');
start=callsToServer.length;cta.$('empty-start').click();cta.$('empty-start').click();await cta.settled();
check(callsToServer.slice(start).filter(x=>x.action==='create').length===1&&snapshot.mode==='solo'&&!cta.$('battle').hidden&&cta.$('round').textContent.includes('/ 18'),'one CTA click starts phase one; rapid repeats cannot duplicate create');cta.close();
const currentCTA=snapshot.room,resumeCTA=setup(902,'&fresh=1');await resumeCTA.settled();start=callsToServer.length;
check(resumeCTA.$('empty-start').textContent==='继续讨伐'&&resumeCTA.$('empty-duo').textContent==='放弃并开新局','active entry CTA describes continuing and explicit abandonment');
await resumeCTA.command('empty-start');check(snapshot.room===currentCTA&&!resumeCTA.$('battle').hidden&&!callsToServer.slice(start).some(x=>['retreat','create'].includes(x.action)),'continue CTA restores the room without abandoning or creating');resumeCTA.close();
snapshot={...snapshot,status:3,reason:'knockout',version:snapshot.version+1};const coopCTA=setup(903,'&fresh=1');await coopCTA.settled();await coopCTA.command('empty-duo');check(snapshot.mode==='duo'&&snapshot.status===0,'secondary idle CTA reuses duo room creation');coopCTA.close();
const guestCTA=setup(0,'&fresh=1');check(guestCTA.$('empty-start').disabled&&guestCTA.$('empty-duo').disabled,'guest CTAs are both disabled');guestCTA.close();
for(const [uid,mode,version,limit] of [[920,'solo','raid-v2-solo110-p4-duo150',16],[921,'solo','raid-v3-solo110-p4-duo150-r18',18],[922,'duo','raid-v3-solo110-p4-duo150-r18',16]]){
 snapshot=battle({mode,rules_version:version,round_limit:limit});const limits=setup(uid);await limits.settled();
 check(limits.$('round').textContent.endsWith('/ '+limit),'round label follows room cap '+version+'/'+mode);
 check(limits.$('round-rules').textContent.includes('本局最多 '+limit+' 轮'),'rule text follows room cap');
 snapshot={...snapshot,status:3,reason:'round_limit',version:snapshot.version+1};await limits.poll();
 check(limits.$('result-text').textContent.startsWith(limit+' 回合已用尽'),'terminal text follows room cap');limits.close();
}
snapshot=battle({round_limit:18,mode:'solo',preview:{phase:2,kind:2,targets:[0],damage:28}});const guide=setup(930);await guide.settled();
check(guide.$('preview-name').textContent.startsWith('⚠ 重击')&&guide.stage.querySelector('.forecast').classList.contains('is-heavy'),'heavy forecast has an explicit warning and bad-color border hook');
check(guide.$('preview-text').textContent.includes('28 伤害')&&guide.$('preview-text').textContent.includes('守护后为 6'),'guidance leaves authoritative damage numbers unchanged');
snapshot={...snapshot,version:snapshot.version+1,preview:{phase:2,kind:3,targets:[],damage:0}};await guide.poll();
check(guide.$('preview-text').textContent.startsWith('本轮回气，可全力进攻')&&!guide.stage.querySelector('.forecast').classList.contains('is-heavy'),'rest turn gives a clear attack opportunity and clears heavy border');
snapshot={...snapshot,version:snapshot.version+1,preview:{phase:2,kind:0,targets:[0],damage:10}};await guide.poll();
check(!guide.$('preview-name').textContent.includes('⚠')&&!guide.$('preview-text').textContent.includes('全力进攻'),'ordinary turns add no warning or rest badge');
snapshot={...snapshot,version:snapshot.version+1,status:3,reason:'knockout',preview:{phase:2,kind:2,targets:[0],damage:28}};await guide.poll();
check(!guide.$('preview-name').textContent.includes('⚠')&&!guide.stage.querySelector('.forecast').classList.contains('is-heavy'),'terminal state does not prompt a new defensive action');guide.close();
console.log(JSON.stringify({status:'PASS',checks,scope:'scripted transport + MiniDOM; not browser or PHP'}));
