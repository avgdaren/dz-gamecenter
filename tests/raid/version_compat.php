<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实规则/持久化解码，无数据库连接。 */
define('IN_DISCUZ',true);
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/raid.php';
use gamecenter_raid_rules as R;
$service=(new ReflectionClass(gamecenter_raid::class))->newInstanceWithoutConstructor();
$decode=new ReflectionMethod(gamecenter_raid::class,'decode');$checks=0;
function row(array $s): array {
 $r=['id'=>1,'code'=>'ABCDEF123456','creator_uid'=>1,'creator_name'=>'甲','slot0_uid'=>1,'slot1_uid'=>$s['status']===0||$s['mode']==='solo'?0:2,'slot1_name'=>'乙','mode'=>$s['mode'],'rules_version'=>$s['rules_version'],'created_ms'=>0,'started_ms'=>0,'state_json'=>json_encode($s),'result_json'=>'{}'];
 foreach(['status','round_no','version','deadline_ms','updated_ms','ended_ms'] as $key)$r[$key]=$s[$key];
 if($s['status']>=2)$r['result_json']=json_encode(['mode'=>$s['mode'],'rules_version'=>$s['rules_version'],'status'=>$s['status'],'reason'=>$s['reason'],'rounds'=>count($s['history']),'hp'=>$s['hp'],'pots'=>$s['pots'],'survivors'=>count(R::alive($s)),'duration_ms'=>$s['ended_ms']]);
 return $r;
}
foreach([R::LEGACY_VERSION,R::VERSION] as $version){
 foreach(['solo','duo'] as $mode){
  $s=R::initial($mode,0,$version);$decoded=$decode->invoke($service,row($s));if($decoded['state']!==$s)throw new RuntimeException('active decode');$checks++;
  $end=R::advance_due($s,480000);$decoded=$decode->invoke($service,row($end));if($decoded['state']!==$end||$decoded['result']['rules_version']!==$version)throw new RuntimeException('history decode');$checks++;
 }
 $wait=R::initial('duo',0,$version);$wait['status']=0;$wait['deadline_ms']=300000;
 if($decode->invoke($service,row($wait))['state']!==$wait)throw new RuntimeException('waiting decode');$checks++;
}
$bad=R::initial('solo',0);$bad['rules_version']='unknown';
try{$decode->invoke($service,row($bad));throw new RuntimeException('future version accepted');}catch(InvalidArgumentException $e){if($e->getMessage()!=='rules_version')throw $e;$checks++;}
echo json_encode(['status'=>'PASS','checks'=>$checks,'scope'=>'real PHP rules and room/history decoder; no DB concurrency'])."\n";
