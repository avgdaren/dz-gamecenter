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
 *   stats     只读：分类统计 + 各品级可售量/潜在总额（不写库）
 *   dry-run   只读：逐行判定会做什么，输出聚合与异常清单
 *   apply     逐行事务迁移（--yes 才真写）
 *   verify    全表核对：标记齐全、守恒、展示≤持有
 *
 * 约定（对应部署方案 §1）：
 *   - 纯旧档（该行所有鱼都没库存字段、也没有 inventory_schema）→ owned=catch、sold=0、标记=1
 *   - 已迁移档（字段合法且守恒）→ 只在缺标记时补标记，绝不改 owned/sold
 *   - 混合 / 缺一字段 / 不守恒 / 展示超持有 → 记异常，原行不动
 *   - 纯库存迁移：不调用 settle()、不动金币/捕获/时间锚点/布局，updated_ms 保持原值
 *   - 每行一个事务，row.version +1；崩溃后重跑不会重复改
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

if($dz === '' || $dsn === '') {
    fwrite(STDERR, "需要 --dz-root 与 --dsn；不默认连接任何库。\n");
    exit(2);
}
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

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$meta = gamecenter_aquarium_content::catalog();
$rarityOf = []; $priceOf = ['常见'=>1,'少见'=>2,'稀有'=>5,'珍奇'=>10];
foreach($meta['fish'] as $it) { $rarityOf[$it['id']] = (string)($it['rarity'] ?? ''); }

