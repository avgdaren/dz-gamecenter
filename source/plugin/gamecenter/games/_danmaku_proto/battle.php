<?php
/* (C) 2026 Carinoasd. Local P1 battle rules: 小典 / Codex. */
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
require_once __DIR__.'/engine.php';
require_once __DIR__.'/boss-patterns.php';

class DanmakuP1Phase extends DanmakuP0Sim {
    public int $index;
    public bool $patternV3=false;
    public bool $normalMode=false;
    public int $normalRevision=0;
    public int $hp;
    public function __construct(array $rules,int $index,bool $assist,bool $focusFire=false,bool $patternV3=false,bool $normalMode=false,array $options=[]){
        if($normalMode)$rules=danmaku_normal_rules($rules,$options['normalRevision']??1);
        parent::__construct($rules,$index===1?'aim':'flower',$assist,$focusFire?parent::FOCUS_RULE:parent::RULE);
        $this->patternV3=$patternV3||$normalMode;$this->normalMode=$normalMode;$this->index=$index;
        $this->normalRevision=$normalMode?($options['normalRevision']??1):0;$this->respawnBombs=$options['respawnBombs']??false;
        $this->hp=$rules['boss']['phaseHP'][$index];
    }
    public function damageBoss(int $damage): void {
        $applied=min($this->hp,$damage);
        $this->hp-=$applied;$this->stats['damage']+=$applied;
        if($applied>0)$this->stats['shotHits']++;
    }
    public function resolveEnd(): void {
        if($this->hp<=0)$this->status='phase_clear';
        elseif($this->tick>=$this->rules['clock']['phaseMaxTicks'])$this->status='timeout';
    }
    public function pattern(): void {
        if($this->patternV3){danmaku_boss_pattern_r3($this);return;}
        if($this->index===0){parent::pattern();return;}
        if($this->index===1){
            $this->scene='aim';parent::pattern();
            $this->scene='wave';parent::pattern();$this->scene='aim';return;
        }
        $r=$this->rules;$p=$r['patterns']['phase3'];$wave=$r['patterns']['wave'];
        $q=1+($this->tick-1)%$p['cycleTicks'];$c=intdiv($this->tick-1,$p['cycleTicks']);
        $j=array_search($q,$p['flowerCycleTicks'],true);
        if($j!==false){
            $rotations=$r['patterns']['flower']['rotationSequence'];$rotation=$rotations[(3*$c+$j)%count($rotations)];
            for($i=0;$i<32;$i++)if(!in_array($i,$p['flowerOmittedIndices'],true)){
                $this->spawn($this->boss['x'],$this->boss['y'],$rotation+$i*16,$p['flowerSpeedStepQ'],5);
            }
        }
        foreach($p['waveBatchCycleTicks'] as $i=>$start){
            $row=array_search($q-$start,$wave['rowOffsets'],true);
            if($row===false)continue;
            $gap=$wave['gapStartSequence'][(2*$c+$i)%count($wave['gapStartSequence'])];
            foreach($wave['columnsX'] as $j=>$x)if($j<$gap||$j>=$gap+$p['waveOmitColumns']){
                $this->spawn(($x+$wave['rowShiftSequence'][$row])*64,112*64,128,$p['waveSpeedStepQ'],6);
            }
        }
        if($q===$p['aimCaptureCycleTick']){
            $dx=$this->player['x']-$this->boss['x'];$dy=$this->player['y']-$this->boss['y'];$best=PHP_INT_MIN;
            foreach($r['directionVectors'] as $i=>$v){
                $dot=$dx*$v[0]+$dy*$v[1];if($dot>$best){$best=$dot;$this->aimAngle=$i;}
            }
            $this->warningUntil=$this->tick+30;
        }
        if(in_array($q,$p['aimFireCycleTicks'],true))foreach($p['aimAngleOffsets'] as $angle){
            $this->spawn($this->boss['x'],$this->boss['y'],$this->aimAngle+$angle,$p['aimSpeedStepQ'],4);
        }
    }
}

