<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。水族馆购买、扩容与布置的纯规则（无 IO、无时间）。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';
require_once __DIR__.'/aquarium_configs.php';
require_once __DIR__.'/aquarium_stock.php';

final class gamecenter_aquarium_shop {
    const MAX_SLOTS = 12;

    /** 旧档没有这些字段时的默认值（迁移前的档、或 S2 之前建的档）。 */
    public static function defaults(array $s, array $c): array {
        if(!isset($s['fish_capacity'])) { $s['fish_capacity'] = $c['initial_fish_capacity']; }
        if(!isset($s['decor_owned']) || !is_array($s['decor_owned'])) { $s['decor_owned'] = []; }
        if(!isset($s['layout']) || !is_array($s['layout'])) {
            $s['layout'] = ['fish'=>[], 'decor'=>['back'=>[], 'front'=>[]], 'background'=>self::backgrounds()[0]];
        }
        $cap = (int)$s['fish_capacity'];
        $slots = $s['layout']['fish'] ?? [];
        if(!is_array($slots)) { $slots = []; }
        $slots = array_values($slots);
        while(count($slots) < $cap) { $slots[] = null; }
        $slots = array_slice($slots, 0, $cap);
        foreach($slots as $i=>$v) { if($v !== null && !is_string($v)) { $slots[$i] = null; } }
        $s['layout']['fish'] = $slots;
        foreach(['back','front'] as $layer) {
            if(!isset($s['layout']['decor'][$layer]) || !is_array($s['layout']['decor'][$layer])) { $s['layout']['decor'][$layer] = []; }
            $s['layout']['decor'][$layer] = array_values(array_filter($s['layout']['decor'][$layer], 'is_string'));
        }
        if(!is_string($s['layout']['background'] ?? null) || !in_array($s['layout']['background'], self::backgrounds(), true)) {
            $s['layout']['background'] = self::backgrounds()[0];
        }
        // 库存模式判定与迁移统一走 gamecenter_aquarium_stock（运行时与 CLI 同一套规则）
        if(isset($s['fish']) && is_array($s['fish'])) {
            $cls = gamecenter_aquarium_stock::classify($s, $c);
            if($cls['kind'] === 'legacy') { $s = gamecenter_aquarium_stock::migrate($s); }
            elseif($cls['kind'] === 'anomaly') { $s['inventory_anomaly'] = true; }
        }
        return $s;
    }

    public static function backgrounds(): array { return ['tank_day','tank_moon']; }

    /** 暂定每层装饰位；6/8/10 未定案，这里只做单点常量，换方案改这一处。 */
    public static function decor_slots_per_layer(): int { return 3; }

    public static function validateState(array $s, array $c): void {
        if(!in_array((int)($s['fish_capacity'] ?? 0), $c['fish_capacities'], true)) { throw new DomainException('state-capacity'); }
        if(!is_array($s['decor_owned'] ?? null) || !is_array($s['layout'] ?? null)) { throw new DomainException('state-layout'); }
        $owned = [];
        foreach($s['decor_owned'] as $id=>$at) {
            if(!isset($c['decor'][$id]) || !gamecenter_aquarium_rules::number($at)) { throw new DomainException('state-decor'); }
            $owned[$id] = true;
        }
        if(empty($s['inventory_anomaly'])) {
            foreach($s['fish'] as $fid=>$f) {
                if(!array_key_exists('owned_count',$f) || !array_key_exists('sold_count',$f)) { throw new DomainException('state-stock-missing'); }
                if(!gamecenter_aquarium_rules::number($f['owned_count']) || !gamecenter_aquarium_rules::number($f['sold_count'])) { throw new DomainException('state-stock'); }
                $stockOwned = (int)$f['owned_count']; $stockSold = (int)$f['sold_count'];
                if($stockOwned < 0 || $stockSold < 0) { throw new DomainException('state-stock-negative'); }
                if($stockOwned + $stockSold !== (int)($f['catch_count'] ?? 0)) { throw new DomainException('state-stock-sum'); }
            }
        }
        $slots = $s['layout']['fish'];
        if(count($slots) !== (int)$s['fish_capacity']) { throw new DomainException('state-layout'); }
        // 同种鱼可重复展示，但最多展示「钓到的条数」；旧档可能超额，读取时只校验已发现
        foreach($slots as $fid) {
            if($fid === null) { continue; }
            if(!is_string($fid) || !isset($s['fish'][$fid])) { throw new DomainException('state-layout'); }
        }
        $decorSeen = [];
        foreach(['back','front'] as $layer) {
            $list = $s['layout']['decor'][$layer];
            if(count($list) > self::decor_slots_per_layer()) { throw new DomainException('state-layout'); }
            foreach($list as $id) {
                if(!is_string($id) || !isset($owned[$id]) || isset($decorSeen[$id])) { throw new DomainException('state-layout'); }
                if(!in_array($layer, $c['decor'][$id]['layers'], true)) { throw new DomainException('state-layout'); }
                $decorSeen[$id] = true;
            }
        }
        if(!in_array($s['layout']['background'], self::backgrounds(), true)) { throw new DomainException('state-layout'); }
    }