$say = static function(array $x) use ($outFile) {
    $line = json_encode($x, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    echo $line, "\n";
    if($outFile !== '') { file_put_contents($outFile, $line."\n", FILE_APPEND); }
};

/** 判定一行的库存状态：legacy / migrated / anomaly */
function classify(array $s, array $c): array {
    $fish = $s['fish'] ?? null;
    if(!is_array($fish)) { return ['kind'=>'anomaly','why'=>'no-fish']; }
    $schema = (int)($s['inventory_schema'] ?? 0);
    $anyStock = false; $anyMissing = false; $bad = '';
    foreach($fish as $fid=>$f) {
        if(!is_array($f)) { $bad = 'fish-entry'; break; }
        $hasOwned = array_key_exists('owned_count', $f);
        $hasSold  = array_key_exists('sold_count', $f);
        if($hasOwned || $hasSold) { $anyStock = true; }
        if(!$hasOwned || !$hasSold) { $anyMissing = true; continue; }
        $owned = $f['owned_count']; $sold = $f['sold_count']; $catch = (int)($f['catch_count'] ?? 0);
        if(!is_int($owned) || !is_int($sold) || $owned < 0 || $sold < 0) { $bad = 'nonint:'.$fid; break; }
        if($owned + $sold !== $catch) { $bad = 'sum:'.$fid; break; }
    }
    if($bad !== '') { return ['kind'=>'anomaly','why'=>$bad]; }
    // 展示数不得超过持有量
    $shown = [];
    foreach(($s['layout']['fish'] ?? []) as $x) { if(is_string($x)) { $shown[$x] = ($shown[$x] ?? 0) + 1; } }
    foreach($shown as $fid=>$n) {
        $owned = isset($fish[$fid]) ? (int)($fish[$fid]['owned_count'] ?? 0) : 0;
        if($n > $owned) { return ['kind'=>'anomaly','why'=>'overdisplay:'.$fid]; }
    }
    if(!$anyStock) { return ['kind'=> $schema === 0 ? 'legacy' : 'anomaly', 'why'=> $schema === 0 ? '' : 'marker-without-fields']; }
    if($anyMissing) { return ['kind'=>'anomaly','why'=>'partial']; }
    return ['kind'=>'migrated', 'why'=> $schema === 0 ? 'needs-marker' : ''];
}

/** 可售与潜在金额（只统计，不写库）：可售 = owned − max(4, 展示数) */
function inventoryAgg(array $s): array {
    global $rarityOf, $priceOf;
    $shown = [];
    foreach(($s['layout']['fish'] ?? []) as $x) { if(is_string($x)) { $shown[$x] = ($shown[$x] ?? 0) + 1; } }
    $byRarity = []; $total = 0;
    foreach(($s['fish'] ?? []) as $fid=>$f) {
        if(!is_array($f)) { continue; }
        $owned = (int)($f['owned_count'] ?? $f['catch_count'] ?? 0);
        $keep = max(4, $shown[$fid] ?? 0);
        $sellable = max(0, $owned - $keep);
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

$table = 'gamecenter_aquarium_save';
$lastUid = 0;
$counts = ['total'=>0,'legacy'=>0,'migrated'=>0,'anomaly'=>0,'written'=>0];
$agg = ['potential'=>0,'byRarity'=>[], 'accounts'=>[]];
$anomalies = [];

do {
    $rows = DB::fetch_all('SELECT uid, version, updated_ms, state_json FROM %t WHERE uid>%d ORDER BY uid LIMIT %d', [$table, $lastUid, $batch]);
    foreach($rows as $row) {
        $counts['total']++;
        $lastUid = (int)$row['uid'];
        $raw = (string)$row['state_json'];
        $s = json_decode($raw, true);
        if(!is_array($s)) { $counts['anomaly']++; $anomalies[] = ['uid'=>$lastUid,'why'=>'json']; continue; }
        $cls = classify($s, $c);
        $counts[$cls['kind']]++;

        if($mode === 'verify') {
    // 全表核对：标记齐全、守恒、展示≤持有
    $vLast = 0; $v = ['accounts'=>0,'ok'=>0,'missing_marker'=>0,'bad_sum'=>0,'over_display'=>0,'bad_json'=>0,'details'=>[]];
    do {
        $rows2 = DB::fetch_all('SELECT uid, state_json FROM %t WHERE uid>%d ORDER BY uid LIMIT %d', [$table, $vLast, $batch]);
        foreach($rows2 as $r2) {
            $v['accounts']++; $vLast = (int)$r2['uid'];
            $sx = json_decode((string)$r2['state_json'], true);
            if(!is_array($sx)) { $v['bad_json']++; $v['details'][] = ['uid'=>$vLast,'why'=>'json']; continue; }
            $cls = classify($sx, $c);
            if($cls['kind'] === 'anomaly') { $v['details'][] = ['uid'=>$vLast,'why'=>$cls['why']]; continue; }
            if((int)($sx['inventory_schema'] ?? 0) !== 1) { $v['missing_marker']++; $v['details'][] = ['uid'=>$vLast,'why'=>'no-marker']; continue; }
            $v['ok']++;
        }
    } while(count($rows2) === $batch);
    $say(['mode'=>'verify'] + $v);
    exit(($v['ok'] === $v['accounts']) ? 0 : 1);
}

if($mode === 'stats' || $mode === 'dry-run') {
            if($cls['kind'] !== 'anomaly') {
                $a = inventoryAgg($s);
                $agg['potential'] += $a['potential'];
                foreach($a['byRarity'] as $k=>$v) {
                    if(!isset($agg['byRarity'][$k])) { $agg['byRarity'][$k] = ['owned'=>0,'sellable'=>0,'potential'=>0]; }
                    foreach($v as $vv=>$vvv) { if($vv !== 'species') { $agg['byRarity'][$k][$vv] += $vvv; } }
                }
                $agg['accounts'][] = $a['potential'];
            } else {
                $anomalies[] = ['uid'=>$lastUid,'why'=>$cls['why']];
            }
            if($mode === 'dry-run') { continue; }
            continue;
        }

        if($cls['kind'] === 'anomaly') { $anomalies[] = ['uid'=>$lastUid,'why'=>$cls['why']]; continue; }
        if($cls['kind'] === 'migrated' && $cls['why'] === '') { continue; }   // 已完成

        if($mode === 'apply') {
            if(!$yes) { continue; }
            DB::begin_transaction();
            try {
                $locked = DB::fetch_first('SELECT uid, version, updated_ms, state_json FROM %t WHERE uid=%d FOR UPDATE', [$table, $lastUid]);
                $cur = json_decode((string)$locked['state_json'], true);
                $re = classify($cur, $c);
                if($re['kind'] === 'anomaly' || ($re['kind'] === 'migrated' && $re['why'] === '')) {
                    DB::commit(); continue;   // 别人已处理 / 数据有问题，不写
                }
                if($re['kind'] === 'legacy') {
                    foreach($cur['fish'] as $fid=>$f) {
                        if(!is_array($f)) { continue; }
                        if(!array_key_exists('owned_count', $f)) { $cur['fish'][$fid]['owned_count'] = (int)($f['catch_count'] ?? 0); }
                        if(!array_key_exists('sold_count', $f)) { $cur['fish'][$fid]['sold_count'] = 0; }
                    }
                }
                $cur['inventory_schema'] = 1;
                DB::update($table, ['state_json' => json_encode($cur, JSON_UNESCAPED_UNICODE), 'version' => (int)$locked['version'] + 1],
                    ['uid' => $lastUid]);
                DB::commit();
                $counts['written']++;
            } catch(Throwable $e) {
                DB::rollback();
                $anomalies[] = ['uid'=>$lastUid,'why'=>'write:'.$e->getMessage()];
            }
        }
    }
} while(count($rows) === $batch);

if($mode === 'verify') {
    // 全表核对：标记齐全、守恒、展示≤持有
    $vLast = 0; $v = ['accounts'=>0,'ok'=>0,'missing_marker'=>0,'bad_sum'=>0,'over_display'=>0,'bad_json'=>0,'details'=>[]];
    do {
        $rows2 = DB::fetch_all('SELECT uid, state_json FROM %t WHERE uid>%d ORDER BY uid LIMIT %d', [$table, $vLast, $batch]);
        foreach($rows2 as $r2) {
            $v['accounts']++; $vLast = (int)$r2['uid'];
            $sx = json_decode((string)$r2['state_json'], true);
            if(!is_array($sx)) { $v['bad_json']++; $v['details'][] = ['uid'=>$vLast,'why'=>'json']; continue; }
            $cls = classify($sx, $c);
            if($cls['kind'] === 'anomaly') { $v['details'][] = ['uid'=>$vLast,'why'=>$cls['why']]; continue; }
            if((int)($sx['inventory_schema'] ?? 0) !== 1) { $v['missing_marker']++; $v['details'][] = ['uid'=>$vLast,'why'=>'no-marker']; continue; }
            $v['ok']++;
        }
    } while(count($rows2) === $batch);
    $say(['mode'=>'verify'] + $v);
    exit(($v['ok'] === $v['accounts']) ? 0 : 1);
}

if($mode === 'stats' || $mode === 'dry-run') {
    $acc = $agg['accounts'];
    sort($acc);
    $pct = static function(array $a, float $q) { if(!$a) { return 0; } $i = (int)floor((count($a) - 1) * $q); return $a[$i]; };
    $say(['mode'=>$mode, 'accounts'=>$counts['total'], 'legacy'=>$counts['legacy'], 'migrated'=>$counts['migrated'],
        'anomaly'=>$counts['anomaly'], 'potential_total'=>$agg['potential'],
        'by_rarity'=>$agg['byRarity'],
        'per_account_potential'=>['median'=>$pct($acc,0.5),'p90'=>$pct($acc,0.9),'p95'=>$pct($acc,0.95),'p99'=>$pct($acc,0.99),'max'=>$acc ? end($acc) : 0],
        'anomalies'=>$anomalies]);
} else {
    $say(['mode'=>$mode, 'accounts'=>$counts['total'], 'legacy'=>$counts['legacy'], 'migrated'=>$counts['migrated'],
        'anomaly'=>$counts['anomaly'], 'written'=>$counts['written'],
        'dry_run'=> !$yes, 'anomalies'=>$anomalies]);
}
