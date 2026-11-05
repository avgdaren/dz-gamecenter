<?php
/**
 * 作者：GPT / Codex。天使讨伐队纯规则；不读会话、时钟或数据库。
 * 1.5.0 并入游戏中心平台：Carinoasd · (C) 2026 Carinoasd
 */
declare(strict_types=1);

final class gamecenter_raid_rules {
    public const VERSION = 'raid-v3-solo110-p4-duo150-r18';
    public const V2_VERSION = 'raid-v2-solo110-p4-duo150';
    public const LEGACY_VERSION = 'raid-v1-p1-balanced';
    public static function config(string $version): array {
        return match($version) {
            self::LEGACY_VERSION => ['solo_hp'=>120,'duo_hp'=>130,'solo_potions'=>3,'solo_round_limit'=>16,'duo_round_limit'=>16],
            self::V2_VERSION => ['solo_hp'=>110,'duo_hp'=>150,'solo_potions'=>4,'solo_round_limit'=>16,'duo_round_limit'=>16],
            self::VERSION => ['solo_hp'=>110,'duo_hp'=>150,'solo_potions'=>4,'solo_round_limit'=>18,'duo_round_limit'=>16],
            default => throw new InvalidArgumentException('rules_version'),
        };
    }
    public const ACTIVE = 1, WON = 2, LOST = 3;
    public const TURN_MS = 30000;

    public static function initial(string $mode, int $now, string $rulesVersion = self::VERSION): array {
        $config=self::config($rulesVersion);
        $limit=$mode==='solo'?$config['solo_round_limit']:$config['duo_round_limit'];
        if(!in_array($mode, ['solo', 'duo'], true) || $now < 0 || $now > PHP_INT_MAX - self::TURN_MS * ($limit+1)) {
            throw new InvalidArgumentException('mode');
        }
        $n = $mode === 'solo' ? 1 : 2;
        $s = ['schema'=>1, 'rules_version'=>$rulesVersion, 'mode'=>$mode,
            'status'=>self::ACTIVE, 'round_no'=>1, 'version'=>1,
            'boss_max_hp'=>$n === 1 ? $config['solo_hp'] : $config['duo_hp'], 'boss'=>$n === 1 ? $config['solo_hp'] : $config['duo_hp'],
            'hp'=>array_fill(0, $n, 40), 'pots'=>array_fill(0, $n, $n === 1 ? $config['solo_potions'] : 2),
            'left'=>array_fill(0, $n, false), 'leaving'=>array_fill(0, $n, false),
            'intents'=>array_fill(0, $n, null), 'exposed'=>false,
            'deadline_ms'=>$now + self::TURN_MS, 'updated_ms'=>$now,
            'history'=>[], 'reason'=>'', 'ended_ms'=>null];
        $s['preview'] = self::preview($s);
        $s['round_limit']=$limit;
        return $s;
    }

    /** Old serialized v1/v2 rooms predate round_limit. Upgrade only in memory, never to v3 values. */
    public static function normalize(array $s): array {
        if(!is_string($s['rules_version'] ?? null)) { throw new InvalidArgumentException('rules_version'); }
        $config=self::config($s['rules_version']);
        if(!in_array($s['mode'] ?? null,['solo','duo'],true)) { throw new InvalidArgumentException('state'); }
        $limit=$s['mode']==='solo'?$config['solo_round_limit']:$config['duo_round_limit'];
        if(!array_key_exists('round_limit',$s) && $s['rules_version']!==self::VERSION) { $s['round_limit']=$limit; }
        if(($s['round_limit'] ?? null)!==$limit) { throw new InvalidArgumentException('state'); }
        return $s;
    }

