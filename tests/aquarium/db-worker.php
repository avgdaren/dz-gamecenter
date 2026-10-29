<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。仅 CLI、显式测试库；使用调用方提供的 X5 DB 原文件。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if(getenv('GC_AQUARIUM_TEST') !== '1' || !preg_match('/dbname=([a-z0-9_]+_gc_test)(?:;|$)/i',getenv('GC_TEST_DSN') ?: '')) { fwrite(STDERR,"需要 GC_AQUARIUM_TEST=1 和以 _gc_test 结尾的独立库；真实X5驱动\n");exit(1); }
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
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/aquarium.php';
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/aquarium_schema.php';
$store=new gamecenter_aquarium_store();
while(($line=fgets(STDIN))!==false) {
 try {
  $x=json_decode($line,true,32,JSON_THROW_ON_ERROR);$op=$x['op']??'request';
  if($op==='init_schema') {
   $store->query('DROP TABLE IF EXISTS '.DB::table('gamecenter_aquarium_save'));
   for($i=0;$i<2;$i++)$store->query(gamecenter_aquarium_schema::sql());$r=['ok'=>1];
  } elseif($op==='raw') {
   $r=$store->first('SELECT * FROM %t WHERE uid=%d',['gamecenter_aquarium_save',$x['uid']]);
  } elseif($op==='corrupt') {
   $store->query('UPDATE %t SET state_json=%s WHERE uid=%d',['gamecenter_aquarium_save',$x['json'],$x['uid']]);$r=['ok'=>1];
  } elseif($op==='querysafe') {
   $blocked=false;try{$store->first('SELECT @@SESSION.innodb_lock_wait_timeout AS n');}catch(DbException $e){$blocked=true;}
   $before=$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")['Value'];
   $inside=$store->transaction(fn()=>$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")['Value']);
   $after=$store->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'")['Value'];
   $r=compact('blocked','before','inside','after');
  } elseif($op==='hold') {
   $store->transaction(function()use($store,$x){$store->lock($x['uid']);usleep(2300000);});$r=['ok'=>1];
  } else {
   $service=new gamecenter_aquarium($store,isset($x['now'])?fn()=>(int)$x['now']:null);
   $r=$service->request((int)$x['uid'],$x['allowed']??true,$x['data']);
  }
  echo json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)."\n";
 }catch(Throwable $e){echo json_encode(['test_error'=>$e->getMessage(),'code'=>(int)$e->getCode()])."\n";}
}
