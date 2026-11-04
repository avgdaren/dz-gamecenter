<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。
 *  库存模式判定与迁移：运行时（shop/rules）与 CLI 工具共用同一套规则。
 *
 *  四种结果：
 *    legacy       —— 整行纯旧档（所有鱼两个库存字段都不存在），可迁移
 *    needs-marker —— 库存字段完整合法但缺 inventory_schema，只补标记
 *    new          —— 已是新档
 *    anomaly      —— 混合/半字段/非法值/不守恒/未知 schema/展示超持有/行头或配置不符
 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';

final class gamecenter_aquarium_stock {
    const SCHEMA = 1;

    /** 单条鱼记录：old（两字段都无）/ new（都合法）/ bad */
    private static function fishKind(array $f): string {
        $hasOwned = array_key_exists('owned_count', $f);
        $hasSold  = array_key_exists('sold_count', $f);
        if(!$hasOwned && !$hasSold) {
            // 纯旧档也要先验证基础字段，不能靠强转掩盖坏数据
            if(!array_key_exists('catch_count', $f) || !is_int($f['catch_count']) || $f['catch_count'] < 0) { return 'bad'; }
            return 'old';
        }
        if(!$hasOwned || !$hasSold) { return 'bad'; }
        if(!is_int($f['owned_count']) || !is_int($f['sold_count'])) { return 'bad'; }
        if($f['owned_count'] < 0 || $f['sold_count'] < 0) { return 'bad'; }
        if(!array_key_exists('catch_count', $f) || !is_int($f['catch_count'])) { return 'bad'; }
        if($f['owned_count'] + $f['sold_count'] !== $f['catch_count']) { return 'bad'; }
        return 'new';
    }

    /** 展示计数；布局形状不合法直接报错，不让 shown() 悄悄吞掉坏元素 */
    private static function layoutShown(array $s): array {
        $layout = $s['layout'] ?? null;
        if(!is_array($layout)) { return ['error'=>'layout']; }
        $slots = $layout['fish'] ?? null;
        if(!is_array($slots) || !array_is_list($slots)) { return ['error'=>'layout-fish']; }
        foreach($slots as $x) {
            if($x !== null && !is_string($x)) { return ['error'=>'layout-slot']; }
        }
        $out = [];
        foreach($slots as $x) { if(is_string($x) && $x !== '') { $out[$x] = ($out[$x] ?? 0) + 1; } }
        return ['shown'=>$out];
    }

    private static function fishKnown(string $fid, array $c): bool {
        foreach(($c['waters'] ?? []) as $w) {
            if(isset($w['fish'][$fid])) { return true; }
        }
        return false;
    }

    /** 配置与哈希必须与所选配置一致 */
    private static function configOk(array $s, array $c): string {
        if((string)($s['config_version'] ?? '') !== (string)($c['version'] ?? '')) { return 'config-version'; }
        foreach(['pool_hash','config_hash'] as $k) {
            if(!is_string($s[$k] ?? null) || !is_string($c[$k] ?? null) || !hash_equals($c[$k], $s[$k])) { return $k; }
        }
        return '';
    }

