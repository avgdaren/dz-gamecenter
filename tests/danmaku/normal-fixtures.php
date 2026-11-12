<?php
/* (C) 2026 Carinoasd. Isolated Normal phase parity: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$results=[];
foreach($cases as $case){
    $s=$case['kind']==='stage'?new DanmakuStage01Sim($rules,$case['index'],$case['assist'],DanmakuStage01::NORMAL_RULE):
        new DanmakuP1Phase($rules,$case['index'],$case['assist'],true,true,true);
    // Bounded isolated fixture; invulnerability belongs only to this test process.
    $s->player['invulUntil']=1000000;$trace=[];
    foreach($case['inputs'] as $input){$s->step($input);if($s->tick%60===0)$trace[]=$s->snapshot();}
    $results[]=$trace;
}
echo json_encode($results,JSON_THROW_ON_ERROR);
