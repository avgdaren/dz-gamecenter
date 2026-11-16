/* (C) 2026 Carinoasd. Retained historical simulation baselines after build cleanup: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),r=require(path.join(base,'rules.json')),S=require(path.join(base,'stage.js')),dir=path.join(__dirname,'fixtures/legacy-hard'),rows=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8')),plain=x=>JSON.parse(JSON.stringify(x));
for(const [i,row] of rows.entries()){
 const source=fs.readFileSync(path.join(dir,row.runtime),'utf8');assert.equal(crypto.createHash('sha256').update(source).digest('hex'),row.runtimeSha256);
 const box={module:{exports:{}},require:name=>require(path.join(base,name))};vm.runInNewContext(source,box);const Old=box.module.exports,rule=i===0?S.hardRule:S.hardV2Rule;
 for(const index of [-1,0,1,2]){const a=new Old.Sim(r,index,false,rule),b=new S.Sim(r,index,false,rule);for(const s of [a,b])s.player.invulUntil=100000;for(let t=0;t<(i===0?720:360);t++){const input={dx:t%120<60?64:-64,dy:0,flags:t%90<45?1:0};a.step(input);b.step(input);}assert.deepEqual(plain(a.snapshot()),plain(b.snapshot()));}
}
console.log(JSON.stringify({status:'PASS',retainedSimulationModules:rows.length,boundedPhaseComparisons:8,naturalFullClearTested:false}));
