<?php
/** 作者：GPT / Codex。可由论坛已配置的调度入口包含；不自行创建常驻进程。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once dirname(__DIR__).'/lib/room.php';
try { (new gamecenter_room())->sweep(50); }
catch(Throwable $e) { if(function_exists('runlog')) { runlog('gamecenter_room','cleanup failed; code='.(int)$e->getCode()); } }
