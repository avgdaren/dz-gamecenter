<?php
/* (C) 2026 Carinoasd. Actual legal P1 full-battle replay budget: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/battle.php';
$root=__DIR__.'/../../tmp/danmaku/p1/';
$payload=json_decode(file_get_contents($root.'standard-long-clear.json'),true,512,JSON_THROW_ON_ERROR);
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
for($i=0;$i<5;$i++)danmaku_p1_replay($payload,$rules,false,false);
$times=[];
for($i=0;$i<50;$i++){$start=hrtime(true);$result=danmaku_p1_replay($payload,$rules,false,false);$times[]=(hrtime(true)-$start)/1e6;}
sort($times);
$report=['fixture'=>'LEGAL_STANDARD_FULL_BATTLE_211_SECONDS','ticks'=>$payload['ticks'],'inputBytes'=>strlen($payload['input']),
 'samples'=>50,'warmup'=>5,'p50_ms'=>$times[24],'p95_ms'=>$times[47],'max_ms'=>$times[49],
 'peak_memory_bytes'=>memory_get_peak_usage(true),'php'=>PHP_VERSION,'opcache_cli'=>ini_get('opcache.enable_cli'),
 'target_ms'=>500,'status'=>$times[47]<=500?'PASS':'OVER_BUDGET','battleStatus'=>$result['snapshot']['status'],'score'=>$result['snapshot']['score']['total'],
 'synthetic360FixturePassed'=>false,'onlineWorkerLoadVerified'=>false];
file_put_contents($root.'benchmark.json',json_encode($report,JSON_PRETTY_PRINT));echo json_encode($report,JSON_PRETTY_PRINT);
