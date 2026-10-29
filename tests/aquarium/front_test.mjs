/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。无浏览器DOM行为模型，不替代真实页面验收。 */
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../../source/plugin/gamecenter/games/aquarium/game.js',import.meta.url),'utf8');
let checks=0;
function check(x,m){checks++;assert.ok(x,m);}
class El{
 constructor(tag){this.tag=tag;this.textContent='';this.children=[];this.handlers={};this.disabled=false;}
 appendChild(x){this.children.push(x);return x;}
 replaceChildren(){this.children=[];}
 setAttribute(){}
 addEventListener(k,fn){this.handlers[k]=fn;}
 click(){if(!this.disabled)return this.handlers.click?.();}
}
const stage=new El('div');stage.dataset={url:'plugin.php?id=gamecenter',formhash:'fixture'};
const doc={hidden:false,createElement:tag=>new El(tag),handlers:{},addEventListener(k,fn){this.handlers[k]=fn;}};
const win={handlers:{},addEventListener(k,fn){this.handlers[k]=fn;}};
let register,queue=[],requests=[],timers=[];
vm.runInNewContext(code,{GameCenter:{register(k,fn){check(k==='aquarium','registration');register=fn;}},
 document:doc,window:win,FormData,setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},
 fetch(url,opts){requests.push({url,data:Object.fromEntries(opts.body.entries())});return new Promise((resolve,reject)=>queue.push({resolve,reject}));}});
const button=prefix=>stage.children.find(e=>e.tag==='button'&&e.textContent.startsWith(prefix));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const reply=async data=>{const q=queue.shift();assert.ok(q);q.resolve({ok:true,json:()=>Promise.resolve(data)});await flush();};
const snap=(version,level=0)=>({coins:122,rod_level:level,catch_seq:0,fish:{test_pond_a:{}},summary:null,version,
 current_water:'test_pond',unlocked_waters:['test_pond'],rules:{rod_costs:[0,120,260,600,900],waters:{test_pond:{},test_bay:{}}}});
register(stage,{uid:1,start(){throw Error('must not start a score game');}});
check(requests.length===1&&requests[0].data.action==='sync','initial state sync only');
await reply({ok:0,msg:'尚未建立',code:'uninitialized'});
button('建立').click();check(requests.at(-1).data.action==='init','explicit initialization');
await reply({ok:1,snapshot:snap(1),msg:'ok'});
check(requests.at(-1).data.action==='sync','successful init fetches latest state');
await reply({ok:1,snapshot:snap(1),msg:'ok'});
check(timers.at(-1).ms===45000,'quiet sync cadence');
button('升到').click();const before=requests.length;
check(requests.at(-1).data.target_level==='1'&&requests.at(-1).data.expected_version==='1','absolute intended level and original revision');
check(stage.children.filter(e=>e.tag==='button').every(e=>e.disabled),'busy disables all controls');
button('升到').click();check(requests.length===before,'double click no second request');
queue.shift().reject(Error('lost response'));await flush();
check(button('升到').disabled&&!button('同步').disabled,'unknown result requires read recovery');
check(requests.length===before,'no automatic purchase replay');
button('同步').click();await reply({ok:1,snapshot:snap(2,1),msg:'recovered'});
check(!button('升到').disabled&&button('升到').textContent.includes('Lv.2'),'recovery displays committed target');
const conflict=snap(3,1);conflict.summary={catch_count:3,coins:7};
button('升到').click();await reply({ok:0,code:'conflict',snapshot:conflict,msg:'状态已更新'});
check(stage.children.some(e=>e.tag==='details'&&!e.open),'persisted receipt is collapsed, not replayed');
check(requests.at(-1).data.action==='upgrade'&&requests.at(-1).data.expected_version==='2','conflict does not silently resend with new version');
doc.hidden=true;doc.handlers.visibilitychange();const hidden=requests.length;
check(requests.length===hidden,'hiding does not sync');
doc.hidden=false;doc.handlers.visibilitychange();await reply({ok:1,snapshot:snap(3,1)});
check(requests.at(-1).data.action==='sync','resume reads state only');
win.handlers.pagehide();const count=requests.length;button('同步').click();check(requests.length===count,'pagehide stops actions');
win.handlers.pageshow();await reply({ok:1,snapshot:snap(3,1)});check(requests.length===count+1,'bfcache resume works');
console.log(JSON.stringify({status:'PASS',checks,scope:'DOM model, not browser/Discuz'}));
