<?php

/**
 * 遊戲中心 gamecenter — 聯機房間清理：所有聯機遊戲逾時的房間判超時負／過期（每款每輪最多 50 間），
 * 並移除沒心跳的配對佇列。房間在被讀取或有人開新房時本來就會即時判定，這個任務只負責沒人再打開的房間。
 *
 * cronname: cron_room
 * week: -1
 * day: -1
 * hour: -1
 * minute: 0,5,10,15,20,25,30,35,40,45,50,55
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd（1.3.0 房間程式原作者 GPT / Codex）
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

require_once DISCUZ_ROOT.'./source/plugin/gamecenter/lib/core.php';
require_once DISCUZ_ROOT.'./source/plugin/gamecenter/lib/room.php';
try {
	gamecenter_room::sweep_all(50);
} catch(Throwable $e) {
	if(function_exists('runlog')) {
		runlog('gamecenter_room', 'cleanup failed; code='.(int)$e->getCode());
	}
}
