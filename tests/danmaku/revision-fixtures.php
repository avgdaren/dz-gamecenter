<?php
/* (C) 2026 Carinoasd. Isolated respawn and pattern parity: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$packet=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$results=[];
function fixtureSim(array $c,array $r): DanmakuP0Sim {
    if($c['kind']==='stage')return new DanmakuStage01Sim($r,$c['index'],$c['assist'],$c['rule']);
    if($c['kind']==='p0')return new DanmakuP0Sim($r,$c['scene'],$c['assist'],$c['rule']);
    $normal=in_array($c['rule'],[DanmakuP1Battle::NORMAL_RULE,DanmakuP1Battle::NORMAL_V2_RULE],true);
    return new DanmakuP1Phase($r,$c['index'],$c['assist'],true,true,$normal,DanmakuP1Battle::phaseOptions($c['rule']));
}
foreach($packet['cases'] as $c){
    $s=fixtureSim($c,$r);
    if($packet['action']==='phases'){
        $s->player['invulUntil']=1000000;$trace=[];
        foreach($c['inputs'] as $input){$s->step($input);if($s->tick%60===0)$trace[]=$s->snapshot();}
        $results[]=$trace;continue;
    }
    $s->player['bombs']=$c['stock'];$s->player['lives']=$c['lives']??3;$s->player['invulUntil']=!empty($c['invulnerable'])?1000:0;
    if(!empty($c['body'])){
        $s->tick=149;[$x,$y]=$r['stage01']['paths'][0][150];$s->player['x']=$s->player['px']=$x;$s->player['y']=$s->player['py']=$y;
        $s->mobs[]=['id'=>100,'type'=>0,'born'=>0,'baseX'=>0,'mirror'=>false,'reward'=>0,'hp'=>32,'aim'=>128,'warningUntil'=>0,'warningKind'=>0,'x'=>$x,'px'=>$x,'y'=>$y,'py'=>$y];
    }else{
        // Two simultaneous hits still cause one miss; no game-state injection in product code.
        for($i=0;$i<2;$i++)$s->spawn($s->player['x'],$s->player['y'],0,0,4);
    }
    $s->step(['dx'=>0,'dy'=>0,'flags'=>!empty($c['bomb'])?3:1]);
    $results[]=['stock'=>$s->player['bombs'],'lives'=>$s->player['lives'],'taken'=>$s->stats['hitsTaken'],
        'used'=>$s->stats['bombsUsed'],'collected'=>$s->stats['bombCollected']??0,'status'=>$s->status];
}
echo json_encode($results,JSON_THROW_ON_ERROR);
