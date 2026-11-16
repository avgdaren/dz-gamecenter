<?php
/* (C) 2026 Carinoasd. Original integer Hard v3 choreography: 小典 / Codex. */
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
function danmaku_choreo_direction(object $s,int $x,int $y,int $tx,int $ty): int {
    $dx=$tx-$x;$dy=$ty-$y;$best=PHP_INT_MIN;$angle=128;
    foreach($s->rules['directionVectors'] as $i=>$v){$dot=$dx*$v[0]+$dy*$v[1];if($dot>$best){$best=$dot;$angle=$i;}}return $angle;
}
function danmaku_choreo_emit(object $s,int $x,int $y,int $angle,int $speed,int $radius,int $ttl,int $kind,array $o=[]): void {
    $safe=$s->rules['hard03']['minimumSpawnDistance']*64;$dx=$x-$s->player['x'];$dy=$y-$s->player['y'];if($dx*$dx+$dy*$dy<$safe*$safe)return;
    $s->spawn($x,$y,$angle,$speed,$radius,$ttl,$kind);$i=count($s->enemies)-1;
    $s->enemies[$i][10]=[(($angle*256)%131072+131072)%131072,$speed,$o['turn']??0,$o['accel']??0,$o['changeAge']??-1,$o['mode']??0,$o['angle']??0,$o['nextSpeed']??$speed,$o['nextTurn']??0,0,0];
}
function danmaku_choreo_motion(object $s): void {
    $keep=[];$births=[];$r=$s->rules;
    foreach($s->enemies as $e){
        if(!isset($e[10])){$keep[]=$e;continue;}$m=$e[10];$age=$s->tick-$e[6];
        if($m[4]>=0&&!$m[9]){
            if(($m[5]===2||$m[5]===4)&&$age===max(0,$m[4]-24))$m[10]=danmaku_choreo_direction($s,$e[1],$e[2],$s->player['x'],$s->player['y'])*256;
            if($age>=$m[4]){
                if($m[5]===4){for($lane=-2;$lane<=2;$lane++)$births[]=[$e[1],$e[2],intdiv($m[10],256)+$lane*8,208+abs($lane)*8,3,260,23];continue;}
                if($m[5]===1)$m[0]+=$m[6]*256;elseif($m[5]===2)$m[0]=$m[10];elseif($m[5]===3)$m[0]=$m[6]*256;
                $m[1]=$m[7];$m[2]=$m[8];$m[3]=0;$m[9]=1;
            }
        }
        $m[0]=(($m[0]+$m[2])%131072+131072)%131072;$m[1]=max(0,$m[1]+$m[3]);$speed=$m[1];
        if($s->assist)$speed=intdiv($speed*$r['assist']['enemySpeedNumerator'],$r['assist']['enemySpeedDenominator']);
        $v=$r['directionVectors'][intdiv($m[0],256)];$e[3]=intdiv($speed*$v[0],1024);$e[4]=intdiv($speed*$v[1],1024);$e[10]=$m;$keep[]=$e;
    }
    $s->enemies=$keep;foreach($births as $b)danmaku_choreo_emit($s,...$b);
}
function danmaku_choreo_pulse_index(array $rows,int $t): int {
    $lo=0;$hi=count($rows)-1;while($lo<=$hi){$mid=($lo+$hi)>>1;if($rows[$mid][0]===$t)return $mid;if($rows[$mid][0]<$t)$lo=$mid+1;else $hi=$mid-1;}return -1;
}
function danmaku_choreo_pattern(object $s): void {
    $rows=$s->rules['hard01']['bossPulses'];$index=danmaku_choreo_pulse_index($rows,$s->musicTick);$c=$index>=0?$rows[$index]:null;if(!$c||$s->tick<30)return;
    $n=$c[1];$q=$n%32;$group=intdiv($n,32);$strong=$c[2]>0;$x=$s->boss['x'];$y=$s->boss['y'];
    if($s->index===0){
        $gap=[104,116,128,140,152,140,128,116][intdiv($n,4)%8];$turn=$group%2?48:-48;
        if($q%4===0){$count=$strong?40:32;for($i=0;$i<$count;$i++){$a=intdiv($i*512,$count)+($group%3-1)*4;$d=($a-$gap+768)%512-256;
            if(abs($d)>24)danmaku_choreo_emit($s,$x,$y,$a,160+($i%4)*4,4,360,20,['turn'=>$turn,'changeAge'=>100,'mode'=>1,'nextSpeed'=>176,'nextTurn'=>-$turn]);}}
        if($strong&&$q%4===2)for($i=0;$i<24;$i++){$a=intdiv($i*512,24)+($q%8?5:-5);$d=($a-$gap+768)%512-256;
            if(abs($d)>30)danmaku_choreo_emit($s,$x,$y,$a,144,3,340,23,['turn'=>-$turn,'changeAge'=>100,'mode'=>1,'nextSpeed'=>160,'nextTurn'=>$turn]);}
    }elseif($s->index===1){
        if($q%8===0){$future=$rows[min(count($rows)-1,$index+8)];$delay=max(72,$future[0]-$c[0]);
            for($i=0;$i<5;$i++)danmaku_choreo_emit($s,$x,$y,48+$i*40,160,6,$delay+2,24,['accel'=>-3,'changeAge'=>$delay,'mode'=>4,'nextSpeed'=>0]);}
        if($strong&&$q%8===4)for($i=0;$i<13;$i++)danmaku_choreo_emit($s,$x,$y,64+$i*10+($group%2?4:-4),144,3,300,22,['turn'=>$group%2?24:-24,'changeAge'=>120,'mode'=>1,'nextSpeed'=>160,'nextTurn'=>0]);
    }else{
        if($q<24){$sweep=[76,84,92,100,108,116,124,116,108,100,92,84][$q%12];$lanes=$strong?[-8,-4,0,4,8]:[-6,0,6];
            foreach($lanes as $k=>$offset){
                danmaku_choreo_emit($s,84*64,104*64,$sweep+$offset,156+($k%2)*12,3,320,$group%2?23:22,['turn'=>64,'changeAge'=>90,'mode'=>1,'nextSpeed'=>168,'nextTurn'=>-64]);
                danmaku_choreo_emit($s,396*64,104*64,256-$sweep-$offset,156+($k%2)*12,4,320,$group%2?20:21,['turn'=>-64,'changeAge'=>90,'mode'=>1,'nextSpeed'=>168,'nextTurn'=>64]);}}
        if($q===24||$q===28){$gateX=[160,240,320,240][$group%4];$opening=danmaku_choreo_direction($s,$x,$y,$gateX*64,520*64);
            for($i=0;$i<28;$i++){$a=intdiv($i*512,28)+($q===28?9:0);$d=($a-$opening+768)%512-256;if(abs($d)>28)danmaku_choreo_emit($s,$x,$y,$a,$q===24?144:136,4,340,$q===24?21:20);}}
    }
}
