<?php
/* (C) 2026 Carinoasd. Five-level isolated replay parity: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$packet=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$rows=[];
foreach($packet['cases'] as $c){
 $s=new DanmakuStage01Sim($r,$c['index'],$c['assist'],$c['rule']);
 if($packet['action']==='phases'){
  $s->player['power']=16;$s->player['invulUntil']=1000000;$trace=[];
  foreach($c['inputs'] as $input){$s->step($input);if($s->tick%60===0)$trace[]=$s->snapshot();}$rows[]=$trace;continue;
 }
 $s->player['power']=16;$s->player['bombs']=0;$s->spawn($s->player['x'],$s->player['y'],0,0,4);$s->step(['dx'=>0,'dy'=>0,'flags'=>1]);
 $hit=['level'=>DanmakuStage01Sim::level($s->player['power'],$s->rules),'power'=>$s->player['power'],'stock'=>$s->player['bombs'],'lives'=>$s->player['lives'],'drops'=>$s->snapshot()['drops']];
 $s->collect(['kind'=>0,'value'=>4,'recovery'=>true]);$recovered=$s->player['power'];
 $s->collect(['kind'=>0,'value'=>4,'recovery'=>false]);$s->collect(['kind'=>0,'value'=>4,'recovery'=>true]);
 $rows[]=['hit'=>$hit,'recovered'=>$recovered,'power'=>$s->player['power'],'overflowScoreUnits'=>$s->stats['overflowScoreUnits'],'level'=>DanmakuStage01Sim::level($s->player['power'],$s->rules)];
}
echo json_encode($rows,JSON_THROW_ON_ERROR);
