<?php
/* (C) 2026 Carinoasd. Exact corner attraction boundaries: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$packet=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$rows=[];
foreach($packet['cases'] as $c){
 $b=new DanmakuStage01($r,$c['assist'],$c['rule']);$s=$b->sim;$s->player['x']=$s->player['px']=$c['x'];$s->player['y']=$s->player['py']=$c['y'];
 foreach([[0,1,false],[0,4,true],[1,1,false],[2,1,false]] as [$kind,$value,$recovery])$s->drop(240*64,620*64,$value,$recovery,$kind);
 $s->tick=1;$s->items(['flags'=>$c['flags']]);$first=$b->snapshot();
 if($c['leave']){$s->player['x']=$s->player['px']=240*64;$s->player['y']=$s->player['py']=550*64;}
 for($t=2;$t<=80;$t++){$s->tick=$t;$s->items(['flags'=>$c['flags']]);}
 $rows[]=[$first,$b->snapshot()];
}
echo json_encode($rows,JSON_THROW_ON_ERROR);
