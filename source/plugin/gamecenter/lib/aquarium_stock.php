<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。
 *  库存模式判定与迁移：运行时（shop/rules）与 CLI 工具共用同一套规则，避免两套口径。
 *
 *  三种模式：
 *    legacy  —— 整行纯旧档：所有鱼都没有 owned/sold，且没有 inventory_schema
 *    new     —— 整行新档：所有鱼都有合法 owned/sold 且守恒，schema=1
 *    anomaly —— 混合/半字段/非法值/不守恒/未知 schema/展示超持有
 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';

final class gamecenter_aquarium_stock {
    const SCHEMA = 1;

    /** 单条鱼记录的类型：old（两字段都无）/ new（都合法）/ bad */
    private static function fishKind(array $f): string {
        $hasOwned = array_key_exists('owned_count', $f);
        $hasSold  = array_key_exists('sold_count', $f);
        if(!$hasOwned && !$hasSold) { return 'old'; }
        if(!$hasOwned || !$hasSold) { return 'bad'; }
        if(!is_int($f['owned_count']) || !is_int($f['sold_count'])) { return 'bad'; }
        if($f['owned_count'] < 0 || $f['sold_count'] < 0) { return 'bad'; }
        if(!is_int($f['catch_count'])) { return 'bad'; }
        if($f['owned_count'] + $f['sold_count'] !== $f['catch_count']) { return 'bad'; }
        return 'new';
    }

    /** 展示计数（只统计非空 fish_id） */
    public static function shown(array $s): array {
        $out = [];
        foreach(($s['layout']['fish'] ?? []) as $x) {
            if(is_string($x) && $x !== '') { $out[$x] = ($out[$x] ?? 0) + 1; }
        }
        return $out;
    }

    /**
     * 判定整行模式。
     * @param array $s      存档 JSON
     * @param array $c      当前配置（用于校验 fish_id 是否合法）
     * @param array|null $header 数据库行头（uid/save_version/config_version/updated_ms），给了就一起核对
     * @return array{kind:string,why:string}
     */
    public static function classify(array $s, array $c, ?array $header = null): array {
        $fish = $s['fish'] ?? null;
        if(!is_array($fish)) { return ['kind'=>'anomaly','why'=>'no-fish']; }

        // 行头核对：uid / 存档版本 / 配置版本 / 时间锚点
        if($header !== null) {
            if((string)($s['uid'] ?? '') !== (string)($header['uid'] ?? '')) { return ['kind'=>'anomaly','why'=>'uid-mismatch']; }
            if((int)($s['save_version'] ?? 0) !== 1 || (int)($header['save_version'] ?? 1) !== 1) { return ['kind'=>'anomaly','why'=>'save-version']; }
            $cv = (string)($s['config_version'] ?? '');
            if($cv === '' || $cv !== (string)($header['config_version'] ?? '')) { return ['kind'=>'anomaly','why'=>'config-version']; }
            if((int)($s['last_settled_ms'] ?? -1) !== (int)($header['updated_ms'] ?? -2)) { return ['kind'=>'anomaly','why'=>'anchor']; }
        }

        // schema 严格判定：只有「字段缺失」算旧档，非 1 的显式值一律异常
        $schemaRaw = $s['inventory_schema'] ?? null;
        if($schemaRaw !== null && !is_int($schemaRaw)) { return ['kind'=>'anomaly','why'=>'schema-type']; }
        $schema = $schemaRaw === null ? 0 : $schemaRaw;
        if($schema !== 0 && $schema !== self::SCHEMA) { return ['kind'=>'anomaly','why'=>'schema-unknown']; }

        $kinds = ['old'=>0,'new'=>0,'bad'=>0];
        foreach($fish as $fid=>$f) {
            if(!is_string($fid) || !self::fishKnown($fid, $c)) {
                return ['kind'=>'anomaly','why'=>'unknown-fish:'.$fid];
            }
            if(!is_array($f)) { return ['kind'=>'anomaly','why'=>'fish-entry:'.$fid]; }
            if(!isset($f['discovered_at']) || !gamecenter_aquarium_rules::number($f['discovered_at'] ?? null)) {
                return ['kind'=>'anomaly','why'=>'discovered:'.$fid];
            }
            $k = self::fishKind($f);
            $kinds[$k]++;
            if($k === 'bad') { return ['kind'=>'anomaly','why'=>'stock:'.$fid]; }
        }

        // 整行模式
        if($kinds['new'] === 0 && $kinds['old'] === 0) { return ['kind'=>'legacy','why'=>'empty'];}
        if($kinds['old'] > 0 && $kinds['new'] > 0) { return ['kind'=>'anomaly','why'=>'mixed']; }
        $mode = $kinds['new'] > 0 ? 'new' : 'legacy';
        if($mode === 'new' && $schema !== self::SCHEMA) { return ['kind'=>'anomaly','why'=>'new-without-marker']; }
        if($mode === 'legacy' && $schema === self::SCHEMA) { return ['kind'=>'anomaly','why'=>'marker-without-fields']; }

        // 展示保护：旧档用 catch_count 推算持有量，新档用 owned_count
        foreach(self::shown($s) as $fid=>$n) {
            if(!isset($fish[$fid])) { return ['kind'=>'anomaly','why'=>'shown-missing:'.$fid]; }
            $f = $fish[$fid];
            $owned = $mode === 'legacy' ? (int)($f['catch_count'] ?? 0) : (int)$f['owned_count'];
            if($n > $owned) { return ['kind'=>'anomaly','why'=>'overdisplay:'.$fid]; }
        }

        // 已有异常标记的行保持隔离，不自动清标
        if(!empty($s['inventory_anomaly'])) { return ['kind'=>'anomaly','why'=>'flagged']; }

        return ['kind'=>$mode, 'why'=>$mode === 'new' ? '' : 'legacy'];
    }

    private static function fishKnown(string $fid, array $c): bool {
        foreach(($c['waters'] ?? []) as $w) {
            if(isset($w['fish'][$fid])) { return true; }
        }
        return false;
    }

    /** 纯旧档 → 新档：只补库存字段与标记，其他一律不动 */
    public static function migrate(array $s): array {
        foreach(($s['fish'] ?? []) as $fid=>$f) {
            if(!is_array($f)) { continue; }
            if(!array_key_exists('owned_count', $f)) { $s['fish'][$fid]['owned_count'] = (int)($f['catch_count'] ?? 0); }
            if(!array_key_exists('sold_count', $f)) { $s['fish'][$fid]['sold_count'] = 0; }
        }
        $s['inventory_schema'] = self::SCHEMA;
        return $s;
    }
}
