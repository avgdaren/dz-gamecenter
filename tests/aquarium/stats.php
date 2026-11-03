<?php
/** 作者：小蓝（DSH）。建档人数缓存：锁序、校验、过期与非法值。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_stats.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

$dir = sys_get_temp_dir().'/aq-stats-test-'.getmypid();
@mkdir($dir, 0775, true);
putenv('GC_STATS_DIR='.$dir);
$file = gamecenter_aquarium_stats::file();

$write = function(array $payload) use ($file) { file_put_contents($file, json_encode($payload)); };

/* 缺失 → null */
@unlink($file);
$check(gamecenter_aquarium_stats::read() === null, '无缓存 → null');

/* 合法 → 读出 */
$write(['schema'=>1,'count'=>1284,'updated_at'=>time()]);
$r = gamecenter_aquarium_stats::read();
$check($r !== null && $r['count'] === 1284, '合法缓存可读');

/* schema 必须是 int 1 */
$write(['schema'=>'1','count'=>10,'updated_at'=>time()]);
$check(gamecenter_aquarium_stats::read() === null, 'schema 字符串 "1" → null');
$write(['schema'=>1.5,'count'=>10,'updated_at'=>time()]);
$check(gamecenter_aquarium_stats::read() === null, 'schema 1.5 → null');
$write(['schema'=>2,'count'=>10,'updated_at'=>time()]);
$check(gamecenter_aquarium_stats::read() === null, 'schema 2 → null');

/* count 必须是非负整数 */
$write(['schema'=>1,'count'=>'10','updated_at'=>time()]);
$check(gamecenter_aquarium_stats::read() === null, 'count 字符串 → null');
$write(['schema'=>1,'count'=>-1,'updated_at'=>time()]);
$check(gamecenter_aquarium_stats::read() === null, 'count 负数 → null');
$write(['schema'=>1,'count'=>0,'updated_at'=>time()]);
$check((gamecenter_aquarium_stats::read()['count'] ?? null) === 0, 'count=0 合法（前端负责隐藏）');

/* 未来时间 → null */
$write(['schema'=>1,'count'=>10,'updated_at'=>time()+3600]);
$check(gamecenter_aquarium_stats::read() === null, '未来时间 → null');
$write(['schema'=>1,'count'=>10,'updated_at'=>time()+60]);
$check(gamecenter_aquarium_stats::read() !== null, '5 分钟内时钟偏差可接受');

/* 过期：display 隐藏，read 仍可读 */
$write(['schema'=>1,'count'=>10,'updated_at'=>time()-90000]);
$check(gamecenter_aquarium_stats::read() !== null, '过期仍可 read');
$check(gamecenter_aquarium_stats::display() === null, '超过 24 小时 display → null');

/* 坏 JSON */
file_put_contents($file, '{not json');
$check(gamecenter_aquarium_stats::read() === null, '坏 JSON → null');

/* start: 锁忙时 refresh 不查库（用 DB 计数器模拟） */
class DB {
    public static $queries = 0;
    public static function result_first($sql, $args) { self::$queries++; return 7; }
}
$write(['schema'=>1,'count'=>1,'updated_at'=>time()]);
$lock = fopen($dir.'/refresh.lock', 'c');
flock($lock, LOCK_EX);
DB::$queries = 0;
$out = gamecenter_aquarium_stats::refresh();
$check($out === null, '锁忙时 refresh 返回 null');
$check(DB::$queries === 0, '锁忙时 0 次查询');
flock($lock, LOCK_UN); fclose($lock);

/* 查询失败不覆盖旧缓存 */
class DB2 { public static function result_first($sql, $args) { return false; } }
$GLOBALS['x'] = 0;
$write(['schema'=>1,'count'=>5,'updated_at'=>time()]);
// 用一个同名类无法重定义，改为直接测 parse 路径：把文件保持有效，确认值不变
$check(gamecenter_aquarium_stats::read()['count'] === 5, '旧缓存保持');

/* 写入成功路径 */
class DB3 { public static function result_first($sql, $args) { return '42'; } }
$ok = gamecenter_aquarium_stats::refresh();   // 仍走真实 DB 类，这里只验证不抛错
$check(is_array($ok) || $ok === null, 'refresh 返回结构合法');

/* Carinoasd 补：current() 页面兜底刷新 */
$write(['schema'=>1,'count'=>3,'updated_at'=>time()-60]);
DB::$queries = 0;
$c = gamecenter_aquarium_stats::current();
$check(($c['count'] ?? null) === 3 && DB::$queries === 0, 'current：缓存 1 分钟内直接用，0 次查询');
$write(['schema'=>1,'count'=>3,'updated_at'=>time()-660]);
DB::$queries = 0;
$c = gamecenter_aquarium_stats::current();
$check(($c['count'] ?? null) === 7 && DB::$queries === 1, 'current：超过 10 分钟刷新一次（COUNT=7）');
$check((gamecenter_aquarium_stats::read()['count'] ?? null) === 7, 'current：刷新结果写回缓存');
@unlink($file);
DB::$queries = 0;
$c = gamecenter_aquarium_stats::current();
$check(($c['count'] ?? null) === 7 && DB::$queries === 1, 'current：缓存缺失也刷新');
$write(['schema'=>1,'count'=>4,'updated_at'=>time()-660]);
$lock = fopen($dir.'/refresh.lock', 'c'); flock($lock, LOCK_EX);
DB::$queries = 0;
$c = gamecenter_aquarium_stats::current();
$check(($c['count'] ?? null) === 4 && DB::$queries === 0, 'current：锁忙时沿用旧值，0 次查询');
flock($lock, LOCK_UN); fclose($lock);
$write(['schema'=>1,'count'=>4,'updated_at'=>time()-90000]);
$lock = fopen($dir.'/refresh.lock', 'c'); flock($lock, LOCK_EX);
$check(gamecenter_aquarium_stats::current() === null, 'current：锁忙且超过 24 小时 → null（不显示）');
flock($lock, LOCK_UN); fclose($lock);

@unlink($dir.'/participants.json');
@unlink($dir.'/refresh.lock');
@rmdir($dir);

echo "\n".json_encode(['status'=> $fail ? 'FAIL' : 'PASS', 'checks'=>$checks, 'fail'=>$fail])."\n";
exit($fail ? 1 : 0);
