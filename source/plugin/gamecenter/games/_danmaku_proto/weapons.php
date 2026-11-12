<?php
/* (C) 2026 Carinoasd. Integer homing replay: 小典 / Codex. */
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
function danmaku_weapon_targets(object $sim): array {
 if($sim->index>=0)return $sim->hp>0?[['id'=>0,'x'=>$sim->boss['x'],'y'=>$sim->boss['y']]]:[];
 $out=[];foreach($sim->mobs as $m)if($m['hp']>0&&$m['y']>=-2048&&$m['y']<=40960)$out[]=['id'=>$m['id'],'x'=>$m['x'],'y'=>$m['y']];return $out;
}
function danmaku_weapon_approach(int $v,int $w,int $step): int {return $v<$w?min($w,$v+$step):max($w,$v-$step);}
function danmaku_weapon_tracking(object $sim): void {
 $targets=danmaku_weapon_targets($sim);$config=$sim->rules['weapons06']['tracking'];
 foreach($sim->shots as &$s){
  if($s[9]!==1)continue;$target=null;foreach($targets as $t)if($t['id']===$s[10]){$target=$t;break;}
  if($target===null){$best=PHP_INT_MAX;foreach($targets as $t){$dx=$t['x']-$s[1];$dy=$t['y']-$s[2];$d=$dx*$dx+$dy*$dy;if($target===null||$d<$best||($d===$best&&$t['id']<$target['id'])){$best=$d;$target=$t;}}}
  $s[10]=$target['id']??-1;if($target===null)continue;
  $dx=$target['x']-$s[1];$dy=$target['y']-$s[2];$d=max(1,abs($dx),abs($dy));
  $s[4]=danmaku_weapon_approach($s[4],intdiv($dx*$config['speedQ'],$d),$config['turnStepQ']);$s[5]=danmaku_weapon_approach($s[5],intdiv($dy*$config['speedQ'],$d),$config['turnStepQ']);
 }unset($s);
}
