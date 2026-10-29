<?php
/**
 * 水族馆存档迁移 CLI（作者：小蓝 / DSH；原插件 (C) 2026 Carinoasd）
 *
 * 只跑命令行，不通过 HTTP 暴露。必须显式给出目标库（--dsn），不默认连接任何库。
 *
 *   php tools/aquarium_migrate.php --mode=dry-run --dz-root=E:/dzx5-env/www \
 *       --dsn="mysql:host=127.0.0.1;port=3306;dbname=discuz;charset=utf8mb4" \
 *       --user=root --password=*** --tablepre=pre_
 *
 * 模式：
 *   dry-run   只统计与分类，不写库（默认）
 *   apply     分批迁移，断点写入 job 文件；--yes 才真正写库
 *   verify    核对全表是否只剩目标版本且能通过校验
 *   backup    导出存档行到 JSON（--out=文件）
 *   restore   从备份 JSON 还原（--in=文件 --yes）
 *   maintenance  on|off 切换维护标记（--value=on）
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
$mode = $opt('mode', 'dry-run');
$jobFile = $opt('job', 'aquarium-migration-job.json');
$cutoffArg = $opt('cutoff', '');
$batch = (int)$opt('batch', '200');
$maxBatches = (int)$opt('max-batches', '0'); // >0 时只跑这么多批，用于中断/续跑演练
$yes = $opt('yes', '') === '1';

if($dz === '' || $dsn === '') {
    fwrite(STDERR, "需要 --dz-root 与原版 X5 根目录、--dsn 目标库；不默认连接任何库。\n");
    exit(2);
}
if(!is_file($dz.'/source/class/db/db_driver_mysqli.php')) { fwrite(STDERR, "dz-root 不像 X5 根目录：$dz\n"); exit(2); }

class DbException extends Exception { public function __construct($message = '', $code = 0, $sql = '') { parent::__construct($message, (int)$code); } }
function getglobal($key) {
    if($key === 'db_driver') { return getenv('GC_TEST_DRIVER') ?: 'pdo'; }
    if($key === 'config/security/querysafe') {
        return ['status'=>1, 'dfunction'=>['load_file','hex','substring','if','ord','char'],
            'daction'=>['@','intooutfile','intodumpfile','unionselect','(select','unionall','uniondistinct'],
            'dnote'=>['/*','*/','#','--','"'], 'dlikehex'=>1, 'afullnote'=>0];
    }
    return null;
}
function dintval($value) { return is_array($value) ? array_map('intval', $value) : (int)$value; }
function DISCUZ_PLUGIN($id) { return dirname(__DIR__).'/source/plugin/'.$id; }
function getgpc($key, $type = '') { return ''; }
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

require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_configs.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_store.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_migrate.php';

