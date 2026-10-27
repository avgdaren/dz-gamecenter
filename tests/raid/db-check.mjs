/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。隔离库、真实 X5 驱动、官方 querysafe。 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const workerFile=fileURLToPath(new URL('./db-worker.php',import.meta.url));
function worker(){
 const p=spawn(process.env.PHP_BIN||'php',[workerFile],{env:process.env,stdio:['pipe','pipe','inherit']}); const queue=[];
 createInterface({input:p.stdout}).on('line',line=>{const job=queue.shift();if(!job)throw Error(line);try{const r=JSON.parse(line);r.test_error?job.reject(Error(JSON.stringify(r))):job.resolve(r);}catch(e){job.reject(e);}});
 p.on('close',code=>{for(const job of queue)job.reject(Error('worker exited '+code));});
 return {send(x){return new Promise((resolve,reject)=>{queue.push({resolve,reject});p.stdin.write(JSON.stringify(x)+'\n');});},close(){p.stdin.end();}};
}
const workers=[worker(),worker(),worker()];const [admin,a,b]=workers;
const id=()=>randomBytes(16).toString('hex');let checks=0;
function check(x,n){assert.ok(x,n);checks++;}
const call=(w,uid,data,now)=>w.send({uid,data:{client_version:'raid-client-1',...data},...(now===undefined?{}:{now})});
const create=(uid,mode='duo',now)=>call(a,uid,{action:'create',mode,request_id:id()},now);
const join=(uid,room,now)=>call(b,uid,{action:'join',room,request_id:id()},now);
const act=(w,uid,room,round,kind='attack',target=-1,now,request_id=id())=>call(w,uid,{action:'act',room,round,kind,target,request_id},now);
try {
 check((await admin.send({op:'querysafe'})).blocked,'original unsafe session query rejected');
 await admin.send({op:'init'});
 check((await admin.send({op:'mapping'})).blocked,'cross-connection mapping rejected');
 const timeout=await admin.send({op:'timeout_config'});check(timeout.inside<=2&&timeout.before===timeout.after,'session timeout restored');
 check((await call(a,0,{action:'current'})).code==='login','guest rejected');
 check((await a.send({uid:1,allowed:false,data:{action:'current'}})).code==='permission','group rejected');
 check((await call(a,1,{action:'current',uid:999})).code==='input','spoofed uid rejected');
 check((await call(a,1,{action:'current',client_version:'obsolete'})).code==='client','unknown client rejected');
 check((await call(a,1,{action:'act',room:'x',round:1,target:-1,kind:'attack',request_id:id()})).code==='input','room validation');
 const key=id();const cr={action:'create',mode:'duo',request_id:key};
 const duplicates=await Promise.all([call(a,1,cr),call(b,1,cr)]);
 check(duplicates.every(r=>r.ok)&&duplicates[0].snapshot.room===duplicates[1].snapshot.room,'same create ID once: '+JSON.stringify(duplicates));
 const room=duplicates[0].snapshot.room;
 check((await call(a,1,{...cr,mode:'solo'})).code==='request_conflict','create ID changed mode');
 check((await call(a,9,{action:'state',room})).snapshot===null,'third-party state private');
 check((await join(1,room)).ok===0,'cannot occupy two seats');
 const joins=await Promise.all([join(2,room),call(a,3,{action:'join',room,request_id:id()})]);
 check(joins.filter(x=>x.ok).length===1,'one second seat');const partner=joins[0].ok?2:3;
 check((await create(1)).code==='active','one active room per UID');
 check((await call(a,1,{action:'current'})).snapshot.status===1,'resume active');
 let both=await Promise.all([act(a,1,room,1),act(b,partner,room,1)]);
 check(both.every(x=>x.ok),'both confirm same round with stale shared version');
 let s=(await call(a,1,{action:'state',room})).snapshot;
 check(s.round_no===2&&s.history.length===1&&s.boss===110,'round exactly once');
 const req=id();const move={action:'act',room,round:2,kind:'heal',target:0,request_id:req};
 const replay=await Promise.all([call(a,1,move),call(b,1,move)]);
 check(replay.every(x=>x.ok)&&replay.some(x=>x.replayed),'lost response same action ID');
 check((await call(a,1,{...move,target:1})).code==='request_conflict','changed fingerprint rejected');
 await act(b,partner,room,2);
 s=(await call(a,1,{action:'state',room})).snapshot;
 check(s.pots[0]===1,'healing charged once at settlement');
 check((await call(a,1,move)).replayed===1,'old acknowledged action remains replayable');
 check((await call(a,partner,{action:'state',room})).snapshot.hp.join(',')===s.hp.join(','),'member sees same authority');
 // Full reference fixtures exercise service input -> DB -> pure rules, not just end results.
 const fixture=JSON.parse(readFileSync(new URL('../../docs/raid/P1-REFERENCE.json',import.meta.url)));
 const cases=Array.isArray(fixture.cases)?fixture.cases:Object.values(fixture.cases);
 let uid=100;
 for(const item of cases){
   const mode=item.mode;const u=uid;uid+=2;let r=await create(u,mode,1000000);check(r.ok,'fixture create '+JSON.stringify(r));
   const code=r.snapshot.room;if(mode==='duo')check((await join(u+1,code,1000000)).ok,'fixture join');
   for(const turn of item.expected.trace){
     for(let i=0;i<turn.actions.length;i++){
       const [kind,target]=turn.actions[i];if(kind==='-')continue;
       r=await act(i===0?a:b,u+i,code,turn.round,{A:'attack',G:'guard',H:'heal'}[kind],target,1000000+turn.round);
       check(r.ok,'fixture act '+JSON.stringify(r));
     }
     const x=r.snapshot;
     check(x.boss===turn.boss&&JSON.stringify(x.hp)===JSON.stringify(turn.hp)&&JSON.stringify(x.pots)===JSON.stringify(turn.pots),'fixture round '+item.name+' '+turn.round);
   }
   check(r.snapshot.status===2,'fixture won');
 }
 // Clock catch-up is committed even when rejecting a late command.
 const c=await create(20,'duo',2000000);const croom=c.snapshot.room;await join(21,croom,2000000);
 check((await act(a,20,croom,1,'attack',-1,2030000)).code==='round','at deadline old round rejected');
 s=(await call(a,20,{action:'current'},2030000)).snapshot;
 check(s.round_no===2&&s.deadline_ms===2060000&&s.history[0].defaults.length===2,'catch-up persisted at original deadline');
 s=(await call(a,20,{action:'current'},2480000)).snapshot;
 check(s.status===3&&s.history.length===16&&s.ended_ms===2480000,'offline 480 seconds bounded to 16 rounds');
 // Waiting expiry releases qualification and old invitations cannot be joined.
 const wait=await create(30,'duo',3000000);const wroom=wait.snapshot.room;
 const expired=await call(a,30,{action:'state',room:wroom},3300000);
 check(expired.snapshot.status===4&&expired.snapshot.result.duration_ms===0,'waiting expiry, zero battle time');
 check((await join(31,wroom,3300001)).snapshot===null,'expired join discloses no snapshot');
 check((await create(30,'solo',3300001)).ok,'waiting expiry releases creator');
 // Deferred retreat releases pointer only after settlement. Old join/create replay never steals pointer.
 const originalId=id();const original=await call(a,40,{action:'create',mode:'duo',request_id:originalId},4000000);const oroom=original.snapshot.room;
 const joinId=id();await call(b,41,{action:'join',room:oroom,request_id:joinId},4000000);
 const left=await call(a,40,{action:'retreat',room:oroom,request_id:id()},4000001);
 check(left.ok&&left.snapshot.leaving[0]&&!left.snapshot.left[0],'retreat deferred');
 check((await create(40,'solo',4000002)).code==='active','no early release');
 await act(b,41,oroom,1,'attack',-1,4000003);
 const newRoom=(await create(40,'solo',4000004)).snapshot.room;
 const old=await call(a,40,{action:'create',mode:'duo',request_id:originalId},4000005);
 check(old.replayed===1&&old.snapshot.room===oroom,'old create receipt acknowledged');
 check((await call(a,40,{action:'current'},4000005)).snapshot.room===newRoom,'old replay leaves current pointer');
 await call(a,41,{action:'retreat',room:oroom,request_id:id()},4000006);
 const next41=(await create(41,'solo',4000007)).snapshot.room;
 check((await call(b,41,{action:'join',room:oroom,request_id:joinId},4000008)).replayed===1,'old join receipt');
 check((await call(b,41,{action:'current'},4000008)).snapshot.room===next41,'old join never rewinds pointer');
 const cancel=await create(50,'duo',5000000);const cc=cancel.snapshot.room;
 const cancelled=await call(a,50,{action:'cancel',room:cc,expected_version:1,request_id:id()},5000001);
 check(cancelled.snapshot.status===4,'creator cancels waiting');
 // Independent history branches, stable ordering at identical timestamps.
 for(let i=0;i<14;i++){const z=await create(60,'solo',6000000);await call(a,60,{action:'retreat',room:z.snapshot.room,request_id:id()},6000001);}
 const hist=await call(a,60,{action:'history'},6000001);
 check(hist.history.length===10&&new Set(hist.history.map(x=>x.room)).size===10,'history latest ten unique');
 const explain=await admin.send({op:'explain',uid:60});check(explain.every(rows=>rows[0].possible_keys.includes('history')),'both history indices eligible');
 const limit=create;for(let i=14;i<30;i++){const z=await limit(60,'solo',6000000);await call(a,60,{action:'retreat',room:z.snapshot.room,request_id:id()},6000001);}
 check((await create(60,'solo',6000002)).code==='rate','30 new rooms per ten minutes');
 // Same-seat racing requests: two distinct IDs, exactly one accepted per round.
 const race=await create(70,'duo');const rr=race.snapshot.room;await join(71,rr);
 for(let i=0;i<1000;i++){
   await admin.send({op:'fixture',room:rr});
   const results=await Promise.all([act(a,70,rr,1),act(b,70,rr,1)]);
   check(results.filter(x=>x.ok).length===1,'same-seat race '+i);
   check(Number((await admin.send({op:'counts',room:rr})).n)===1,'one intent receipt '+i);
 }
 // Before/at deadline contenders: either the action is retained once or defaulted once, never both.
 for(let i=0;i<200;i++){
   const now=Date.now()-29998;await admin.send({op:'fixture',room:rr,now});
   const results=await Promise.all([act(a,70,rr,1),call(b,71,{action:'state',room:rr})]);
   check(results.every(r=>r.ok || r.code==='round'),'deadline requests have defined outcome '+i);
   await new Promise(resolve=>setTimeout(resolve,5));
   const x=(await call(a,70,{action:'state',room:rr})).snapshot;
   check(x.history.length===1&&x.round_no===2,'deadline single settlement '+i);
   const h=x.history[0];check((h.actions[0].kind==='attack')!==h.defaults.includes(0),'intent xor timeout '+i);
 }
 // Real lock-order inversion invokes transaction deadlock retry.
 const d1=await create(80,'duo');const d2=await create(81,'duo');
 const dead=await Promise.all([a.send({op:'deadlock',rooms:[d1.snapshot.room,d2.snapshot.room]}),b.send({op:'deadlock',rooms:[d2.snapshot.room,d1.snapshot.room]})]);
 check(dead.every(x=>x.ok)&&dead.some(x=>x.tries>1),'real deadlock retried');
 const holding=admin.send({op:'hold',room:d1.snapshot.room});await new Promise(r=>setTimeout(r,100));
 const probe=await a.send({op:'lock_probe',room:d1.snapshot.room});await holding;
 check(probe.ok&&probe.tries>1,'real 1205 lock wait retried');
 await admin.send({op:'corrupt',room:rr,json:'{"bad":true}'});
 const bad=await call(a,70,{action:'state',room:rr});check(bad.code==='busy'&&bad.snapshot===null,'corrupt JSON fails closed');
 await admin.send({op:'corrupt',room:rr,json:'x'.repeat(16385)});
 check((await call(a,70,{action:'state',room:rr})).code==='busy','oversized state rejected');
 // Real plugin entry: POST/formhash, game routing, login and single-player bypass rejection.
 async function entry(data){return await new Promise((resolve,reject)=>{const p=spawn(process.env.PHP_BIN||'php',[workerFile],{env:process.env});let out='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',()=>{});p.on('close',()=>{try{resolve(JSON.parse(out));}catch(e){reject(Error(out));}});p.stdin.end(JSON.stringify({op:'entry',...data})+'\n');});}
 const payload={action:'current',client_version:'raid-client-1',formhash:'test-formhash'};
 check((await entry({data:payload})).ok===1,'real plugin route current');
 check((await entry({method:'GET',data:payload})).ok===0,'GET mutation rejected');
 check((await entry({data:{...payload,formhash:'wrong'}})).ok===0,'wrong formhash rejected');
 check((await entry({uid:0,data:payload})).code==='login','entry guest rejected');
 check((await entry({route_op:'start',data:payload})).ok===0,'raid rejects old start');
 check((await entry({route_op:'submit',data:payload})).ok===0,'raid rejects old submit');
 check((await entry({game:'snake',data:payload})).ok===0,'raid operation rejects another game');
 console.log(JSON.stringify({status:'PASS',driver:process.env.GC_TEST_DRIVER||'pdo',checks,races:1000,deadline_races:200,fixture_cases:cases.length}));
} finally {workers.forEach(x=>x.close());}

