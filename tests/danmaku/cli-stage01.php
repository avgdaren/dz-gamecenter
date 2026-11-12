<?php
/* (C) 2026 Carinoasd. Local one-stage replay runner: 小典 / Codex. */
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/stage.php';
try{
    $source=isset($argv[1])?fopen($argv[1],'rb'):STDIN;
    if(!$source)throw new RuntimeException('无法读取本地回放');
    $raw=stream_get_contents($source,16*1024*1024+1);
    if(strlen($raw)>16*1024*1024)throw new RuntimeException('本机测试数据过大');
    $packet=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    $rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
    if(!is_array($packet))throw new RuntimeException('回放不是对象');
    if(($packet['action']??'')==='batch'){
        if(!is_array($packet['cases']??null)||count($packet['cases'])>128)throw new RuntimeException('测试批次无效');
        $rows=[];foreach($packet['cases'] as $case){
            try{$rows[]=['ok'=>1,'data'=>danmaku_stage01_replay($case['payload'],$rules,($case['partial']??false)===true,($packet['trace']??true)!==false)];}
            catch(Throwable $e){$rows[]=['ok'=>0,'reason'=>$e->getMessage()];}
        }
        $result=['ok'=>1,'results'=>$rows];
    }else $result=['ok'=>1,'data'=>danmaku_stage01_replay($packet,$rules,false,isset($argv[2])&&$argv[2]==='--trace')];
    echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){echo json_encode(['ok'=>0,'reason'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);exit(1);}
