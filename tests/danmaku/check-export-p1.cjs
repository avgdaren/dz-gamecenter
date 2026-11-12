/* (C) 2026 Carinoasd. Verify an actual P1 browser export: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
if(!process.argv[2])throw new Error('Usage: node tests/danmaku/check-export-p1.cjs <export.json>');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto');
const rules=require(path.join(base,'rules.json')),R=require(path.join(base,'battle-replay.js'));
const payload=JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,''));
const js=R.run(payload,rules,false,true);
const p=spawnSync(process.env.DANMAKU_PHP||'E:\\dzx5-env\\php\\php.exe',[path.join(__dirname,'cli-p1.php'),path.resolve(process.argv[2]),'--trace'],
 {encoding:'utf8',maxBuffer:32*1024*1024,timeout:10000});
assert.equal(p.status,0,p.stderr||p.stdout.slice(0,200));const php=JSON.parse(p.stdout);assert.equal(php.ok,1,php.reason);assert.deepEqual(php.data,js);
const report={status:'PASS',source:'actual_browser_export',file:path.basename(process.argv[2]),rule:payload.rule,ticks:payload.ticks,
 terminal:js.snapshot.status,phaseBreaks:js.snapshot.phaseBreaks,hp:js.snapshot.hp,score:js.snapshot.score,stats:js.snapshot.sim.stats,
 jsPhpAllTraceSnapshotsEqual:true,inputBase64Bytes:payload.input.length};
fs.mkdirSync(path.join(root,'tmp/danmaku/p1'),{recursive:true});fs.writeFileSync(path.join(root,'tmp/danmaku/p1/browser-export-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
