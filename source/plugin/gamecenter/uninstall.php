<?php

/**
 * 遊戲中心 gamecenter — 卸載：刪自有表（成績、排行、獎勵紀錄一起刪除；已發出的積分不收回）。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

foreach(['gamecenter_raid_action', 'gamecenter_raid_member', 'gamecenter_raid_room', 'gamecenter_room_action', 'gamecenter_room_member', 'gamecenter_room', 'gamecenter_game', 'gamecenter_session', 'gamecenter_play', 'gamecenter_best', 'gamecenter_reward', 'gamecenter_settle'] as $t) {
	DB::query('DROP TABLE IF EXISTS '.DB::table($t));
}

$finish = true;
