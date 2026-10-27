/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实 Chromium + 生产前端/音轨；脚本接口不代表 Discuz 验收。 */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
let checks=0,room=0,badVictory=false;
const check=(v,n)=>{assert.ok(v,n);checks++;};
function battle(){return {room:String(++room).padStart(12,'A'),status:1,reason:'',seat:0,version:1,mode:'solo',rules_version:'raid-v3-solo110-p4-duo150-r18',round_limit:18,round_no:1,deadline_ms:Date.now()+30000,hp:[40],pots:[4],left:[false],leaving:[false],intents:[null],players:[{name:'测试挑战者'}],history:[],boss:110,boss_max_hp:110,exposed:false,preview:{phase:1,kind:0,targets:[0],damage:8}};}
let state=battle();
const dir='source/plugin/gamecenter/games/raid/';
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'){
  let body='';for await(const chunk of req)body+=chunk;
  const action=/name="action"\r\n\r\n([^\r]+)/.exec(body)?.[1];
  if(action==='create')state=battle();
  if(action==='act')state={...state,status:2,boss:0,reason:'defeated',version:state.version+1};
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:1,server_ms:Date.now(),snapshot:state}));return;
 }
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname==='/'){
  res.setHeader('Content-Type','text/html');res.end(`<html><head><meta charset="utf-8"></head><body><div id="stage" data-url="/" data-formhash="test"></div><script>window.GameCenter={register:(key,fn)=>fn(document.querySelector('#stage'),{uid:1})};</script><script src="/${dir}feedback.js"></script><script src="/${dir}music.js"></script><script src="/${dir}game.js"></script></body></html>`);return;
 }
 if(badVictory&&pathname.endsWith('/victory.mp3')){res.writeHead(404);res.end();return;}
 const path=resolve(root,'.'+pathname);if(!path.startsWith(root+'/'))throw Error('path');
 const bytes=await readFile(path);res.setHeader('Content-Type',({'.js':'text/javascript','.mp3':'audio/mpeg','.webp':'image/webp'})[extname(path)]||'application/octet-stream');res.end(bytes);
 }catch(_){res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{window.__audios=[];const Native=window.Audio;window.Audio=class extends Native{constructor(...args){super(...args);window.__audios.push(this);}};});
 const url=`http://127.0.0.1:${server.address().port}/`;
 const loaded=async()=>page.waitForFunction(()=>document.querySelector('[data-gcr=current]')?.disabled===false);
 const current=async()=>{await page.evaluate(()=>document.querySelector('[data-gcr=current]').click());await loaded();};
 const audio=()=>page.evaluate(()=>window.__audios.map(a=>({src:a.src,paused:a.paused,volume:a.volume,loop:a.loop,error:a.error?.code})));
 await page.goto(url);await loaded();check((await audio()).length===0,'default off no media');
 await page.locator('[data-gcr=bgm]').click();await page.waitForFunction(()=>window.__audios[0]&&!window.__audios[0].paused);
 await page.locator('[data-kind=attack]').click();await page.locator('.confirm').click();
 await page.waitForFunction(()=>window.__audios[0]?.src.includes('victory.mp3')&&!window.__audios[0].paused&&window.__audios[0].volume>.27);
 let a=await audio();check(a.length===1&&a[0].loop&&a[0].src.includes('v=0.1.13'),'actual production kill plays victory using one native audio');
 await page.locator('[data-gcr=again]').click();await loaded();await page.waitForFunction(()=>window.__audios[0].src.includes('/battle.mp3')&&!window.__audios[0].paused);
 check((await audio()).length===1,'restart returns to phase one without second audio');
 for(const [status,reason]of [[3,'knockout'],[3,'round_limit'],[3,'retreated'],[4,'cancelled']]){
  state={...battle(),status,reason,version:2};await current();a=await audio();check(a[0].paused&&!a[0].src.includes('victory.mp3'),'non-victory '+reason+' silent');
 }
 state={...battle(),status:2,boss:0,reason:'defeated',version:2};await page.reload();await loaded();
 check((await audio()).length===0,'refresh terminal with saved on preference never autoplays');
 await page.locator('.notice').click();await page.waitForFunction(()=>window.__audios[0]?.src.includes('victory.mp3')&&!window.__audios[0].paused&&window.__audios[0].volume>.27);
 check(true,'ordinary page gesture restores victory after refresh');
 await page.locator('[data-gcr=bgm]').click();state=battle();await current();state={...state,status:2,boss:0,version:2};await current();
 a=await audio();check(a.every(x=>x.paused),'muted kill never starts any audio');
 badVictory=true;await page.reload();await loaded();await page.locator('[data-gcr=bgm]').click();
 await page.waitForFunction(()=>window.__audios[0]?.error);
 check((await audio())[0].paused,'404 victory leaves native audio paused');
 check(errors.length===0,'no uncaught application exceptions');
 console.log(JSON.stringify({status:'PASS',checks,browser:await browser.version(),scope:'real native HTMLAudio + production JS; scripted server, not Discuz; no human listening or real background-tab claim'}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
