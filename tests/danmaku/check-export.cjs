/* (C) 2026 Carinoasd. Verify an actual browser-exported local recording: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
if(!process.argv[2])throw new Error('Usage: node tests/danmaku/check-export.cjs <export.json>');
const root=path.resolve(__dirname,'../..'),game=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=JSON.parse(fs.readFileSync(path.join(game,'rules.json'),'utf8'));
const replay=require(path.join(game,'replay.js'));
const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const js=replay.run(payload,rules,false);
const proc=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli.php')],
  {input:JSON.stringify(payload),encoding:'utf8',maxBuffer:16*1024*1024,timeout:10000});
assert.equal(proc.status,0,proc.stderr||proc.stdout.slice(0,200));
const php=JSON.parse(proc.stdout);assert.equal(php.ok,1,php.reason);assert.deepEqual(php.data,js);
const inputs=replay.decode(payload,rules);
const report={status:'PASS',source:'browser_export',file:path.basename(process.argv[2]),scene:payload.scene,
  ticks:payload.ticks,terminal:js.snapshot.status,player:js.snapshot.player,stats:js.snapshot.stats,
  moved:inputs.some(i=>i.dx!==0||i.dy!==0),bombPressed:inputs.some(i=>i.flags&2),
  jsPhpEvery60TicksEqual:true,inputBase64Bytes:payload.input.length};
fs.mkdirSync(path.join(root,'tmp/danmaku'),{recursive:true});
fs.writeFileSync(path.join(root,'tmp/danmaku/browser-export-check.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