class DanmakuP1Battle {
    public const RULE='danmaku-p1-r1';
    public const FOCUS_RULE='danmaku-p1-r2';
    public const PATTERN_RULE='danmaku-p1-r3';
    public const NORMAL_RULE='danmaku-p1-normal-r1';
    public const RESPAWN_RULE='danmaku-p1-r4';
    public const NORMAL_V2_RULE='danmaku-p1-normal-r2';
    public static function phaseOptions(string $rule): array {return ['respawnBombs'=>$rule===self::RESPAWN_RULE||$rule===self::NORMAL_V2_RULE,'normalRevision'=>$rule===self::NORMAL_V2_RULE?2:1];}
    public string $rule;
    public array $rules;
    public bool $assist;
    public int $tick=0;
    public int $activeTicks=0;
    public int $phaseIndex=0;
    public int $phaseBreaks=0;
    public string $status='playing';
    public string $stage='opening';
    public int $remaining;
    public DanmakuP1Phase $sim;
    public array $stats;
    public array $events=[];
    public int $remainingInvulnerability=0;
    public function __construct(array $rules,bool $assist,string $rule=self::RULE){
        if(!in_array($rule,[self::RULE,self::FOCUS_RULE,self::PATTERN_RULE,self::NORMAL_RULE,self::RESPAWN_RULE,self::NORMAL_V2_RULE],true))throw new RuntimeException('未知的战斗规则版本');
        $this->rule=$rule;
        $this->rules=$rules;$this->assist=$assist;$this->remaining=$rules['clock']['introTicks'];
        $this->sim=new DanmakuP1Phase($rules,0,$assist,$rule!==self::RULE,$rule===self::PATTERN_RULE||$rule===self::RESPAWN_RULE,$rule===self::NORMAL_RULE||$rule===self::NORMAL_V2_RULE,self::phaseOptions($rule));$this->stats=&$this->sim->stats;
    }
    public function idleMove(array $input): void {
        $p=&$this->sim->player;$bounds=$this->rules['field']['playerBounds'];
        $p['px']=$p['x'];$p['py']=$p['y'];
        $p['x']=max($bounds['minX']*64,min($bounds['maxX']*64,$p['x']+$input['dx']));
        $p['y']=max($bounds['minY']*64,min($bounds['maxY']*64,$p['y']+$input['dy']));
    }
    public function nextPhase(): void {
        $rule=$this->rule;$old=$this->sim;$next=new DanmakuP1Phase($this->rules,++$this->phaseIndex,$this->assist,$rule!==self::RULE,$rule===self::PATTERN_RULE||$rule===self::RESPAWN_RULE,$rule===self::NORMAL_RULE||$rule===self::NORMAL_V2_RULE,self::phaseOptions($rule));
        $next->player['x']=$next->player['px']=$old->player['x'];
        $next->player['y']=$next->player['py']=$old->player['y'];
        $next->player['lives']=$old->player['lives'];$next->player['bombs']=$old->player['bombs'];
        $next->player['invulUntil']=max(0,$this->remainingInvulnerability-$this->rules['clock']['transitionTicks']);
        $next->stats=$this->stats;$next->nextEnemy=$old->nextEnemy;$next->nextShot=$old->nextShot;
        $this->sim=$next;$this->stats=&$this->sim->stats;
    }
    public function step(array $input): string {
        if($this->status!=='playing')throw new RuntimeException('终局后不能追加输入');
        DanmakuP0Sim::validateInput($input,$this->rules);
        if($this->tick>=$this->rules['clock']['standardMaxTicks'])throw new RuntimeException('对局超过逻辑上限');
        $this->tick++;
        if($this->stage!=='active'){
            $this->idleMove($input);$this->remaining--;
            if($this->remaining===0){if($this->stage==='transition')$this->nextPhase();$this->stage='active';}
            return $this->status;
        }
        $this->activeTicks++;
        $status=$this->sim->step($input);
        if($status==='dead'||$status==='timeout'){$this->status=$status;$this->stage='over';}
        elseif($status==='phase_clear'){
            $this->phaseBreaks++;
            $this->events[]=['tick'=>$this->tick,'phase'=>$this->phaseIndex,'activeTicks'=>$this->activeTicks,
                'lives'=>$this->sim->player['lives'],'bombs'=>$this->sim->player['bombs']];
            $this->sim->enemies=[];$this->sim->shots=[];
            if($this->phaseIndex===2){$this->status='clear';$this->stage='over';}
            else{
                $this->remainingInvulnerability=max(0,$this->sim->player['invulUntil']-$this->sim->tick);
                $this->stage='transition';$this->remaining=$this->rules['clock']['transitionTicks'];
            }
        }
        return $this->status;
    }
    public function score(): array {
        $r=$this->rules['score'];$clear=$this->status==='clear';$p=$this->sim->player;
        $parts=['clear'=>$clear?$r['clear']:0,'phase'=>$this->phaseBreaks*$r['phaseBreak'],
            'damage'=>intdiv(min($this->stats['damage'],$r['standardTotalHP'])*$r['totalDamageBudget'],$r['standardTotalHP']),
            'graze'=>min($this->stats['graze'],$r['grazeBulletCap'])*$r['grazePerBullet'],
            'resources'=>$clear?$p['lives']*$r['remainingLifeOnClear']+$p['bombs']*$r['remainingBombOnClear']:0,
            'time'=>$clear?min($r['timeBonusCap'],max(0,intdiv(($r['totalPhaseBudgetTicks']-$this->activeTicks)*$r['timePointsPerSavedSecond'],60))):0];
        $parts['total']=array_sum($parts);return $parts;
    }
    public function snapshot(): array {
        return ['rule'=>$this->rule,'tick'=>$this->tick,'activeTicks'=>$this->activeTicks,'assist'=>$this->assist,
            'phase'=>$this->phaseIndex,'phaseBreaks'=>$this->phaseBreaks,'stage'=>$this->stage,'remaining'=>$this->remaining,
            'status'=>$this->status,'hp'=>$this->sim->hp,'score'=>$this->score(),'events'=>$this->events,'sim'=>$this->sim->snapshot()];
    }
}

