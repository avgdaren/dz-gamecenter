<?php
/** 作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。服务与迁移共用的存档边界校验。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_shop.php';
final class gamecenter_aquarium_state {
    /** 行头允许数据库返回的十进制字符串，JSON 内字段仍要求原生整数。 */
    public static function decode(array $row, ?int $uid = null): array {
        foreach(['uid','save_version','version','updated_ms'] as $k) {
            if(!isset($row[$k]) || (!is_int($row[$k]) && !is_string($row[$k]))
                || !ctype_digit((string)$row[$k]) || (float)$row[$k] > gamecenter_aquarium_rules::MAX_VALUE) {
                throw new DomainException('row-'.$k);
            }
        }
        if((int)$row['save_version'] !== 1) { throw new DomainException('save-version'); }
        if((int)$row['version'] < 1 || (int)$row['version'] >= gamecenter_aquarium_rules::MAX_VALUE) { throw new DomainException('row-version'); }
        if(!is_string($row['state_json'] ?? null) || strlen($row['state_json']) > 131072) { throw new DomainException('state-json'); }
        $s = json_decode($row['state_json'], true, 32, JSON_THROW_ON_ERROR);
        if(!is_array($s) || ($s['uid'] ?? null) !== (int)$row['uid'] || ($uid !== null && $uid !== (int)$row['uid'])) {
            throw new DomainException('state-uid');
        }
        if(!is_string($row['config_version'] ?? null) || ($s['config_version'] ?? null) !== $row['config_version']) {
            throw new DomainException('row-json-version');
        }
        if(($s['last_settled_ms'] ?? null) !== (int)$row['updated_ms']) { throw new DomainException('anchor-mismatch'); }
        return $s;
    }

    /** 仅在线兼容入口可补纯旧库存/缺标记；CLI 池切换和 verify 必须是完整新档。 */
    public static function validate(array $s, array $c, bool $allowLegacy = false): array {
        gamecenter_aquarium_rules::validate($s, $c);
        if(array_key_exists('recent_summary',$s)) {
            $summary=$s['recent_summary'];
            if(!is_array($summary)) { throw new DomainException('state-summary'); }
            foreach(['from_ms','to_ms','coins','catch_count','effective_ms','discarded_ms'] as $k) {
                if(!gamecenter_aquarium_rules::number($summary[$k] ?? null)) { throw new DomainException('state-summary'); }
            }
            if(!is_array($summary['new_fish_ids'] ?? null) || !array_is_list($summary['new_fish_ids'])) { throw new DomainException('state-summary'); }
            foreach($summary['new_fish_ids'] as $fid) {
                if(!is_string($fid) || !isset($s['fish'][$fid])) { throw new DomainException('state-summary'); }
            }
        }
        $hasShop = isset($c['decor'], $c['fish_capacities'], $c['initial_fish_capacity']);
        // S2 之前的完整旧档没有任何布置字段。只为这一种形状补默认值，不清洗已有坏布局。
        if($allowLegacy && $hasShop && !array_key_exists('fish_capacity', $s)
            && !array_key_exists('decor_owned', $s) && !array_key_exists('layout', $s)) {
            $s = gamecenter_aquarium_shop::defaults($s, $c);
        }
        $cls = gamecenter_aquarium_stock::classify($s, $c);
        if($allowLegacy && $cls['kind'] === 'legacy') { $s = gamecenter_aquarium_stock::migrate($s); }
        elseif($allowLegacy && $cls['kind'] === 'needs-marker') { $s = gamecenter_aquarium_stock::markOnly($s); }
        elseif($cls['kind'] !== 'new') { throw new DomainException('stock:'.$cls['kind'].':'.$cls['why']); }
        if($hasShop) { gamecenter_aquarium_shop::validateState($s, $c); }
        return $s;
    }
}
