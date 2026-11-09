<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。CLI路由/视图模型，不启动HTTP或X5。 */
if(PHP_SAPI!=='cli') {http_response_code(404);exit;}
define('IN_DISCUZ',true);define('CURMODULE','gamecenter');define('TIMESTAMP',1700000000);
$x=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
$_POST=$x['data']??[];$_GET=['op'=>$x['route_op']??'aquarium','game'=>$x['game']??'aquarium'];
$_SERVER['REQUEST_METHOD']=$x['method']??'POST';
$_G=['uid'=>$x['uid']??1,'adminid'=>$x['adminid']??1,'groupid'=>2,'cache'=>['plugin'=>['gamecenter'=>$x['vars']??[]]]];
function getgpc($k,$type=''){return $type==='P'?($_POST[$k]??''):($_GET[$k]??$_POST[$k]??'');}
function formhash(){return 'fixture-formhash';}
function DISCUZ_PLUGIN($id){return dirname(__DIR__,2).'/source/plugin/'.$id;}
function dhtmlspecialchars($s){return htmlspecialchars($s,ENT_QUOTES,'UTF-8');}
if(!function_exists('mb_substr')){function mb_substr($s,$start,$len){return '测';}}
class Result {public array $rows;public function __construct(array $r){$this->rows=$r;}}
class DB {
 static function fetch_first($q,$args){
  if($args[0]==='gamecenter_game')return ['gkey'=>$args[1],'available'=>1];
  if($args[0]==='gamecenter_save')return ['data'=>'{"fixture":true}','dateline'=>TIMESTAMP];
  if($args[0]==='gamecenter_session')return ['token'=>'fixture-token','uid'=>1,'gkey'=>$_GET['game'],'used'=>0,'dateline'=>TIMESTAMP];
  return [];
 }
 static function table($t){return 'model_'.$t;}
 static function object(){return (object)['curlink'=>1];}
 static function query($q,$args=[],$silent='',$unbuffered=false){
  if(($args[0]??'')==='gamecenter_save')return new Result([]); // 旧槽位API路由模型
  if($silent!=='RETRY'||!$unbuffered)throw new RuntimeException('unsafe driver usage');
  return new Result(str_starts_with($q,'SHOW SESSION')?[['Value'=>'2']]:[]);
 }
 static function fetch($q){return array_shift($q->rows);}
 static function free_result($q){}
 static function begin_transaction(){return true;}
 static function commit(){return true;}
 static function rollback(){return true;}
 static function result_first($q,$args){if($args[0]==='gamecenter_chunk')return 0;throw new RuntimeException('unexpected result query');}
 static function insert($t,$data){if($t!=='gamecenter_chunk')throw new RuntimeException('unexpected insert');return 1;}
 static function field($key,$v){return $key.'='.json_encode($v);}
 static function delete($t,$where){if($t!=='gamecenter_save')throw new RuntimeException('unexpected delete');return 1;}
}
require __DIR__.'/../../source/plugin/gamecenter/lib/core.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/view.php';
if(($x['test']??'')==='view'){
 $g=['gkey'=>'aquarium','available'=>0,'m'=>['name'=>'测试','intro'=>'占位','help'=>'测试','unit'=>'','icon'=>'','style'=>'','script'=>'game.js','version'=>'0.0.2']];
 echo gamecenter_view::play_page($g);exit;
}
if(($x['test']??'')==='core'){
 echo json_encode(['start'=>gamecenter_core::start(['gkey'=>'aquarium']),'submit'=>gamecenter_core::submit(['gkey'=>'aquarium'],'',[]),
  'rewards'=>gamecenter_core::week_rewards(['gkey'=>'aquarium'])]);exit;
}
require __DIR__.'/../../source/plugin/gamecenter/gamecenter.inc.php';
