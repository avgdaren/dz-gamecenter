<?php
/* (C) 2026 Carinoasd. One-stage deterministic replay: 小典 / Codex. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'||!defined('DANMAKU_P0_LOCAL')){http_response_code(404);exit;}
require_once __DIR__.'/battle.php';
require_once __DIR__.'/weapons.php';

class DanmakuStage01Sim extends DanmakuP1Phase {
    public bool $weaponMode=false;
    public bool $wideWeaponMode=false;
    public bool $collectMode=false;
    public bool $cornerMode=false;
    public int $lastPointPickup=-999;
    public int $lastPointValue=0;
    public array $mobs=[];
    public array $drops=[];
    public int $cursor=0;
    public int $nextDrop=1;
    public int $lastHit=-999;
    public int $lastBomb=-999;
    public int $lastUpgrade=-999;
    public int $lastDowngrade=-999;
    public bool $bombMode=false;
    public int $bombActiveUntil=0;
    public int $bombCooldownUntil=0;
    public int $bombX=15360;
    public int $bombY=35328;
    public int $lastBombPickup=-999;
    public int $lastBombOverflow=-999;
    public function __construct(array $rules,int $index,bool $assist,string $rule=DanmakuStage01::RULE){
        if(!in_array($rule,DanmakuStage01::SUPPORTED,true))throw new RuntimeException('未知的关卡规则版本');
        $rules=self::effectiveRules($rules,$rule);
        parent::__construct($rules,max(0,$index),$assist,true,in_array($rule,[DanmakuStage01::PATTERN_RULE,DanmakuStage01::RESPAWN_RULE,DanmakuStage01::POWER_RULE,DanmakuStage01::WEAPON_RULE,DanmakuStage01::WIDE_WEAPON_RULE,DanmakuStage01::COLLECT_RULE,DanmakuStage01::CORNER_RULE],true),in_array($rule,[DanmakuStage01::NORMAL_RULE,DanmakuStage01::NORMAL_V2_RULE,DanmakuStage01::NORMAL_POWER_RULE,DanmakuStage01::NORMAL_WEAPON_RULE,DanmakuStage01::NORMAL_WIDE_WEAPON_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true),
            ['respawnBombs'=>in_array($rule,[DanmakuStage01::RESPAWN_RULE,DanmakuStage01::NORMAL_V2_RULE,DanmakuStage01::POWER_RULE,DanmakuStage01::NORMAL_POWER_RULE,DanmakuStage01::WEAPON_RULE,DanmakuStage01::NORMAL_WEAPON_RULE,DanmakuStage01::WIDE_WEAPON_RULE,DanmakuStage01::NORMAL_WIDE_WEAPON_RULE,DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true),'normalRevision'=>$rule===DanmakuStage01::NORMAL_RULE?1:2]);
        $this->index=$index;$this->rule=$rule;$this->bombMode=$rule!==DanmakuStage01::RULE;$this->scene=$index<0?'corridor':($index===1?'aim':'flower');
        $this->cornerMode=in_array($rule,[DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true);
        $this->collectMode=in_array($rule,[DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true);
        $this->wideWeaponMode=in_array($rule,[DanmakuStage01::WIDE_WEAPON_RULE,DanmakuStage01::NORMAL_WIDE_WEAPON_RULE,DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true);
        $this->weaponMode=in_array($rule,[DanmakuStage01::WEAPON_RULE,DanmakuStage01::NORMAL_WEAPON_RULE,DanmakuStage01::WIDE_WEAPON_RULE,DanmakuStage01::NORMAL_WIDE_WEAPON_RULE,DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true);
        $this->hp=$index<0?0:$rules['boss']['phaseHP'][$index];$this->player['power']=0;
        $this->stats+=['mobDamage'=>0,'mobKills'=>0,'mobScore'=>0,'powerCollected'=>0,'powerRecovered'=>0,'powerLost'=>0,
            'powerOverflow'=>0,'overflowScoreUnits'=>0,'mobSpawned'=>0,'mobPeak'=>0,'dropSpawned'=>0,'dropPeak'=>0,'upgrades'=>0];
        if($this->collectMode)$this->stats+=['pointItemsSpawned'=>0,'pointCollected'=>0,'pointScore'=>0];
        if($this->bombMode){
            $config=$rules['stage01']['bomb'];$this->player['bombs']=$assist?$config['assistStart']:$config['standardStart'];
            $this->bombX=$this->player['x'];$this->bombY=$this->player['y'];
            $this->stats+=['bombDamage'=>0,'bombKills'=>0,'bombCleared'=>0,'bombCollected'=>0,'bombOverflowTokens'=>0,'bombItemsSpawned'=>0];
        }
    }
    public function initialBombStock(): int {$b=$this->rules['stage01']['bomb'];return $this->bombMode?($this->assist?$b['assistStart']:$b['standardStart']):parent::initialBombStock();}
    public static function effectiveRules(array $rules,string $rule): array {
        if(!in_array($rule,[DanmakuStage01::POWER_RULE,DanmakuStage01::NORMAL_POWER_RULE,DanmakuStage01::WEAPON_RULE,DanmakuStage01::NORMAL_WEAPON_RULE,DanmakuStage01::WIDE_WEAPON_RULE,DanmakuStage01::NORMAL_WIDE_WEAPON_RULE,DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true))return $rules;
        $p=$rules['power05'];$rules['stage01']['shotCap']=$p['shotCap'];
        foreach(['thresholds','maxPower','levels'] as $key)$rules['stage01']['growth'][$key]=$p[$key];
        if(in_array($rule,[DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true)){
            $c=$rules['collect08'];$rules['stage01']['dropCap']=$c['dropCap'];
            foreach($rules['stage01']['schedule'] as &$m)if(in_array($m['id'],$c['extraPowerIds'],true))$m['reward']=$c['extraPowerValue'];unset($m);
        }
        return $rules;
    }
    public static function level(int $power,array $rules): int {
        $a=$rules['stage01']['growth']['thresholds'];for($i=count($a)-1;$i>0;$i--)if($power>=$a[$i])return $i+1;return 1;
    }
    public static function position(array $rules,array $mob,int $age): array {
        $v=$rules['stage01']['paths'][$mob['type']][max(0,min($rules['stage01']['types'][$mob['type']]['life'],$age))];
        return $mob['type']===0?['x'=>$mob['mirror']?30720-$v[0]:$v[0],'y'=>$v[1]]:['x'=>$mob['baseX']+$v[0],'y'=>$v[1]];
    }
    private static function contact(array $a,array $b,int $radius): bool {
        return parent::sweptHit($a['px']-$b['px'],$a['py']-$b['py'],$a['x']-$b['x'],$a['y']-$b['y'],$radius);
    }
    private static function shotContact(array $s,array $b,int $radius): bool {
        return parent::sweptHit($s[1]-$s[4]-$b['px'],$s[2]-$s[5]-$b['py'],$s[1]-$b['x'],$s[2]-$b['y'],$radius);
    }
    // Packed enemy arrays use the same field order as JS snapshots; no px/py allocation.
    public function spawn(int $x,int $y,int $angle,int $speed,int $radius,int $ttl=480,int $kind=3): void {
        $r=$this->rules;$v=$r['directionVectors'][($angle%512+512)%512];
        if($this->assist)$speed=intdiv($speed*$r['assist']['enemySpeedNumerator'],$r['assist']['enemySpeedDenominator']);
        $this->enemies[]=[$this->nextEnemy++,$x,$y,intdiv($speed*$v[0],1024),intdiv($speed*$v[1],1024),$radius,$this->tick,0,$ttl,$kind];
        $this->stats['enemySpawned']++;$count=count($this->enemies);
        if($count>($this->index<0?$r['stage01']['enemyCap']:$r['limits']['enemyLiveCap'])||$this->stats['enemySpawned']>$r['limits']['enemySpawnCap'])throw new RuntimeException('敌弹超过关卡上限');
        $this->stats['enemyPeak']=max($this->stats['enemyPeak'],$count);
    }
    public function capture(array &$mob): void {
        $dx=$this->player['x']-$mob['x'];$dy=$this->player['y']-$mob['y'];$best=PHP_INT_MIN;$angle=128;
        foreach($this->rules['directionVectors'] as $i=>$v){$dot=$dx*$v[0]+$dy*$v[1];if($dot>$best){$best=$dot;$angle=$i;}}
        $mob['aim']=$angle;
    }
    public function pattern(): void {
        if($this->index>=0){parent::pattern();return;}
        $t=$this->tick;$r=$this->rules;$s=$r['stage01'];
        while($this->cursor<count($s['schedule'])&&$s['schedule'][$this->cursor]['at']<=$t){
            $birth=$s['schedule'][$this->cursor++];$type=$s['types'][$birth['type']];
            $m=['id'=>$birth['id'],'type'=>$birth['type'],'born'=>$birth['at'],'baseX'=>$birth['x'],'mirror'=>$birth['mirror'],
                'reward'=>$birth['reward'],'hp'=>$type['hp'],'aim'=>128,'warningUntil'=>0,'warningKind'=>0];
            $m+=self::position($r,$m,0);$m['px']=$m['x'];$m['py']=$m['y'];$this->mobs[]=$m;$this->stats['mobSpawned']++;
        }
        $keep=[];foreach($this->mobs as $m)if($t-$m['born']<$s['types'][$m['type']]['life']&&$m['hp']>0)$keep[]=$m;
        $this->stats['mobPeak']=max($this->stats['mobPeak'],count($keep));
        if(count($keep)>$s['mobCap'])throw new RuntimeException('小怪超过关卡上限');
        foreach($keep as &$m){
            $age=$t-$m['born'];$type=$s['types'][$m['type']];$m['px']=$m['x'];$m['py']=$m['y'];
            $v=self::position($r,$m,$age);$m['x']=$v['x'];$m['y']=$v['y'];
            foreach($type['attacks'] as $a){
                if($age===$a['warning']){
                    if($a['capture'])$this->capture($m);
                    $m['warningUntil']=max($m['warningUntil'],$t+$a['at']-$a['warning']);$m['warningKind']=$a['aimed']?1:2;
                }
                if($age===$a['at'])foreach($a['offsets'] as $offset)$this->spawn($m['x'],$m['y'],($a['aimed']?$m['aim']:128)+$offset,
                    $type['speedQ'],$type['bulletRadius'],$type['ttl'],$m['type']);
            }
        }
        unset($m);$this->mobs=array_values($keep);
    }
    public function drop(int $x,int $y,int $value,bool $recovery,int $kind=0): void {
        if($value<=0)return;$g=$this->rules['stage01']['growth'];
        $this->drops[]=['id'=>$this->nextDrop++,'x'=>max(768,min(29952,$x)),'y'=>max(0,$y),'px'=>$x,'py'=>$y,'born'=>$this->tick,
            'value'=>$value,'recovery'=>$recovery,'unlock'=>$this->tick+($recovery?$g['recoveryUnlockTicks']:$g['rewardUnlockTicks']),'attracted'=>false];
        if($this->bombMode){$this->drops[count($this->drops)-1]['kind']=$kind===1?1:($this->collectMode&&$kind===2?2:0);if($this->collectMode&&$kind===2)$this->stats['pointItemsSpawned']++;if($kind===1)$this->stats['bombItemsSpawned']++;}
        $this->stats['dropSpawned']++;$this->stats['dropPeak']=max($this->stats['dropPeak'],count($this->drops));
        if(count($this->drops)>$this->rules['stage01']['dropCap'])throw new RuntimeException('掉落超过关卡上限');
    }
    public function losePower(): void {
        $p=&$this->player;$g=$this->rules['stage01']['growth'];$before=self::level($p['power'],$this->rules);
        if($before===1)return;$next=$g['thresholds'][$before-2];$lost=$p['power']-$next;$p['power']=$next;
        $this->stats['powerLost']+=$lost;$this->lastDowngrade=$this->tick;
        if($p['lives']>0)$this->drop($p['x'],$p['y']-3072,$lost,true);
    }
    public function collect(array $item): void {
        if($this->collectMode&&($item['kind']??0)===2){
            $value=$item['value']*$this->rules['collect08']['pointValue'];$this->stats['pointCollected']+=$item['value'];$this->stats['pointScore']+=$value;
            $this->lastPointValue=$this->lastPointPickup===$this->tick?$this->lastPointValue+$value:$value;$this->lastPointPickup=$this->tick;return;
        }
        if($this->bombMode&&($item['kind']??0)===1){
            $config=$this->rules['stage01']['bomb'];$this->stats['bombCollected']++;$this->lastBombPickup=$this->tick;
            if($this->player['bombs']<$config['stockCap'])$this->player['bombs']++;
            else{$this->stats['bombOverflowTokens']++;$this->lastBombOverflow=$this->tick;}
            return;
        }
        $p=&$this->player;$g=$this->rules['stage01']['growth'];$before=self::level($p['power'],$this->rules);
        $raw=$p['power']+$item['value'];$overflow=max(0,$raw-$g['maxPower']);$p['power']=min($g['maxPower'],$raw);
        $this->stats[$item['recovery']?'powerRecovered':'powerCollected']+=$item['value'];$this->stats['powerOverflow']+=$overflow;
        if(!$item['recovery'])$this->stats['overflowScoreUnits']+=$overflow;
        $after=self::level($p['power'],$this->rules);if($after>$before){$this->lastUpgrade=$this->tick;$this->stats['upgrades']+=$after-$before;}
    }
    public function damageMob(int $index,int $damage,bool $fromBomb): void {
        $m=$this->mobs[$index];if($m['hp']<=0)return;$type=$this->rules['stage01']['types'][$m['type']];
        $applied=min($m['hp'],$damage);$this->mobs[$index]['hp']-=$applied;$this->stats['mobDamage']+=$applied;
        if($fromBomb)$this->stats['bombDamage']+=$applied;else $this->stats['shotHits']++;
        if($this->mobs[$index]['hp']===0){
            $this->stats['mobKills']++;$this->stats['mobScore']+=$type['killScore'];
            if($this->collectMode&&$m['reward']===0)$this->drop($m['x'],$m['y'],1,false,2);else $this->drop($m['x'],$m['y'],$m['reward'],false);
            if($fromBomb)$this->stats['bombKills']++;
            if($this->bombMode&&$m['type']===$this->rules['stage01']['bomb']['rewardType'])$this->drop($m['x'],$m['y'],$this->rules['stage01']['bomb']['rewardValue'],false,1);
        }
    }
    public function bombDamage(): void {
        $damage=$this->rules['stage01']['bomb']['damage'];
        if($this->index>=0){$applied=min($this->hp,$damage);$this->hp-=$applied;$this->stats['damage']+=$applied;$this->stats['bombDamage']+=$applied;}
        else foreach($this->mobs as $i=>$m){
            $radius=$this->rules['stage01']['types'][$m['type']]['radius']*64;
            if($m['x']>=-$radius&&$m['x']<=30720+$radius&&$m['y']>=-$radius&&$m['y']<=40960+$radius)$this->damageMob($i,$damage,true);
        }
    }
    public function items(array $input): void {
        $p=$this->player;$g=$this->rules['stage01']['growth'];$t=$this->tick;$keep=[];
        $radius=(($input['flags']&1)?$g['focusMagnetRadius']:$g['magnetRadius'])*64;
        $c=$this->rules['corner09']??null;$corner=$this->cornerMode&&$p['y']<=$c['topY']*64&&($p['x']<=$c['leftX']*64||$p['x']>=$c['rightX']*64);
        foreach($this->drops as $item){
            if($t-$item['born']>=$g['dropTtl'])continue;
            $item['px']=$item['x'];$item['py']=$item['y'];$dx=$p['x']-$item['x'];$dy=$p['y']-$item['y'];
            if($corner){$item['attracted']=true;$item['unlock']=min($item['unlock'],$t);}
            if($t>=$item['unlock']&&(($this->index<0&&$t>=$this->rules['stage01']['gatherTick'])||$dx*$dx+$dy*$dy<=$radius*$radius))$item['attracted']=true;
            if($item['attracted']){
                $distance=max(abs($dx),abs($dy));
                if($distance<=$g['magnetStepQ']){$item['x']=$p['x'];$item['y']=$p['y'];}
                else{$item['x']+=intdiv($dx*$g['magnetStepQ'],$distance);$item['y']+=intdiv($dy*$g['magnetStepQ'],$distance);}
            }else $item['y']+=($t-$item['born']<$g['hoverTicks']?-24:$g['fallStepQ']);
            if($t>=$item['unlock']&&self::contact($item,$p,$g['pickupRadius']*64)){$this->collect($item);continue;}
            if($item['y']<=43008)$keep[]=$item;
        }
        $this->drops=$keep;
    }
    public function fire(array $input): void {
        $r=$this->rules;$p=$this->player;$t=$this->tick;
        $level=self::level($p['power'],$r);$focused=($input['flags']&1)!==0;
        $packet=$this->weaponMode&&$focused&&$level>=4?$r['weapons06']['focused'][$level]:null;
        $fireMain=($t-$r['playerShot']['firstPhaseTick'])%($packet!==null?$packet['interval']:$r['playerShot']['intervalTicks'])===0;
        if($fireMain)foreach($packet!==null?$packet['lanes']:$r['stage01']['growth']['levels'][$level-1][$focused?'focused':'normal'] as $i=>$spec){
            $this->shots[]=[$this->nextShot++,$p['x']+$spec['offsetX']*64,$p['y']-1024,$t,$packet!==null?0:$spec['vxQ'],-($packet!==null?$packet['speedQ']:$r['playerShot']['speedStepQ']),$spec['damage'],$focused?1:0,$level];
            if($this->weaponMode){$last=count($this->shots)-1;$this->shots[$last][]=$packet!==null?2:(int)(!$focused&&$level===5&&in_array($i,$r['weapons06']['tracking']['lanes'],true));$this->shots[$last][]=-1;}
        }
        if($this->wideWeaponMode&&$focused&&$level>=$r['weapons07']['sideShots']['minimumLevel']){
            $side=$r['weapons07']['sideShots'];
            if(($t-$r['playerShot']['firstPhaseTick'])%$side['interval']===0)foreach($side['offsets'] as $offset){
                $this->shots[]=[$this->nextShot++,$p['x']+$offset*64,$p['y']-1024,$t,0,-$side['speedQ'],$side['damage'],1,$level,3,-1];
            }
        }
        if(count($this->shots)>$r['stage01']['shotCap'])throw new RuntimeException('自机子弹超过关卡上限');
    }
    public function step(array $input,bool $validated=false): string {
        if($this->status!=='playing')throw new RuntimeException('终局后不能追加输入');
        if(!$validated)parent::validateInput($input,$this->rules);
        $t=++$this->tick;$r=$this->rules;$p=&$this->player;$b=&$this->boss;$bounds=$r['field']['playerBounds'];
        $p['px']=$p['x'];$p['py']=$p['y'];$b['px']=$b['x'];$b['py']=$b['y'];
        $p['x']=max($bounds['minX']*64,min($bounds['maxX']*64,$p['x']+$input['dx']));
        $p['y']=max($bounds['minY']*64,min($bounds['maxY']*64,$p['y']+$input['dy']));
        if($this->index>=0)$b['x']=parent::bossX($t);
        $this->fire($input);$this->pattern();
        if($this->weaponMode)danmaku_weapon_tracking($this);
        $activated=false;
        if($this->bombMode){
            $config=$r['stage01']['bomb'];
            if(($input['flags']&2)&&$p['bombs']>0&&$t>=$this->bombCooldownUntil){
                $p['bombs']--;$this->stats['bombsUsed']++;$this->lastBomb=$t;$activated=true;
                $this->bombActiveUntil=$t+$config['clearTicks'];$this->bombCooldownUntil=$t+$config['cooldownTicks'];
                $this->bombX=$p['x'];$this->bombY=$p['y'];$p['invulUntil']=max($p['invulUntil'],$t+$config['invulnerabilityTicks']);
            }
            if($t<$this->bombActiveUntil){$this->stats['bombCleared']+=count($this->enemies);$this->enemies=[];}
        }elseif(($input['flags']&2)&&$p['bombs']>0){$p['bombs']--;$this->stats['bombsUsed']++;$this->lastBomb=$t;$this->enemies=[];
            $p['invulUntil']=max($p['invulUntil'],$t+$r['player']['bombInvulnerabilityTicks']);}
        $collided=[];$graze=[];$keep=[];$detect=$t>=$p['invulUntil'];
        $playerPX=$p['px'];$playerPY=$p['py'];$playerX=$p['x'];$playerY=$p['y'];
        $hitBase=$r['player']['hitRadius']*64;$grazeBase=$r['player']['grazeCenterRadius']*64;
        foreach($this->enemies as $e){
            $e[1]+=$e[3];$e[2]+=$e[4];$keep[]=$e;
            if(!$detect)continue;
            $x0=$e[1]-$e[3]-$playerPX;$y0=$e[2]-$e[4]-$playerPY;$x1=$e[1]-$playerX;$y1=$e[2]-$playerY;
            $hitRadius=$hitBase+$e[5]*64;
            $grazeRadius=$grazeBase+$e[5]*64;$radius=$e[7]?$hitRadius:$grazeRadius;
            if(($x0>$radius&&$x1>$radius)||($x0<-$radius&&$x1<-$radius)||($y0>$radius&&$y1>$radius)||($y0<-$radius&&$y1<-$radius))continue;
            if(parent::sweptHit($x0,$y0,$x1,$y1,$hitRadius))$collided[$e[0]]=true;
            if(!$e[7]&&parent::sweptHit($x0,$y0,$x1,$y1,$grazeRadius))$graze[$e[0]]=true;
        }
        $this->enemies=$keep;$bodyHit=false;
        if($detect){
            foreach($this->mobs as $m)if(self::contact($m,$p,($r['player']['hitRadius']+$r['stage01']['types'][$m['type']]['radius'])*64)){$bodyHit=true;break;}
            if($collided||$bodyHit){
                $p['lives']--;$this->stats['hitsTaken']++;$this->lastHit=$t;
                $this->replenishOnRespawn();
                $p['invulUntil']=max($p['invulUntil'],$t+$r['player']['hitInvulnerabilityTicks']);$clear=$r['player']['hitClearRadius']*64;$keep=[];
                foreach($this->enemies as $e){$dx=$e[1]-$p['x'];$dy=$e[2]-$p['y'];if(!isset($collided[$e[0]])&&$dx*$dx+$dy*$dy>$clear*$clear)$keep[]=$e;}
                $this->enemies=$keep;$this->losePower();
            }
        }
        if($p['lives']<=0)$this->status='dead';
        elseif($activated)$this->bombDamage();
        $margin=$r['field']['enemyCullMargin']*64;$keep=[];
        $minField=-$margin;$maxFieldX=30720+$margin;$maxFieldY=40960+$margin;$shotTtl=$r['playerShot']['ttlTicks'];
        // Reject distant boss shots before the swept test; integer endpoints are unchanged.
        $shotRadius=($r['playerShot']['radius']+$r['boss']['hitRadius'])*64;
        $bossX=$b['x'];$bossY=$b['y'];$bossDX=$bossX-$b['px'];$bossDY=$bossY-$b['py'];
        $alive=$p['lives']>0;$bossPhase=$this->index>=0;
        foreach($this->shots as $s){
            $s[1]+=$s[4];$s[2]+=$s[5];$hit=false;
            if($alive){
                if($bossPhase){
                    $y1=$s[2]-$bossY;$y0=$y1-$s[5]+$bossDY;
                    if(!(($y0>$shotRadius&&$y1>$shotRadius)||($y0<-$shotRadius&&$y1<-$shotRadius))){
                        $x1=$s[1]-$bossX;$x0=$x1-$s[4]+$bossDX;
                        if(!(($x0>$shotRadius&&$x1>$shotRadius)||($x0<-$shotRadius&&$x1<-$shotRadius))&&
                            parent::sweptHit($x0,$y0,$x1,$y1,$shotRadius)){$this->damageBoss($s[6]);$hit=true;}
                    }
                }
                else foreach($this->mobs as $i=>$m){
                    $type=$r['stage01']['types'][$m['type']];
                    if($m['hp']<=0||!self::shotContact($s,$m,($r['playerShot']['radius']+$type['radius'])*64))continue;
                    $this->damageMob($i,$s[6],false);
                    $hit=true;break;
                }
            }
            if(!$hit&&$t-$s[3]+1<$shotTtl&&$s[1]>=$minField&&$s[1]<=$maxFieldX&&$s[2]>=$minField&&$s[2]<=$maxFieldY)$keep[]=$s;
        }
        $this->shots=$keep;
        if($p['lives']>0){
            $keep=[];foreach($this->mobs as $m)if($m['hp']>0)$keep[]=$m;$this->mobs=$keep;
            $this->items($input);
            if($this->index<0){if($t>=$r['stage01']['preludeTicks'])$this->status='prelude_clear';}else $this->resolveEnd();
        }
        $commitGraze=$this->status==='playing'&&$t>=$p['invulUntil'];$keep=[];
        foreach($this->enemies as $e){
            if($commitGraze&&isset($graze[$e[0]])){$e[7]=1;$this->stats['graze']++;}
            if($t-$e[6]+1<$e[8]&&$e[1]>=$minField&&$e[1]<=$maxFieldX&&$e[2]>=$minField&&$e[2]<=$maxFieldY)$keep[]=$e;
        }
        $this->enemies=$keep;return $this->status;
    }
    public function snapshot(): array {
        $p=$this->player;$s=$this->stats;
        $result=['tick'=>$this->tick,'scene'=>$this->scene,'assist'=>$this->assist,'status'=>$this->status,
            'player'=>[$p['x'],$p['y'],$p['lives'],$p['bombs'],$p['invulUntil']],'boss'=>[$this->boss['x'],$this->boss['y']],
            'aim'=>[$this->aimAngle,$this->warningUntil],
            'stats'=>[$s['damage'],$s['shotHits'],$s['hitsTaken'],$s['graze'],$s['bombsUsed'],$s['enemySpawned'],$s['enemyPeak']],
            'nextIds'=>[$this->nextEnemy,$this->nextShot,$this->nextDrop,$this->cursor],
            'enemies'=>$this->enemies,'shots'=>$this->shots,'power'=>[$p['power'],self::level($p['power'],$this->rules)],
            'powerEvents'=>[$this->lastUpgrade,$this->lastDowngrade],
            'growth'=>[$s['mobDamage'],$s['mobKills'],$s['mobScore'],$s['powerCollected'],$s['powerRecovered'],$s['powerLost'],$s['powerOverflow'],$s['overflowScoreUnits'],
                $s['mobSpawned'],$s['mobPeak'],$s['dropSpawned'],$s['dropPeak'],$s['upgrades']],
            'mobs'=>array_map(static fn($m)=>[$m['id'],$m['type'],$m['born'],$m['baseX'],$m['mirror']?1:0,$m['reward'],$m['x'],$m['y'],$m['hp'],$m['aim'],$m['warningUntil'],$m['warningKind']],$this->mobs),
            'drops'=>array_map(static fn($d)=>[$d['id'],$d['x'],$d['y'],$d['born'],$d['value'],$d['recovery']?1:0,$d['unlock'],$d['attracted']?1:0],$this->drops)];
        if($this->bombMode){
            foreach($this->drops as $i=>$d)$result['drops'][$i][]=$d['kind'];
            $result['bomb']=[$this->bombActiveUntil,$this->bombCooldownUntil,$this->lastBomb,$this->bombX,$this->bombY,
                $s['bombDamage'],$s['bombKills'],$s['bombCleared'],$s['bombCollected'],$s['bombOverflowTokens'],$s['bombItemsSpawned'],$this->lastBombPickup,$this->lastBombOverflow];
        }
        if($this->collectMode)$result['collect']=[$s['pointItemsSpawned'],$s['pointCollected'],$s['pointScore'],$this->lastPointPickup,$this->lastPointValue];
        return $result;
    }
}

class DanmakuStage01 {
    public const RULE='danmaku-stage01-r1';
    public const BOMB_RULE='danmaku-stage01-r2';
    public const PATTERN_RULE='danmaku-stage01-r3';
    public const NORMAL_RULE='danmaku-stage01-normal-r1';
    public const RESPAWN_RULE='danmaku-stage01-r4';
    public const NORMAL_V2_RULE='danmaku-stage01-normal-r2';
    public const POWER_RULE='danmaku-stage01-r5';
    public const NORMAL_POWER_RULE='danmaku-stage01-normal-r3';
    public const WEAPON_RULE='danmaku-stage01-r6';
    public const NORMAL_WEAPON_RULE='danmaku-stage01-normal-r4';
    public const WIDE_WEAPON_RULE='danmaku-stage01-r7';
    public const NORMAL_WIDE_WEAPON_RULE='danmaku-stage01-normal-r5';
    public const COLLECT_RULE='danmaku-stage01-r8';
    public const NORMAL_COLLECT_RULE='danmaku-stage01-normal-r6';
    public const CORNER_RULE='danmaku-stage01-r9';
    public const NORMAL_CORNER_RULE='danmaku-stage01-normal-r7';
    public const SUPPORTED=[self::RULE,self::BOMB_RULE,self::PATTERN_RULE,self::NORMAL_RULE,self::RESPAWN_RULE,self::NORMAL_V2_RULE,self::POWER_RULE,self::NORMAL_POWER_RULE,self::WEAPON_RULE,self::NORMAL_WEAPON_RULE,self::WIDE_WEAPON_RULE,self::NORMAL_WIDE_WEAPON_RULE,self::COLLECT_RULE,self::NORMAL_COLLECT_RULE,self::CORNER_RULE,self::NORMAL_CORNER_RULE];
    public string $rule=self::RULE;
    public array $rules;
    public bool $assist;
    public int $tick=0;
    public int $activeTicks=0;
    public int $phaseIndex=-1;
    public int $phaseBreaks=0;
    public string $status='playing';
    public string $stage='prelude';
    public int $remaining;
    public array $events=[];
    public array $stats;
    public DanmakuStage01Sim $sim;
    public function __construct(array $rules,bool $assist,string $rule=self::RULE){
        if(!in_array($rule,self::SUPPORTED,true))throw new RuntimeException('未知的关卡规则版本');
        $rules=DanmakuStage01Sim::effectiveRules($rules,$rule);
        $this->rule=$rule;
        $this->rules=$rules;$this->assist=$assist;$this->remaining=$rules['stage01']['preludeTicks'];
        $this->sim=new DanmakuStage01Sim($rules,-1,$assist,$rule);$this->stats=&$this->sim->stats;
    }
    public function replace(int $index): void {
        $old=$this->sim;$next=new DanmakuStage01Sim($this->rules,$index,$this->assist,$this->rule);
        foreach($old->drops as $item)$old->collect($item);$old->drops=[];
        $next->player=$old->player;$next->player['px']=$old->player['x'];$next->player['py']=$old->player['y'];
        $next->player['invulUntil']=max(0,$old->player['invulUntil']-$old->tick);
        $next->stats=$this->stats;$next->nextEnemy=$old->nextEnemy;$next->nextShot=$old->nextShot;$next->nextDrop=$old->nextDrop;
        if($old->bombMode){
            $next->bombActiveUntil=max(0,$old->bombActiveUntil-$old->tick);$next->bombCooldownUntil=max(0,$old->bombCooldownUntil-$old->tick);
            $next->lastBomb=max(-999,$old->lastBomb-$old->tick);$next->bombX=$old->bombX;$next->bombY=$old->bombY;
        }
        $this->sim=$next;$this->stats=&$this->sim->stats;$this->phaseIndex=$index;
    }
    public function step(array $input): string {
        if($this->status!=='playing')throw new RuntimeException('终局后不能追加输入');
        DanmakuP0Sim::validateInput($input,$this->rules);
        if($this->tick>=$this->rules['stage01']['maxTicks'])throw new RuntimeException('关卡超过逻辑上限');
        $this->tick++;
        if($this->stage==='opening'||$this->stage==='transition'){
            $p=&$this->sim->player;$bounds=$this->rules['field']['playerBounds'];$p['px']=$p['x'];$p['py']=$p['y'];
            $p['x']=max($bounds['minX']*64,min($bounds['maxX']*64,$p['x']+$input['dx']));
            $p['y']=max($bounds['minY']*64,min($bounds['maxY']*64,$p['y']+$input['dy']));$p['invulUntil']=max(0,$p['invulUntil']-1);
            if($this->sim->bombMode){
                $this->sim->bombActiveUntil=max(0,$this->sim->bombActiveUntil-1);$this->sim->bombCooldownUntil=max(0,$this->sim->bombCooldownUntil-1);
                $this->sim->lastBomb=max(-999,$this->sim->lastBomb-1);
            }
            if(--$this->remaining===0)$this->stage='active';return $this->status;
        }
        $prelude=$this->stage==='prelude';if(!$prelude)$this->activeTicks++;
        $result=$this->sim->step($input,true);
        if($prelude)$this->remaining=max(0,$this->rules['stage01']['preludeTicks']-$this->sim->tick);
        if($result==='dead'||$result==='timeout'){$this->status=$result;$this->stage='over';}
        elseif($result==='prelude_clear'){
            $this->events[]=['tick'=>$this->tick,'phase'=>-1,'activeTicks'=>$this->activeTicks,'lives'=>$this->sim->player['lives'],'bombs'=>$this->sim->player['bombs']];
            $this->replace(0);$this->stage='opening';$this->remaining=$this->rules['clock']['introTicks'];
        }elseif($result==='phase_clear'){
            $this->phaseBreaks++;$this->events[]=['tick'=>$this->tick,'phase'=>$this->phaseIndex,'activeTicks'=>$this->activeTicks,'lives'=>$this->sim->player['lives'],'bombs'=>$this->sim->player['bombs']];
            if($this->phaseIndex===2){foreach($this->sim->drops as $item)$this->sim->collect($item);$this->sim->drops=[];
                $this->status='clear';$this->stage='over';$this->sim->enemies=[];$this->sim->shots=[];}
            else{$this->replace($this->phaseIndex+1);$this->stage='transition';$this->remaining=$this->rules['clock']['transitionTicks'];}
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
        $total=array_sum($parts);$parts['total']=$total;$parts['mobs']=$this->stats['mobScore'];
        $parts['overflow']=$this->stats['overflowScoreUnits']*$this->rules['stage01']['growth']['overflowPerUnit'];
        $parts['total']+=$parts['mobs']+$parts['overflow'];
        if($this->sim->bombMode){$parts['bombOverflow']=$this->stats['bombOverflowTokens']*$this->rules['stage01']['bomb']['overflowScore'];$parts['total']+=$parts['bombOverflow'];}
        if($this->sim->collectMode){$parts['points']=$this->stats['pointScore'];$parts['total']+=$parts['points'];}
        return $parts;
    }
    public function snapshot(): array {
        return ['rule'=>$this->rule,'tick'=>$this->tick,'activeTicks'=>$this->activeTicks,'assist'=>$this->assist,'phase'=>$this->phaseIndex,
            'phaseBreaks'=>$this->phaseBreaks,'stage'=>$this->stage,'remaining'=>$this->remaining,'status'=>$this->status,'hp'=>$this->sim->hp,
            'score'=>$this->score(),'events'=>$this->events,'sim'=>$this->sim->snapshot()];
    }
}
function danmaku_stage01_score_limit(array $rules,string $rule): int {
    if(in_array($rule,[DanmakuStage01::COLLECT_RULE,DanmakuStage01::NORMAL_COLLECT_RULE,DanmakuStage01::CORNER_RULE,DanmakuStage01::NORMAL_CORNER_RULE],true))return $rules['collect08']['scoreUpperBound'];
    return $rule!==DanmakuStage01::RULE?$rules['stage01']['bombScoreUpperBound']:$rules['stage01']['scoreUpperBound'];
}
function danmaku_stage01_decode(array $payload,array $rules): string {
    if(array_diff(array_keys($payload),['stage','v','rule','assist','ticks','input','score'])||($payload['stage']??null)!==true||
        ($payload['v']??null)!==1||!in_array($payload['rule']??null,DanmakuStage01::SUPPORTED,true)||!isset($payload['assist'])||!is_bool($payload['assist'])||
        !isset($payload['score'])||!is_int($payload['score'])||$payload['score']<0||$payload['score']>danmaku_stage01_score_limit($rules,$payload['rule']))throw new RuntimeException('第一关回放格式、版本或分数无效');
    $ticks=$payload['ticks']??null;$input=$payload['input']??null;
    if(!is_int($ticks)||$ticks<1||$ticks>$rules['stage01']['maxTicks']||!is_string($input)||strlen($input)>4*(int)ceil($ticks*5/3)||
        strlen($input)%4!==0||!preg_match('/\A[A-Za-z0-9+\/]*={0,2}\z/D',$input))throw new RuntimeException('第一关回放步数或编码无效');
    $raw=base64_decode($input,true);
    if($raw===false||strlen($raw)!==$ticks*5||base64_encode($raw)!==$input)throw new RuntimeException('第一关回放字节长度或编码无效');
    return $raw;
}
function danmaku_stage01_replay(array $payload,array $rules,bool $partial=false,bool $traceEnabled=true): array {
    $raw=danmaku_stage01_decode($payload,$rules);$sim=new DanmakuStage01($rules,$payload['assist'],$payload['rule']);$trace=[];
    for($i=0,$length=strlen($raw);$i<$length;$i+=5){
        $dx=ord($raw[$i])+(ord($raw[$i+1])<<8);$dy=ord($raw[$i+2])+(ord($raw[$i+3])<<8);
        $input=['dx'=>$dx>=32768?$dx-65536:$dx,'dy'=>$dy>=32768?$dy-65536:$dy,'flags'=>ord($raw[$i+4])];
        $stage=$sim->stage;$phase=$sim->phaseIndex;$power=$sim->sim->player['power'];
        $bombs=$sim->sim->player['bombs'];$used=$sim->stats['bombsUsed'];$collected=$sim->stats['bombCollected']??0;$sim->step($input);
        $bombEvent=$sim->sim->bombMode&&($bombs!==$sim->sim->player['bombs']||$used!==$sim->stats['bombsUsed']||$collected!==$sim->stats['bombCollected']);
        if($traceEnabled&&($sim->tick%60===0||$sim->status!=='playing'||$stage!==$sim->stage||$phase!==$sim->phaseIndex||$power!==$sim->sim->player['power']||$bombEvent))$trace[]=$sim->snapshot();
    }
    if(!$partial&&$sim->status==='playing')throw new RuntimeException('第一关尚未自然结束');
    if($sim->score()['total']!==$payload['score'])throw new RuntimeException('第一关重算分数不符');
    return ['snapshot'=>$sim->snapshot(),'trace'=>$trace];
}
