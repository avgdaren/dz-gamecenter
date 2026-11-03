<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。
 *  建档人数缓存：只存聚合数字，不含任何个人数据。
 *
 *  缓存文件：<插件目录>/games/aquarium/data/stats/participants.json
 *  { schema:1, count:int, updated_at:int(unix) }
 *
 *  刷新由定时任务调用 refresh()（tools/aquarium_participants_refresh.php）；页面用 current()。
 *  Carinoasd 补：没有配置计划任务时（那支 CLI 不在插件目录里、要带数据库参数，部署时容易漏），
 *  current() 在缓存缺失或超过 REFRESH_AFTER_SECONDS 时才在请求里刷新一次；锁忙或目录不可写就沿用旧值，0 次查询。
 *  并发：**先拿非阻塞排他锁，再 COUNT**；锁忙时 0 次查询，旧文件原样保留。
 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }

final class gamecenter_aquarium_stats {
    const SCHEMA = 1;
    const STALE_HIDE_SECONDS = 86400;   // 超过 24 小时不展示
    const FUTURE_TOLERANCE = 300;       // 允许 5 分钟时钟偏差
    const REFRESH_AFTER_SECONDS = 600;  // 页面兜底刷新的间隔（与计划任务同为 10 分钟）

    /** 缓存目录（相对插件根；可用 GC_STATS_DIR 覆盖，便于仓库/部署目录分离时校验） */
    public static function dir(): string {
        $override = getenv('GC_STATS_DIR');
        if(is_string($override) && $override !== '') { return rtrim($override, '/\\'); }
        return dirname(__DIR__).'/games/aquarium/data/stats';
    }
    public static function file(): string { return self::dir().'/participants.json'; }

    /** 严格解析：schema 必须是整数 1；count 必须是非负整数；时间不能是未来 */
    private static function parse(string $raw): ?array {
        $j = json_decode($raw, true);
        if(!is_array($j)) { return null; }
        if(!array_key_exists('schema', $j) || !is_int($j['schema']) || $j['schema'] !== self::SCHEMA) { return null; }
        if(!array_key_exists('count', $j) || !is_int($j['count']) || $j['count'] < 0) { return null; }
        if(!array_key_exists('updated_at', $j) || !is_int($j['updated_at']) || $j['updated_at'] <= 0) { return null; }
        if($j['updated_at'] > time() + self::FUTURE_TOLERANCE) { return null; }   // 未来时间视为非法
        return ['count'=>$j['count'], 'updated_at'=>$j['updated_at']];
    }

    /** 读缓存。缺失/格式非法/未来时间 → null（调用方隐藏文案，绝不显示 0）。 */
    public static function read(): ?array {
        $f = self::file();
        if(!is_file($f) || !is_readable($f)) { return null; }
        $raw = @file_get_contents($f);
        if($raw === false) { return null; }
        return self::parse($raw);
    }

    /** 给前端的展示数据：过期或缺失返回 null。 */
    public static function display(): ?array {
        $c = self::read();
        if($c === null) { return null; }
        if(time() - $c['updated_at'] > self::STALE_HIDE_SECONDS) { return null; }
        return $c;
    }

    /** 页面用：缓存新鲜就直接用；缺失或超过 10 分钟才刷新一次（拿不到锁、写不进去就退回 display()）。 */
    public static function current(): ?array {
        $c = self::display();
        if($c !== null && time() - $c['updated_at'] <= self::REFRESH_AFTER_SECONDS) { return $c; }
        $fresh = self::refresh();
        return $fresh !== null ? ['count'=>$fresh['count'], 'updated_at'=>$fresh['updated_at']] : $c;
    }

    /**
     * 统计并原子替换缓存。返回 ['count'=>N,'updated_at'=>T] 或 null。
     * 顺序：建目录 → 拿非阻塞锁 → COUNT → 校验 → 写临时文件 → 原子替换。
     */
    public static function refresh(): ?array {
        $dir = self::dir();
        if(!is_dir($dir)) { @mkdir($dir, 0775, true); }
        if(!is_dir($dir) || !is_writable($dir)) { return null; }

        $lock = $dir.'/refresh.lock';
        $fh = @fopen($lock, 'c');
        if($fh === false) { return null; }
        // 锁忙：直接返回，本轮 0 次查询
        if(!flock($fh, LOCK_EX | LOCK_NB)) { fclose($fh); return null; }

        try {
            if(!class_exists('DB')) { return null; }
            $raw = DB::result_first('SELECT COUNT(*) FROM %t', ['gamecenter_aquarium_save']);
            // 不先强转：拒绝 false/null/空/非数字/越界，避免把失败发布成 0
            if($raw === false || $raw === null || $raw === '') { return null; }
            if(is_int($raw)) { $total = $raw; }
            elseif(is_string($raw) && preg_match('/\A[0-9]{1,12}\z/D', $raw)) { $total = (int)$raw; }
            else { return null; }
            if($total < 0 || $total > 999999999999) { return null; }

            $payload = ['schema'=>self::SCHEMA, 'count'=>$total, 'updated_at'=>time()];
            $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
            if($json === false) { return null; }

            $tmp = $dir.'/participants.json.tmp';
            $written = @file_put_contents($tmp, $json);
            if($written === false || $written !== strlen($json)) { @unlink($tmp); return null; }   // 短写不发布
            if(!@rename($tmp, self::file())) { @unlink($tmp); return null; }                       // 替换失败保留旧文件
            return $payload;
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}
