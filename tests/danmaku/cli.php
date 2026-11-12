<?php
/* (C) 2026 Carinoasd. Local-only P0 replay runner: 小典 / Codex. */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/engine.php';
try {
    $source=isset($argv[1])?fopen($argv[1],'rb'):STDIN;
    if (!$source) throw new RuntimeException('无法读取本地回放');
    $raw=stream_get_contents($source,8*1024*1024+1);
    if (strlen($raw)>8*1024*1024) throw new RuntimeException('本机测试数据过大');
    $packet=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    $rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
    if (!is_array($packet)) throw new RuntimeException('回放不是对象');
    if (($packet['action']??'')==='batch') {
        if (!is_array($packet['cases']??null) || count($packet['cases'])>300) throw new RuntimeException('测试批次无效');
        $results=[];
        foreach ($packet['cases'] as $case) {
            try { $results[]=['ok'=>1,'data'=>danmaku_p0_replay($case['payload'],$rules,($case['partial']??false)===true)]; }
            catch (Throwable $error) { $results[]=['ok'=>0,'reason'=>$error->getMessage()]; }
        }
        $result=['ok'=>1,'results'=>$results];
    } else $result=['ok'=>1,'data'=>danmaku_p0_replay($packet,$rules)];
    echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    echo json_encode(['ok'=>0,'reason'=>$error->getMessage()],JSON_UNESCAPED_UNICODE);
    exit(1);
}
