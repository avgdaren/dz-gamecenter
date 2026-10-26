/** 作者：GPT / Codex。离线 DOM/网络状态测试；不声称浏览器或论坛实测。 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {webcrypto} from 'node:crypto';
import {Element} from './minidom.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url));
const sdk=readFileSync(path.join(dir,'../../source/plugin/gamecenter/static/gc.js'),'utf8');
const game=readFileSync(path.join(dir,'../../source/plugin/gamecenter/games/gomoku/game.js'),'utf8');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function snapshot(now){return {code:'ABCDEF123456',board:'0'.repeat(225),black_uid:1,white_uid:2,black_name:'黑方',white_name:'白方',status:1,turn:1,version:2,deadline_ms:now+60000,winner:0,reason:'',last_cell:-1};}
function setup(options={}){
 let now=1000000,nextId=1;const timers=new Map();
 const document=new Element('document');document.hidden=false;document.readyState='complete';
 document.createElement=tag=>new Element(tag);document.getElementById=id=>document.querySelector('#'+id);
 document.innerHTML='<div id="gc-stage" data-game="gomoku" data-url="http://test.local/plugin.php?id=gamecenter" data-formhash="test" data-uid="'+(options.guest?0:1)+'" data-best="" data-rivals="[]"></div>';
 const stage=document.getElementById('gc-stage');const calls=[];const writes=new Map();
 let room=options.empty?null:snapshot(now),inflight=0,maxInflight=0,deferred=null;
 const controls={failCurrent:!!options.failCurrent,loseWrite:!!options.loseWrite,deny:!!options.deny,defer:!!options.defer};
 function result(data){
  if(controls.deny)return {ok:0,code:'permission',msg:'请刷新页面重新确认权限',server_ms:now};
  if(data.action==='history')return {ok:1,server_ms:now,history:[],room:null};
  if(data.action==='create'){
   if(!writes.has(data.request_id)){room=snapshot(now);room.status=0;room.white_uid=0;room.white_name='';room.version=1;writes.set(data.request_id,true);}
  }else if(data.action==='join'){
   if(!room){room=snapshot(now);room.black_uid=2;room.white_uid=1;}
  }else if(data.action==='move'&&!writes.has(data.request_id)){
   if(+data.version!==room.version)return {ok:0,code:'conflict',room:{...room},server_ms:now,msg:'局面已更新'};
   const b=room.board.split('');b[+data.cell]='1';room.board=b.join('');room.turn=2;room.version++;room.last_cell=+data.cell;writes.set(data.request_id,true);
  }else if(data.action==='resign'&&!writes.has(data.request_id)){
   room.status=2;room.winner=2;room.reason='resign';room.version++;writes.set(data.request_id,true);
  }
  return {ok:1,room:room?{...room}:null,server_ms:now};
 }
 function timer(fn,ms,interval=0){const id=nextId++;timers.set(id,{fn,time:now+ms,interval});return id;}
 const ctx={document,location:{href:'http://test.local/plugin.php?id=gamecenter&game=gomoku&mod=play'},navigator:{userAgent:'test',clipboard:{writeText:async()=>{}}},crypto:webcrypto,URL,Uint8Array,AbortController,
  Date:class extends Date{static now(){return now;}},Math:Object.assign(Object.create(Math),{random:()=>0}),innerHeight:1000,
  FormData:class{constructor(){this.fields=[];}append(k,v){this.fields.push([k,String(v)]);}},
  setTimeout:(fn,ms)=>timer(fn,ms),clearTimeout:id=>timers.delete(id),setInterval:(fn,ms)=>timer(fn,ms,ms),clearInterval:id=>timers.delete(id),
  fetch(url,request){
   assert.equal(new URL(url).searchParams.get('op'),'room');const data=Object.fromEntries(request.body.fields);assert.equal(data.formhash,'test');calls.push(data);
   inflight++;maxInflight=Math.max(inflight,maxInflight);
   let promise;
   if(controls.defer){promise=new Promise((resolve,reject)=>{deferred={resolve:()=>resolve(result(data)),reject};request.signal.addEventListener('abort',()=>reject(Error('abort')));});}
   else if(controls.failCurrent&&data.action==='current'){controls.failCurrent=false;promise=Promise.reject(Error('network'));}
   else {const reply=result(data);if(controls.loseWrite&&['move','create','join','resign'].includes(data.action)){controls.loseWrite=false;promise=Promise.reject(Error('lost ack'));}else promise=Promise.resolve(reply);}
   return promise.then(reply=>({ok:true,json:()=>Promise.resolve(reply)})).finally(()=>inflight--);
  }};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(sdk,ctx);vm.runInContext(game,ctx);
 const root=stage.querySelector('.gcg');
 return {root,calls,controls,server:()=>room,setServer:r=>room=r,maxInflight:()=>maxInflight,
  async ready(){await flush();},async click(selector){root.querySelector(selector).click();await flush();},
  async tick(ms){const until=now+ms;for(;;){const job=[...timers].filter(([,v])=>v.time<=until).sort((a,b)=>a[1].time-b[1].time)[0];if(!job)break;timers.delete(job[0]);now=job[1].time;job[1].fn();if(job[1].interval)timers.set(job[0],{...job[1],time:now+job[1].interval});await flush();}now=until;await flush();},
  async hidden(value){document.hidden=value;document.dispatchEvent({type:'visibilitychange'});await flush();},
  async join(code){root.querySelector('form input').value=code;root.querySelector('form').dispatchEvent({type:'submit',preventDefault(){}});await flush();},
  async release(){controls.defer=false;deferred.resolve();await flush();},
  activeTimers:()=>[...timers.values()].map(t=>t.time-now)
 };
}
let checks=0;const check=(value,name)=>{assert.ok(value,name);checks++;};
let t=setup();await t.ready();check(t.calls.length===1&&t.calls[0].action==='current','restore at boot');
check(t.root.querySelectorAll('.gcg-cell').length===225,'full board');
await t.click('[data-cell="112"]');check(t.calls.length===1,'selection does not submit');
check(t.root.querySelector('[data-action=move]').disabled===false,'confirmation enabled');
await t.click('[data-action=move]');check(t.server().board[112]==='1','confirmed move sent');
check(t.root.querySelectorAll('.black').length===1,'render server board');
await t.click('[data-cell="113"]');await t.click('[data-action=move]');check(t.calls.filter(c=>c.action==='move').length===1,'opponent turn blocks move');
await t.tick(1999);check(t.calls.length===2,'no sub-1.5s polling');await t.tick(1);check(t.calls.at(-1).action==='state','2-second poll');
await t.hidden(true);const count=t.calls.length;await t.tick(10000);check(t.calls.length===count,'hidden stops poll');
await t.hidden(false);check(t.calls.length===count+1,'visible synchronizes immediately');check(t.maxInflight()===1,'one request at a time');
const ended={...t.server(),status:2,winner:2,reason:'timeout'};t.setServer(ended);await t.tick(2000);check(t.root.querySelector('.gcg-status').textContent.includes('对方获胜'),'server-only outcome');

t=setup({loseWrite:true});await t.ready();await t.click('[data-cell="112"]');await t.click('[data-action=move]');
check(!t.root.querySelector('.gcg-retry').hidden,'lost ack prompts retry');
await t.tick(4000);check(t.server().version===3,'poll sees authoritative result');
await t.click('[data-action=retry]');const moves=t.calls.filter(c=>c.action==='move');
check(moves.length===2&&moves[0].request_id===moves[1].request_id&&moves[0].version===moves[1].version,'retry same ID and version');
check(t.server().version===3&&t.root.querySelector('.gcg-retry').hidden,'no duplicate mutation');

t=setup({empty:true,loseWrite:true});await t.ready();await t.click('[data-action=create]');check(!t.root.querySelector('.gcg-retry').hidden,'create uncertain');
await t.click('[data-action=retry]');check(t.calls.filter(c=>c.action==='create')[0].request_id===t.calls.filter(c=>c.action==='create')[1].request_id,'idempotent create retry');
check(t.server().status===0,'waiting restored');

t=setup({empty:true});await t.ready();await t.join('ABCDEF123456');check(t.server().white_uid===1,'explicit join');
await t.click('[data-action=resign]');check(t.server().status===1,'resign asks inline confirmation');
await t.click('[data-action=confirm-resign]');check(t.server().status===2,'resign request');

t=setup({failCurrent:true});await t.ready();check(t.calls.length===1,'initial failure');await t.tick(3999);check(t.calls.length===1,'error backoff');await t.tick(1);check(t.calls.length===2,'initial recovery without known room');
t=setup({defer:true});await t.ready();await t.click('[data-action=create]');await t.hidden(true);await t.hidden(false);check(t.calls.length===1,'busy blocks overlapping actions and resume');await t.release();check(t.maxInflight()===1,'deferred max inflight');
t=setup({deny:true});await t.ready();check(t.root.querySelector('[data-action=create]').disabled,'permission loss disables writes');await t.tick(10000);check(t.calls.length===1,'permission loss stops polling');
t=setup({guest:true});await t.ready();check(t.calls.length===0&&t.root.querySelector('[data-action=create]').disabled,'guest never calls room API');
console.log(`PASS front state: ${checks} checks; DOM/network simulated, actual SDK/game source. No browser/Discuz claim.`);
