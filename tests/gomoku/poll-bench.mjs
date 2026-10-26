/** 作者：GPT / Codex。真实测试站短轮询压测；配置文件放在仓库之外，不输出凭据。 */
import {readFileSync} from 'node:fs';
const input=process.argv[2];
if(!input)throw Error('用法：node tests/gomoku/poll-bench.mjs <仓库外的本地配置.json>');
const cfg=JSON.parse(readFileSync(input,'utf8'));
const api=new URL(cfg.url),forum=new URL(cfg.forum_url);
if(api.origin!==forum.origin)throw Error('API 与论坛页必须同源');
if(!['localhost','127.0.0.1','[::1]'].includes(api.hostname)&&process.env.GC_BENCH_ALLOW_REMOTE!=='1')throw Error('默认仅允许本地测试站；远程测试站需显式 GC_BENCH_ALLOW_REMOTE=1');
if(!Array.isArray(cfg.sessions)||cfg.sessions.length!==40)throw Error('验收脚本要求 40 个页面配置，可按需包含多账号/多房间');
for(const s of cfg.sessions)if(typeof s.cookie!=='string'||typeof s.formhash!=='string'||!/^[A-F0-9]{12}$/.test(s.room))throw Error('页面配置缺少 cookie/formhash/room');
const duration=Number(process.env.GC_BENCH_MS||600000);
if(!Number.isFinite(duration)||duration<1000)throw Error('无效持续时间');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const percentile=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.max(0,Math.ceil(a.length*p)-1)]:null;
const times={baseline:[],poll:[],forum:[]},errors={baseline:0,poll:0,forum:0};
const roomStates={waiting:0,playing:0,finished:0,cancelled:0};
async function probe(kind,session){
 const started=performance.now();
 try{
  let url=forum,options={headers:{Cookie:session.cookie},signal:AbortSignal.timeout(10000)};
  if(kind==='poll'){
   url=new URL(api);url.searchParams.set('op','room');url.searchParams.set('game','gomoku');url.searchParams.set('inajax','1');
   options={...options,method:'POST',body:new URLSearchParams({action:'state',room:session.room,formhash:session.formhash})};
  }
  const response=await fetch(url,options);if(!response.ok)throw Error('HTTP');
  if(kind==='poll'){const data=await response.json();if(data.ok!==1||!data.room)throw Error('business');const key=['waiting','playing','finished','cancelled'][data.room.status];if(key)roomStates[key]++;}
  else await response.arrayBuffer();
  times[kind].push(performance.now()-started);
 }catch(e){errors[kind]++;}
}
for(let i=0;i<30;i++){await probe('baseline',cfg.sessions[0]);await wait(100);}
const started=performance.now(),until=started+duration;
await Promise.all([
 ...cfg.sessions.map(async(session,index)=>{await wait(index*50);while(performance.now()<until){const tick=performance.now();await probe('poll',session);await wait(Math.max(0,2000-(performance.now()-tick)));}}),
 (async()=>{while(performance.now()<until){const tick=performance.now();await probe('forum',cfg.sessions[0]);await wait(Math.max(0,1000-(performance.now()-tick)));}})()
]);
const p95=Object.fromEntries(Object.entries(times).map(([k,a])=>[k,percentile(a,.95)]));
console.log(JSON.stringify({pages:40,duration_ms:duration,successful_requests:Object.fromEntries(Object.entries(times).map(([k,a])=>[k,a.length])),errors,p95_ms:p95,room_state_samples:roomStates,
 latency_checks:{poll:p95.poll!==null&&p95.poll<=150,forum:p95.forum!==null&&p95.baseline!==null&&p95.forum<=p95.baseline*1.5&&p95.forum-p95.baseline<=200},
 full_acceptance:'仍需内容/浏览器验收与 php-cgi 内存采样；缩短持续时间不算 10 分钟验收。'},null,2));
