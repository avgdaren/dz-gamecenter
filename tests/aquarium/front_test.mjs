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
    return nodes.filter(x=>sel==='*'||(sel.startsWith('.')?x.classList.contains(sel.slice(1)):x.tag===sel));}
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
let register,queue=[],requests=[],assets=[],timers=new Map(),timerId=0;
vm.runInNewContext(code,{GameCenter:{register(k,fn){check(k==='aquarium','registration');register=fn;}},
  document:doc,window:win,FormData,performance,console,requestAnimationFrame(){},setInterval(){},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id);},
  fetch(url,opts){
    if(!opts?.body){assets.push(url);return Promise.resolve({json:()=>Promise.resolve(JSON.parse(readFileSync(new URL(url.split('?')[0],root),'utf8')))});}
    requests.push({url,data:Object.fromEntries(opts.body.entries())});
    return new Promise((resolve,reject)=>queue.push({resolve,reject}));
  }});
const button=prefix=>stage.querySelectorAll('button').find(e=>e.textContent.startsWith(prefix));
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const reply=async data=>{const q=queue.shift();assert.ok(q,'pending API request');q.resolve({ok:true,json:()=>Promise.resolve(data)});await flush();};
const catalog={fish:[{id:'pond_blue',name:'彩鳞鱼',water:'pond',rarity:'常见',discovered:true,owned:1,shown:0}],decor:[],waters:{pond:'池塘'},book:{discovered:1,total:1}};
const snap=(version,level=0)=>({coins:1000,rod_level:level,progress_ms:0,catch_seq:0,fish:{pond_blue:{catch_count:1,owned_count:1,sold_count:0}},summary:null,version,
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
console.log(JSON.stringify({status:'PASS',checks,scope:'current asynchronous DOM model, not browser/Discuz'}));
