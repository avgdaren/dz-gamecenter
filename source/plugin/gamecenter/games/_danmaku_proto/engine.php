<?php
/* (C) 2026 Carinoasd. P0 local rules implementation: 小典 / Codex. */
if (PHP_SAPI !== 'cli' || !defined('DANMAKU_P0_LOCAL')) {
    http_response_code(404);
    exit;
}

class DanmakuP0Sim {
    public array $rules;
    public string $scene;
    public bool $assist;
    public int $tick = 0;
    public string $status = 'playing';
    public array $player;
    public array $boss;
    public array $enemies = [];
    public array $shots = [];
    public int $nextEnemy = 1;
    public int $nextShot = 1;
    public int $aimAngle = 128;
    public int $warningUntil = 0;
    public array $stats = ['damage'=>0, 'shotHits'=>0, 'hitsTaken'=>0, 'graze'=>0,
        'bombsUsed'=>0, 'enemySpawned'=>0, 'enemyPeak'=>0];

    public function __construct(array $rules, string $scene, bool $assist) {
        if (!in_array($scene, ['flower','aim','wave'], true)) throw new RuntimeException('未知的原型场景');
        $this->rules = $rules;
        $this->scene = $scene;
        $this->assist = $assist;
        $this->player = ['x'=>15360, 'y'=>35328, 'px'=>15360, 'py'=>35328,
            'lives'=>$assist ? $rules['assist']['lives'] : $rules['player']['standardLives'],
            'bombs'=>$assist ? $rules['assist']['bombs'] : $rules['player']['standardBombs'], 'invulUntil'=>0];
        $this->boss = ['x'=>15360, 'y'=>5632, 'px'=>15360, 'py'=>5632];
    }
    public static function validateInput(array $input, array $rules): void {
        if (!isset($input['dx'], $input['dy'], $input['flags']) || !is_int($input['dx']) ||
            !is_int($input['dy']) || !is_int($input['flags']) || $input['flags'] < 0 || $input['flags'] > 3) {
            throw new RuntimeException('输入格式或操作标记无效');
        }
        $limit = ($input['flags'] & 1) ? $rules['player']['slowStepQ'] : $rules['player']['normalStepQ'];
        if (abs($input['dx']) > $limit || abs($input['dy']) > $limit ||
            $input['dx']*$input['dx'] + $input['dy']*$input['dy'] > $limit*$limit) {
            throw new RuntimeException('移动速度超出规则上限');
        }
    }
    public static function sweptHit(int $x0, int $y0, int $x1, int $y1, int $radius): bool {
        if (($x0>$radius && $x1>$radius) || ($x0<-$radius && $x1<-$radius) ||
            ($y0>$radius && $y1>$radius) || ($y0<-$radius && $y1<-$radius)) return false;
        $vx = $x1-$x0; $vy = $y1-$y0;
        $length = $vx*$vx+$vy*$vy; $rr = $radius*$radius;
        if (!$length) return $x0*$x0+$y0*$y0 <= $rr;
        $dot = $x0*$vx+$y0*$vy;
        if ($dot >= 0) return $x0*$x0+$y0*$y0 <= $rr;
        if ($dot <= -$length) return $x1*$x1+$y1*$y1 <= $rr;
        $cross = $x0*$vy-$y0*$vx;
        return $cross*$cross <= $rr*$length;
    }
    private static function touches(array $bullet, array $actor, int $radius): bool {
        return self::sweptHit($bullet['px']-$actor['px'], $bullet['py']-$actor['py'],
            $bullet['x']-$actor['x'], $bullet['y']-$actor['y'], $radius);
    }
    public static function bossX(int $tick): int {
        $u = ($tick-1)%480;
        if ($u < 120) $offset = intdiv(4096*$u,120);
        elseif ($u < 360) $offset = 4096-intdiv(8192*($u-120),240);
        else $offset = -4096+intdiv(4096*($u-360),120);
        return 15360+$offset;
    }
    public function spawn(int $x, int $y, int $angle, int $speed, int $radius): void {
        $r = $this->rules;
        $vector = $r['directionVectors'][($angle%512+512)%512];
        if ($this->assist) $speed = intdiv($speed*$r['assist']['enemySpeedNumerator'],$r['assist']['enemySpeedDenominator']);
        $this->enemies[] = ['id'=>$this->nextEnemy++, 'x'=>$x, 'y'=>$y, 'px'=>$x, 'py'=>$y,
            'vx'=>intdiv($speed*$vector[0],1024), 'vy'=>intdiv($speed*$vector[1],1024),
            'radius'=>$radius, 'born'=>$this->tick, 'grazed'=>false];
        $this->stats['enemySpawned']++;
        if (count($this->enemies) > $r['limits']['enemyLiveCap'] || $this->stats['enemySpawned'] > $r['limits']['enemySpawnCap']) {
            throw new RuntimeException('弹幕超出设计上限，本局已停止');
        }
        $this->stats['enemyPeak'] = max($this->stats['enemyPeak'],count($this->enemies));
    }
    public function pattern(): void {
        $t = $this->tick; $r = $this->rules; $pattern = $r['patterns'][$this->scene];
        $q = 1+($t-1)%720; $c = intdiv($t-1,720);
        if ($this->scene === 'flower' && $t >= $pattern['firstTick'] && ($t-$pattern['firstTick'])%$pattern['intervalTicks'] === 0) {
            $n = intdiv($t-$pattern['firstTick'],$pattern['intervalTicks']);
            $rotation = $pattern['rotationSequence'][$n%count($pattern['rotationSequence'])];
            for ($i=0; $i<$pattern['ringSlots']; $i++) {
                if (!in_array($i,$pattern['omittedIndices'],true)) $this->spawn($this->boss['x'],$this->boss['y'],
                    $rotation+$i*$pattern['slotAngleUnits'],$pattern['speedStepQ'],$pattern['radius']);
            }
        }
        if ($this->scene === 'aim') {
            if ($q === $pattern['captureCycleTick']) {
                $dx = $this->player['x']-$this->boss['x']; $dy = $this->player['y']-$this->boss['y']; $best = PHP_INT_MIN;
                foreach ($r['directionVectors'] as $i=>$vector) {
                    $dot = $dx*$vector[0]+$dy*$vector[1];
                    if ($dot > $best) { $best = $dot; $this->aimAngle = $i; }
                }
                $this->warningUntil = $t+30;
            }
            if (in_array($q,$pattern['fireCycleTicks'],true)) {
                foreach ($pattern['angleOffsets'] as $angle) $this->spawn($this->boss['x'],$this->boss['y'],
                    $this->aimAngle+$angle,$pattern['speedStepQ'],$pattern['radius']);
            }
        }
        if ($this->scene === 'wave') {
            foreach ($pattern['batchCycleTicks'] as $i=>$start) {
                $row = array_search($q-$start,$pattern['rowOffsets'],true);
                if ($row === false) continue;
                $gap = $pattern['gapStartSequence'][(2*$c+$i)%count($pattern['gapStartSequence'])];
                foreach ($pattern['columnsX'] as $j=>$x) {
                    if ($j < $gap || $j >= $gap+$pattern['omitColumns']) $this->spawn(
                        ($x+$pattern['rowShiftSequence'][$row])*64,112*64,128,$pattern['speedStepQ'],$pattern['radius']);
                }
            }
        }
    }
    public function step(array $input): string {
        if ($this->status !== 'playing') throw new RuntimeException('终局后不能追加输入');
        self::validateInput($input,$this->rules);
        $this->tick++;
        $t = $this->tick; $r = $this->rules;
        $p = &$this->player; $b = &$this->boss;
        $p['px']=$p['x']; $p['py']=$p['y']; $b['px']=$b['x']; $b['py']=$b['y'];
        $bounds = $r['field']['playerBounds'];
        $p['x']=max($bounds['minX']*64,min($bounds['maxX']*64,$p['x']+$input['dx']));
        $p['y']=max($bounds['minY']*64,min($bounds['maxY']*64,$p['y']+$input['dy']));
        $b['x']=self::bossX($t);
        if (($t-$r['playerShot']['firstPhaseTick'])%$r['playerShot']['intervalTicks'] === 0) {
            $this->shots[]=['id'=>$this->nextShot++, 'x'=>$p['x'], 'y'=>$p['y']-1024,
                'px'=>$p['x'], 'py'=>$p['y']-1024, 'born'=>$t];
            if (count($this->shots)>$r['limits']['playerShotLiveCap']) throw new RuntimeException('自机子弹超出设计上限');
        }
        $this->pattern();
        foreach ($this->enemies as &$e) { $e['px']=$e['x']; $e['py']=$e['y']; $e['x']+=$e['vx']; $e['y']+=$e['vy']; }
        unset($e);
        foreach ($this->shots as &$s) { $s['px']=$s['x']; $s['py']=$s['y']; $s['y']-=$r['playerShot']['speedStepQ']; }
        unset($s);
        if (($input['flags']&2) && $p['bombs']>0) {
            $p['bombs']--; $this->stats['bombsUsed']++; $this->enemies=[];
            $p['invulUntil']=max($p['invulUntil'],$t+$r['player']['bombInvulnerabilityTicks']);
        }
        if ($t >= $p['invulUntil']) {
            $collided=[];
            foreach ($this->enemies as $e) if (self::touches($e,$p,($r['player']['hitRadius']+$e['radius'])*64)) $collided[$e['id']]=true;
            if ($collided) {
                $p['lives']--; $this->stats['hitsTaken']++;
                $p['invulUntil']=max($p['invulUntil'],$t+$r['player']['hitInvulnerabilityTicks']);
                $clearRadius=$r['player']['hitClearRadius']*64; $keep=[];
                foreach ($this->enemies as $e) {
                    $dx=$e['x']-$p['x']; $dy=$e['y']-$p['y'];
                    if (!isset($collided[$e['id']]) && $dx*$dx+$dy*$dy>$clearRadius*$clearRadius) $keep[]=$e;
                }
                $this->enemies=$keep;
            }
        }
        if ($p['lives']<=0) $this->status='dead';
        else {
            $keep=[];
            foreach ($this->shots as $s) {
                if (self::touches($s,$b,($r['playerShot']['radius']+$r['boss']['hitRadius'])*64)) {
                    $this->stats['damage']+=$r['playerShot']['damage']; $this->stats['shotHits']++;
                } else $keep[]=$s;
            }
            $this->shots=$keep;
            if ($t >= $r['clock']['singlePatternTicks']) $this->status='complete';
            elseif ($t >= $p['invulUntil']) {
                foreach ($this->enemies as &$e) {
                    if (!$e['grazed'] && self::touches($e,$p,($r['player']['grazeCenterRadius']+$e['radius'])*64)) {
                        $e['grazed']=true; $this->stats['graze']++;
                    }
                }
                unset($e);
            }
        }
        $margin=$r['field']['enemyCullMargin']*64; $width=$r['field']['width']*64; $height=$r['field']['height']*64;
        $keep=[];
        foreach ($this->enemies as $e) {
            if ($t-$e['born']+1<480 && $e['x']>=-$margin && $e['x']<=$width+$margin &&
                $e['y']>=-$margin && $e['y']<=$height+$margin) $keep[]=$e;
        }
        $this->enemies=$keep; $keep=[];
        foreach ($this->shots as $s) {
            if ($t-$s['born']+1<$r['playerShot']['ttlTicks'] && $s['x']>=-$margin && $s['x']<=$width+$margin &&
                $s['y']>=-$margin && $s['y']<=$height+$margin) $keep[]=$s;
        }
        $this->shots=$keep;
        return $this->status;
    }
    public function snapshot(): array {
        $p=$this->player; $s=$this->stats;
        return ['tick'=>$this->tick, 'scene'=>$this->scene, 'assist'=>$this->assist, 'status'=>$this->status,
            'player'=>[$p['x'],$p['y'],$p['lives'],$p['bombs'],$p['invulUntil']], 'boss'=>[$this->boss['x'],$this->boss['y']],
            'aim'=>[$this->aimAngle,$this->warningUntil],
            'stats'=>[$s['damage'],$s['shotHits'],$s['hitsTaken'],$s['graze'],$s['bombsUsed'],$s['enemySpawned'],$s['enemyPeak']],
            'nextIds'=>[$this->nextEnemy,$this->nextShot],
            'enemies'=>array_map(static fn($e)=>[$e['id'],$e['x'],$e['y'],$e['vx'],$e['vy'],$e['radius'],$e['born'],$e['grazed']?1:0],$this->enemies),
            'shots'=>array_map(static fn($shot)=>[$shot['id'],$shot['x'],$shot['y'],$shot['born']],$this->shots)];
    }
}

