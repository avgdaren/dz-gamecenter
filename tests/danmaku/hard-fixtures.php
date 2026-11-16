<?php
/* (C) 2026 Carinoasd. Hard phase / clock parity fixtures: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];
foreach($p['cases'] as $c){
    $s=new DanmakuStage01Sim($r,$c['index'],$c['assist'],$c['rule']??DanmakuStage01::HARD_RULE);
    $s->musicTick=$c['musicTick'];$s->player['power']=$c['power'];$s->player['invulUntil']=$c['invulUntil']??100000;$rows=[];
    foreach($c['inputs'] as $input){$s->step($input);if($s->tick%60===0)$rows[]=$s->snapshot();}
    $out[]=$rows;
}
echo json_encode($out,JSON_THROW_ON_ERROR);
