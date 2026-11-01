<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。
 *  建档人数缓存：只存聚合数字，不含任何个人数据。
 *
 *  缓存文件：games/aquarium/data/stats/participants.json
 *  { schema, count, updated_at }
 *
 *  刷新由定时任务调用 refresh()，页面只 read()，不在请求里 COUNT。
 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }

final class gamecenter_aquarium_stats {
    const SCHEMA = 1;
    const STALE_HIDE_SECONDS = 86400;   // 超过 24 小时不展示

    private static function file(): string {
        return __DIR__.'/../games/aquarium/data/stats/participants.json';
    }

    /** 读缓存。缺失/格式非法/数字不合法 → null（调用方隐藏文案，绝不显示 0）。 */
    public static function read(): ?array {
        $f = self::file();
        if(!is_file($f) || !is_readable($f)) { return null; }
        $raw = @file_get_contents($f);
        if($raw === false) { return null; }
        $j = json_decode($raw, true);
        if(!is_array($j) || (int)($j['schema'] ?? 0) !== self::SCHEMA) { return null; }
        $count = $j['count'] ?? null;
        $at = $j['updated_at'] ?? null;
        if(!is_int($count) || $count < 0 || !is_int($at) || $at <= 0) { return null; }
        return ['count'=>$count, 'updated_at'=>$at];
    }

    /** 给前端的展示数据：过期或缺失返回 null。 */
    public static function display(): ?array {
        $c = self::read();
        if($c === null) { return null; }
        if(time() - $c['updated_at'] > self::STALE_HIDE_SECONDS) { return null; }
        return $c;
    }

    /** 统计并原子替换缓存。返回 ['count'=>N,'updated_at'=>T] 或 null。 */
    public static function refresh(): ?array {
        if(!class_exists('DB')) { return null; }
        $total = (int)DB::result_first('SELECT COUNT(*) FROM %t', ['gamecenter_aquarium_save']);
        if($total < 0) { return null; }
        $dir = dirname(self::file());
        if(!is_dir($dir)) { @mkdir($dir, 0775, true); }
        // 非阻塞排他锁：拿不到就跳过本轮，避免任务重叠
        $lock = $dir.'/refresh.lock';
        $fh = @fopen($lock, 'c');
        if($fh === false) { return null; }
        if(!flock($fh, LOCK_EX | LOCK_NB)) { fclose($fh); return null; }
        try {
            $payload = ['schema'=>self::SCHEMA, 'count'=>$total, 'updated_at'=>time()];
            $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
            if($json === false) { return null; }
            $tmp = $dir.'/participants.json.tmp';
            if(@file_put_contents($tmp, $json) === false) { return null; }
            // 原子替换；失败保留上一份有效结果
            if(!@rename($tmp, self::file())) { @unlink($tmp); return null; }
            return $payload;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
