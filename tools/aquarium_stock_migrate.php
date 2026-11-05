<?php
/**
 * 水族馆「库存迁移 / 存量统计」CLI（作者：小蓝 / DSH；原插件 (C) 2026 Carinoasd）
 *
 * 只跑命令行，必须显式给库；不默认连接任何库，也不通过 HTTP 暴露。
 *
 *   php tools/aquarium_stock_migrate.php --mode=stats --dz-root=E:/dzx5-env/www \
 *       --dsn="mysql:host=127.0.0.1;port=3306;dbname=discuz;charset=utf8mb4" \
 *       --user=root --password=*** --tablepre=pre_
 *
 * 模式：
 *   stats     只读：分类统计 + 各品级可售量/潜在总额
 *   dry-run   只读：逐行判定会做什么
 *   apply     逐行事务迁移（--yes 才真写；仅在维护窗口内用）
 *   verify    全表核对：模式、标记、守恒、展示≤持有、行头一致
 *
 * 分类规则与运行时共用 lib/aquarium_stock.php，避免两套口径。
 * 纯库存迁移：不调用 settle()、不动金币/捕获/时间锚点/布局；updated_ms 保持原值，只 version+1。
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
$mode = $opt('mode', 'stats');
$batch = max(1, (int)$opt('batch', '200'));
$yes = $opt('yes', '') === '1';
$outFile = $opt('out', '');

if($dz === '' || $dsn === '') { fwrite(STDERR, "需要 --dz-root 与 --dsn；不默认连接任何库。\n"); exit(2); }
if(!is_file($dz.'/source/class/db/db_driver_mysqli.php')) { fwrite(STDERR, "dz-root 不像 X5 根目录：$dz\n"); exit(2); }

function getglobal($key) {
    if($key === 'db_driver') { return getenv('GC_TEST_DRIVER') ?: 'pdo'; }
    if($key === 'config/security/querysafe') {
        return ['status'=>1, 'dfunction'=>['load_file','hex','substring','if','ord','char'],
            'daction'=>['@','intooutfile','intodumpfile','unionselect','(select','unionall','uniondistinct'],
            'dnote'=>['/*','*/','#','--','"'], 'dlikehex'=>1, 'afullnote'=>0];
    }
    return null;
}
function dintval($v) { return is_array($v) ? array_map('intval', $v) : (int)$v; }
function DISCUZ_PLUGIN($id) { return dirname(__DIR__).'/source/plugin/'.$id; }
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

require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_configs.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_stock.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_store.php';

$store = new gamecenter_aquarium_store();

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$meta = gamecenter_aquarium_content::catalog();
$rarityOf = []; $priceOf = ['常见'=>1,'少见'=>2,'稀有'=>5,'珍奇'=>10];
foreach($meta['fish'] as $it) { $rarityOf[$it['id']] = (string)($it['rarity'] ?? ''); }

$say = static function(array $x) use ($outFile) {
    $line = json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    echo $line, "\n";
    if($outFile !== '') { @file_put_contents($outFile, $line."\n", FILE_APPEND); }
};

$table = 'gamecenter_aquarium_save';
$counts = ['total'=>0,'legacy'=>0,'new'=>0,'anomaly'=>0,'written'=>0,'failed'=>0];
$agg = ['potential'=>0,'byRarity'=>[], 'accounts'=>[]];
$anomalies = [];

function rowHeader(array $row): array {
    return ['uid'=>$row['uid'], 'save_version'=>$row['save_version'] ?? 1,
        'config_version'=>$row['config_version'] ?? '', 'updated_ms'=>$row['updated_ms'] ?? 0];
}