    /** All external serialized states must be validated before use, including version. */
    public static function validate(array $s): void {
        $s=self::normalize($s);
        if(($s['schema'] ?? null) !== 1 || !in_array($s['rules_version'] ?? null,[self::VERSION,self::V2_VERSION,self::LEGACY_VERSION],true)) {
            throw new InvalidArgumentException('rules_version');
        }
        $config=self::config($s['rules_version']);
        $mode = $s['mode'] ?? null;
        if(!in_array($mode, ['solo', 'duo'], true)) { throw new InvalidArgumentException('state'); }
        $n = $mode === 'solo' ? 1 : 2;
        $max = $n === 1 ? $config['solo_hp'] : $config['duo_hp'];
        if(($s['boss_max_hp'] ?? null) !== $max) { throw new InvalidArgumentException('state'); }
        foreach(['hp','pots','left','leaving','intents'] as $key) {
            if(!isset($s[$key]) || !is_array($s[$key]) || !array_is_list($s[$key]) || count($s[$key]) !== $n) {
                throw new InvalidArgumentException('state');
            }
        }
        foreach($s['hp'] as $i=>$hp) {
            if(!is_int($hp) || $hp < 0 || $hp > 40 || !is_int($s['pots'][$i]) ||
                $s['pots'][$i] < 0 || $s['pots'][$i] > ($n === 1 ? $config['solo_potions'] : 2) ||
                !is_bool($s['left'][$i]) || !is_bool($s['leaving'][$i])) {
                throw new InvalidArgumentException('state');
            }
        }
        foreach(['boss'=>[0,$max], 'round_no'=>[1,$s['round_limit']], 'version'=>[1,1000],
            'deadline_ms'=>[0,PHP_INT_MAX-self::TURN_MS], 'updated_ms'=>[0,PHP_INT_MAX-self::TURN_MS]] as $key=>$range) {
            if(!isset($s[$key]) || !is_int($s[$key]) || $s[$key] < $range[0] || $s[$key] > $range[1]) {
                throw new InvalidArgumentException('state');
            }
        }
        if(!in_array($s['status'] ?? null, [self::ACTIVE,self::WON,self::LOST], true) ||
            !is_bool($s['exposed'] ?? null) || !isset($s['history']) || !is_array($s['history']) ||
            !array_is_list($s['history']) || count($s['history']) > $s['round_limit'] ||
            !is_string($s['reason'] ?? null) || !array_key_exists('ended_ms', $s)) {
            throw new InvalidArgumentException('state');
        }
        if($s['status'] === self::ACTIVE) {
            if($s['boss'] === 0 || !self::alive($s) || $s['ended_ms'] !== null ||
                count($s['history']) !== $s['round_no'] - 1 || ($s['preview'] ?? null) !== self::preview($s)) {
                throw new InvalidArgumentException('state');
            }
            foreach($s['intents'] as $actor=>$action) {
                if($action !== null) { self::validate_action($s, $actor, $action); }
            }
        } elseif(!is_int($s['ended_ms']) || $s['ended_ms'] < 0 ||
            ($s['status'] === self::WON && $s['boss'] !== 0)) {
            throw new InvalidArgumentException('state');
        }
    }

    public static function alive(array $s): array {
        $alive = [];
        foreach($s['hp'] as $i=>$hp) { if($hp > 0 && !$s['left'][$i]) { $alive[] = $i; } }
        return $alive;
    }

    /** Freeze this preview when the round is prepared, before accepting intentions. */
    public static function preview(array $s): array {
        $alive = self::alive($s);
        if(!$alive) { throw new InvalidArgumentException('no_survivor'); }
        $kind = ($s['round_no'] - 1) % 4;
        $phase = $s['boss'] * 2 <= $s['boss_max_hp'] ? 2 : 1;
        $focus = intdiv($s['round_no'] - 1, 4) % count($s['hp']);
        if(!in_array($focus, $alive, true)) { $focus = $alive[0]; }
        return ['kind'=>$kind, 'phase'=>$phase,
            'targets'=>in_array($kind, [0,2], true) ? [$focus] : ($kind === 1 ? $alive : []),
            'damage'=>$kind === 3 ? 0 : ($kind === 2 ? ($phase === 1 ? 24 : 28) : ($phase === 1 ? 8 : 10))];
    }

    public static function validate_action(array $s, int $actor, array $a): void {
        if(!in_array($actor, self::alive($s), true)) { throw new InvalidArgumentException('actor'); }
        if(count($a) !== 2 || !array_key_exists('kind', $a) || !array_key_exists('target', $a) ||
            !in_array($a['kind'], ['attack','guard','heal'], true) || !is_int($a['target'])) {
            throw new InvalidArgumentException('action');
        }
        if($a['kind'] === 'attack') {
            if($a['target'] !== -1) { throw new InvalidArgumentException('target'); }
        } else {
            if(!in_array($a['target'], self::alive($s), true)) { throw new InvalidArgumentException('target'); }
            if($a['kind'] === 'heal' && ($s['pots'][$actor] <= 0 || $s['hp'][$a['target']] === 40)) {
                throw new InvalidArgumentException('heal');
            }
        }
    }

    /** Caller first persists advance_due even if a subsequent late action is rejected. */
    public static function submit(array $s, int $round, int $actor, array $action, int $now): array {
        $s=self::normalize($s);
        self::validate($s);
        if($s['status'] !== self::ACTIVE) { throw new InvalidArgumentException('ended'); }
        if($now >= $s['deadline_ms']) { throw new InvalidArgumentException('due'); }
        if($now < $s['updated_ms']) { throw new InvalidArgumentException('clock'); }
        if($round !== $s['round_no']) { throw new InvalidArgumentException('round'); }
        self::validate_action($s, $actor, $action);
        if($s['intents'][$actor] !== null) { throw new InvalidArgumentException('locked'); }
        $s['intents'][$actor] = $action;
        $s['version']++;
        $s['updated_ms'] = $now;
        foreach(self::alive($s) as $i) { if($s['intents'][$i] === null) { return $s; } }
        return self::resolve($s, $now, false);
    }

