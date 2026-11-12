<?php
/* (C) 2026 Carinoasd. Deterministic pickup/drop boundary fixtures: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$packet=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$rows=[];
foreach($packet['cases'] as $c){
 $b=new DanmakuStage01($r,$c['assist'],$c['rule']);$s=$b->sim;
 if($packet['action']==='all'){
  foreach($s->rules['stage01']['schedule'] as $m){$s->mobs=[['id'=>$m['id'],'type'=>$m['type'],'born'=>0,'baseX'=>$m['x'],'mirror'=>$m['mirror'],'reward'=>$m['reward'],'hp'=>$s->rules['stage01']['types'][$m['type']]['hp'],'aim'=>128,'warningUntil'=>0,'warningKind'=>0,'x'=>240*64,'y'=>100*64,'px'=>240*64,'py'=>100*64]];$s->damageMob(0,10000,false);$s->damageMob(0,10000,true);}
  for($i=0;$i<4;$i++)$s->drop(12*64,0,4,true);
  $before=$b->snapshot();foreach($s->drops as &$d)if($d['kind']===2){$d['x']=$d['px']=$s->player['x'];$d['y']=$d['py']=$s->player['y'];}unset($d);
  $s->tick=12;$s->items(['flags'=>1]);$after=$b->snapshot();$s->items(['flags'=>1]);$rows[]=[$before,$after,$b->snapshot()];continue;
 }
 if($packet['action']==='mixed'){
  $s->player['bombs']=3;foreach([[0,3],[1,1],[2,1]] as [$kind,$value])$s->drop($s->player['x'],$s->player['y'],$value,false,$kind);
  $s->tick=12;$s->items(['flags'=>1]);$before=$b->snapshot();$s->drop(12*64,0,1,false,2);$b->replace(0);$after=$b->snapshot();$b->replace(1);$rows[]=[$before,$after,$b->snapshot()];continue;
 }
 if($packet['action']==='death'){
  $s->player['power']=16;$s->player['bombs']=0;$s->drop($s->player['x'],$s->player['y'],1,false,2);$s->tick=12;$s->items(['flags'=>1]);
  $s->spawn($s->player['x'],$s->player['y'],0,0,4);$s->step(['dx'=>0,'dy'=>0,'flags'=>1]);$rows[]=$b->snapshot();
 }
}
echo json_encode($rows,JSON_THROW_ON_ERROR);