function danmaku_p0_decode(array $payload, array $rules): array {
    if (array_diff(array_keys($payload),['prototype','rule','scene','assist','ticks','input']) ||
        ($payload['prototype']??null)!==true || ($payload['rule']??null)!==$rules['meta']['rulesId'] ||
        !in_array($payload['scene']??null,['flower','aim','wave'],true) || !isset($payload['assist']) || !is_bool($payload['assist']) ||
        !isset($payload['ticks']) || !is_int($payload['ticks']) || $payload['ticks']<1 || $payload['ticks']>$rules['clock']['singlePatternTicks'] ||
        !isset($payload['input']) || !is_string($payload['input']) || strlen($payload['input'])>4*(int)ceil($payload['ticks']*5/3) ||
        strlen($payload['input'])%4!==0 || !preg_match('/\A[A-Za-z0-9+\/]*={0,2}\z/D',$payload['input'])) {
        throw new RuntimeException('回放格式、版本或步数无效');
    }
    $raw=base64_decode($payload['input'],true);
    if ($raw===false || strlen($raw)!==$payload['ticks']*5 || base64_encode($raw)!==$payload['input']) throw new RuntimeException('回放字节长度或编码无效');
    $records=[];
    for ($i=0;$i<$payload['ticks'];$i++) {
        $at=$i*5; $dx=ord($raw[$at])+(ord($raw[$at+1])<<8); $dy=ord($raw[$at+2])+(ord($raw[$at+3])<<8);
        $input=['dx'=>$dx>=32768?$dx-65536:$dx,'dy'=>$dy>=32768?$dy-65536:$dy,'flags'=>ord($raw[$at+4])];
        DanmakuP0Sim::validateInput($input,$rules); $records[]=$input;
    }
    return $records;
}
function danmaku_p0_replay(array $payload, array $rules, bool $partial=false): array {
    $records=danmaku_p0_decode($payload,$rules);
    $sim=new DanmakuP0Sim($rules,$payload['scene'],$payload['assist']); $trace=[];
    foreach ($records as $input) {
        $sim->step($input);
        if ($sim->tick%60===0 || $sim->status!=='playing') $trace[]=$sim->snapshot();
    }
    if (!$partial && $sim->status==='playing') throw new RuntimeException('回放尚未自然结束');
    return ['snapshot'=>$sim->snapshot(),'trace'=>$trace];
}
