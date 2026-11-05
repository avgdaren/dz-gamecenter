/** 作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。当前异步 UI 的 DOM 模型；非浏览器/论坛。 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root = new URL('../../', import.meta.url);
const code=readFileSync(new URL('source/plugin/gamecenter/games/aquarium/game.js',root),'utf8');
let checks=0;
function check(x,m){checks++;assert.ok(x,m);}
class El {
  constructor(tag){
    this.tag=tag;this.children=[];this.handlers={};this.disabled=false;this.className='';this._text='';
    this.style={setProperty(){}};this.dataset={};
    this.classList={contains:k=>this.className.split(' ').includes(k),add:k=>this.classList.toggle(k,true),
      remove:k=>this.classList.toggle(k,false),toggle:(k,on)=>{
        const s=new Set(this.className.split(' ').filter(Boolean));
        if(on??!s.has(k))s.add(k);else s.delete(k);this.className=[...s].join(' ');
      }};
  }
  appendChild(x){this.children.push(x);x.parent=this;return x;}
  removeChild(x){this.children.splice(this.children.indexOf(x),1);x.parent=null;}
  remove(){this.parent?.removeChild(this);}
  get firstChild(){return this.children[0];} get childNodes(){return this.children;}
  set textContent(s){this._text=String(s);this.children=[];}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  setAttribute(k,v){this[k]=v;} addEventListener(k,fn){this.handlers[k]=fn;}
  click(){if(!this.disabled)return this.handlers.click?.({stopPropagation(){}});}
  querySelectorAll(sel){const nodes=this.children.flatMap(x=>[x,...x.querySelectorAll('*')]);
    return nodes.filter(x=>sel==='*'||(sel.startsWith('.')?x.classList.contains(sel.slice(1)):sel.startsWith('#')?x.id===sel.slice(1):x.tag===sel));}
  querySelector(sel){return this.querySelectorAll(sel)[0]??null;}
  getBoundingClientRect(){return {width:880,height:550,left:0,top:0};}
}
const stage=new El('div');stage.dataset={url:'plugin.php?id=gamecenter',formhash:'fixture'};
const body=new El('body');body.appendChild(stage);
const head=new El('head');head.appendChild=x=>{queueMicrotask(()=>x.onload());return x;};
const doc={hidden:false,head,body,createElement:tag=>new El(tag),createTextNode:text=>{const e=new El('#text');e.textContent=text;return e;},
  querySelector:sel=>body.querySelector(sel),getElementById:id=>body.querySelectorAll('*').find(e=>e.id===id),
  handlers:{},addEventListener(k,fn){this.handlers[k]=fn;}};
const win={handlers:{},addEventListener(k,fn){this.handlers[k]=fn;}};
let register,queue=[],requests=[],assets=[],timers=new Map(),timerId=0,intervals=[],clock=1700000000000;
class TestDate extends Date {static now(){return clock;}}
vm.runInNewContext(code,{GameCenter:{register(k,fn){check(k==='aquarium','registration');register=fn;}},
  document:doc,window:win,FormData,performance,console,Date:TestDate,requestAnimationFrame(){},setInterval(fn,ms){intervals.push({fn,ms});},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
  fetch(url,opts){
    if(!opts?.body){assets.push(url);return Promise.resolve({json:()=>Promise.resolve(JSON.parse(readFileSync(new URL(url.split('?')[0],root),'utf8')))});}
    requests.push({url,data:Object.fromEntries(opts.body.entries())});
    return new Promise((resolve,reject)=>queue.push({resolve,reject}));
  }});
const button=prefix=>stage.querySelectorAll('button').find(e=>e.textContent.startsWith(prefix));
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const reply=async data=>{const q=queue.shift();assert.ok(q,'pending API request');q.resolve({ok:true,json:()=>Promise.resolve(data)});await flush();};
const catalog={fish:[{id:'pond_blue',name:'彩鳞鱼',water:'pond',rarity:'常见',discovered:true,owned:1,shown:0}],decor:[{id:'trinket_crystal',name:'星晶花簇',owned:false,cost:1002,missing:{coins:2,pond_fish:0,total_fish:0,water:''}}],waters:{pond:'池塘'},book:{discovered:1,total:1}};
const snap=(version,level=0)=>({coins:1000,last_settled_ms:clock,rod_level:level,progress_ms:0,catch_seq:0,fish:{pond_blue:{catch_count:1,owned_count:1,sold_count:0}},summary:null,version,
  current_water:'pond',unlocked_waters:['pond'],fish_capacity:4,layout:{fish:[null,null,null,null],decor:{back:[],front:[]},background:'tank_day'},
  rules:{periods_ms:[120000,108000,96000],rod_costs:[0,120,260],waters:{pond:{}}}});
register(stage,{uid:1,start(){throw Error('must not start a score game');}});
check(requests.length===0,'waits for dependencies');await flush();
check(assets.length===4&&requests.length===1&&requests[0].data.action==='catalog','current startup loads assets and catalog');
await reply({ok:0,msg:'尚未建立',code:'uninitialized'});
button('建立').click();check(requests.at(-1).data.action==='init','explicit initialization');
await reply({ok:1,snapshot:snap(1),msg:'ok'});
check(requests.at(-1).data.action==='catalog','init immediately fetches catalog');
await reply({ok:1,snapshot:snap(1),catalog,msg:'ok'});
check([...timers.values()].some(t=>t.ms===45000),'quiet sync cadence');
button('升级鱼竿').click();const before=requests.length;
check(requests.at(-1).data.target_level==='1'&&requests.at(-1).data.expected_version==='1','absolute intended level and revision');
check(button('升级鱼竿').disabled,'busy disables upgrade');button('升级鱼竿').click();
check(requests.length===before,'double click no second request');
queue.shift().reject(Error('lost response'));await flush();
check(button('升级鱼竿').disabled&&button('同步'),'unknown result requires available read recovery');
check(requests.length===before,'no automatic purchase replay');
button('同步').click();await reply({ok:1,snapshot:snap(2,1),catalog,msg:'recovered'});
check(!button('升级鱼竿').disabled&&button('升级鱼竿').textContent.includes('Lv.2'),'recovery displays committed target');
button('升级鱼竿').click();await reply({ok:0,code:'conflict',snapshot:snap(3,1),msg:'状态已更新'});
check(requests.at(-1).data.action==='upgrade'&&requests.at(-1).data.expected_version==='2','conflict never automatically resends');
const hidden=requests.length;doc.hidden=true;doc.handlers.visibilitychange();
check(requests.length===hidden&&![...timers.values()].some(t=>t.ms===45000),'hidden clears sync timer');
doc.hidden=false;doc.handlers.visibilitychange();await reply({ok:1,snapshot:snap(3,1)});
check(requests.at(-1).data.action==='sync','resume reads state');
win.handlers.pagehide();const count=requests.length;button('同步').click();button('升级鱼竿').click();
check(requests.length===count,'pagehide stops all calls');
win.handlers.pageshow();await reply({ok:1,snapshot:snap(3,1)});
check(requests.length===count+1,'bfcache resume reads once');
// Regression: crossing the actual due time must sync without a user action.
const tick=intervals.find(x=>x.ms===1000).fn;
button('装饰').click();check(button('购买').disabled,'below-cost purchase initially disabled');
let requestCount=requests.length;
clock+=107900;tick();
check(requests.length===requestCount,'no premature settlement 100ms before due');
clock+=150;tick();
check(requests.length===requestCount+1&&requests.at(-1).data.action==='sync','crossed deadline syncs even after modulo would wrap');
tick();check(requests.length===requestCount+1,'busy deadline never duplicates request');
const settledAt=clock;
const earned={...snap(4,1),coins:1007};
await reply({ok:1,snapshot:earned});
check(doc.getElementById('aq-coins').textContent==='1,007','automatic sync paints authoritative earned coins');
check(!button('购买').disabled,'earned coins refresh purchase availability despite old catalog shortfall');
// A read-only snapshot must not restart the catch clock.
clock+=1000;button('同步').click();await reply({ok:1,snapshot:earned});
clock=settledAt+108100;tick();
check(requests.at(-1).data.action==='sync'&&queue.length===1,'unchanged snapshot preserves due time');
queue.shift().reject(Error('temporary offline'));await flush();
requestCount=requests.length;clock+=1000;tick();
check(requests.length===requestCount,'failed sync is throttled');
clock+=3000;tick();
check(requests.length===requestCount+1,'overdue sync retries after four seconds');
await reply({ok:1,snapshot:{...snap(5,1),coins:1009}});
requestCount=requests.length;clock+=400000;doc.hidden=true;tick();
check(requests.length===requestCount,'hidden countdown never makes a request');
doc.hidden=false;tick();
check(requests.length===requestCount+1,'late timer across several periods still syncs once');
await reply({ok:1,snapshot:{...snap(6,1),coins:1015}});
win.handlers.pagehide();clock+=400000;requestCount=requests.length;tick();
check(requests.length===requestCount,'stopped countdown never makes a request');
console.log(JSON.stringify({status:'PASS',checks,scope:'current asynchronous DOM model, not browser/Discuz'}));
