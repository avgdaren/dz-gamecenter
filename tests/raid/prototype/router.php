<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd 署名保留。仅本机 P1 样稿。 */
declare(strict_types=1);
// This is deliberately outside the deployable plugin. Never expose it through Discuz/nginx.
if(PHP_SAPI !== 'cli-server' || !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1','::1'], true)) {
    http_response_code(404); exit;
}
$port = (int)($_SERVER['SERVER_PORT'] ?? 0);
$host = $_SERVER['HTTP_HOST'] ?? '';
if(!in_array($host, ['127.0.0.1:'.$port, 'localhost:'.$port], true)) { http_response_code(403); exit; }
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if($origin !== '' && $origin !== 'http://'.$host) { http_response_code(403); exit; }
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');
$path = parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
$files = ['/'=>'index.html','/app.js'=>'app.js','/feedback.js'=>'feedback.js','/music.js'=>'music.js','/style.css'=>'style.css','/boss.svg'=>'boss.svg','/assets/battle.mp3'=>'assets/battle.mp3'];
if(isset($files[$path]) && $_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Content-Type: '.['/'=>'text/html; charset=utf-8','/app.js'=>'text/javascript; charset=utf-8','/feedback.js'=>'text/javascript; charset=utf-8','/music.js'=>'text/javascript; charset=utf-8',
        '/style.css'=>'text/css; charset=utf-8','/boss.svg'=>'image/svg+xml','/assets/battle.mp3'=>'audio/mpeg'][$path]);
    if($path==='/assets/battle.mp3') {
        $size=filesize(__DIR__.'/'.$files[$path]); header('Accept-Ranges: bytes');
        if(isset($_SERVER['HTTP_RANGE'])) {
            if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$_SERVER['HTTP_RANGE'],$range) || ($range[1]==='' && $range[2]==='')) {
                http_response_code(416); header('Content-Range: bytes */'.$size); exit;
            }
            $start=$range[1]===''?max(0,$size-(int)$range[2]):(int)$range[1];
            $end=$range[1]===''||$range[2]===''?$size-1:min($size-1,(int)$range[2]);
            if($start>$end || $start>=$size) {http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
            http_response_code(206);header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);header('Content-Length: '.($end-$start+1));
            $file=fopen(__DIR__.'/'.$files[$path],'rb');fseek($file,$start);echo fread($file,$end-$start+1);fclose($file);exit;
        }
        header('Content-Length: '.$size);
    }
    readfile(__DIR__.'/'.$files[$path]); exit;
}
if($path !== '/api') { http_response_code(404); exit; }
require dirname(__DIR__,3).'/source/plugin/gamecenter/lib/raid_rules.php';
use gamecenter_raid_rules as R;
session_name('raid_p1');
if(!@session_start(['cookie_httponly'=>true,'cookie_samesite'=>'Strict','use_strict_mode'=>true])) {
    http_response_code(503); header('Content-Type: application/json');
    echo '{"ok":false,"code":"session_unavailable"}'; exit;
}
$_SESSION['token'] ??= bin2hex(random_bytes(24));
$_SESSION['offset'] ??= 0;
$_SESSION['generation'] ??= 0;
$_SESSION['receipts'] ??= [];
$wall = (int)floor(microtime(true)*1000);
$now = $wall + $_SESSION['offset'];
header('Content-Type: application/json; charset=utf-8');
function reply(bool $ok, string $code='', ?array $receipt=null): never {
    global $now;
    echo json_encode(['ok'=>$ok,'code'=>$code,'token'=>$_SESSION['token'],
        'generation'=>$_SESSION['generation'],'server_ms'=>$now,'snapshot'=>$_SESSION['battle'] ?? null,
        'receipt'=>$receipt],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
    exit;
}
try {
    // Polling or a rejected late input must still persist all due rounds.
    if(isset($_SESSION['battle'])) { $_SESSION['battle'] = R::advance_due($_SESSION['battle'],$now); }
    if($_SERVER['REQUEST_METHOD'] === 'GET') { reply(true); }
    if($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); reply(false,'method'); }
    if(!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) { reply(false,'input'); }
    $raw=file_get_contents('php://input',false,null,0,4097);
    if(strlen($raw)>4096) { reply(false,'input'); }
    $q=json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if(!is_array($q) || array_is_list($q)) { reply(false,'input'); }
    foreach($q as $value) { if(!is_scalar($value)) { reply(false,'input'); } }
    if(!is_string($q['token'] ?? null) || !hash_equals($_SESSION['token'],$q['token'])) { reply(false,'token'); }
    $id=$q['request_id'] ?? null;
    if(!is_string($id) || !preg_match('/^[a-f0-9]{32}$/D',$id)) { reply(false,'request_id'); }
    unset($q['token']); ksort($q);
    $fingerprint=hash('sha256',json_encode($q,JSON_THROW_ON_ERROR));
    if(isset($_SESSION['receipts'][$id])) {
        $old=$_SESSION['receipts'][$id];
        if(!hash_equals($old['fingerprint'],$fingerprint)) { reply(false,'request_conflict'); }
        reply(true,'replayed',$old['receipt']);
    }
    if(($q['generation'] ?? null) !== $_SESSION['generation']) { reply(false,'generation'); }
    $op=$q['op'] ?? '';
    if($op === 'start') {
        if(!is_string($q['mode'] ?? null)) { reply(false,'mode'); }
        $_SESSION['battle']=R::initial($q['mode'],$now); $_SESSION['generation']++;
    } else {
        if(!isset($_SESSION['battle'])) { reply(false,'no_battle'); }
        $s=$_SESSION['battle'];
        if($op === 'act') {
            foreach(['round','actor','target'] as $key) { if(!is_int($q[$key] ?? null)) { reply(false,'input'); } }
            if(!is_string($q['kind'] ?? null)) { reply(false,'input'); }
            $_SESSION['battle']=R::submit($s,$q['round'],$q['actor'],['kind'=>$q['kind'],'target'=>$q['target']],$now);
        } elseif($op === 'retreat') {
            if(!is_int($q['actor'] ?? null)) { reply(false,'input'); }
            $_SESSION['battle']=R::retreat($s,$q['actor'],$now);
        } elseif($op === 'advance') {
            if(!in_array($q['ms'] ?? null,[30000,480000],true)) { reply(false,'input'); }
            // A local simulation clock only; production P2 will never accept a client time.
            $jump=$q['ms'] === 30000 ? max(0,$s['deadline_ms']-$now) : 480000;
            $_SESSION['offset']+=$jump; $now+=$jump;
            $_SESSION['battle']=R::advance_due($s,$now);
        } else { reply(false,'op'); }
    }
    $receipt=['request_id'=>$id,'generation'=>$_SESSION['generation'],
        'accepted_round'=>$op === 'act' ? $q['round'] : $_SESSION['battle']['round_no'],
        'accepted_version'=>$_SESSION['battle']['version']];
    $_SESSION['receipts'][$id]=['fingerprint'=>$fingerprint,'receipt'=>$receipt];
    if(count($_SESSION['receipts'])>96) { array_shift($_SESSION['receipts']); }
    reply(true,'accepted',$receipt);
} catch(InvalidArgumentException $e) { reply(false,$e->getMessage()); }
catch(JsonException $e) { reply(false,'input'); }
catch(Throwable $e) { http_response_code(500); reply(false,'internal'); }

