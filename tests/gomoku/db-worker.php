<?php
/** 作者：GPT / Codex。仅 CLI、显式测试库；使用调用方提供的 X5 DB 原文件。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if(getenv('GC_ROOM_TEST') !== '1' || !preg_match('/dbname=([a-z0-9_]+_gc_test)(?:;|$)/i',getenv('GC_TEST_DSN') ?: '')) { fwrite(STDERR,"需要 GC_ROOM_TEST=1 和以 _gc_test 结尾的独立库\n");exit(1); }
define('IN_DISCUZ',true); define('TIMESTAMP',time());
class DbException extends Exception { public function __construct($message='', $code=0, $sql='') { parent::__construct($message,(int)$code); } }
function getglobal($key) { return $key==='db_driver' ? (getenv('GC_TEST_DRIVER') ?: 'pdo') : ['status'=>0]; }
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
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/room.php';
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/room_schema.php';
class gamecenter_test_store extends gamecenter_room_store {
	public function transaction(callable $work) {
		try { return parent::transaction($work); }
		catch(Throwable $e) { fwrite(STDERR,'test DB exception: '.$e->getMessage().' code='.$e->getCode()."\n"); throw $e; }
	}
}
$store=new gamecenter_test_store();
while(($line=fgets(STDIN))!==false) {
	try {
		$x=json_decode($line,true,32,JSON_THROW_ON_ERROR);$op=$x['op']??'request';
		if($op==='init') {
			foreach(['gamecenter_room_action','gamecenter_room_member','gamecenter_room'] as $table)$store->query('DROP TABLE IF EXISTS '.DB::table($table));
			foreach(explode(';',gamecenter_room_schema::sql()) as $sql)if(trim($sql)!=='')$store->query(trim($sql));
			// 仅清理固定前缀的测试表，不操作插件实际表。
			foreach(['gamecenter_room_action','gamecenter_room_member','gamecenter_room'] as $table)$store->query('DELETE FROM %t',[$table]);
			$store->query('CREATE TABLE IF NOT EXISTS '.DB::table('gamecenter_game')." (gkey varchar(32) PRIMARY KEY,available tinyint NOT NULL DEFAULT 1) ENGINE=InnoDB");
			foreach(['gomoku','snake'] as $g)$store->query('INSERT IGNORE INTO %t (gkey,available) VALUES (%s,1)',['gamecenter_game',$g]);
			$result=['ok'=>1];
		} elseif($op==='fixture') {
			$code=$x['code']??'F00000000001';$now=(int)floor(microtime(true)*1000);$deadline=$x['deadline']??($now+60000);
			$store->transaction(function() use($store,$code,$now,$deadline) {
				$store->query('INSERT IGNORE INTO %t (code,black_uid,white_uid,black_name,white_name,create_request,board,status,version,deadline_ms,created_ms,updated_ms) VALUES (%s,101,102,%s,%s,%s,%s,1,2,%d,%d,%d)', ['gamecenter_room',$code,'测试黑方','测试白方',strtolower(str_pad($code,32,'0')),str_repeat('0',225),$deadline,$now,$now]);
				$r=$store->first('SELECT id FROM %t WHERE code=%s FOR UPDATE',['gamecenter_room',$code]);
				$store->query('DELETE FROM %t WHERE room_id=%d',['gamecenter_room_action',$r['id']]);
				$store->query('UPDATE %t SET board=%s,status=1,turn=1,winner=0,reason=%s,version=2,last_cell=-1,deadline_ms=%d WHERE id=%d',['gamecenter_room',str_repeat('0',225),'',$deadline,$r['id']]);
			});$result=['ok'=>1];
		} elseif($op==='entry') {
			define('CURMODULE','gamecenter');
			$_POST=$x['data'];$_GET=['op'=>$x['route_op']??'room','game'=>$x['game']??'gomoku'];$_SERVER['REQUEST_METHOD']=$x['method']??'POST';
			$_G=['uid'=>$x['uid']??1,'username'=>'测试用户','groupid'=>2,'adminid'=>1,'cache'=>['plugin'=>['gamecenter'=>[]]]];
			require dirname(__DIR__,2).'/source/plugin/gamecenter/gamecenter.inc.php';
			exit;
		} elseif($op==='counts') {
			$result=$store->first('SELECT COUNT(*) AS n FROM %t WHERE room_id=(SELECT id FROM %t WHERE code=%s)', ['gamecenter_room_action','gamecenter_room',$x['code']]);
		} elseif($op==='timeout_config') {
			$before=(int)$store->first('SELECT @@SESSION.innodb_lock_wait_timeout AS n')['n'];
			$inside=$store->transaction(fn()=>(int)$store->first('SELECT @@SESSION.innodb_lock_wait_timeout AS n')['n']);
			$after=(int)$store->first('SELECT @@SESSION.innodb_lock_wait_timeout AS n')['n'];
			$result=['before'=>$before,'inside'=>$inside,'after'=>$after];
		} elseif($op==='mapping') {
			$driver=DB::object();$previous=$driver->map;
			$driver->link[2]=getglobal('db_driver')==='pdo' ? new PDO($dsn,getenv('GC_TEST_USER')?:'',getenv('GC_TEST_PASSWORD')?:'') : new mysqli($h[1]??'127.0.0.1',getenv('GC_TEST_USER')?:'',getenv('GC_TEST_PASSWORD')?:'',$d[1],(int)($p[1]??3306));
			$driver->map['gamecenter_room_member']=2;
			try { $store->transaction(fn()=>true);$result=['blocked'=>false]; }
			catch(RuntimeException $e) { $result=['blocked'=>true]; }
			finally { $driver->map=$previous;DB::table('gamecenter_room'); }
		} elseif($op==='deadline') {
			$store->query('UPDATE %t SET deadline_ms=%d WHERE code=%s',['gamecenter_room',$x['deadline'],$x['code']]);$result=['ok'=>1];
		} elseif($op==='sweep') { $result=['count'=>(new gamecenter_room())->sweep(50)]; }
		elseif($op==='deadlock') {
			$tries=0;$store->transaction(function()use($store,$x,&$tries){$tries++;foreach($x['codes'] as $code){$store->first('SELECT id FROM %t WHERE code=%s FOR UPDATE',['gamecenter_room',$code]);usleep(30000);}});$result=['ok'=>1,'tries'=>$tries];
		} else { $result=(new gamecenter_room($store))->request((int)$x['uid'],$x['name']??('UID '.$x['uid']),$x['allowed']??true,$x['data']); }
		echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
	} catch(Throwable $e) { echo json_encode(['test_error'=>$e->getMessage(),'code'=>(int)$e->getCode()])."\n"; }
}