function inventoryAgg(array $s): array {
    global $rarityOf, $priceOf;
    $shown = [];
    foreach((($s['layout'] ?? [])['fish'] ?? []) as $x) { if(is_string($x) && $x !== '') { $shown[$x] = ($shown[$x] ?? 0) + 1; } }
    $byRarity = []; $total = 0;
    foreach(($s['fish'] ?? []) as $fid=>$f) {
        if(!is_array($f)) { continue; }
        $owned = (int)($f['owned_count'] ?? $f['catch_count'] ?? 0);
        $sellable = max(0, $owned - max(4, $shown[$fid] ?? 0));
        $rar = $rarityOf[$fid] ?? '';
        $price = $priceOf[$rar] ?? 0;
        $pot = $sellable * $price;
        $k = $rar === '' ? 'unknown' : $rar;
        if(!isset($byRarity[$k])) { $byRarity[$k] = ['owned'=>0,'sellable'=>0,'potential'=>0,'species'=>0]; }
        $byRarity[$k]['owned'] += $owned;
        $byRarity[$k]['sellable'] += $sellable;
        $byRarity[$k]['potential'] += $pot;
        $byRarity[$k]['species']++;
        $total += $pot;
    }
    return ['byRarity'=>$byRarity, 'potential'=>$total];
}

/* ---------------- verify：独立全扫，计数真实递增 ---------------- */
if($mode === 'verify') {
    $v = ['mode'=>'verify','accounts'=>0,'ok'=>0,'legacy'=>0,'anomaly'=>0,'missing_marker'=>0,
        'bad_sum'=>0,'over_display'=>0,'bad_json'=>0,'bad_header'=>0,'flagged'=>0,'details'=>[]];
    $last = 0;
    do {
        $rows = $store->rows('SELECT uid, save_version, config_version, version, updated_ms, state_json FROM %t WHERE uid>%d ORDER BY uid LIMIT %d', [$table, $last, $batch]);
        foreach($rows as $row) {
            $v['accounts']++; $last = (int)$row['uid'];
            $sx = json_decode((string)$row['state_json'], true);
            if(!is_array($sx)) { $v['bad_json']++; $v['details'][] = ['uid'=>$last,'why'=>'json']; continue; }
            $cls = gamecenter_aquarium_stock::classify($sx, $c, rowHeader($row));
            if($cls['kind'] === 'legacy') { $v['legacy']++; $v['details'][] = ['uid'=>$last,'why'=>'legacy-unmigrated']; continue; }
            if($cls['kind'] === 'anomaly') {
                $v['anomaly']++;
                $why = $cls['why'];
                if(strpos($why,'overdisplay') === 0) { $v['over_display']++; }
                elseif($why === 'flagged') { $v['flagged']++; }
                elseif(strpos($why,'stock') === 0) { $v['bad_sum']++; }
                elseif(in_array($why, ['uid-mismatch','save-version','config-version','anchor'], true)) { $v['bad_header']++; }
                $v['details'][] = ['uid'=>$last,'why'=>$why];
                continue;
            }
            if($cls['kind'] === 'needs-marker') { $v['missing_marker']++; $v['details'][] = ['uid'=>$last,'why'=>'marker-missing']; continue; }
            $v['ok']++;
        }
    } while(count($rows) === $batch);
    $say($v);
    exit(($v['ok'] === $v['accounts']) ? 0 : 1);
}

