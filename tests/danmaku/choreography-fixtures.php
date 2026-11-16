<?php
/* (C) 2026 Carinoasd. Bounded Hard v3 behavior edge fixtures: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$p=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$s=new DanmakuStage01Sim($r,1,false,DanmakuStage01::HARD_V3_RULE);$out=[];
if($p['action']==='seed'){
    danmaku_choreo_emit($s,240*64,160*64,128,160,6,102,24,['accel'=>-3,'changeAge'=>100,'mode'=>4,'nextSpeed'=>0]);
    for($t=1;$t<=110;$t++){$s->tick=$t;if($t===80)$s->player['x']=160*64;danmaku_choreo_motion($s);foreach($s->enemies as &$e){$e[1]+=$e[3];$e[2]+=$e[4];}unset($e);if(in_array($t,[1,54,76,80,99,100,110],true))$out[]=$s->snapshot();}
}elseif($p['action']==='safe'){
    foreach([0,31*64,32*64,33*64] as $dx)danmaku_choreo_emit($s,$s->player['x']+$dx,$s->player['y'],128,160,4,300,20);
    $out=$s->snapshot();
}
echo json_encode($out,JSON_THROW_ON_ERROR);
