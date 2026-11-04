<?php
/**
 * 鱼池版本切换 CLI（作者：小蓝 / DSH）
 *
 *  php tools/aquarium_pool_switch.php --dz-root=E:/dzx5-env/www --dsn="..." --user=... --password=... \
 *      --tablepre=pre_ --from=aquarium-content-candidate-v1 --to=aquarium-content-v2-candidate-v1 [--apply] [--uid=N]
 *
 * 不加 --apply 就是 dry-run。逐行事务，失败即停并返回非 0。
 * 与「库存补字段迁移」是两件事：这里会按源配置结算一次，切换只改配置标识。
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

$dz = $opt('dz-root'); $dsn = $opt('dsn'); $user = $opt('user'); $pass = $opt('password');
$tablepre = $opt('tablepre', 'pre_'); $apply = $opt('apply', '') === '1';
$from = $opt('from', 'aquarium-content-candidate-v1');
$to = $opt('to', 'aquarium-content-v2-candidate-v1');
// apply 必须沿用 dry-run 打印的固定毫秒 N；在连接数据库前拒绝坏参数。
$cutoffArg = $opt('cutoff', '');
$now = (int)floor(microtime(true) * 1000);
if(($apply && $cutoffArg === '') || ($cutoffArg !== '' &&
    (!preg_match('/\A[1-9][0-9]{0,12}\z/D', $cutoffArg) || (int)$cutoffArg > $now))) {
    fwrite(STDERR, "需要 --cutoff=固定正整数毫秒，且不得晚于当前服务器时间\n"); exit(2);
}
$onlyUid = (int)$opt('uid', '0');
$pluginDir = $opt('plugin-dir', rtrim($dz, '/' . DIRECTORY_SEPARATOR).'/source/plugin/gamecenter');
if(!is_dir($pluginDir.'/lib')) { fwrite(STDERR, "plugin-dir 不像游戏中心插件目录：$pluginDir" . PHP_EOL); exit(2); }

if($dz === '' || $dsn === '') { fwrite(STDERR, "需要 --dz-root 与 --dsn\n"); exit(2); }
$allowedEdges = [['aquarium-content-candidate-v1', 'aquarium-content-v2-candidate-v1']];
$okEdge = false;
foreach($allowedEdges as $e) { if($from === $e[0] && $to === $e[1]) { $okEdge = true; } }
if(!$okEdge) { fwrite(STDERR, '本批只允许 v1 -> v2' . PHP_EOL); exit(2); }

function getglobal($key) {
    if($key === 'db_driver') { return getenv('GC_TEST_DRIVER') ?: 'pdo'; }
    if($key === 'config/security/querysafe') { return ['status'=>1,'dfunction'=>[],'daction'=>[],'dnote'=>[],'dlikehex'=>1,'afullnote'=>0]; }
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

preg_match('/host=([^;]+)/', $dsn, $h); preg_match('/port=([0-9]+)/', $dsn, $p); preg_match('/dbname=([^;]+)/', $dsn, $d);
DB::init('db_driver_'.getglobal('db_driver'), [1=>['dsn'=>$dsn,'dbhost'=>$h[1] ?? '127.0.0.1','dbport'=>(int)($p[1] ?? 3306),
    'dbname'=>$d[1] ?? '','dbcharset'=>'utf8mb4','compress'=>0,'dbuser'=>$user,'dbpw'=>$pass,'pconnect'=>0,'tablepre'=>$tablepre]]);

require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_configs.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_store.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_migrate.php';

$store = new gamecenter_aquarium_store();
$mig = new gamecenter_aquarium_migrate($store,
    gamecenter_aquarium_configs::for_version($from),
    gamecenter_aquarium_configs::for_version($to));

$explicitCutoff = $cutoffArg === '' ? null : (int)$cutoffArg;
$cutoff = $mig->cutoff($now, $explicitCutoff);
echo json_encode(['mode'=>$apply ? 'apply' : 'dry-run','from'=>$from,'to'=>$to,'cutoff'=>$cutoff,
    'cutoff_pinned'=>$explicitCutoff !== null,
    'same_ids'=>$mig->sameIds(),'distribution'=>$mig->distribution(),'total'=>$mig->total()], JSON_UNESCAPED_UNICODE), "\n";

$sql = $onlyUid > 0
    ? 'SELECT uid FROM %t WHERE uid=%d ORDER BY uid'
    : 'SELECT uid FROM %t ORDER BY uid';
$rows = $onlyUid > 0 ? $store->rows($sql, ['gamecenter_aquarium_save', $onlyUid]) : $store->rows($sql, ['gamecenter_aquarium_save']);

$count = ['migrated'=>0,'skipped'=>0,'failed'=>0];
$fails = [];
foreach($rows as $r) {
    $uid = (int)$r['uid'];
    try {
        $out = $mig->migrateOne($uid, $cutoff, $apply);
    } catch(Throwable $e) {
        $out = ['status'=>'failed','reason'=>'exception:'.$e->getMessage()];
    }
    $st = $out['status'] ?? 'failed';
    $count[$st] = ($count[$st] ?? 0) + 1;
    if($st === 'failed') {
        $fails[] = ['uid'=>$uid,'reason'=>$out['reason'] ?? ''];
        if($apply) {
            // 失败即停：不再处理下一号，留待人工核对
            echo json_encode(['stopped'=>true,'uid'=>$uid,'reason'=>$out['reason'] ?? ''] + $count, JSON_UNESCAPED_UNICODE), "\n";
            exit(3);
        }
    }
}
echo json_encode($count + ['fails'=>$fails], JSON_UNESCAPED_UNICODE), "\n";
exit(($count['failed'] ?? 0) > 0 ? 1 : 0);
