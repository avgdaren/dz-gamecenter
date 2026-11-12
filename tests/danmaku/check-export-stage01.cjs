/* (C) 2026 Carinoasd. Compare exported one-stage replays: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const file=process.argv[2];if(!file)throw Error('Usage: node tests/danmaku/check-export-stage01.cjs <export.json>');
const rules=JSON.parse(fs.readFileSync(path.join(base,'rules.json'),'utf8'));
if(fs.statSync(file).size>rules.limits.payloadMaxBytes)throw Error('Replay file exceeds size limit');
const payload=JSON.parse(fs.readFileSync(file,'utf8')),replay=require(path.join(base,'stage-replay.js'));
const result=replay.run(payload,rules,false,true);
const php=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli-stage01.php'),path.resolve(file),'--trace'],
 {encoding:'utf8',maxBuffer:64*1024*1024,timeout:180000});
assert.equal(php.status,0,php.stderr||php.stdout);const server=JSON.parse(php.stdout);assert.equal(server.ok,1,server.reason);assert.deepEqual(server.data,result);
console.log(JSON.stringify({status:'PASS',rule:payload.rule,ticks:payload.ticks,terminal:result.snapshot.status,score:result.snapshot.score.total,
 jsPhpFullTraceMatch:true,originalBrowserStateCheckedByThisCommand:false}));
