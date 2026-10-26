/**
 * 作者：GPT / Codex。真实 SDK + 游戏 + PHP 校验器的离线状态测试。
 * MiniDOM 只模拟本游戏用到的 DOM，不代替浏览器布局/触控/键盘或 Discuz 验收。
 * 无 npm 包；从现有平台读取 SDK，不修改 SDK。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const php = process.env.PHP_BIN || 'php';
const sdk = readFileSync(path.join(dir, '../../../static/gc.js'), 'utf8');
const game = readFileSync(path.join(dir, '../game.js'), 'utf8');
function rpc(request) {
  return JSON.parse(execFileSync(php, ['-n', path.join(dir, 'verify-cli.php')], {
    input: JSON.stringify([request]), encoding: 'utf8'
  }))[0];
}
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, c => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[c]));
class Element {
  constructor(tag) { this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.listeners={};this.parentElement=null;this.disabled=false;this._text=''; }
  setAttribute(name,value) {this.attrs[name]=String(value);}
  getAttribute(name) {return this.attrs[name]??null;}
  get className(){return this.attrs.class||'';}
  set className(value){this.attrs.class=value;}
  get classList(){const self=this;return {contains:n=>self.className.split(' ').includes(n),toggle(n,on){const a=new Set(self.className.split(' ').filter(Boolean));const add=on??!a.has(n);if(add)a.add(n);else a.delete(n);self.className=[...a].join(' ');}};}
  get dataset(){const self=this;return new Proxy({}, {get:(_,key)=>self.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))??undefined,set:(_,key,value)=>{self.setAttribute('data-'+key,value);return true;}});}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  get firstElementChild(){return this.children[0]||null;}
  appendChild(child){child.remove();child.parentElement=this;this.children.push(child);return child;}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}}
  set innerHTML(html){
    this.children=[];this._text='';const stack=[this];
    for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){
      if(token.startsWith('</')){stack.pop();continue;}
      if(token.startsWith('<')){
        const match=/^<([\w-]+)/.exec(token);if(!match)continue;
        const el=new Element(match[1]);
        for(const m of token.slice(match[0].length).matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)){
          el.setAttribute(m[1],decode(m[2]??m[3]??''));
          if(m[1]==='disabled')el.disabled=true;
        }
        el.hidden=el.getAttribute('hidden')!==null;el.style={};stack.at(-1).appendChild(el);
        if(!token.endsWith('/>')&&!['INPUT','BR','IMG','LINK','META'].includes(el.tagName))stack.push(el);
      }else stack.at(-1)._text+=decode(token);
    }
  }
  matches(selector){
    const tag=/^[\w-]+/.exec(selector);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
    const id=/#([\w-]+)/.exec(selector);if(id&&this.getAttribute('id')!==id[1])return false;
    for(const m of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;
    for(const m of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g))if(m[2]===undefined?this.getAttribute(m[1])===null:this.getAttribute(m[1])!==m[2])return false;
    return true;
  }
  querySelectorAll(selector){
    const parts=selector.trim().split(/\s+/),out=[];
    const visit=el=>{for(const child of el.children){let yes=child.matches(parts.at(-1));let ancestor=child.parentElement;
      for(let n=parts.length-2;n>=0&&yes;n--){while(ancestor&&!ancestor.matches(parts[n]))ancestor=ancestor.parentElement;if(!ancestor)yes=false;else ancestor=ancestor.parentElement;}
      if(yes)out.push(child);visit(child);}};visit(this);return out;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let el=this;el;el=el.parentElement)if(el.matches(selector))return el;return null;}
  contains(other){for(let el=other;el;el=el.parentElement)if(el===this)return true;return false;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  click(){if(this.disabled)return;const event={type:'click',target:this,preventDefault(){}};for(let el=this;el;el=el.parentElement)el.dispatchEvent(event);}
  focus(){}
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function setup(options={}){
  let now=0,nextTimer=1;const timers=new Map();
  const document=new Element('document');document.readyState='complete';document.hidden=false;
  document.createElement=tag=>new Element(tag);document.getElementById=id=>document.querySelector('#'+id);
  document.innerHTML='<div id="gc-stage" data-url="http://test.local/plugin.php?id=gamecenter" data-game="memory" data-formhash="test" data-unit="次" data-best="" data-uid="5" data-rivals="[]"></div><div id="gc-boards"></div>';
  const stage=document.getElementById('gc-stage');
  const log={starts:0,submits:[],boards:0,best:null,pendingStart:null};const tokens=new Map();
  const ctx={document,navigator:{userAgent:'test'},innerHeight:900,performance:{now:()=>now},
    FormData:class {constructor(){this.fields=[];}append(k,v){this.fields.push([k,String(v)]);}},
    setTimeout(fn,ms){const id=nextTimer++;timers.set(id,{fn,time:now+ms});return id;},clearTimeout(id){timers.delete(id);},
    fetch(url,request){const op=new URL(url).searchParams.get('op');
      if(op==='board'){log.boards++;return Promise.resolve({text:()=>Promise.resolve('<div>boards refreshed</div>')});}
      const fields=Object.fromEntries(request.body.fields);assert.equal(fields.formhash,'test');
      if(op==='start'){
        log.starts++;const seed=(options.seeds||[1])[(log.starts-1)%(options.seeds||[1]).length];const token='test-'+log.starts;tokens.set(token,seed);
        const reply=options.failStart&&log.starts===1?{ok:0,msg:'start rejected'}:{ok:1,guest:options.guest?1:0,seed:options.invalidSeed?0:seed,token};
        if(options.deferStart)return new Promise(resolve=>{log.pendingStart=()=>resolve({json:()=>Promise.resolve(reply)});});
        return Promise.resolve({json:()=>Promise.resolve(reply)});
      }
      assert.equal(op,'submit');log.submits.push(fields);
      const data={};for(const [key,value]of Object.entries(fields)){const m=/^d\[(.+)\]$/.exec(key);if(m)data[m[1]]=value;}
      const result=rpc({seed:tokens.get(fields.token),data});assert.equal(result.ok,1,JSON.stringify(result));
      log.best=log.best===null?result.score:Math.min(log.best,result.score);
      if(options.networkFailure)return Promise.reject(new Error('network'));
      return Promise.resolve({json:()=>Promise.resolve(options.rejectSubmit?{ok:0,msg:'submit rejected'}:{ok:1,score:result.score,best:log.best,newbest:1,rank:1,reward:0,rivals:[]})});
    }};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(sdk,ctx);vm.runInContext(game,ctx);
  const root=stage.querySelector('.gcm');
  return {log,stage,root,
    phase:()=>root.getAttribute('data-phase'),cards:()=>root.querySelectorAll('.gcm-card'),
    deck:()=>root.querySelectorAll('.gcm-card').map(x=>+x.getAttribute('data-symbol')),
    async click(selector){root.querySelector(selector).click();await flush();},
    async flip(indices){for(const index of indices)root.querySelectorAll('.gcm-card')[index].click();await flush();},
    async start(){root.querySelector('[data-action=start]').click();await flush();},
    async close(){stage.querySelector('.gc-modal button').click();await flush();},
    async tick(ms){const until=now+ms;for(;;){const job=[...timers].filter(([,t])=>t.time<=until).sort((a,b)=>a[1].time-b[1].time)[0];if(!job)break;timers.delete(job[0]);now=job[1].time;job[1].fn();await flush();}now=until;await flush();},
    async hidden(value){document.hidden=value;document.dispatchEvent({type:'visibilitychange'});await flush();}
  };
}
const pairs=deck=>Array.from({length:8},(_,value)=>deck.flatMap((v,i)=>v===value?[i]:[]));
const open=t=>t.root.querySelectorAll('.is-open').length;
const count=(t,name)=>t.root.querySelector('[data-stat='+name+']').textContent;
let groups=0;
const seeds=[1,2,42,123456789,2147483645,2147483646,99,123,98765,20261026];
let t=setup({seeds});
for(let round=0;round<10;round++){
  await t.start();assert.equal(t.phase(),'playing');assert.deepEqual(t.deck(),rpc({op:'deck',seed:seeds[round]}));assert.equal(open(t),0);
  const ps=pairs(t.deck());assert.ok(t.cards()[0].getAttribute('aria-label').includes('未翻开'));
  await t.flip([ps[0][0],ps[0][0]]);assert.equal(count(t,'attempts'),'0');
  await t.flip([ps[0][1],...ps.slice(1).flat(),0,1]);assert.equal(t.phase(),'finished');
  assert.equal(t.log.submits.length,round+1);assert.equal(t.log.submits[round]['d[score]'],'8');assert.equal(count(t,'best'),'8');
  await t.start();assert.equal(t.log.starts,round+1);await t.close();
}
assert.equal(t.log.boards,10);groups++;
t=setup({deferStart:true});await t.start();await t.start();assert.equal(t.log.starts,1);assert.equal(t.phase(),'starting');t.log.pendingStart();await flush();assert.equal(t.phase(),'playing');groups++;

t=setup();await t.start();const mismatch=[0,t.deck().findIndex(v=>v!==t.deck()[0])];
await t.flip([...mismatch,2]);assert.equal(t.phase(),'resolving');assert.equal(open(t),2);assert.equal(count(t,'attempts'),'1');
await t.tick(200);await t.click('[data-action=pause]');await t.tick(2000);assert.equal(open(t),2);
await t.click('[data-action=resume]');await t.tick(499);assert.equal(open(t),2);await t.tick(1);assert.equal(open(t),0);
await t.flip(mismatch);await t.tick(200);await t.hidden(true);await t.tick(2000);assert.equal(open(t),2);
await t.hidden(false);await t.tick(499);assert.equal(open(t),2);await t.tick(1);assert.equal(open(t),0);
await t.click('[data-action=pause]');await t.hidden(true);await t.hidden(false);assert.equal(t.root.querySelector('.gcm-cover').hidden,false);
await t.click('[data-action=resume]');await t.flip(pairs(t.deck()).flat());assert.equal(t.phase(),'finished');assert.equal(t.log.submits[0]['d[score]'],'10');groups++;

for(const mode of ['complete256','matchAt256','missAt256']){
  t=setup();await t.start();const mm=[0,t.deck().findIndex(v=>v!==t.deck()[0])];
  const misses=mode==='complete256'?248:mode==='matchAt256'?255:256;
  for(let i=0;i<misses;i++){await t.flip(mm);await t.tick(700);}
  if(mode==='complete256'){await t.flip(pairs(t.deck()).flat());assert.equal(t.phase(),'finished');assert.equal(t.log.submits[0]['d[score]'],'256');}
  else {if(mode==='matchAt256')await t.flip(pairs(t.deck())[0]);assert.equal(t.phase(),'limit');await t.flip(pairs(t.deck()).flat());assert.equal(t.log.submits.length,0);assert.equal(count(t,'attempts'),'256');}
  groups++;
}
t=setup({guest:true});await t.start();await t.flip(pairs(t.deck()).flat());assert.equal(t.log.submits.length,0);assert.ok(t.root.querySelector('.gcm-status').textContent.includes('试玩完成'));groups++;
t=setup({failStart:true});await t.start();assert.equal(t.phase(),'ready');assert.equal(t.root.querySelector('[data-action=start]').disabled,false);await t.close();await t.start();assert.equal(t.phase(),'playing');groups++;
t=setup({invalidSeed:true});await t.start();assert.equal(t.phase(),'ready');assert.equal(t.log.submits.length,0);groups++;
for(const mode of ['rejectSubmit','networkFailure']){
  t=setup({[mode]:true});await t.start();await t.flip(pairs(t.deck()).flat());assert.equal(t.phase(),'finished');assert.ok(t.root.querySelector('.gcm-status').textContent.includes('未获确认'));
  await t.flip([0,1]);assert.equal(t.log.submits.length,1);await t.close();await t.start();await t.flip(pairs(t.deck()).flat());
  assert.equal(t.log.submits.length,2);assert.notEqual(t.log.submits[0].token,t.log.submits[1].token);groups++;
}
console.log(`PASS: ${groups} offline state groups, including 10 consecutive rounds, real SDK/PHP replay, pause, async guards and 256-attempt boundaries. Browser/Discuz checks NOT performed.`);
