<?php
/* (C) 2026 Carinoasd. Local bomb boundary fixtures: 小典 / Codex. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
$r=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
function fresh(array $r,int $index=0): DanmakuStage01Sim{return new DanmakuStage01Sim($r,$index,false,DanmakuStage01::BOMB_RULE);}
function idle(int $flags=1): array{return ['dx'=>0,'dy'=>0,'flags'=>$flags];}
$results=[];$s=fresh($r,-1);$s->step(idle(3));
for($t=2;$t<=90;$t++){$s->spawn($s->player['x'],$s->player['y'],0,0,4);$s->step(idle());}
$at90=['tick'=>$s->tick,'cleared'=>$s->stats['bombCleared'],'enemies'=>count($s->enemies),'lives'=>$s->player['lives'],'damage'=>$s->stats['bombDamage']];
$s->spawn($s->player['x'],$s->player['y'],0,0,4);$s->step(idle(3));
$at91=['tick'=>$s->tick,'enemies'=>count($s->enemies),'bombs'=>$s->player['bombs'],'lives'=>$s->player['lives']];
while($s->tick<120)$s->step(idle());$s->step(idle());
$results['duration']=['at90'=>$at90,'at91'=>$at91,'at121'=>['tick'=>$s->tick,'lives'=>$s->player['lives'],'used'=>$s->stats['bombsUsed']]];
$s=fresh($r);$s->hp=137;$s->step(idle(3));$results['bossClip']=['hp'=>$s->hp,'status'=>$s->status,'damage'=>$s->stats['damage'],'bombDamage'=>$s->stats['bombDamage']];
$s=fresh($r,-1);$s->tick=2300;$s->pattern();$guardian=array_search(2,array_column($s->mobs,'type'),true);
$s->damageMob($guardian,300,true);$first=$s->mobs[$guardian]['hp'];$s->damageMob($guardian,60,false);$s->damageMob($guardian,999,true);
$b=array_values(array_filter($s->drops,fn($d)=>$d['kind']===1));$s->collect($b[0]);$s->collect(['kind'=>1,'value'=>1,'recovery'=>false]);
$results['supply']=['after300'=>$first,'kills'=>$s->stats['mobKills'],'bombKills'=>$s->stats['bombKills'],'spawned'=>$s->stats['bombItemsSpawned'],'stock'=>$s->player['bombs'],'collected'=>$s->stats['bombCollected'],'overflow'=>$s->stats['bombOverflowTokens'],'power'=>$s->player['power']];
$b=new DanmakuStage01($r,false,DanmakuStage01::BOMB_RULE);$b->sim->tick=4319;$b->sim->hp=0;$b->step(idle(3));
$before=['stage'=>$b->stage,'stock'=>$b->sim->player['bombs'],'active'=>$b->sim->bombActiveUntil,'cooldown'=>$b->sim->bombCooldownUntil,'invul'=>$b->sim->player['invulUntil']];
for($i=0;$i<180;$i++)$b->step(idle(3));$b->step(idle());
$results['transition']=['before'=>$before,'stage'=>$b->stage,'stock'=>$b->sim->player['bombs'],'active'=>$b->sim->bombActiveUntil,'cooldown'=>$b->sim->bombCooldownUntil,'used'=>$b->stats['bombsUsed']];
$values=[];
foreach(['vertical','horizontal','tangent','outside'] as $mode){
    $s=fresh($r);$radius=($r['playerShot']['radius']+$r['boss']['hitRadius'])*64;
    if($mode==='horizontal'){$s->tick=100;$s->boss['x']=DanmakuP0Sim::bossX(100);}
    $shot=[1,$s->boss['x'],$s->boss['y'],$s->tick,0,0,8,1,1];
    if($mode==='vertical'){$shot[2]+=7200;$shot[5]=-14400;}
    if($mode==='horizontal'){$shot[1]-=3000;$shot[4]=6000;}
    if($mode==='tangent')$shot[1]+=$radius;if($mode==='outside')$shot[1]+=$radius+1;
    $s->shots=[$shot];$s->nextShot=2;$s->step(idle());$values[]=$s->hp;
}
$results['shotsSweep']=$values;
echo json_encode($results,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