    /** 条件差多少（用于界面置灰）。 */
    public static function missing(array $s, string $id, array $c): array {
        $e = $c['decor'][$id]; $g = $e['requires'];
        return [
            'coins'=>max(0, (int)$e['cost'] - (int)$s['coins']),
            'pond_fish'=>max(0, (int)$g['pond_count'] - count(array_intersect_key($s['fish'], $c['waters'][$c['initial_water']]['fish']))),
            'total_fish'=>max(0, (int)$g['total_fish'] - count($s['fish'])),
            'water'=>($g['water_unlocked'] !== '' && !in_array($g['water_unlocked'], $s['unlocked_waters'], true)) ? $g['water_unlocked'] : '',
        ];
    }

    /** 售卖价：按品级固定，只对旧鱼生效；限量物种可售恒为 0。 */
    public static function sellPrice(string $rarity): int {
        $table = ['常见'=>1,'少见'=>2,'稀有'=>5,'珍奇'=>10];
        return $table[$rarity] ?? 0;
    }

    /** 该鱼种当前可售数量：持有 − max(保留4条, 缸内展示数)。 */
    public static function sellable(array $s, string $fid): int {
        $f = $s['fish'][$fid] ?? null;
        if(!$f) { return 0; }
        $owned = (int)($f['owned_count'] ?? 0);
        $shown = 0;
        foreach($s['layout']['fish'] as $x) { if($x === $fid) { $shown++; } }
        $keep = max(4, $shown);
        return max(0, $owned - $keep);
    }

    /** 卖鱼：一次只卖一个鱼种指定条数，数量上限在服务端再算一次。 */
    public static function sell(array $s, string $fid, int $qty, array $c, int $now): array {
        if(gamecenter_aquarium_configs::sellHardOff()) { return [$s, 'closed']; }   // 兼容关闭版：售卖恒关
        if(!empty($s['inventory_anomaly'])) { return [$s, 'condition']; }
        if(!isset($s['fish'][$fid])) { return [$s, 'target']; }
        if($qty < 1) { return [$s, 'input']; }
        // 限量物种禁止售卖：上限在 waters[water].fish[fid] 上，不在顶层
        foreach(($c['waters'] ?? []) as $w) {
            if(isset($w['fish'][$fid]['lifetime_cap'])) { return [$s, 'condition']; }
        }
        $max = self::sellable($s, $fid);
        if($qty > $max) { return [$s, 'condition']; }
        require_once __DIR__.'/aquarium_content.php';
        $meta = gamecenter_aquarium_content::catalog();
        $rarity = '';
        foreach($meta['fish'] as $it) { if(($it['id'] ?? '') === $fid) { $rarity = (string)($it['rarity'] ?? ''); break; } }
        $price = self::sellPrice($rarity);
        if($price < 1) { return [$s, 'condition']; }
        $gain = $qty * $price;
        // 金额上限：整笔拒绝，不截断（截断会扣鱼少给钱）
        if($gain < 1 || $gain > gamecenter_aquarium_rules::MAX_VALUE) { return [$s, 'limit']; }
        if((int)$s['coins'] + $gain > gamecenter_aquarium_rules::MAX_VALUE) { return [$s, 'limit']; }
        $s['coins'] = (int)$s['coins'] + $gain;
        $before = (int)($s['version'] ?? 0);
        $s['fish'][$fid]['owned_count'] = (int)$s['fish'][$fid]['owned_count'] - $qty;
        $s['fish'][$fid]['sold_count'] = (int)($s['fish'][$fid]['sold_count'] ?? 0) + $qty;
        // 有界回执：便于丢响应时核对，不当成幂等键
        if(!isset($s['recent_sale']) || !is_array($s['recent_sale'])) { $s['recent_sale']=[]; }
        $s['recent_sale'][] = ['fish_id'=>$fid,'qty'=>$qty,'price'=>$price,'gain'=>$gain,'at_ms'=>$now];
        $s['recent_sale'] = array_slice($s['recent_sale'], -5);
        return [$s, ''];
    }

