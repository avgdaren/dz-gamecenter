/* (C) 2026 Carinoasd. Transport gates only, no forum/game run: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),rules=require('../../source/plugin/gamecenter/games/_danmaku_proto/rules.json');
const bridge=require('../../docs/danmaku/handoff-v1/forum/submission-bridge.js');
// Synthetic DTO, intentionally not a claim that a one-tick game is valid.
// Actual acceptance must additionally call the full deterministic replay.
const payload={stage:true,v:1,rule:'danmaku-stage01-r3',assist:false,ticks:1,input:Buffer.alloc(5).toString('base64'),score:0};
const snapshot={rule:payload.rule,assist:false,stage:'over',status:'dead',tick:1,score:{total:0}};
const normal=bridge.build(payload,snapshot,rules);assert.equal(normal.ok,true);assert.equal(normal.fields.stage,1);assert.equal(normal.fields.assist,0);
for(const status of ['clear','dead','timeout'])assert.ok(bridge.build(payload,{...snapshot,status},rules).ok);
for(const p of [{...payload,assist:true},{...payload,stage:false},{...payload,rule:'danmaku-p1-r3'}])assert.equal(bridge.build(p,snapshot,rules).ok,false);
assert.equal(bridge.build(payload,{...snapshot,stage:'active',status:'playing'},rules).ok,false);
assert.equal(bridge.build({...payload,score:1},snapshot,rules).ok,false);
const form=Object.fromEntries(Object.entries(normal.fields).map(([k,v])=>[k,String(v)]));
const cases=[{seed:123,data:form},{seed:'123',data:normal.fields}];
const invalid=[{...form,assist:'1'},{...form,stage:'0'},{...form,rule:'danmaku-stage01-r2'},
 {...form,seed:'123'},{...form,score:'1e3'},{...form,ticks:'01'},{...form,score:String(rules.stage01.bombScoreUpperBound+1)},
 {...form,input:'!!!!'},{...form,input:[]},{...form,v:'2'},{...form,ticks:'0'},{...form,score:'-1'}];
cases.push(...invalid.map(data=>({seed:123,data})),{seed:0,data:form});
const phpBin=process.env.DANMAKU_PHP||'php';
const p=spawnSync(phpBin,[path.join(__dirname,'test-handoff-bridge.php')],{input:JSON.stringify(cases),encoding:'utf8'});assert.equal(p.status,0,p.error?.message||p.stderr);
const result=JSON.parse(p.stdout);for(const i of [0,1]){assert.equal(result[i].ok,1);assert.deepEqual(result[i].data.payload,payload);assert.equal(result[i].data.minms,16);}
for(let i=2;i<result.length;i++)assert.equal(result[i].ok,0,'Invalid case '+i+' accepted');
const report={status:'PASS',validDtoConversions:2,invalidFormsRejected:result.length-2,frontendModesAndEndStateGated:true,forumHttpRun:false,gameReplayRun:false,transportOnly:true};
const out=path.join(root,'tmp/danmaku/handoff-v1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'bridge-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
