<?php
/** 作者：小蓝（DSH）；原插件 (C) 2026 Carinoasd。
 *  水景（鱼缸背景）目录：服务端可信副本，价格与条件只从这里读，不接受客户端提交。
 *  数据源：games/aquarium/assets/background/expansion-v1/catalog.json
 */
class gamecenter_aquarium_scenery {
    const SCHEMA = 'aquarium-scenery-catalog-v1';
    const FILE = 'games/aquarium/assets/background/expansion-v1/catalog.json';

    private static $cache = null;

    /** 完整目录（含免费默认两景）。读取失败返回空数组，调用方按「无水景可买」处理。 */
    public static function catalog(): array {
        if(self::$cache !== null) { return self::$cache; }
        $path = DISCUZ_ROOT.'./source/plugin/gamecenter/'.self::FILE;
        if(!is_readable($path)) { return self::$cache = []; }
        $raw = @file_get_contents($path);
        if($raw === false) { return self::$cache = []; }
        $json = json_decode($raw, true);
        if(!is_array($json) || ($json['schema'] ?? '') !== self::SCHEMA || !is_array($json['items'] ?? null)) {
            return self::$cache = [];
        }
        $out = [];
        foreach($json['items'] as $it) {
            if(!is_array($it) || !is_string($it['id'] ?? null)) { continue; }
            $out[$it['id']] = $it;
        }
        return self::$cache = $out;
    }

    /** 默认可用的两景（永久免费，旧档自动补齐）。 */
    public static function free_ids(): array { return ['tank_day', 'tank_moon']; }

    /** 支持的全部背景 id，顺序：免费两景在前，再按 index。 */
    public static function supported(): array {
        $ids = self::free_ids();
        $items = self::catalog();
        uasort($items, static function ($a, $b) { return ((int)($a['index'] ?? 0)) <=> ((int)($b['index'] ?? 0)); });
        foreach(array_keys($items) as $id) { if(!in_array($id, $ids, true)) { $ids[] = $id; } }
        return $ids;
    }

    public static function item(string $id): ?array { return self::catalog()[$id] ?? null; }

    /** 购买条件是否满足；返回缺什么（空数组＝满足）。 */
    public static function missing(array $s, string $id): array {
        $it = self::item($id);
        if(!$it) { return ['不存在的水景']; }
        $req = $it['requires'] ?? [];
        $out = [];
        $pond = self::countDiscovered($s, 'pond');
        $total = count($s['fish'] ?? []);
        if((int)($req['pond_discovered'] ?? 0) > 0 && $pond < (int)$req['pond_discovered']) {
            $out[] = '池塘还差 '.((int)$req['pond_discovered'] - $pond).' 种鱼';
        }
        if((int)($req['total_discovered'] ?? 0) > 0 && $total < (int)$req['total_discovered']) {
            $out[] = '图鉴还差 '.((int)$req['total_discovered'] - $total).' 种鱼';
        }
        $water = (string)($req['water_unlocked'] ?? '');
        if($water !== '' && !in_array($water, $s['unlocked_waters'] ?? [], true)) {
            $out[] = '需先解锁钓点：'.self::waterName($water);
        }
        return $out;
    }

    public static function waterName(string $id): string {
        require_once __DIR__.'/aquarium_content.php';
        $w = gamecenter_aquarium_content::catalog()['water_names'] ?? [];
        return (string)($w[$id] ?? $id);
    }

    /** 按不同 fish_id 统计已发现数量（不能数槽位或累计捕获）。 */
    public static function countDiscovered(array $s, ?string $water = null): int {
        require_once __DIR__.'/aquarium_content.php';
        $meta = gamecenter_aquarium_content::catalog();
        $n = 0;
        foreach($meta['fish'] as $f) {
            if(!isset($s['fish'][$f['id']])) { continue; }
            if($water !== null && (string)($f['water'] ?? '') !== $water) { continue; }
            $n++;
        }
        return $n;
    }
}