function danmaku_p1_decode(array $payload,array $rules): array {
    if(array_diff(array_keys($payload),['battle','v','rule','assist','ticks','input','score'])||
        ($payload['battle']??null)!==true||($payload['v']??null)!==1||!in_array($payload['rule']??null,[DanmakuP1Battle::RULE,DanmakuP1Battle::FOCUS_RULE,DanmakuP1Battle::PATTERN_RULE,DanmakuP1Battle::NORMAL_RULE,DanmakuP1Battle::RESPAWN_RULE,DanmakuP1Battle::NORMAL_V2_RULE],true)||
        !isset($payload['assist'])||!is_bool($payload['assist'])||!isset($payload['score'])||!is_int($payload['score'])||
        $payload['score']<0||$payload['score']>$rules['score']['upperBound'])throw new RuntimeException('完整挑战回放格式、版本或分数无效');
    return danmaku_decode_stream($payload['ticks']??null,$payload['input']??null,$rules,$rules['clock']['standardMaxTicks']);
}
function danmaku_p1_replay(array $payload,array $rules,bool $partial=false,bool $traceEnabled=true): array {
    $records=danmaku_p1_decode($payload,$rules);$sim=new DanmakuP1Battle($rules,$payload['assist'],$payload['rule']);$trace=[];
    foreach($records as $input){
        $stage=$sim->stage;$phase=$sim->phaseIndex;
        $sim->step($input);
        if($traceEnabled&&($sim->tick%60===0||$sim->status!=='playing'||$stage!==$sim->stage||$phase!==$sim->phaseIndex))$trace[]=$sim->snapshot();
    }
    if(!$partial&&$sim->status==='playing')throw new RuntimeException('完整挑战尚未自然结束');
    if($sim->score()['total']!==$payload['score'])throw new RuntimeException('重算分数与回放不符');
    return ['snapshot'=>$sim->snapshot(),'trace'=>$trace];
}
