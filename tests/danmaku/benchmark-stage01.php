<?php
/* (C) 2026 Carinoasd. Legal one-stage replay budget: 小典 / Codex. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$root=__DIR__.'/../../tmp/danmaku/stage01-growth/';
$fixture=$argv[1]??($root.'standard-long.json');$destination=$argv[2]??($root.'benchmark.json');
$payload=json_decode(file_get_contents($fixture),true,512,JSON_THROW_ON_ERROR);
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
for($i=0;$i<5;$i++)danmaku_stage01_replay($payload,$rules,false,false);
$times=[];
for($i=0;$i<50;$i++){$start=hrtime(true);$result=danmaku_stage01_replay($payload,$rules,false,false);$times[]=(hrtime(true)-$start)/1e6;}
sort($times);$report=['rule'=>$payload['rule'],'ticks'=>$payload['ticks'],'inputBase64Bytes'=>strlen($payload['input']),
    'samples'=>50,'warmup'=>5,'p50_ms'=>$times[24],'p95_ms'=>$times[47],'max_ms'=>$times[49],
    'peak_memory_bytes'=>memory_get_peak_usage(true),'php'=>PHP_VERSION,'opcache_cli'=>ini_get('opcache.enable_cli'),
    'target_ms'=>500,'status'=>$times[47]<=500?'PASS':'OVER_BUDGET','terminal'=>$result['snapshot']['status'],
    'includesDecodeAndSimulation'=>true,'allPossibleRoutesVerified'=>false,'onlineLoadVerified'=>false,'legacyR2Remeasured'=>false];
file_put_contents($destination,json_encode($report,JSON_PRETTY_PRINT));echo json_encode($report,JSON_PRETTY_PRINT);
