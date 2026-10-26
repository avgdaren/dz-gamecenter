/** 作者：GPT / Codex。真实 MariaDB + X5 DB 原文件；仅对显式隔离库运行。 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const dir=path.dirname(fileURLToPath(import.meta.url));
function worker(){const process=spawn(globalThis.process.env.PHP_BIN||'php',[path.join(dir,'db-worker.php')],{env:globalThis.process.env,stdio:['pipe','pipe','inherit']});const queue=[];
 createInterface({input:process.stdout}).on('line',line=>{const task=queue.shift();if(!task)throw Error(line);const r=JSON.parse(line);r.test_error?task.reject(Error(JSON.stringify(r))):task.resolve(r);});
 process.on('close',code=>{for(const task of queue)task.reject(Error('worker exited '+code));});
 return {send(data){return new Promise((resolve,reject)=>{queue.push({resolve,reject});process.stdin.write(JSON.stringify(data)+'\n');});},close(){process.stdin.end();}};
}
const workers=[worker(),worker(),worker()];const [admin,a,b]=workers;
const id=()=>randomBytes(16).toString('hex');
const call=(w,uid,data)=>w.send({uid,data});
let checks=0;
function check(value,name){assert.ok(value,name);checks++;}
try{
 const safe=await admin.send({op:'querysafe'});
 for(const [i,blocked] of safe.blocked.entries())check(blocked,'querysafe rejects unsafe SQL '+i);
 check(safe.entry_blocked,'DB::query rejects original session-variable SQL');
 check(Number.isInteger(Number(safe.show.Value))&&Number(safe.show.Value)>=0,'querysafe permits SHOW SESSION VARIABLES');
 await admin.send({op:'init'});
 check((await admin.send({op:'mapping'})).blocked,'cross-connection map rejected');
 const timeout=await admin.send({op:'timeout_config'});check(timeout.inside<=2,'room lock wait bounded');check(timeout.before===timeout.after,'session setting restored');
 const key=id();const created=await Promise.all([call(a,1,{action:'create',request_id:key}),call(b,1,{action:'create',request_id:key})]);
 check(created.every(r=>r.ok===1)&&created[0].room.code===created[1].room.code,'duplicate create '+JSON.stringify(created));
 const code=created[0].room.code;
 const denied=await call(b,9,{action:'state',room:code});check(!denied.ok&&!denied.room,'nonmember privacy');
 const self=await call(a,1,{action:'join',room:code});check(self.room.white_uid===0,'cannot occupy both seats');
 const joins=await Promise.all([call(a,2,{action:'join',room:code}),call(b,3,{action:'join',room:code})]);check(joins.filter(r=>r.ok).length===1,'only one second seat');
 let r=(await call(a,1,{action:'state',room:code})).room;
 const white=r.white_uid;
 check((await call(a,1,{action:'create',request_id:id()})).code==='active','one active room');
 const move={action:'move',room:code,version:r.version,cell:112,request_id:id()};
 const ack=await Promise.all([call(a,1,move),call(b,1,move)]);check(ack.every(x=>x.ok===1)&&ack.some(x=>x.replayed),'same move ID replay');
 check(Number((await admin.send({op:'counts',code})).n)===1,'one action row');
 check((await call(a,1,{...move,cell:113})).code==='request_conflict','different payload same ID');
 check((await call(a,1,{...move,request_id:id(),version:3})).code==='turn','out-of-turn rejected');
 const resume=await call(b,white,{action:'current'});check(resume.room.board[112]==='1','current after refresh');
 const end=await call(b,white,{action:'resign',room:code,version:resume.room.version,request_id:id()});check(end.room.winner===1&&end.room.reason==='resign','resign persisted');
 check((await call(a,1,{action:'history'})).history.some(x=>x.code===code),'personal history');
 const waiting=await call(a,4,{action:'create',request_id:id()});await admin.send({op:'deadline',code:waiting.room.code,deadline:Date.now()-1});
 check((await call(a,4,{action:'state',room:waiting.room.code})).room.status===3,'waiting timeout');
 check((await call(a,0,{action:'current'})).code==='login','guest');
 check((await a.send({uid:1,allowed:false,data:{action:'current'}})).code==='permission','group gate');
 const game=await call(a,10,{action:'create',request_id:id()});await call(b,11,{action:'join',room:game.room.code});
 for(let i=0;i<9;i++){
  const uid=i%2?11:10;const cell=i%2?15+Math.floor(i/2):Math.floor(i/2);const state=await call(a,uid,{action:'state',room:game.room.code});
  const result=await call(a,uid,{action:'move',room:game.room.code,version:state.room.version,cell,request_id:id()});
  check(result.ok===1,'full legal game '+i);if(i===8)check(result.room.status===2&&result.room.winner===10&&result.room.reason==='five','winning outcome persisted');
 }
 for(let i=0;i<30;i++){const r=await call(a,20,{action:'create',request_id:id()});check(r.ok===1,'rate setup');await call(a,20,{action:'resign',room:r.room.code,version:r.room.version,request_id:id()});}
 check((await call(a,20,{action:'create',request_id:id()})).code==='rate','creation rate limit');
 for(const x of [
  {method:'GET',data:{action:'current',formhash:'test-formhash'}},
  {data:{action:'current',formhash:'wrong'}},
  {route_op:'start',data:{formhash:'test-formhash'}},
  {route_op:'submit',data:{formhash:'test-formhash','d[score]':9999}},
  {game:'snake',data:{action:'current',formhash:'test-formhash'}},
  {uid:0,data:{action:'current',formhash:'test-formhash'}}
 ]){const w=worker();const r=await w.send({op:'entry',...x});check(r.ok===0,'route gate '+JSON.stringify(x));w.close();}
 {const w=worker();const r=await w.send({op:'entry',data:{action:'current',formhash:'test-formhash'}});check(r.ok===1,'room route reaches service');w.close();}
 await admin.send({op:'fixture',code:'F00000000001'});
 for(let i=0;i<1000;i++){
  await admin.send({op:'fixture',code:'F00000000001'});
  const common={action:'move',room:'F00000000001',version:2};
  const results=await Promise.all([call(a,101,{...common,cell:0,request_id:id()}),call(b,101,{...common,cell:1,request_id:id()})]);
  check(results.filter(r=>r.ok===1).length===1,'one move per version '+i);
  check(Number((await admin.send({op:'counts',code:'F00000000001'})).n)===1,'one stored action '+i);
 }
 let moves=0,timeouts=0,maxDelta=0;
 for(let i=0;i<200;i++){
  const deadline=Date.now()+(i%2?15:-2);
  await admin.send({op:'fixture',code:'F00000000001',deadline});
  await Promise.all([call(a,101,{action:'move',room:'F00000000001',version:2,cell:0,request_id:id()}),call(b,102,{action:'state',room:'F00000000001'})]);
  const result=await call(a,101,{action:'state',room:'F00000000001'});const r=result.room;
  maxDelta=Math.max(maxDelta,Math.abs(result.server_ms-deadline));
  check((r.status===2&&r.reason==='timeout'&&r.board[0]==='0')||(r.status===1&&r.board[0]==='1'),'deadline/move mutually exclusive '+i);
  if(r.status===2)timeouts++;else moves++;
 }
 check(moves>0&&timeouts>0,'both sides of deadline exercised');
 await admin.send({op:'fixture',code:'F00000000002'});
 const locks=await Promise.all([a.send({op:'deadlock',codes:['F00000000001','F00000000002']}),b.send({op:'deadlock',codes:['F00000000002','F00000000001']})]);
 check(locks.every(x=>x.ok)&&locks.some(x=>x.tries>1),'real 1213 recovered');
 console.log(JSON.stringify({result:'PASS',checks,driver:process.env.GC_TEST_DRIVER||'pdo',races:1000,deadlineRaces:200,moves,timeouts,maxObservedDeadlineDeltaMs:maxDelta,deadlockTries:locks.map(x=>x.tries)},null,2));
}finally{workers.forEach(w=>w.close());}
