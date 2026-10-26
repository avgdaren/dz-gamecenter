<?php
/** 作者：GPT / Codex。企划 SQL 的官方安全检查回归；仅 CLI，无数据库连接。
 * 插件原始代码版权 (C) 2026 Carinoasd，保留其署名。
 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$root = getenv('GC_DZ_ROOT') ?: ($argv[1] ?? '');
$source = rtrim($root, '/\\').'/source/class/discuz/discuz_database.php';
if(!is_file($source)) {
	fwrite(STDERR, "请通过 GC_DZ_ROOT 或第一个参数指定本机原版 Discuz 根目录\n"); exit(1);
}
define('IN_DISCUZ', true);
class DbException extends Exception {
	public function __construct($message = '', $code = 0, $sql = '') {
		parent::__construct($message, (int)$code);
	}
}
function getglobal($key) {
	if($key !== 'config/security/querysafe') { return null; }
	// 对照官方 config_global_default.php；不读取站点凭据，不关闭检查。
	return ['status'=>1, 'dfunction'=>['load_file','hex','substring','if','ord','char'],
		'daction'=>['@','intooutfile','intodumpfile','unionselect','(select','unionall','uniondistinct'],
		'dnote'=>['/*','*/','#','--','"'], 'dlikehex'=>1, 'afullnote'=>0];
}
require $source;
$queries = [
	'union_history' => ['SELECT id,updated_ms FROM pre_gamecenter_raid_room WHERE slot0_uid=3 AND status>=2 UNION SELECT id,updated_ms FROM pre_gamecenter_raid_room WHERE slot1_uid=3 AND status>=2', false],
	'slot0_history' => ['SELECT id,updated_ms FROM pre_gamecenter_raid_room WHERE slot0_uid=3 AND status>=2 ORDER BY updated_ms DESC,id DESC LIMIT 10', true],
	'slot1_history' => ['SELECT id,updated_ms FROM pre_gamecenter_raid_room WHERE slot1_uid=3 AND status>=2 ORDER BY updated_ms DESC,id DESC LIMIT 10', true],
];
$result = [];
foreach($queries as $name => [$sql, $expected]) {
	$allowed = true;
	try { discuz_database::checkquery($sql); }
	catch(DbException $e) {
		if($e->getMessage() !== 'It is not safe to do this query') { throw $e; }
		$allowed = false;
	}
	if($allowed !== $expected) { throw new RuntimeException('querysafe result differs: '.$name); }
	$result[$name] = $allowed ? 'allowed' : 'blocked';
}
$bytes = file_get_contents($source);
echo json_encode(['status'=>'PASS', 'checks'=>count($queries),
	'scope'=>'official safecheck only; no database or forum request',
	'database_class_blob'=>sha1('blob '.strlen($bytes)."\0".$bytes), 'queries'=>$result], JSON_UNESCAPED_UNICODE)."\n";
