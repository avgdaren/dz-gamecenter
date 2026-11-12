<?php
/* (C) 2026 Carinoasd. Local isolated phase fixtures: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$results=[];
foreach($cases as $case){
    $sim=$case['kind']==='stage'?new DanmakuStage01Sim($rules,$case['index'],$case['assist'],$case['rule']):
        new DanmakuP1Phase($rules,$case['index'],$case['assist'],$case['rule']!==DanmakuP1Battle::RULE,$case['rule']===DanmakuP1Battle::PATTERN_RULE);
    // Isolate attacks/collision arithmetic without terminating the fixture on a hit.
    $sim->player['invulUntil']=1000000;$trace=[];
    for($i=0;$i<$case['ticks'];$i++){
        $sim->step(['dx'=>0,'dy'=>0,'flags'=>1]);
        if($sim->tick%60===0)$trace[]=$sim->snapshot();
    }
    $results[]=$trace;
}
echo json_encode($results,JSON_THROW_ON_ERROR);
