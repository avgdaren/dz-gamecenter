<?php
/**
 * 水族馆建档人数缓存刷新（作者：小蓝 / DSH）
 *
 * 用法（交给计划任务，每 10 分钟一次）：
 *   php tools/aquarium_participants_refresh.php --dz-root=E:/dzx5-env/www \
 *       --plugin-dir=E:/dzx5-env/www/source/plugin/gamecenter \
 *       --dsn="mysql:host=127.0.0.1;port=3306;dbname=discuz;charset=utf8mb4" \
 *       --user=root --password=*** --tablepre=pre_
 *
 * 要点：
 *   - 缓存必须写到**网站实际部署的插件目录**，不是仓库工作副本。用 --plugin-dir 显式指定；
 *     不给就用 <dz-root>/source/plugin/gamecenter。仓库与部署分离时不会写错位置。
 *   - 只做一次 COUNT(*)，不读 state_json、不加锁表、不改任何存档。
 *   - 与 tools/aquarium_stock_migrate.php 是两类任务：这个更轻，不需要维护窗口。
 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', 'stderr');
define('IN_DISCUZ', true);
define('TIMESTAMP', time());

$args = [];
foreach(array_slice($argv, 1) as $a) {
    if(preg_match('/^--([a-z0-9-]+)(?:=(.*))?$/i', $a, $m)) { $args[$m[1]] = $m[2] ?? '1'; }
}
$opt = static function(string $k, string $def = '') use ($args): string { return isset($args[$k]) ? (string)$args[$k] : $def; };

$dz = $opt('dz-root', getenv('GC_DZ_ROOT') ?: '');
$dsn = $opt('dsn', getenv('GC_TEST_DSN') ?: '');
$user = $opt('user', getenv('GC_TEST_USER') ?: '');
$pass = $opt('password', getenv('GC_TEST_PASSWORD') ?: '');
$tablepre = $opt('tablepre', 'pre_');

if($dz === '' || $dsn === '') { fwrite(STDERR, "需要 --dz-root 与 --dsn\n"); exit(2); }

// 插件目录：显式参数优先，否则取 dz-root 下的实际部署位置
$pluginDir = $opt('plugin-dir', rtrim($dz, '/\\').'/source/plugin/gamecenter');
if(!is_dir($pluginDir.'/lib')) {
    fwrite(STDERR, "plugin-dir 不像游戏中心插件目录：$pluginDir\n");
    exit(2);
}
$statsDir = $pluginDir.'/games/aquarium/data/stats';
if(!is_dir($statsDir)) { @mkdir($statsDir, 0775, true); }
if(!is_dir($statsDir) || !is_writable($statsDir)) {
    fwrite(STDERR, "缓存目录不可写：$statsDir\n");
    exit(2);
}

function getglobal($key) {
    if($key === 'db_driver') { return getenv('GC_TEST_DRIVER') ?: 'pdo'; }
    if($key === 'config/security/querysafe') {
        return ['status'=>1, 'dfunction'=>[], 'daction'=>[], 'dnote'=>[], 'dlikehex'=>1, 'afullnote'=>0];
    }
    return null;
}
function dintval($v) { return is_array($v) ? array_map('intval', $v) : (int)$v; }
function DISCUZ_PLUGIN($id) { global $pluginDir; return $pluginDir; }
function getgpc($k, $t = '') { return ''; }
function formhash() { return 'cli'; }

require $dz.'/source/class/db/db_driver_mysqli.php';
require $dz.'/source/class/db/db_driver_pdo.php';
require $dz.'/source/class/discuz/discuz_database.php';
class_alias('discuz_database', 'DB');

preg_match('/host=([^;]+)/', $dsn, $h);
preg_match('/port=([0-9]+)/', $dsn, $p);
preg_match('/dbname=([^;]+)/', $dsn, $d);
DB::init('db_driver_'.getglobal('db_driver'), [1=>['dsn'=>$dsn, 'dbhost'=>$h[1] ?? '127.0.0.1', 'dbport'=>(int)($p[1] ?? 3306),
    'dbname'=>$d[1] ?? '', 'dbcharset'=>'utf8mb4', 'compress'=>0, 'dbuser'=>$user, 'dbpw'=>$pass, 'pconnect'=>0, 'tablepre'=>$tablepre]]);

// 让缓存目录固定到实际部署位置
putenv('GC_STATS_DIR='.$statsDir);
require $pluginDir.'/lib/aquarium_stats.php';

$t0 = microtime(true);
$r = gamecenter_aquarium_stats::refresh();
$ms = (int)round((microtime(true) - $t0) * 1000);
if($r === null) {
    echo json_encode(['ok'=>0,'msg'=>'本轮跳过或失败（锁忙/查询失败/写盘失败），保留上一份缓存','ms'=>$ms,'dir'=>$statsDir], JSON_UNESCAPED_UNICODE), "\n";
    exit(1);
}
echo json_encode(['ok'=>1,'count'=>$r['count'],'updated_at'=>$r['updated_at'],'ms'=>$ms,'file'=>gamecenter_aquarium_stats::file()], JSON_UNESCAPED_UNICODE), "\n";
