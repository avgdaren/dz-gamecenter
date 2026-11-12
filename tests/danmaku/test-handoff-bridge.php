<?php
/* (C) 2026 Carinoasd. Isolated transport tests: 小典 / Codex. */
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../../docs/danmaku/handoff-v1/forum/submission-bridge.php';
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$cases=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];
foreach($cases as $case){try{$out[]=['ok'=>1,'data'=>danmaku_handoff_decode_submission($case['seed'],$case['data'],$rules)];}catch(Throwable $e){$out[]=['ok'=>0,'reason'=>$e->getMessage()];}}
echo json_encode($out,JSON_THROW_ON_ERROR);