    /** Timeout fills only missing intentions. Next deadline derives from original deadline. */
    public static function advance_due(array $s, int $now): array {
        $s=self::normalize($s);
        self::validate($s);
        if($now < $s['updated_ms'] || $now > PHP_INT_MAX - self::TURN_MS * ($s['round_limit']+1)) {
            throw new InvalidArgumentException('clock');
        }
        for($i=0; $i<$s['round_limit'] && $s['status'] === self::ACTIVE && $now >= $s['deadline_ms']; $i++) {
            $s = self::resolve($s, $s['deadline_ms'], true);
        }
        return $s;
    }

    public static function retreat(array $s, int $actor, int $now): array {
        $s=self::normalize($s);
        self::validate($s);
        if($s['status'] !== self::ACTIVE) { throw new InvalidArgumentException('ended'); }
        if($now >= $s['deadline_ms']) { throw new InvalidArgumentException('due'); }
        if($now < $s['updated_ms']) { throw new InvalidArgumentException('clock'); }
        if(!isset($s['hp'][$actor]) || $s['left'][$actor] || $s['leaving'][$actor]) {
            throw new InvalidArgumentException('actor');
        }
        if($s['mode'] === 'solo') { return self::finish($s, self::LOST, 'retreated', $now); }
        $s['leaving'][$actor] = true;
        $s['version']++;
        $s['updated_ms'] = $now;
        if($s['hp'][$actor] > 0 && $s['intents'][$actor] === null) {
            $s['intents'][$actor] = ['kind'=>'guard','target'=>$actor];
        }
        // A downed member has no remaining action in this round; departure still lands at round end.
        foreach(self::alive($s) as $i) { if($s['intents'][$i] === null) { return $s; } }
        return self::resolve($s, $now, false);
    }

    /** Complete one prepared round. No external arbitrary state replacement is accepted. */
    private static function resolve(array $s, int $at, bool $timeout): array {
        $before = $s['hp'];
        $wards = []; $heals = array_fill(0, count($before), 0); $attackers = 0; $defaults = [];
        foreach(self::alive($s) as $i) {
            if($s['intents'][$i] === null) {
                if(!$timeout) { throw new LogicException('missing_intent'); }
                $s['intents'][$i] = ['kind'=>'guard','target'=>$i]; $defaults[] = $i;
            }
            $a = $s['intents'][$i];
            self::validate_action($s, $i, $a);
            if($a['kind'] === 'guard') { $wards[$a['target']] = true; }
            elseif($a['kind'] === 'heal') { $s['pots'][$i]--; $heals[$a['target']] += 28; }
            else { $attackers++; }
        }
        foreach($heals as $i=>$amount) { $s['hp'][$i] = min(40, $s['hp'][$i] + $amount); }
        $p = $s['preview'];
        $attack = $p['kind'] === 3 && $s['exposed'] ? 20 : 10;
        $s['boss'] = max(0, $s['boss'] - $attackers * $attack);
        $s['exposed'] = false;
        $damage = array_fill(0, count($before), 0);
        if($s['boss'] > 0) {
            foreach($p['targets'] as $target) {
                $damage[$target] = isset($wards[$target]) ? intdiv($p['damage'] + 4, 5) : $p['damage'];
                $s['hp'][$target] = max(0, $s['hp'][$target] - $damage[$target]);
                if($p['kind'] === 2 && isset($wards[$target]) && $s['hp'][$target] > 0) { $s['exposed'] = true; }
            }
        }
        // Victory stops the round before deferred departures, just as it cancels the boss attack.
        foreach($s['leaving'] as $i=>$leave) {
            if($leave && $s['boss'] > 0) { $s['left'][$i] = true; }
            $s['leaving'][$i] = false;
        }
        $s['history'][] = ['round'=>$s['round_no'], 'preview'=>$p, 'actions'=>$s['intents'],
            'hp'=>$s['hp'], 'boss'=>$s['boss'], 'pots'=>$s['pots'], 'exposed'=>$s['exposed'],
            'damage'=>$damage, 'heals'=>$heals, 'defaults'=>$defaults, 'left'=>$s['left']];
        $s['version']++; $s['updated_ms'] = $at;
        $s['intents'] = array_fill(0, count($before), null);
        if($s['boss'] === 0) { return self::finish($s, self::WON, 'defeated', $at); }
        if(!self::alive($s)) { return self::finish($s, self::LOST, array_sum($s['hp']) > 0 ? 'retreated' : 'knockout', $at); }
        if($s['round_no'] >= $s['round_limit']) { return self::finish($s, self::LOST, 'round_limit', $at); }
        $s['round_no']++;
        $s['deadline_ms'] = $at + self::TURN_MS;
        $s['preview'] = self::preview($s);
        return $s;
    }

    private static function finish(array $s, int $status, string $reason, int $at): array {
        $s['status'] = $status; $s['reason'] = $reason; $s['ended_ms'] = $at;
        $s['updated_ms'] = $at; $s['version']++;
        $s['exposed'] = false;
        return $s;
    }
}

