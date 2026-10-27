<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。仅 CLI、显式测试库；使用调用方提供的 X5 DB 原文件。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if(getenv('GC_RAID_TEST') !== '1' || !preg_match('/dbname=([a-z0-9_]+_gc_test)(?:;|$)/i',getenv('GC_TEST_DSN') ?: '')) { fwrite(STDERR,"需要 GC_RAID_TEST=1 和以 _gc_test 结尾的独立库\n");exit(1); }
ini_set('display_errors','stderr');
define('IN_DISCUZ',true); define('TIMESTAMP',time());
class DbException extends Exception { public function __construct($message='', $code=0, $sql='') { parent::__construct($message,(int)$code); } }
function getglobal($key) {
	if($key==='db_driver') { return getenv('GC_TEST_DRIVER') ?: 'pdo'; }
	// 与官方 config_global_default.php 一致；所有 DB::query 都必须经过启用的检查。
	if($key==='config/security/querysafe') {
		return ['status'=>1, 'dfunction'=>['load_file','hex','substring','if','ord','char'],
			'daction'=>['@','intooutfile','intodumpfile','unionselect','(select','unionall','uniondistinct'],
			'dnote'=>['/*','*/','#','--','"'], 'dlikehex'=>1, 'afullnote'=>0];
	}
	return null;
}
function dintval($value) { return is_array($value) ? array_map('intval',$value) : (int)$value; }
function DISCUZ_PLUGIN($id) { return dirname(__DIR__,2).'/source/plugin/'.$id; }
function getgpc($key,$type='') { return $type==='P' ? ($_POST[$key]??'') : ($_GET[$key]??$_POST[$key]??''); }
function formhash() { return 'test-formhash'; }
$dz=getenv('GC_DZ_ROOT');
require $dz.'/source/class/db/db_driver_mysqli.php';
require $dz.'/source/class/db/db_driver_pdo.php';
require $dz.'/source/class/discuz/discuz_database.php';
class_alias('discuz_database','DB');
$dsn=getenv('GC_TEST_DSN');
preg_match('/host=([^;]+)/',$dsn,$h);preg_match('/port=([0-9]+)/',$dsn,$p);preg_match('/dbname=([^;]+)/',$dsn,$d);
DB::init('db_driver_'.getglobal('db_driver'),[1=>['dsn'=>$dsn,'dbhost'=>$h[1]??'127.0.0.1','dbport'=>(int)($p[1]??3306),'dbname'=>$d[1], 'dbcharset'=>'utf8mb4','compress'=>0,'dbuser'=>getenv('GC_TEST_USER') ?: '', 'dbpw'=>getenv('GC_TEST_PASSWORD') ?: '', 'pconnect'=>0,'tablepre'=>'gct_']]);
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/raid.php';
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/raid_schema.php';
class gamecenter_test_store extends gamecenter_raid_store {
	public function transaction(callable $work) {
		try { return parent::transaction($work); }
		catch(Throwable $e) { fwrite(STDERR,'test DB exception: '.$e->getMessage().' code='.$e->getCode()."\n"); throw $e; }
	}
}
$store=new gamecenter_test_store();
while(($line=fgets(STDIN))!==false) {
    try {
        $x=json_decode($line,true,32,JSON_THROW_ON_ERROR); $op=$x['op']??'request';
        $service=new gamecenter_raid($store, isset($x['now']) ? fn()=>(int)$x['now'] : null);
        if($op==='init') {
            foreach(['gamecenter_raid_action','gamecenter_raid_member','gamecenter_raid_room'] as $table) $store->query('DROP TABLE IF EXISTS '.DB::table($table));
            for($i=0;$i<2;$i++) foreach(explode(';',gamecenter_raid_schema::sql()) as $sql) if(trim($sql)!=='') $store->query(trim($sql));
            $store->query('CREATE TABLE IF NOT EXISTS '.DB::table('gamecenter_game')." (gkey varchar(32) PRIMARY KEY,available tinyint NOT NULL DEFAULT 1) ENGINE=InnoDB");
            foreach(['raid','snake','gomoku'] as $g) $store->query('INSERT IGNORE INTO %t (gkey,available) VALUES (%s,1)',['gamecenter_game',$g]);
            $result=['ok'=>1];
        } elseif($op==='querysafe') {
            $blocked=false;
            try { $store->first('SELECT @@SESSION.innodb_lock_wait_timeout AS n'); }
            catch(DbException $e) { $blocked=$e->getMessage()==='It is not safe to do this query'; }
            $result=['blocked'=>$blocked,'show'=>$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")];
        } elseif($op==='fixture') {
            $code=$x['room']; $now=$x['now']??(int)floor(microtime(true)*1000);
            $s=$x['state']??gamecenter_raid_rules::initial('duo',$now);
            gamecenter_raid_rules::validate($s);
            $store->transaction(function()use($store,$code,$now,$s){
                $r=$store->first('SELECT * FROM %t WHERE code=%s FOR UPDATE',['gamecenter_raid_room',$code]);
                $store->query('DELETE FROM %t WHERE room_id=%d',['gamecenter_raid_action',$r['id']]);
                $store->query('UPDATE %t SET status=%d,round_no=%d,version=%d,deadline_ms=%d,state_json=%s,result_json=%s,started_ms=%d,updated_ms=%d,ended_ms=NULL WHERE id=%d',
                    ['gamecenter_raid_room',$s['status'],$s['round_no'],$s['version'],$s['deadline_ms'],json_encode($s,JSON_THROW_ON_ERROR),'{}',$now,$s['updated_ms'],$r['id']]);
            }); $result=['ok'=>1];
        } elseif($op==='corrupt') {
            $store->query('UPDATE %t SET state_json=%s WHERE code=%s',['gamecenter_raid_room',$x['json'],$x['room']]);$result=['ok'=>1];
        } elseif($op==='counts') {
            $result=$store->first('SELECT COUNT(*) AS n FROM %t a INNER JOIN %t r ON r.id=a.room_id WHERE r.code=%s',['gamecenter_raid_action','gamecenter_raid_room',$x['room']]);
        } elseif($op==='mapping') {
            $driver=DB::object();$previous=$driver->map;
            $driver->link[2]=getglobal('db_driver')==='pdo' ? new PDO($dsn,getenv('GC_TEST_USER')?:'',getenv('GC_TEST_PASSWORD')?:'') : new mysqli($h[1]??'127.0.0.1',getenv('GC_TEST_USER')?:'',getenv('GC_TEST_PASSWORD')?:'',$d[1],(int)($p[1]??3306));
            $driver->map['gamecenter_raid_member']=2;
            try { $store->transaction(fn()=>true);$result=['blocked'=>false]; }
            catch(RuntimeException $e) { $result=['blocked'=>true]; }
            finally { $driver->map=$previous;DB::table('gamecenter_raid_room'); }
        } elseif($op==='timeout_config') {
            $before=(int)$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")['Value'];
            $inside=$store->transaction(fn()=>(int)$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")['Value']);
            $after=(int)$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")['Value'];
            $result=compact('before','inside','after');
        } elseif($op==='hold' || $op==='lock_probe') {
            $tries=0;$store->transaction(function()use($store,$x,$op,&$tries){$tries++;$store->first('SELECT id FROM %t WHERE code=%s FOR UPDATE',['gamecenter_raid_room',$x['room']]);if($op==='hold')usleep(2300000);});$result=['ok'=>1,'tries'=>$tries];
        } elseif($op==='deadlock') {
            $tries=0;$store->transaction(function()use($store,$x,&$tries){$tries++;foreach($x['rooms'] as $code){$store->first('SELECT id FROM %t WHERE code=%s FOR UPDATE',['gamecenter_raid_room',$code]);usleep(30000);}});$result=['ok'=>1,'tries'=>$tries];
        } elseif($op==='sweep') { $result=['n'=>$service->sweep(50)]; }
        elseif($op==='explain') {
            $result=[];foreach(['slot0_uid','slot1_uid'] as $c)$result[]=$store->rows('EXPLAIN SELECT * FROM %t WHERE '.$c.'=%d AND status>=2 ORDER BY updated_ms DESC,id DESC LIMIT 10',['gamecenter_raid_room',$x['uid']]);
        } elseif($op==='entry') {
            define('CURMODULE','gamecenter');
            $_POST=$x['data'];$_GET=['op'=>$x['route_op']??'raid','game'=>$x['game']??'raid'];$_SERVER['REQUEST_METHOD']=$x['method']??'POST';
            $_G=['uid'=>$x['uid']??1,'username'=>'测试用户','groupid'=>2,'adminid'=>1,'cache'=>['plugin'=>['gamecenter'=>[]]]];
            require dirname(__DIR__,2).'/source/plugin/gamecenter/gamecenter.inc.php'; exit;
        } else { $result=$service->request((int)$x['uid'],$x['name']??('UID '.$x['uid']),$x['allowed']??true,$x['data']); }
        echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
    } catch(Throwable $e) { echo json_encode(['test_error'=>$e->getMessage(),'code'=>(int)$e->getCode()])."\n"; }
}
