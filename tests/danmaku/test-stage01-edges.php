<?php
/* (C) 2026 Carinoasd. Internal boundary fixtures, never replay inputs: 小典 / Codex. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$zero=['dx'=>0,'dy'=>0,'flags'=>1];$results=[];
foreach([false,true] as $bomb){
    $s=new DanmakuStage01Sim($rules,0,false);$s->hp=1;$s->player['lives']=1;
    $s->shots=[[1,15360,6400,0,0,-768,8,1,1]];$s->nextShot=2;
    $s->drop($s->player['x'],$s->player['y'],8,false);$s->drops[0]['unlock']=0;
    $s->spawn($s->player['x'],$s->player['y'],0,0,4);$s->step(['dx'=>0,'dy'=>0,'flags'=>$bomb?3:1]);
    $results[]=['status'=>$s->status,'hp'=>$s->hp,'lives'=>$s->player['lives'],'power'=>$s->player['power'],'damage'=>$s->stats['damage'],'bombs'=>$s->player['bombs']];
}
$s=new DanmakuStage01Sim($rules,0,false);$s->spawn($s->player['x']-640,$s->player['y'],0,1280,4);$s->step($zero);
$results[]=['lives'=>$s->player['lives'],'hits'=>$s->stats['hitsTaken']];
$s=new DanmakuStage01Sim($rules,0,false);$s->player['power']=8;$s->spawn($s->player['x'],$s->player['y'],0,0,4);$s->step($zero);
$item=$s->drops[0];$before=$s->player['power'];$s->player['power']=8;$s->collect($item);
$results[]=['afterHit'=>$before,'recoveryValue'=>$item['value'],'unlock'=>$item['unlock'],'power'=>$s->player['power'],'overflowScoreUnits'=>$s->stats['overflowScoreUnits'],'lost'=>$s->stats['powerLost']];
echo json_encode($results,JSON_THROW_ON_ERROR);
