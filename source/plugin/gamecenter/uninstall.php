<?php

/**
 * 遊戲中心 gamecenter — 卸載：刪自有表（成績、排行、獎勵紀錄一起刪除；已發出的積分不收回）。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

// 1.6.0：加天使水族馆的存檔表。1.5.0：補上 1.4.0 漏刪的 room_seat／match／rating／save／chunk，以及天使讨伐令的三張表（與 json 的 datatables 一致）
foreach(['gamecenter_room_action', 'gamecenter_room_member', 'gamecenter_room_seat', 'gamecenter_room', 'gamecenter_match', 'gamecenter_rating', 'gamecenter_save', 'gamecenter_chunk',
	'gamecenter_raid_action', 'gamecenter_raid_member', 'gamecenter_raid_room', 'gamecenter_aquarium_save',
	'gamecenter_game', 'gamecenter_session', 'gamecenter_play', 'gamecenter_best', 'gamecenter_reward', 'gamecenter_settle', 'gamecenter_replay', 'gamecenter_challenge'] as $t) {
	DB::query('DROP TABLE IF EXISTS '.DB::table($t));
}

$finish = true;
