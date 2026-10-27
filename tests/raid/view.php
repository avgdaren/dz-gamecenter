<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。真实 view 类、最小平台替身；非 Discuz 渲染。 */
if(PHP_SAPI !== 'cli') { exit; }
define('IN_DISCUZ',true);
$root=dirname(__DIR__,2).'/source/plugin/gamecenter';
class gamecenter_core {
    public static function esc($s){return htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');}
    public static function game_dir($key){global $root;return $root.'/games/'.$key;}
    public static function can_play(){global $_G;return $_G['uid'] ? '' : '请先登录';}
    public static function best_of(...$args){throw new RuntimeException('raid must not query solo scores');}
    public static function rivals(...$args){throw new RuntimeException('raid must not query solo rivals');}
}
function formhash(){return 'test-formhash';}
require $root.'/lib/view.php';
$m=json_decode(file_get_contents($root.'/games/raid/game.json'),true,16,JSON_THROW_ON_ERROR);
$g=['gkey'=>'raid','m'=>$m,'available'=>1];
$checks=0;
foreach([0,10] as $uid){
    $_G=['uid'=>$uid,'adminid'=>0,'setting'=>[]];$html=gamecenter_view::play_page($g);
    foreach(['data-game="raid"','data-uid="'.$uid.'"'] as $needle){if(!str_contains($html,$needle))throw new RuntimeException($needle);$checks++;}
    if(strpos($html,'feedback.js')>strpos($html,'games/raid/game.js') || strpos($html,'music.js')>strpos($html,'games/raid/game.js'))throw new RuntimeException('script order');$checks++;
    if(str_contains($html,'试玩模式。') || str_contains($html,'gc-tabsbox'))throw new RuntimeException('misleading scores or guest play');$checks++;
    if(gamecenter_view::reward_lines($g)!==[])throw new RuntimeException('raid reward');$checks++;
}
echo json_encode(['status'=>'PASS','checks'=>$checks])."\n";
