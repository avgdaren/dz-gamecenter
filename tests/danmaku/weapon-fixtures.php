<?php
/* (C) 2026 Carinoasd. Isolated laser/homing parity fixture: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$packet=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$rows=[];
function targetMob(int $id,int $x,int $y,int $hp=100): array{return ['id'=>$id,'type'=>0,'x'=>$x*64,'y'=>$y*64,'px'=>$x*64,'py'=>$y*64,'hp'=>$hp,'reward'=>0,'born'=>0,'baseX'=>0,'mirror'=>false,'aim'=>128,'warningUntil'=>0,'warningKind'=>0];}
if($packet['action']==='phases')foreach($packet['cases'] as $c){$s=new DanmakuStage01Sim($r,$c['index'],$c['assist'],$c['rule']);$s->player['power']=$c['power'];$s->player['invulUntil']=1000000;$trace=[];foreach($c['inputs'] as $input){$s->step($input);if($s->tick%60===0)$trace[]=$s->snapshot();}$rows[]=$trace;}
if($packet['action']==='tracking-edges'){
 $s=new DanmakuStage01Sim($r,-1,false,DanmakuStage01::WEAPON_RULE);$s->mobs=[targetMob(7,300,300),targetMob(2,180,300)];$s->shots=[[1,240*64,500*64,1,0,-576,1,0,5,1,-1]];
 danmaku_weapon_tracking($s);$rows[]=[$s->shots[0][4],$s->shots[0][5],$s->shots[0][10]];$s->mobs[]=targetMob(1,240,490);
 danmaku_weapon_tracking($s);$rows[]=[$s->shots[0][4],$s->shots[0][5],$s->shots[0][10]];$s->mobs[1]['hp']=0;
 danmaku_weapon_tracking($s);$rows[]=[$s->shots[0][4],$s->shots[0][5],$s->shots[0][10]];$s->mobs=[];
 danmaku_weapon_tracking($s);$rows[]=[$s->shots[0][4],$s->shots[0][5],$s->shots[0][10]];
}
echo json_encode($rows,JSON_THROW_ON_ERROR);