/* ---------------- 主循环 ---------------- */
$lastUid = 0;
do {
    $rows = $store->rows('SELECT uid, save_version, config_version, version, updated_ms, state_json FROM %t WHERE uid>%d ORDER BY uid LIMIT %d', [$table, $lastUid, $batch]);
    foreach($rows as $row) {
        $counts['total']++; $lastUid = (int)$row['uid'];
        $s = json_decode((string)$row['state_json'], true);
        if(!is_array($s)) { $counts['anomaly']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'json']; continue; }
        $cls = gamecenter_aquarium_stock::classify($s, $c, rowHeader($row));
        $counts[$cls['kind'] === 'new' ? 'new' : $cls['kind']]++;

        if($cls['kind'] === 'anomaly') { $anomalies[] = ['uid'=>$lastUid,'why'=>$cls['why']]; continue; }

        if($mode === 'stats' || $mode === 'dry-run') {
            $a = inventoryAgg($s);
            $agg['potential'] += $a['potential'];
            foreach($a['byRarity'] as $k=>$vv) {
                if(!isset($agg['byRarity'][$k])) { $agg['byRarity'][$k] = ['owned'=>0,'sellable'=>0,'potential'=>0]; }
                foreach($vv as $kk=>$vvv) { if($kk !== 'species') { $agg['byRarity'][$k][$kk] += $vvv; } }
            }
            $agg['accounts'][] = $a['potential'];
            continue;
        }

        if($mode !== 'apply') { continue; }
        if($cls['kind'] === 'new') { continue; }
        // needs-marker：只补标记，绝不重置 sold
        if(!$yes) { continue; }

        $ok = true;
        try { $ok = (bool)DB::begin_transaction(); } catch(Throwable $e) { $ok = false; }
        if(!$ok) { $counts['failed']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'tx-begin']; continue; }
        try {
            $locked = $store->first('SELECT uid, save_version, config_version, version, updated_ms, state_json FROM %t WHERE uid=%d FOR UPDATE', [$table, $lastUid]);
            if(!$locked) { DB::rollback(); $counts['failed']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'lock-missing']; continue; }
            $cur = json_decode((string)$locked['state_json'], true);
            if(!is_array($cur)) { DB::rollback(); $counts['failed']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'lock-json']; continue; }
            $rowVersion = (int)($locked['version'] ?? 0);
            if($rowVersion < 1 || $rowVersion >= 999999999) { DB::rollback(); $counts['failed']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'row-version']; continue; }
            $re = gamecenter_aquarium_stock::classify($cur, $c, rowHeader($locked));
            if($re['kind'] === 'anomaly') { DB::rollback(); $counts['anomaly']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'lock-'.$re['why']]; continue; }
            if($re['kind'] === 'new') { DB::rollback(); continue; }

            $next = ($re['kind'] === 'needs-marker') ? gamecenter_aquarium_stock::markOnly($cur) : gamecenter_aquarium_stock::migrate($cur);
            $json = json_encode($next, JSON_UNESCAPED_UNICODE);
            if($json === false) { DB::rollback(); $counts['failed']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'encode']; continue; }
            $upd = DB::update($table, ['state_json'=>$json, 'version'=>(int)$locked['version']+1], ['uid'=>$lastUid]);
            if($upd === false) { DB::rollback(); $counts['failed']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'update']; continue; }
            $cmt = DB::commit();
            if($cmt === false) {
                // 提交结果不明：立即停下，不继续处理下一个账号，也不猜成未提交
                $counts['failed']++;
                $anomalies[] = ['uid'=>$lastUid,'why'=>'commit-unknown','action'=>'stop'];
                $say(['mode'=>'apply','stopped'=>true,'uid'=>$lastUid,'why'=>'commit-unknown',
                    'written'=>$counts['written'],'failed'=>$counts['failed']]);
                exit(3);
            }
            $counts['written']++;
        } catch(Throwable $e) {
            try { DB::rollback(); } catch(Throwable $e2) {}
            $counts['failed']++;
            $anomalies[] = ['uid'=>$lastUid,'why'=>'tx:'.$e->getMessage()];
        }
    }
} while(count($rows) === $batch);

if($mode === 'stats' || $mode === 'dry-run') {
    $acc = $agg['accounts']; sort($acc);
    $pct = static function(array $a, float $q) { if(!$a) { return 0; } return $a[(int)floor((count($a)-1)*$q)]; };
    $say(['mode'=>$mode,'accounts'=>$counts['total'],'legacy'=>$counts['legacy'],'needs_marker'=>$counts['needs_marker'] ?? 0,
        'new'=>$counts['new'],'anomaly'=>$counts['anomaly'],
        'potential_total'=>$agg['potential'],'by_rarity'=>$agg['byRarity'],
        'per_account_potential'=>['median'=>$pct($acc,0.5),'p90'=>$pct($acc,0.9),'p95'=>$pct($acc,0.95),'p99'=>$pct($acc,0.99),'max'=>$acc ? end($acc) : 0],
        'anomalies'=>$anomalies]);
    if($mode === 'dry-run' && $counts['anomaly'] > 0) { exit(1); }
} else {
    $say(['mode'=>$mode,'accounts'=>$counts['total'],'legacy'=>$counts['legacy'],'new'=>$counts['new'],
        'anomaly'=>$counts['anomaly'],'written'=>$counts['written'],'failed'=>$counts['failed'],
        'dry_run'=>!$yes,'anomalies'=>$anomalies]);
    // apply：异常未处理也算失败，不能 exit 0
    exit(($counts['failed'] || $counts['anomaly']) ? 1 : 0);
}
