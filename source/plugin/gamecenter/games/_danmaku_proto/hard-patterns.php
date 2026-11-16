<?php
/* (C) 2026 Carinoasd. Deterministic music-cued Hard: 小典 / Codex. */
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
function danmaku_hard_cue(array $rows,int $t): ?array {
    $lo=0;$hi=count($rows)-1;
    while($lo<=$hi){$mid=($lo+$hi)>>1;if($rows[$mid][0]===$t)return $rows[$mid];if($rows[$mid][0]<$t)$lo=$mid+1;else $hi=$mid-1;}
    return null;
}
function danmaku_hard_pattern(object $s): void {
    $rows=$s->rules['hard01']['bossPulses'];$t=$s->musicTick;$up=danmaku_hard_cue($rows,$t+24);$c=danmaku_hard_cue($rows,$t);
    if($up&&(($s->index===1&&$up[1]%8===0)||($s->index!==1&&$up[1]%4===0))){
        if($s->index===1){
            $dx=$s->player['x']-$s->boss['x'];$dy=$s->player['y']-$s->boss['y'];$best=PHP_INT_MIN;
            foreach($s->rules['directionVectors'] as $i=>$vec){$dot=$dx*$vec[0]+$dy*$vec[1];if($dot>$best){$best=$dot;$s->aimAngle=$i;}}
        }
        $s->warningUntil=$s->tick+24;
    }
    if(!$c||$s->tick<30)return;
    $n=$c[1];$q=$n%16;$v=$c[2];$bar=intdiv($n,16);$x=$s->boss['x'];$y=$s->boss['y'];
    if($s->index===0){
        if($q%4===0||$v>0&&$q%4===1){
            $echo=$q%4===1;$slots=$echo?32:($v===0?32:40);$gap=[104,116,128,140,152,140,128,116][intdiv($n,4)%8];$rotation=($bar%3-1)*5;
            for($i=0;$i<$slots;$i++){$a=intdiv($i*512,$slots)+$rotation;$d=($a-$gap+768)%512-256;if(abs($d)>18)$s->spawn($x,$y,$a,$echo?152:184,4,360,3);}
        }
        if($v>0&&$q%4===2)foreach([68,92,116,140] as $a){
            $s->spawn($x-64*64,$y+16*64,$a+($bar%2?8:-8),192,4,300,3);
            $s->spawn($x+64*64,$y+16*64,256-$a-($bar%2?8:-8),192,4,300,3);
        }
    }elseif($s->index===1){
        if($q%8<=2&&($v>0||$q%8===0)&&$s->warningUntil>0&&$s->tick>=$s->warningUntil&&$s->tick<=$s->warningUntil+30)for($i=-4;$i<=4;$i++)$s->spawn($x,$y,$s->aimAngle+$i*5,288+($q%8)*16,3,240,3);
        if($v>0&&($q%8===4||$v===2&&$q%8===6))foreach([48,64,80,96] as $a){$s->spawn(24*64,120*64,$a,208,3,300,3);$s->spawn(456*64,120*64,256-$a,208,3,300,3);}
    }else{
        if($q%2===0&&$q<12&&($v>0||$q%4===0)){
            $row=intdiv($q,2);$base=[128,240,352,240][$bar%4];$offset=[0,16,32,48,32,16][$row]*($bar%2?-1:1);$gate=$base+$offset;
            for($i=16;$i<=464;$i+=16)if(abs($i-$gate)>32)$s->spawn($i*64,48*64,128,224,5,240,3);
        }
        if($v>0&&($q===13||$q===15))foreach([48,64,80,96,112] as $a){$s->spawn(24*64,80*64,$a,224,4,300,3);$s->spawn(456*64,80*64,256-$a,224,4,300,3);}
    }
}