    /**
     * @param array $s 存档
     * @param array $c 当前配置
     * @param array|null $header 数据库行头：uid / save_version / config_version / updated_ms
     * @return array{kind:string,why:string}
     */
    public static function classify(array $s, array $c, ?array $header = null): array {
        // 已有异常标记优先：保持隔离，不自动清标、不越过校验
        if(!empty($s['inventory_anomaly'])) { return ['kind'=>'anomaly','why'=>'flagged']; }

        if($header !== null) {
            if((string)($s['uid'] ?? '') !== (string)($header['uid'] ?? '')) { return ['kind'=>'anomaly','why'=>'uid-mismatch']; }
            if((int)($s['save_version'] ?? 0) !== 1 || (int)($header['save_version'] ?? 1) !== 1) { return ['kind'=>'anomaly','why'=>'save-version']; }
            if((string)($s['config_version'] ?? '') !== (string)($header['config_version'] ?? '')) { return ['kind'=>'anomaly','why'=>'config-row-mismatch']; }
            if((int)($s['last_settled_ms'] ?? -1) !== (int)($header['updated_ms'] ?? -2)) { return ['kind'=>'anomaly','why'=>'anchor']; }
        }
        $bad = self::configOk($s, $c);
        if($bad !== '') { return ['kind'=>'anomaly','why'=>$bad]; }

        // schema：只有「键不存在」才算未标记；显式 null / 0 / 非 1 一律异常
        $hasSchema = array_key_exists('inventory_schema', $s);
        $schema = $hasSchema ? $s['inventory_schema'] : null;
        if($hasSchema && (!is_int($schema) || $schema !== self::SCHEMA)) { return ['kind'=>'anomaly','why'=>'schema-unknown']; }

        $fish = $s['fish'] ?? null;
        if(!is_array($fish) || !$fish) { return ['kind'=>'anomaly','why'=>'no-fish']; }   // 空 fish 不允许

        $kinds = ['old'=>0,'new'=>0];
        foreach($fish as $fid=>$f) {
            if(!is_string($fid) || !self::fishKnown($fid, $c)) { return ['kind'=>'anomaly','why'=>'unknown-fish:'.$fid]; }
            if(!is_array($f)) { return ['kind'=>'anomaly','why'=>'fish-entry:'.$fid]; }
            if(!array_key_exists('discovered_at', $f) || !is_int($f['discovered_at']) || $f['discovered_at'] <= 0) {
                return ['kind'=>'anomaly','why'=>'discovered:'.$fid];
            }
            if($f['discovered_at'] > (int)($s['last_settled_ms'] ?? 0)) { return ['kind'=>'anomaly','why'=>'discovered-future:'.$fid]; }
            $k = self::fishKind($f);
            if($k === 'bad') { return ['kind'=>'anomaly','why'=>'stock:'.$fid]; }
            foreach($c['waters'] as $w) {
                if(isset($w['fish'][$fid]['lifetime_cap']) && $f['catch_count'] > $w['fish'][$fid]['lifetime_cap']) {
                    return ['kind'=>'anomaly','why'=>'lifetime-cap:'.$fid];
                }
            }
            $kinds[$k]++;
        }
        if($kinds['old'] > 0 && $kinds['new'] > 0) { return ['kind'=>'anomaly','why'=>'mixed']; }
        $mode = $kinds['new'] > 0 ? 'new' : 'legacy';

        // 布局形状 + 展示保护（旧档用 catch_count 推算持有量）
        $lay = !array_key_exists('layout', $s) && !isset($c['fish_capacities'])
            ? ['shown'=>[]] : self::layoutShown($s);
        if(isset($lay['error'])) { return ['kind'=>'anomaly','why'=>$lay['error']]; }
        foreach($lay['shown'] as $fid=>$n) {
            if(!isset($fish[$fid])) { return ['kind'=>'anomaly','why'=>'shown-missing:'.$fid]; }
            $owned = $mode === 'legacy' ? (int)$fish[$fid]['catch_count'] : (int)$fish[$fid]['owned_count'];
            if($n > $owned) { return ['kind'=>'anomaly','why'=>'overdisplay:'.$fid]; }
        }

        if($mode === 'legacy') {
            if($hasSchema) { return ['kind'=>'anomaly','why'=>'marker-without-fields']; }
            return ['kind'=>'legacy','why'=>''];
        }
        if(!$hasSchema) { return ['kind'=>'needs-marker','why'=>'marker-missing']; }
        return ['kind'=>'new','why'=>''];
    }

    /** 纯旧档 → 新档：只补库存字段与标记 */
    public static function migrate(array $s): array {
        foreach(($s['fish'] ?? []) as $fid=>$f) {
            if(!is_array($f)) { continue; }
            if(!array_key_exists('owned_count', $f)) { $s['fish'][$fid]['owned_count'] = (int)($f['catch_count'] ?? 0); }
            if(!array_key_exists('sold_count', $f)) { $s['fish'][$fid]['sold_count'] = 0; }
        }
        $s['inventory_schema'] = self::SCHEMA;
        return $s;
    }

    /** 只补标记（needs-marker）：绝不重置 sold */
    public static function markOnly(array $s): array {
        $s['inventory_schema'] = self::SCHEMA;
        return $s;
    }
}