$store = new gamecenter_aquarium_store();
$mig = new gamecenter_aquarium_migrate($store);
$say = static function(array $x) { echo json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n"; };

if($mode === 'maintenance') {
    $on = $opt('value', 'on') === 'on';
    $file = gamecenter_aquarium_configs::maintenance_file();
    if($on) { if(!is_dir(dirname($file))) { mkdir(dirname($file), 0777, true); } touch($file); }
    elseif(is_file($file)) { unlink($file); }
    $say(['mode'=>'maintenance', 'on'=>$on, 'file'=>$file]);
    exit(0);
}

if($mode === 'backup') {
    $out = $opt('out', '');
    if($out === '') { fwrite(STDERR, "需要 --out=文件\n"); exit(2); }
    $rows = $mig->backup();
    file_put_contents($out, json_encode(['taken_ms'=>(int)(microtime(true)*1000), 'rows'=>$rows], JSON_UNESCAPED_UNICODE));
    $say(['mode'=>'backup', 'rows'=>count($rows), 'out'=>$out]);
    exit(0);
}

if($mode === 'restore') {
    $in = $opt('in', '');
    if($in === '' || !$yes) { fwrite(STDERR, "需要 --in=文件 且 --yes\n"); exit(2); }
    $data = json_decode((string)file_get_contents($in), true, 64, JSON_THROW_ON_ERROR);
    $n = $mig->restore($data['rows'] ?? []);
    $say(['mode'=>'restore', 'restored'=>$n, 'in'=>$in]);
    exit(0);
}

if($mode === 'verify') {
    $v = $mig->verify();
    $say(['mode'=>'verify', 'source_version'=>$mig->sourceVersion(), 'target_version'=>$mig->targetVersion()] + $v);
    exit(empty($v['other']) && empty($v['broken']) ? 0 : 1);
}

// dry-run / apply
$job = ['source'=>$mig->sourceVersion(), 'target'=>$mig->targetVersion(), 'cutoff_ms'=>0, 'cursor_uid'=>0,
    'stats'=>['migrated'=>0,'skipped'=>0,'failed'=>0], 'failures'=>[], 'started_ms'=>(int)(microtime(true)*1000)];
if(is_file($jobFile)) {
    $prev = json_decode((string)file_get_contents($jobFile), true, 32, JSON_THROW_ON_ERROR);
    if(($prev['source'] ?? '') !== $job['source'] || ($prev['target'] ?? '') !== $job['target']) {
        fwrite(STDERR, "job 文件的源/目标版本与本工具不一致，拒绝续跑。\n"); exit(3);
    }
    $job = $prev;
}
if($cutoffArg !== '') { $job['cutoff_ms'] = (int)$cutoffArg; }
if((int)$job['cutoff_ms'] <= 0) { $job['cutoff_ms'] = $mig->cutoff((int)floor(microtime(true)*1000)); }

$say(['mode'=>$mode, 'source_version'=>$job['source'], 'target_version'=>$job['target'], 'cutoff_ms'=>$job['cutoff_ms'],
    'total'=>$mig->total(), 'distribution'=>$mig->distribution(), 'cursor'=>$job['cursor_uid']]);

if($mode === 'dry-run') {
    $stats = $job['stats'];
    $cursor = $mig->runBatch((int)$job['cursor_uid'], $batch, (int)$job['cutoff_ms'], false, $stats);
    $say(['mode'=>'dry-run', 'would'=>$stats, 'next_cursor'=>$cursor]);
    exit(0);
}

if($mode !== 'apply') { fwrite(STDERR, "未知 mode：$mode\n"); exit(2); }
if(!$yes) { fwrite(STDERR, "apply 需要 --yes 确认（当前是 dry-run 语义，未写库）\n"); exit(2); }

$guard = 0;
while($guard++ < 10000) {
    $stats = $job['stats'];
    $cursor = $mig->runBatch((int)$job['cursor_uid'], $batch, (int)$job['cutoff_ms'], true, $stats);
    $job['stats'] = ['migrated'=>$stats['migrated'] ?? 0, 'skipped'=>$stats['skipped'] ?? 0, 'failed'=>$stats['failed'] ?? 0];
    $job['failures'] = array_slice($stats['failures'] ?? [], 0, 200);
    $advanced = $cursor !== (int)$job['cursor_uid'];
    $job['cursor_uid'] = $cursor;
    $job['updated_ms'] = (int)(microtime(true)*1000);
    file_put_contents($jobFile, json_encode($job, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $say(['mode'=>'apply', 'batch_to'=>$cursor, 'stats'=>$job['stats'], 'job'=>$jobFile]);
    if(!$advanced) { break; }
    if($maxBatches > 0 && $guard >= $maxBatches) { break; }
}

$v = $mig->verify();
$say(['mode'=>'apply-done', 'verify'=>$v]);
// 退出码只反映本次有没有失败行；全表是否收尾用 --mode=verify 单独判。
exit(($job['stats']['failed'] ?? 0) === 0 ? 0 : 1);
