<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。可选Discuz计划任务，仅有界追算，不删历史。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once dirname(__DIR__).'/lib/raid.php';
try { (new gamecenter_raid())->sweep(50); }
catch(Throwable $e) { if(function_exists('runlog')) { runlog('gamecenter_raid','cleanup failed; code='.(int)$e->getCode()); } }
