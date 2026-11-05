<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。1.4基线纯规则冒烟，非完整游戏验收。 */
if(PHP_SAPI!=='cli') {http_response_code(404);exit;}
define('IN_DISCUZ',true);
function DISCUZ_PLUGIN($id){return dirname(__DIR__,2).'/source/plugin/'.$id;}
require __DIR__.'/../../source/plugin/gamecenter/lib/core.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/room.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/gomoku.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/raid_rules.php';
require __DIR__.'/../../source/plugin/gamecenter/games/reversi/rules.php';
require __DIR__.'/../../source/plugin/gamecenter/games/memory/verify.php';
require __DIR__.'/../../source/plugin/gamecenter/games/tetris/verify.php';
require __DIR__.'/../../source/plugin/gamecenter/games/snake/verify.php';
$n=0;function ck($ok,$label){global $n;$n++;if(!$ok)throw new RuntimeException($label);}
foreach(['gomoku','memory','minesweeper','raid','reversi','snake','tetris'] as $key)ck(gamecenter_core::manifest($key)!==null,'manifest '.$key);
ck(gamecenter_core::daily_rewards(['gkey'=>'snake','dailyrewards'=>'10,5'])===[10,5],'legacy daily reward helper without gkey in nested call');
ck(gamecenter_core::week_rewards(['gkey'=>'aquarium','weekrewards'=>'99'])===[],'aquarium has no weekly reward');
foreach([[1,8],[2,8],[2,15]] as [$v,$pairs]) {
 $deck=gamecenter_verify_memory::deck(1,$pairs);$moves=[];
 for($i=0;$i<$pairs;$i++)foreach($deck as $index=>$card)if($card===$i)$moves[]=$index;
 $data=['v'=>(string)$v,'pairs'=>(string)$pairs,'score'=>(string)$pairs,'moves'=>implode(',',$moves)];
 ck(gamecenter_verify_memory::verify(1,$data)['ok']===1,'memory current/legacy rules');
 $data['score']='999';ck(gamecenter_verify_memory::verify(1,$data)['ok']===0,'memory cheating');
}
$t=['v'=>'2','score'=>'0','ticks'=>'1','moves'=>'1:q'];ck(gamecenter_verify_tetris::verify(1,$t)['ok']===1,'tetris quit replay');
$t['score']='1';ck(gamecenter_verify_tetris::verify(1,$t)['ok']===0,'tetris wrong score');
ck(gamecenter_verify_snake::verify(1,['v'=>'2','score'=>'0','ticks'=>'15','moves'=>''])['ok']===1,'snake straight wall');
ck(gamecenter_verify_snake::verify(1,['v'=>'2','score'=>'999','ticks'=>'15','moves'=>''])['ok']===0,'snake cheating');
$board=str_repeat('0',225);for($i=0;$i<5;$i++)$board[$i]='1';ck(gamecenter_gomoku::won($board,4,'1'),'gomoku pure five');
$board[0]='0';ck(!gamecenter_gomoku::won($board,4,'1'),'gomoku four not won');
$state=gamecenter_rules_reversi::init(1,2);$next=gamecenter_rules_reversi::move($state,1,['cell'=>19],1);
ck(is_array($next)&&$next['b'][27]==='1'&&$next['turn']===2,'reversi legal move');
ck(gamecenter_rules_reversi::move($state,1,['cell'=>0],1)==='cell','reversi illegal move');
foreach(['solo','duo'] as $mode){$s=gamecenter_raid_rules::initial($mode,1000000);gamecenter_raid_rules::validate($s);ck($s['round_limit']===($mode==='solo'?18:16),'raid preserved');}
$findings=[];$g=gamecenter_core::manifest('gomoku');
if(empty($g['room']) || gamecenter_room::rules_class('gomoku')==='')$findings[]='baseline gomoku lacks room declaration/rules adapter; current room endpoint rejects it';
echo json_encode(['status'=>'PASS_WITH_BASELINE_FINDINGS','checks'=>$n,'findings'=>$findings,'scope'=>'pure smoke; not seven-game forum acceptance'])."\n";
