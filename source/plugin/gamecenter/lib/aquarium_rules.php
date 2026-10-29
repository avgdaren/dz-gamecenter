<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。水族馆纯规则；无 HTTP、数据库、系统时间或隐式随机。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
final class gamecenter_aquarium_rules {
    const MAX_VALUE = 9000000000000;
    public static function number($n, int $min = 0, int $max = self::MAX_VALUE): bool {
        return is_int($n) && $n >= $min && $n <= $max;
    }
    public static function id($s): bool { return is_string($s) && preg_match('/\A[a-z][a-z0-9_]{0,63}\z/D', $s) === 1; }
    public static function prepare(array $c): array {
        if(PHP_INT_SIZE < 8 || !is_string($c['version'] ?? null) || !self::number($c['cap_ms'] ?? null,1,259200000)
            || !is_array($c['periods_ms'] ?? null) || !is_array($c['rod_costs'] ?? null)
            || !is_array($c['waters'] ?? null) || !$c['waters'] || !self::number($c['initial_coins'] ?? null)
            || count($c['periods_ms']) !== count($c['rod_costs']) || count($c['periods_ms']) < 1) { throw new DomainException('config'); }
        if(!array_is_list($c['periods_ms']) || !array_is_list($c['rod_costs'])) { throw new DomainException('config'); }
        foreach($c['periods_ms'] as $i=>$p) {
            if(!self::number($p,1000,3600000) || !self::number($c['rod_costs'][$i]) || ($i && $p >= $c['periods_ms'][$i-1])) { throw new DomainException('config'); }
        }
        if($c['rod_costs'][0] !== 0 || !isset($c['waters'][$c['initial_water'] ?? ''])) { throw new DomainException('config'); }
        ksort($c['waters'],SORT_STRING); $canonical="aquarium-pools-v1\n"; $ids=[];
        foreach($c['waters'] as $wid=>&$w) {
            if(!self::id($wid) || !is_array($w) || !is_array($w['fish'] ?? null) || !$w['fish']
                || !self::number($w['cost'] ?? null) || !self::number($w['requires_count'] ?? null,0,100)
                || !is_string($w['requires_water'] ?? null)) { throw new DomainException('config'); }
            if($w['requires_water'] !== '' && !isset($c['waters'][$w['requires_water']])) { throw new DomainException('config'); }
            ksort($w['fish'],SORT_STRING); $sum=0;
            foreach($w['fish'] as $fid=>$f) {
                if(!self::id($fid) || isset($ids[$fid]) || !is_array($f) || !self::number($f['weight'] ?? null,1,2147483648)
                    || !self::number($f['coins'] ?? null,0,1000000)) { throw new DomainException('config'); }
                $ids[$fid]=true; $sum+=$f['weight']; $canonical.=$wid."\t".$fid."\t".$f['weight']."\n";
            }
            if($sum>2147483648) { throw new DomainException('config'); }
        }
        unset($w);
        if(!isset($c['waters'][$c['initial_water']]['fish'][$c['initial_fish'] ?? ''])) { throw new DomainException('config'); }
        $hash=hash('sha256',$canonical);
        if(!is_string($c['pool_hash'] ?? null) || !hash_equals($c['pool_hash'],$hash)) { throw new DomainException('config'); }
        // 全配置另外冻结，避免价格/奖励变动绕过仅覆盖权重的 pool_hash。
        $plain=$c; unset($plain['config_hash']);
        $full=hash('sha256',json_encode($plain,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
        if(!is_string($c['config_hash'] ?? null) || !hash_equals($c['config_hash'],$full)) { throw new DomainException('config'); }
        return $c;
    }
    public static function initial(int $uid, string $seedHex, int $now, array $c): array {
        if(!self::number($uid,1,2147483647) || !self::number($now) || !preg_match('/\A[0-9a-f]{32}\z/D',$seedHex)) { throw new DomainException('state'); }
        $fid=$c['initial_fish']; $wid=$c['initial_water'];
        $s=['uid'=>$uid,'save_version'=>1,'config_version'=>$c['version'],'pool_hash'=>$c['pool_hash'],'config_hash'=>$c['config_hash'],
            'seed_hex'=>$seedHex,'coins'=>$c['initial_coins']+$c['waters'][$wid]['fish'][$fid]['coins'],'rod_level'=>0,
            'last_settled_ms'=>$now,'progress_ms'=>0,'catch_seq'=>0,'current_water'=>$wid,'unlocked_waters'=>[$wid],
            'fish'=>[$fid=>['discovered_at'=>$now,'catch_count'=>1]],'no_new_count'=>array_fill_keys(array_keys($c['waters']),0)];
        self::validate($s,$c); return $s;
    }
    public static function validate(array $s, array $c): void {
        foreach(['uid','save_version','coins','rod_level','last_settled_ms','progress_ms','catch_seq'] as $k) {
            if(!self::number($s[$k] ?? null)) { throw new DomainException('state'); }
        }
        if($s['uid']<1 || $s['uid']>2147483647 || $s['save_version']!==1 || ($s['config_version'] ?? null)!==$c['version']
            || ($s['pool_hash'] ?? null)!==$c['pool_hash'] || ($s['config_hash'] ?? null)!==$c['config_hash']
            || !is_string($s['seed_hex'] ?? null) || !preg_match('/\A[0-9a-f]{32}\z/D',$s['seed_hex'])
            || !isset($c['periods_ms'][$s['rod_level']]) || $s['progress_ms'] >= $c['periods_ms'][$s['rod_level']]
            || !is_array($s['unlocked_waters'] ?? null) || !array_is_list($s['unlocked_waters'])
            || count(array_unique($s['unlocked_waters'],SORT_REGULAR))!==count($s['unlocked_waters'])
            || !in_array($s['current_water'] ?? null,$s['unlocked_waters'],true)
            || !in_array($c['initial_water'],$s['unlocked_waters'],true)
            || !is_array($s['fish'] ?? null) || !is_array($s['no_new_count'] ?? null)) { throw new DomainException('state'); }
        $known=[];
        foreach($c['waters'] as $wid=>$w) {
            if(!self::number($s['no_new_count'][$wid] ?? null,0,80)) { throw new DomainException('state'); }
            foreach($w['fish'] as $fid=>$f) { $known[$fid]=$wid; }
        }
        if(count($s['no_new_count'])!==count($c['waters'])) { throw new DomainException('state'); }
        foreach($s['unlocked_waters'] as $wid) { if(!is_string($wid) || !isset($c['waters'][$wid])) { throw new DomainException('state'); } }
        foreach($s['fish'] as $fid=>$f) {
            if(!isset($known[$fid]) || !in_array($known[$fid],$s['unlocked_waters'],true) || !is_array($f)
                || !self::number($f['discovered_at'] ?? null,0,$s['last_settled_ms']) || !self::number($f['catch_count'] ?? null,1)) { throw new DomainException('state'); }
        }
        if(!isset($s['fish'][$c['initial_fish']])) { throw new DomainException('state'); }
    }
    public static function ticket(string $seedHex,int $uid,int $seq,int $weight,?callable $digest=null): int {
        if(!preg_match('/\A[0-9a-f]{32}\z/D',$seedHex) || $uid<1 || $seq<1 || $weight<1 || $weight>2147483648) { throw new DomainException('state'); }
        $limit=intdiv(4294967296,$weight)*$weight;
        for($draw=0;$draw<1024;$draw++) {
            $msg=sprintf('%d:%d:%d',$uid,$seq,$draw);
            $bytes=$digest ? $digest($msg) : hash_hmac('sha256',$msg,hex2bin($seedHex),true);
            if(!is_string($bytes) || strlen($bytes)!==32) { throw new DomainException('random'); }
            $x=unpack('N',substr($bytes,0,4))[1];
            if($x<$limit) { return $x%$weight; }
        }
        throw new DomainException('random');
    }
    public static function pick(array $pool,int $ticket): string {
        foreach($pool as $fid=>$f) { if($ticket<$f['weight']) { return $fid; } $ticket-=$f['weight']; }
        throw new DomainException('random');
    }
    public static function settle(array $s,int $now,array $c): array {
        $c=self::prepare($c);
        self::validate($s,$c); if(!self::number($now)) { throw new DomainException('time'); }
        $l=$s['last_settled_ms']; $elapsed=max(0,$now-$l); $t=min($elapsed,$c['cap_ms']);
        $d=$c['periods_ms'][$s['rod_level']]; $old=$s['progress_ms'];
        $k=intdiv($old+$t,$d); $pool=$c['waters'][$s['current_water']]['fish']; $wid=$s['current_water']; $catches=[];
        for($i=0;$i<$k;$i++) {
            $missing=array_diff_key($pool,$s['fish']);
            $eligible=($missing && $s['no_new_count'][$wid]>=80) ? $missing : $pool;
            $sum=array_sum(array_column($eligible,'weight'));
            $s['catch_seq']++; $fid=self::pick($eligible,self::ticket($s['seed_hex'],$s['uid'],$s['catch_seq'],$sum));
            $at=$l+($d-$old)+$i*$d; $isNew=!isset($s['fish'][$fid]); $coins=$pool[$fid]['coins'];
            if($isNew) { $s['fish'][$fid]=['discovered_at'=>$at,'catch_count'=>0]; }
            $s['fish'][$fid]['catch_count']++; $s['coins']+=$coins;
            $s['no_new_count'][$wid]=$isNew ? 0 : ($missing ? min(80,$s['no_new_count'][$wid]+1) : $s['no_new_count'][$wid]);
            $catches[]=['fish_id'=>$fid,'coins'=>$coins,'is_new'=>$isNew,'caught_ms'=>$at];
        }
        $s['progress_ms']=($old+$t)%$d; $s['last_settled_ms']=max($l,$now);
        ksort($s['fish'],SORT_STRING); self::validate($s,$c);
        return ['save'=>$s,'catches'=>$catches,'elapsed_ms'=>$elapsed,'effective_ms'=>$t,'discarded_ms'=>$elapsed-$t];
    }
    /** 调用方必须先 settle；错误只返回原状态，不能半扣款。 */
    public static function operate(array $s,array $data,array $c): array {
        $error=''; $action=$data['action'];
        if($action==='upgrade') {
            $target=$data['target_level'];
            if($target!==$s['rod_level']+1 || !isset($c['periods_ms'][$target])) { $error='target'; }
            elseif($s['coins']<$c['rod_costs'][$target]) { $error='coins'; }
            else { $s['progress_ms']=intdiv($s['progress_ms']*$c['periods_ms'][$target],$c['periods_ms'][$s['rod_level']]); $s['rod_level']=$target; $s['coins']-=$c['rod_costs'][$target]; }
        } elseif($action==='unlock') {
            $wid=$data['water_id']; $w=$c['waters'][$wid] ?? null;
            if(!$w || in_array($wid,$s['unlocked_waters'],true)) { $error='target'; }
            elseif(count(array_intersect_key($s['fish'],$c['waters'][$w['requires_water']]['fish']))<$w['requires_count']) { $error='condition'; }
            elseif($s['coins']<$w['cost']) { $error='coins'; }
            else { $s['coins']-=$w['cost']; $s['unlocked_waters'][]=$wid; sort($s['unlocked_waters'],SORT_STRING); }
        } elseif($action==='switch') {
            if(!in_array($data['water_id'],$s['unlocked_waters'],true)) { $error='condition'; }
            else { $s['current_water']=$data['water_id']; }
        } else { $error='input'; }
        self::validate($s,$c); return ['save'=>$s,'code'=>$error];
    }
}
