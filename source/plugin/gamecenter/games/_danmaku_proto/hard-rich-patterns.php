<?php
/* (C) 2026 Carinoasd. Deterministic Hard v2 variations: 小典 / Codex. */
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
require_once __DIR__.'/hard-patterns.php';
function danmaku_hard_rich_pattern(object $s): void {
    $rows=$s->rules['hard01']['bossPulses'];$up=danmaku_hard_cue($rows,$s->musicTick+24);$c=danmaku_hard_cue($rows,$s->musicTick);
    if($up&&(($s->index===1&&$up[1]%8===0)||($s->index!==1&&$up[1]%4===0))){
        if($s->index===1){$dx=$s->player['x']-$s->boss['x'];$dy=$s->player['y']-$s->boss['y'];$best=PHP_INT_MIN;
            foreach($s->rules['directionVectors'] as $i=>$vec){$d=$dx*$vec[0]+$dy*$vec[1];if($d>$best){$best=$d;$s->aimAngle=$i;}}}
        $s->warningUntil=$s->tick+24;
    }
    if(!$c||$s->tick<30)return;
    $n=$c[1];$q=$n%16;$v=$c[2];$bar=intdiv($n,16);$variant=$bar%2;$x=$s->boss['x'];$y=$s->boss['y'];
    if($s->index===0){
        $gap=[104,116,128,140,152,140,128,116][intdiv($n,4)%8];
        if($q%4===0){
            if(!$variant){
                for($i=0;$i<36;$i++){$a=intdiv($i*512,36)+($bar%3-1)*5;$d=($a-$gap+768)%512-256;
                    if(abs($d)>18)$s->spawn($x,$y,$a,[152,176,208,232,208,176][$i%6],4,330,$i%2?11:10);}
            }else for($i=0;$i<6;$i++)for($j=0;$j<4;$j++){
                $angle=intdiv($i*512,6)+($n*3)%64+$j*4;$delta=($angle-$gap+768)%512-256;
                if(abs($delta)>18)$s->spawn($x,$y,$angle,152+$j*32,4,330,$j%2?13:17);
            }
        }
        if($v>0&&$q%4===1)for($i=0;$i<24;$i++){$echo=intdiv($i*512,24)+($bar%2?6:-6);$dist=($echo-$gap+768)%512-256;
            if(abs($dist)>20)$s->spawn($x,$y,$echo,144,4,330,$variant?14:15);}
        if($v>0&&$q%4===2)foreach([68,92,116,140] as $k=>$a){$turn=($bar%4-1)*6;
            $s->spawn($x-64*64,$y+16*64,$a+$turn,192+$k*8,3,280,$variant?12:16);
            $s->spawn($x+64*64,$y+16*64,256-$a-$turn,192+$k*8,3,280,$variant?16:12);}
    }elseif($s->index===1){
        if($q%8<=2&&($v>0||$q%8===0)&&$s->warningUntil>0&&$s->tick>=$s->warningUntil&&$s->tick<=$s->warningUntil+30){
            if(!$variant)for($i=-4;$i<=4;$i++)$s->spawn($x,$y,$s->aimAngle+$i*5,272+($q%8)*24,3,240,$q%8===1?15:12);
            else for($j=-1;$j<=1;$j+=2)for($i=-3;$i<=3;$i++)$s->spawn($x+$j*18*64,$y,$s->aimAngle+$i*6+$j*3,256+($q%8)*24,3,240,$j<0?11:14);
        }
        if($v>0&&($q%8===4||$v===2&&$q%8===6))foreach([48,64,80,96] as $k=>$a){$sweep=$variant?($q%8===4?-8:8):0;
            $s->spawn(24*64,120*64,$a+$sweep,192+$k*8,4,280,$variant?17:16);
            $s->spawn(456*64,120*64,256-$a-$sweep,192+$k*8,4,280,$variant?13:10);}
    }else{
        if($q%2===0&&$q<12&&($v>0||$q%4===0)){
            $row=intdiv($q,2);$base=[128,240,352,240][$bar%4];$gate=$base+[0,16,32,48,32,16][$row]*($bar%2?-1:1);
            for($i=16+($variant&&$row%2?8:0);$i<=464;$i+=$variant?24:16)if(abs($i-$gate)>32)$s->spawn($i*64,48*64,128+($variant?($row%2?5:-5):0),216,5,240,$variant?($row%2?14:16):($row%2?13:12));
        }
        if($v>0&&($q===13||$q===15))foreach([48,64,80,96,112] as $k=>$a){
            $s->spawn(24*64,80*64,$a+($variant?6:0),208+$k*8,4,280,$variant?11:15);
            $s->spawn(456*64,80*64,256-$a-($variant?6:0),208+$k*8,4,280,$variant?17:10);}
    }
}
