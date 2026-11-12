<?php
/* (C) 2026 Carinoasd. Deterministic Boss r3 patterns: 小典 / Codex. */
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
function danmaku_normal_rules(array $rules): array {
    $n=$rules['normal01'];$rules['limits']['enemySpawnCap']=$n['enemySpawnCap'];
    $rules['stage01']['enemyCap']=$n['preludeEnemyCap'];
    foreach($rules['stage01']['types'] as $i=>$type)$rules['stage01']['types'][$i]=array_replace($type,$n['types'][$i]);
    return $rules;
}
function danmaku_boss_pattern_r3(object $sim): void {
    $p=($sim->normalMode?$sim->rules['normal01']['boss']:$sim->rules['bossPatternsR3'])[$sim->index];
    $q=1+($sim->tick-1)%$p['cycleTicks'];$c=intdiv($sim->tick-1,$p['cycleTicks']);
    if($sim->index===0){
        $echo=in_array($q-$p['echoDelay'],$p['fireTicks'],true);$main=in_array($q,$p['fireTicks'],true);
        if(!$main&&!$echo)return;
        $burst=array_search($q-($echo?$p['echoDelay']:0),$p['fireTicks'],true);$ordinal=$c*count($p['fireTicks'])+$burst;
        $rotation=$p['rotations'][($sim->normalMode?$ordinal:$c)%count($p['rotations'])];$gap=$sim->normalMode?$p['gapAngles'][$ordinal%count($p['gapAngles'])]:128;
        for($i=0;$i<$p['slots'];$i++){
            $angle=intdiv($i*512,$p['slots'])+$rotation;$d=($angle-$gap+768)%512-256;
            if(abs($d)<=$p['gapHalfAngle'])continue;
            $sim->spawn($sim->boss['x'],$sim->boss['y'],$angle,$echo?$p['echoSpeed']:$p['speed'],$p['radius']);
        }
    }elseif($sim->index===1){
        if(in_array($q,$p['captureTicks'],true)){
            $dx=$sim->player['x']-$sim->boss['x'];$dy=$sim->player['y']-$sim->boss['y'];$best=PHP_INT_MIN;
            foreach($sim->rules['directionVectors'] as $i=>$v){$dot=$dx*$v[0]+$dy*$v[1];if($dot>$best){$best=$dot;$sim->aimAngle=$i;}}
            $sim->warningUntil=$sim->tick+$p['warningTicks'];
        }
        if(in_array($q,$p['fireTicks'],true))foreach($p['angles'] as $a)$sim->spawn($sim->boss['x'],$sim->boss['y'],$sim->aimAngle+$a,$p['speed'],$p['radius']);
    }else{
        if(in_array($q,$p['wallTicks'],true)){
            $gap=$p['gapCenters'][$c%count($p['gapCenters'])];
            foreach($p['columns'] as $x)if(abs($x-$gap)>$p['gapHalfWidth'])$sim->spawn($x*64,$p['wallY']*64,128,$p['wallSpeed'],$p['wallRadius']);
        }
        if(in_array($q,$p['fanTicks'],true)){
            foreach($p['leftAngles'] as $a)$sim->spawn(24*64,80*64,$a,$p['fanSpeed'],$p['fanRadius']);
            foreach($p['rightAngles'] as $a)$sim->spawn(456*64,80*64,$a,$p['fanSpeed'],$p['fanRadius']);
        }
    }
}
