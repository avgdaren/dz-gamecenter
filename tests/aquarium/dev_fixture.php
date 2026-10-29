<?php
/**
 * 开发验收用的存档夹具（作者：小蓝 / DSH）
 * 仅 CLI、仅显式指定库；只改金币与已发现鱼，用于在真实站点上验证购买/扩容的成功路径。
 *   php tests/aquarium/dev_fixture.php --dz-root=... --dsn=... --user=.. --password=.. --tablepre=pre_ --uid=1 --add-coins=5000
 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', 'stderr');
define('IN_DISCUZ', true); define('TIMESTAMP', time());
$args = [];
foreach(array_slice($argv, 1) as $a) { if(preg_match('/^--([a-z0-9-]+)(?:=(.*))?$/i', $a, $m)) { $args[$m[1]] = $m[2] ?? '1'; } }
$opt = static fn(string $k, string $d = '') => $args[$k] ?? $d;

$dz = (string)$opt('dz-root'); $dsn = (string)$opt('dsn');
$user = (string)$opt('user'); $pass = (string)$opt('password'); $pre = (string)$opt('tablepre', 'pre_');
$uid = (int)$opt('uid', '0'); $addCoins = (int)$opt('add-coins', '0'); $discover = (int)$opt('discover', '0');
if($dz === '' || $dsn === '' || $uid < 1 || ($addCoins === 0 && $discover === 0)) {
    fwrite(STDERR, "需要 --dz-root --dsn --uid 以及 --add-coins 或 --discover\n"); exit(2);
}

class DbException extends Exception { public function __construct($m = '', $c = 0, $s = '') { parent::__construct($m, (int)$c); } }
function getglobal($k) {
    if($k === 'db_driver') { return getenv('GC_TEST_DRIVER') ?: 'pdo'; }
    if($k === 'config/security/querysafe') {
        return ['status'=>1, 'dfunction'=>['load_file','hex','substring','if','ord','char'],
            'daction'=>['@','intooutfile','intodumpfile','unionselect','(select','unionall','uniondistinct'],
            'dnote'=>['/*','*/','#','--','"'], 'dlikehex'=>1, 'afullnote'=>0];
    }
    return null;
}
function dintval($v) { return is_array($v) ? array_map('intval', $v) : (int)$v; }
function DISCUZ_PLUGIN($id) { return dirname(__DIR__, 2).'/source/plugin/'.$id; }
function getgpc($k, $t = '') { return ''; }
function formhash() { return 'cli'; }

require $dz.'/source/class/db/db_driver_mysqli.php';
require $dz.'/source/class/db/db_driver_pdo.php';
require $dz.'/source/class/discuz/discuz_database.php';
class_alias('discuz_database', 'DB');
preg_match('/host=([^;]+)/', $dsn, $h); preg_match('/port=([0-9]+)/', $dsn, $p); preg_match('/dbname=([^;]+)/', $dsn, $d);
DB::init('db_driver_'.getglobal('db_driver'), [1=>['dsn'=>$dsn, 'dbhost'=>$h[1] ?? '127.0.0.1', 'dbport'=>(int)($p[1] ?? 3306),
    'dbname'=>$d[1] ?? '', 'dbcharset'=>'utf8mb4', 'compress'=>0, 'dbuser'=>$user, 'dbpw'=>$pass, 'pconnect'=>0, 'tablepre'=>$pre]]);

require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_configs.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_store.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_shop.php';

$store = new gamecenter_aquarium_store();
$store->transaction(function() use ($store, $uid, $addCoins, $discover) {
    $row = $store->lock($uid);
    if(!$row) { throw new DomainException('no-save'); }
    $c = gamecenter_aquarium_configs::for_version((string)$row['config_version']);
    $s = json_decode((string)$row['state_json'], true, 32, JSON_THROW_ON_ERROR);
    if($addCoins !== 0) { $s['coins'] = max(0, (int)$s['coins'] + $addCoins); }
    if($discover > 0) {
        $n = 0;
        foreach($c['waters'][$s['current_water']]['fish'] as $fid => $f) {
            if($n >= $discover) { break; }
            if(!isset($s['fish'][$fid])) { $s['fish'][$fid] = ['discovered_at'=>(int)$s['last_settled_ms'], 'catch_count'=>1]; }
            $n++;
        }
        ksort($s['fish'], SORT_STRING);
    }
    gamecenter_aquarium_rules::validate($s, $c);
    gamecenter_aquarium_shop::validateState($s, $c);
    $row['state_json'] = json_encode($s, JSON_THROW_ON_ERROR);
    $store->save($row);
    echo json_encode(['ok'=>1, 'coins'=>$s['coins'], 'fish'=>count($s['fish'])]), "\n";
});
