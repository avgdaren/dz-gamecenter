<?php
/* (C) 2026 Carinoasd. Strict form-to-replay adapter: 小典 / Codex.
 * No DB/network and no game bootstrap. This is not an installed verify.php.
 */
if(!defined('IN_DISCUZ')&&PHP_SAPI!=='cli'){http_response_code(404);exit;}
function danmaku_handoff_uint(mixed $value,int $max): int {
    if(!is_int($value)&&!is_string($value))throw new RuntimeException('成绩字段格式无效');
    $text=(string)$value;
    if(strlen($text)>strlen((string)$max)||!preg_match('/\A(?:0|[1-9][0-9]*)\z/D',$text))throw new RuntimeException('成绩字段格式无效');
    $n=(int)$text;if($n>$max)throw new RuntimeException('成绩字段超出上限');return $n;
}
function danmaku_handoff_decode_submission(mixed $seed,array $data,array $rules): array {
    if(danmaku_handoff_uint($seed,2147483646)<1)throw new RuntimeException('开局凭证种子无效');
    $keys=['stage','v','rule','assist','ticks','input','score'];
    if(count($data)!==count($keys)||array_diff(array_keys($data),$keys))throw new RuntimeException('成绩字段无效');
    if(danmaku_handoff_uint($data['stage'],1)!==1||danmaku_handoff_uint($data['v'],1)!==1||$data['rule']!=='danmaku-stage01-r3')throw new RuntimeException('仅支持当前标准完整第一关');
    if(danmaku_handoff_uint($data['assist'],1)!==0)throw new RuntimeException('辅助练习不记录榜单成绩');
    $ticks=danmaku_handoff_uint($data['ticks'],$rules['stage01']['maxTicks']);
    $score=danmaku_handoff_uint($data['score'],$rules['stage01']['bombScoreUpperBound']);
    if($ticks<1||!is_string($data['input'])||strlen($data['input'])!==4*(int)ceil($ticks*5/3)||!preg_match('/\A[A-Za-z0-9+\/]*={0,2}\z/D',$data['input']))throw new RuntimeException('回放编码或长度无效');
    $raw=base64_decode($data['input'],true);
    if($raw===false||strlen($raw)!==$ticks*5||base64_encode($raw)!==$data['input'])throw new RuntimeException('回放编码无效');
    return ['payload'=>['stage'=>true,'v'=>1,'rule'=>$data['rule'],'assist'=>false,'ticks'=>$ticks,'input'=>$data['input'],'score'=>$score],
            'minms'=>intdiv($ticks*1000,60)];
}
