<?php
/* (C) 2026 Carinoasd. Legal P0 terminal replay timing: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/engine.php';
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$files=glob(__DIR__.'/../../tmp/danmaku/sample-*.json');
if(count($files)!==6)throw new RuntimeException('先运行 test-core.cjs 生成六份正常终局记录');
$scans=[];$worst=null;$worstTime=-1;
foreach($files as $file){
    $payload=json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR);
    $start=hrtime(true);$result=danmaku_p0_replay($payload,$rules);$ms=(hrtime(true)-$start)/1e6;
    $scans[]=['sample'=>basename($file),'ticks'=>$payload['ticks'],'ms'=>$ms];
    if($ms>$worstTime){$worstTime=$ms;$worst=$payload;}
}
for($i=0;$i<5;$i++)danmaku_p0_replay($worst,$rules);
$times=[];
for($i=0;$i<50;$i++){$start=hrtime(true);danmaku_p0_replay($worst,$rules);$times[]=(hrtime(true)-$start)/1e6;}
sort($times);
$report=['fixture'=>'LEGAL_P0_TERMINAL_REPLAY_WITH_60_TICK_TRACES','scene'=>$worst['scene'],'assist'=>$worst['assist'],
    'ticks'=>$worst['ticks'],'samples'=>50,'warmup'=>5,'p50_ms'=>$times[24],'p95_ms'=>$times[47],
    'max_ms'=>$times[49],'peak_memory_bytes'=>memory_get_peak_usage(true),'php'=>PHP_VERSION,
    'opcache_cli'=>ini_get('opcache.enable_cli'),'target_ms'=>500,'status'=>$times[47]<=500?'PASS':'OVER_BUDGET','screening'=>$scans];
file_put_contents(__DIR__.'/../../tmp/danmaku/benchmark-normal.json',json_encode($report,JSON_PRETTY_PRINT));
echo json_encode($report,JSON_PRETTY_PRINT);