    public static function buy(array $s, string $id, array $c, int $now): array {
        if(!isset($c['decor'][$id])) { return [$s, 'target']; }
        if(isset($s['decor_owned'][$id])) { return [$s, 'owned']; }
        $m = self::missing($s, $id, $c);
        if($m['water'] !== '' || $m['pond_fish'] > 0 || $m['total_fish'] > 0) { return [$s, 'condition']; }
        if($m['coins'] > 0) { return [$s, 'coins']; }
        $s['coins'] -= (int)$c['decor'][$id]['cost'];
        $s['decor_owned'][$id] = $now;
        ksort($s['decor_owned'], SORT_STRING);
        return [$s, ''];
    }

    public static function expand(array $s, array $c): array {
        $caps = $c['fish_capacities']; $costs = $c['fish_capacity_costs'];
        $cur = (int)$s['fish_capacity'];
        $idx = array_search($cur, $caps, true);
        if($idx === false || !isset($caps[$idx+1])) { return [$s, 'target']; }
        $cost = (int)$costs[$idx+1];
        if((int)$s['coins'] < $cost) { return [$s, 'coins']; }
        $s['coins'] -= $cost;
        $s['fish_capacity'] = (int)$caps[$idx+1];
        while(count($s['layout']['fish']) < $s['fish_capacity']) { $s['layout']['fish'][] = null; }
        return [$s, ''];
    }

    public static function setLayout(array $s, array $payload, array $c): array {
        if(!is_array($payload)) { return [$s, 'input']; }
        $keys = array_keys($payload);
        foreach($keys as $k) { if(!in_array($k, ['fish','decor','background'], true)) { return [$s, 'input']; } }
        $next = $s;

        if(array_key_exists('fish', $payload)) {
			$list = $payload['fish'];
			if(!is_array($list) || !array_is_list($list) || count($list) !== (int)$s['fish_capacity']) { return [$s, 'input']; }
			$clean = [];
			$perSpecies = [];
			foreach($list as $fid) {
				if($fid === null || $fid === '') { $clean[] = null; continue; }
				if(!is_string($fid) || !isset($s['fish'][$fid])) { return [$s, 'target']; }
				// 钓几条才能放几条：展示数不得超过该鱼种的捕获数
				$perSpecies[$fid] = ($perSpecies[$fid] ?? 0) + 1;
				$held = (int)($s['fish'][$fid]['owned_count'] ?? $s['fish'][$fid]['catch_count'] ?? 0);
        if($perSpecies[$fid] > $held) { return [$s, 'condition']; }
				$clean[] = $fid;
			}
			$next['layout']['fish'] = $clean;
        }

        if(array_key_exists('decor', $payload)) {
            $decor = $payload['decor'];
            if(!is_array($decor)) { return [$s, 'input']; }
            $all = [];
            foreach(['back','front'] as $layer) {
                if(!array_key_exists($layer, $decor)) { continue; }
                $list = $decor[$layer];
                if(!is_array($list) || !array_is_list($list) || count($list) > self::decor_slots_per_layer()) { return [$s, 'input']; }
                $clean = [];
                foreach($list as $id) {
                    if(!is_string($id) || !isset($c['decor'][$id]) || !isset($s['decor_owned'][$id])) { return [$s, 'target']; }
                    if(!in_array($layer, $c['decor'][$id]['layers'], true)) { return [$s, 'condition']; }
                    if(isset($all[$id])) { return [$s, 'target']; }
                    $all[$id] = true; $clean[] = $id;
                }
                $next['layout']['decor'][$layer] = $clean;
            }
            foreach(array_keys($decor) as $k) { if(!in_array($k, ['back','front'], true)) { return [$s, 'input']; } }
        }

        if(array_key_exists('background', $payload)) {
            $bg = $payload['background'];
            if(!is_string($bg) || !in_array($bg, self::backgrounds(), true)) { return [$s, 'target']; }
            $next['layout']['background'] = $bg;
        }

        self::validateState($next, $c);
        return [$next, ''];
    }
}
