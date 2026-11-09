<?php
/** 作者：小蓝（DSH）。迁移测试用 worker：建表、造旧档、读原行。仅 CLI，仅隔离库。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if(getenv('GC_AQUARIUM_TEST') !== '1' || !preg_match('/dbname=([a-z0-9_]+_gc_test)(?:;|$)/i', getenv('GC_TEST_DSN') ?: '')) {
    fwrite(STDERR, "需要 GC_AQUARIUM_TEST=1 和以 _gc_test 结尾的独立库\n"); exit(1);
}
ini_set('display_errors', 'stderr');
define('IN_DISCUZ', true); define('TIMESTAMP', time());
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
$dz = getenv('GC_DZ_ROOT');
require $dz.'/source/class/db/db_driver_mysqli.php';
require $dz.'/source/class/db/db_driver_pdo.php';
require $dz.'/source/class/discuz/discuz_database.php';
class_alias('discuz_database', 'DB');
$dsn = getenv('GC_TEST_DSN');
preg_match('/host=([^;]+)/', $dsn, $h); preg_match('/port=([0-9]+)/', $dsn, $p); preg_match('/dbname=([^;]+)/', $dsn, $d);
DB::init('db_driver_'.getglobal('db_driver'), [1=>['dsn'=>$dsn, 'dbhost'=>$h[1] ?? '127.0.0.1', 'dbport'=>(int)($p[1] ?? 3306),
    'dbname'=>$d[1] ?? '', 'dbcharset'=>'utf8mb4', 'compress'=>0, 'dbuser'=>getenv('GC_TEST_USER') ?: '',
    'dbpw'=>getenv('GC_TEST_PASSWORD') ?: '', 'pconnect'=>0, 'tablepre'=>'gct_']]);

require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_configs.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_store.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_migrate.php';
require DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_schema.php';

$store = new gamecenter_aquarium_store();
while(($line = fgets(STDIN)) !== false) {
    try {
        $x = json_decode($line, true, 32, JSON_THROW_ON_ERROR);
        $op = $x['op'] ?? '';
        if($op === 'init_schema') {
            $store->query('DROP TABLE IF EXISTS '.DB::table('gamecenter_aquarium_save'));
            $store->query(gamecenter_aquarium_schema::sql());
            $r = ['ok'=>1];
        } elseif($op === 'seed') {
            $c = gamecenter_aquarium_configs::for_version($x['config'] ?? gamecenter_aquarium_configs::FOUNDATION);
            $base = (int)($x['base_ms'] ?? 1700000000000);
            $made = 0;
            for($i = 1; $i <= (int)$x['n']; $i++) {
                $uid = $i;
                $s = gamecenter_aquarium_rules::initial($uid, str_pad(dechex($uid), 32, '0', STR_PAD_LEFT), $base, $c);
                // 让每个号积累若干捕获；偶数号更久，奇数号更短
                $advance = ($uid % 2 === 0) ? 40 : 12;
                $settled = gamecenter_aquarium_rules::settle($s, $base + $advance * 120000, $c);
                $s2 = $settled['save'];
                if(isset($c['fish_capacities'])) { $s2 = gamecenter_aquarium_shop::defaults($s2,$c); }
                $store->query('INSERT INTO %t (uid,save_version,config_version,state_json,version,updated_ms) VALUES (%d,%d,%s,%s,%d,%d)',
                    ['gamecenter_aquarium_save', $uid, 1, $c['version'], json_encode($s2, JSON_THROW_ON_ERROR), 1, $s2['last_settled_ms']]);
                $made++;
            }
            $r = ['ok'=>1, 'seeded'=>$made];
        } elseif($op === 'raw') {
            $r = $store->first('SELECT * FROM %t WHERE uid=%d', ['gamecenter_aquarium_save', (int)$x['uid']]);
        } elseif($op === 'set_version') {
            $store->query('UPDATE %t SET config_version=%s WHERE uid=%d', ['gamecenter_aquarium_save', (string)$x['version'], (int)$x['uid']]);
            $r = ['ok'=>1];
        } elseif($op === 'corrupt') {
            $store->query('UPDATE %t SET state_json=%s WHERE uid=%d', ['gamecenter_aquarium_save', '{bad', (int)$x['uid']]);
            $r = ['ok'=>1];
        } elseif($op === 'replace_state') {
            $s = $x['state'];
            $store->save_versioned(['uid'=>(int)$x['uid'],'save_version'=>1,'config_version'=>$s['config_version'],
                'state_json'=>json_encode($s,JSON_THROW_ON_ERROR),'version'=>1,'updated_ms'=>$s['last_settled_ms']]);
            $r=['ok'=>1];
        } elseif($op === 'counts') {
            $r = $store->rows('SELECT config_version AS v, COUNT(*) AS c FROM %t GROUP BY config_version', ['gamecenter_aquarium_save']);
        } else {
            $r = ['error'=>'unknown-op'];
        }
        echo json_encode($r, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), "\n";
    } catch(Throwable $e) {
        echo json_encode(['test_error'=>$e->getMessage(), 'code'=>(int)$e->getCode()]), "\n";
    }
}
