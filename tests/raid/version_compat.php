<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实三版规则/持久化解码，无数据库连接。 */
define('IN_DISCUZ',true);
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/raid.php';
use gamecenter_raid_rules as R;
$service=(new ReflectionClass(gamecenter_raid::class))->newInstanceWithoutConstructor();
$decode=new ReflectionMethod(gamecenter_raid::class,'decode');$checks=0;
function check(bool $yes,string $label):void{global $checks;if(!$yes)throw new RuntimeException($label);$checks++;}
function row(array $s): array {
 $r=['id'=>1,'code'=>'ABCDEF123456','creator_uid'=>1,'creator_name'=>'甲','slot0_uid'=>1,'slot1_uid'=>$s['status']===0||$s['mode']==='solo'?0:2,'slot1_name'=>'乙','mode'=>$s['mode'],'rules_version'=>$s['rules_version'],'created_ms'=>0,'started_ms'=>0,'state_json'=>json_encode($s),'result_json'=>'{}'];
 foreach(['status','round_no','version','deadline_ms','updated_ms','ended_ms'] as $key)$r[$key]=$s[$key];
 if($s['status']>=2)$r['result_json']=json_encode(['mode'=>$s['mode'],'rules_version'=>$s['rules_version'],'status'=>$s['status'],'reason'=>$s['reason'],'rounds'=>count($s['history']),'hp'=>$s['hp'],'pots'=>$s['pots'],'survivors'=>count(R::alive($s)),'duration_ms'=>$s['ended_ms']]);
 return $r;
}
foreach([R::LEGACY_VERSION,R::V2_VERSION,R::VERSION] as $version){
 foreach(['solo','duo'] as $mode){
  $expectedLimit=$version===R::VERSION&&$mode==='solo'?18:16;
  $s=R::initial($mode,0,$version);if($version!==R::VERSION)unset($s['round_limit']);
  $record=row($s);$json=$record['state_json'];$decoded=$decode->invoke($service,$record);
  check($decoded['state']['round_limit']===$expectedLimit,'legacy default/current persisted cap');
  check($record['state_json']===$json,'read normalization does not rewrite persisted JSON');
  $at16=R::advance_due($s,480000);
  check($expectedLimit===18?($at16['status']===R::ACTIVE&&$at16['round_no']===17):($at16['status']===R::LOST&&count($at16['history'])===16),'v1/v2 stop16 while v3 solo still active');
  $end=R::advance_due($s,$expectedLimit*30000);if($version!==R::VERSION)unset($end['round_limit']);
  $decoded=$decode->invoke($service,row($end));
  check($decoded['result']['rules_version']===$version&&count($decoded['state']['history'])===$expectedLimit,'versioned terminal and historical cap');
  foreach($decoded['state']['history'] as $h)check(strlen(json_encode($h))<=512,'history row byte budget');
  check(strlen(json_encode($decoded['state']))<=16384,'room byte budget at cap');
 }
 $wait=R::initial('duo',0,$version);$wait['status']=0;$wait['deadline_ms']=300000;
 if($version!==R::VERSION)unset($wait['round_limit']);
 check($decode->invoke($service,row($wait))['state']['round_limit']===16,'old waiting room normalized with duo16');
}
$bad=R::initial('solo',0);$bad['rules_version']='unknown';
try{$decode->invoke($service,row($bad));throw new RuntimeException('future version accepted');}catch(InvalidArgumentException $e){check($e->getMessage()==='rules_version','unknown version rejected');}
// Real request parser+decoder+rules with an in-memory persistence adapter; not a DB concurrency test.
class MemoryRoom extends gamecenter_raid_store {
 public array $room=[];
 public function transaction(callable $work){return $work();}
 public function first(string $sql,array $args=[]):array{return ($args[0]??'')==='gamecenter_raid_room'?$this->room:[];}
 public function query(string $sql,array $args=[]){return true;}
 public function save(array $r):void{$this->room=$r;}
}
$s=R::initial('solo',0);
for($n=1;$n<=4;$n++)$s=R::submit($s,$n,0,['kind'=>$n===4?'heal':'guard','target'=>0],1);
$s=R::advance_due($s,$s['deadline_ms']+11*30000);
$db=new MemoryRoom();$db->room=row($s);$now=$s['updated_ms']+1;$app=new gamecenter_raid($db,fn()=>$now);
foreach([17,18] as $round){
 $reply=$app->request(1,'甲',true,['action'=>'act','room'=>'ABCDEF123456','round'=>$round,'kind'=>'guard','target'=>0,'request_id'=>str_repeat(dechex($round-16),32),'client_version'=>'raid-client-1']);
 check($reply['ok']===1,'production request accepts round'.$round);
}
check($reply['snapshot']['status']===3&&$reply['snapshot']['reason']==='round_limit','18th request reaches terminal');
$reply=$app->request(1,'甲',true,['action'=>'act','room'=>'ABCDEF123456','round'=>19,'kind'=>'guard','target'=>0,'request_id'=>str_repeat('a',32),'client_version'=>'raid-client-1']);check($reply['code']==='input','19th request rejected at parser');
echo json_encode(['status'=>'PASS','checks'=>$checks,'scope'=>'real PHP rules, persisted decoder, request parser with memory adapter; no DB concurrency'])."\n";
