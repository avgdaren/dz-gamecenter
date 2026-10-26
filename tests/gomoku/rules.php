<?php
/** 作者：GPT / Codex。纯规则及无权限请求自测，不需要论坛或数据库。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/room.php';
$checks = 0;
function check($yes, $name) { global $checks; if(!$yes) { throw new RuntimeException($name); } $checks++; }
function fixture() { return ['board'=>str_repeat('0',225),'black_uid'=>1,'white_uid'=>2,'status'=>1,'turn'=>1,'version'=>2,'winner'=>0,'reason'=>'','deadline_ms'=>60000,'updated_ms'=>0,'last_cell'=>-1]; }
foreach([[1,0],[0,1],[1,1],[1,-1]] as [$dx,$dy]) {
	foreach([5,6,7] as $length) {
		$b = str_repeat('0',225); $x = 3; $y = $dy < 0 ? 10 : 3;
		for($i=0;$i<$length;$i++) { $b[($y+$dy*$i)*15+$x+$dx*$i]='1'; }
		check(gamecenter_gomoku::won($b,$y*15+$x,'1'),'five/overline direction');
	}
}
$b = str_repeat('0',225); foreach([13,14,15,16,17] as $i) { $b[$i]='1'; }
check(!gamecenter_gomoku::won($b,15,'1'),'row wrapping must not win');
$b = str_repeat('0',225); foreach([1,2,3,4] as $i) { $b[$i]='1'; }
check(!gamecenter_gomoku::won($b,2,'1'),'four not five');
$r=fixture();check(gamecenter_gomoku::move($r,2,0,2,100)==='turn','wrong player');
check(gamecenter_gomoku::move($r,1,0,1,100)==='conflict','stale version');
check(gamecenter_gomoku::move($r,1,225,2,100)==='cell','out of range');
$r['board'][0]='2';check(gamecenter_gomoku::move($r,1,0,2,100)==='cell','occupied');
$r=fixture();$next=gamecenter_gomoku::move($r,1,0,2,100);
check($next['turn']===2&&$next['version']===3&&$next['deadline_ms']===60100,'advance turn/version/deadline');
check($r['board'][0]==='0','rules do not mutate input');
check(gamecenter_gomoku::expire($r,59999)['status']===1,'just before deadline');
$expired=gamecenter_gomoku::expire($r,60000);
check($expired['status']===2&&$expired['winner']===2&&$expired['reason']==='timeout','exact deadline expires');
check(gamecenter_gomoku::expire($expired,70000)===$expired,'expiry idempotent');
check(gamecenter_gomoku::move($expired,1,0,2,70000)==='ended','expired cannot move');
$r=fixture();$r['status']=0;$r['white_uid']=0;
check(gamecenter_gomoku::expire($r,60000)['status']===3,'waiting expires without winner');
$r=fixture();$r['turn']=2;
for($y=0;$y<15;$y++)for($x=0;$x<15;$x++)$r['board'][$y*15+$x]=($x+2*$y)%4<2?'1':'2';
$r['board'][224]='0';$draw=gamecenter_gomoku::move($r,2,224,2,100);
check($draw['status']===2&&$draw['winner']===0&&$draw['reason']==='draw','full-board draw');
$service=new gamecenter_room();
check($service->request(0,'guest',true,[])['code']==='login','guest denied before SQL');
check($service->request(1,'user',false,[])['code']==='permission','group denied before SQL');
check($service->request(1,'user',true,['action'=>[]])['code']==='input','nested data rejected');
check($service->request(1,'user',true,['action'=>'move','room'=>'../bad'])['code']==='input','bad room rejected');
check($service->request(1,'user',true,['action'=>'create','request_id'=>'bad'])['code']==='input','bad request ID rejected');
echo "PASS rules/auth: $checks checks\n";
