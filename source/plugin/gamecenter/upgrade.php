<?php

/**
 * 遊戲中心 gamecenter — 更新：補表、補欄位（可重複執行）＋登記新放進 games/ 的遊戲。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
  * 1.8.1：天使水族馆修正——手機版鱼缸縮成窄欄（樣式）、同配置存檔每次請求做完整檢查（可修的自動修、修不了的唯讀隔離）、
 * 　　　 布置壞 JSON 回參數錯誤、錯誤記錄改寫進 data/log、後台加「水族馆存檔」分頁；沒有資料表或欄位變更。
  * 1.8.0：併入天使水族馆 1.2.0（lib/aquarium*.php、games/aquarium/：16 種魚、餵食、建檔人數、賣魚預設關、v1 存檔自動遷移 v2；aquarium_save 表結構不變）。
 * 　　　 lib/core.php 讀 game.json 時，資料夾名稱在獨立遊戲白名單裡（raid／aquarium）就視為獨立遊戲（容錯別人的水族馆包缺 standalone 鍵）。
 * 1.7.0：新增天使弹幕（games/danmaku/，純規則遊戲，沒有資料表或欄位變更；更新時由 install.php 登記為新遊戲、預設不開放）。
 * 1.6.0：天使水族馆的存檔表 aquarium_save（由 install.php 建；先前手動放過水族馆、表已存在的照用）。
 * 1.5.0：天使讨伐令的三張表 raid_room／raid_member／raid_action（由 install.php 建；先前手動放過增量包、表已存在的照用）。
 * 1.4.0：通用聯機房間——room 加 gkey／kind／nplayers／players／state／seed／ratings、room_action 加 data、play 加 stats；
 *        新表 room_seat、match、rating、save、chunk（由 install.php 建）；1.3.0 的五子棋房間搬進新欄位。
 * 1.2.0：幽靈挑戰與每日挑戰——新表 gamecenter_replay、gamecenter_challenge（由 install.php 建）；
 *        session 加 mode／ref／pkey、play 加 mode、best 加 rid、game 加 dailytries／dailyrewards、
 *        settle.yw 放寬成 varchar(12)（每日結算用 8 碼日期）。只補缺少的，不動資料。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

$gc_cols = [
	'gamecenter_session' => [
		'mode' => "varchar(8) NOT NULL DEFAULT '' AFTER `used`",
		'ref' => "int(10) unsigned NOT NULL DEFAULT '0' AFTER `mode`",
		'pkey' => "char(8) NOT NULL DEFAULT '' AFTER `ref`",
	],
	'gamecenter_play' => [
		'mode' => "varchar(8) NOT NULL DEFAULT '' AFTER `verified`",
	],
	'gamecenter_best' => [
		'rid' => "int(10) unsigned NOT NULL DEFAULT '0' AFTER `score`",
	],
	'gamecenter_game' => [
		'dailytries' => "smallint(5) unsigned NOT NULL DEFAULT '3' AFTER `maxscore`",
		'dailyrewards' => "varchar(255) NOT NULL DEFAULT '' AFTER `dailytries`",
	],
	'gamecenter_room' => [
		'gkey' => "varchar(32) NOT NULL DEFAULT '' AFTER `code`",
		'kind' => "tinyint(1) unsigned NOT NULL DEFAULT '0' AFTER `gkey`",
		'nplayers' => "tinyint(1) unsigned NOT NULL DEFAULT '2' AFTER `kind`",
		'players' => "text AFTER `nplayers`",
		'state' => "mediumtext AFTER `players`",
		'seed' => "int(10) unsigned NOT NULL DEFAULT '0' AFTER `state`",
		'ratings' => "varchar(500) NOT NULL DEFAULT '' AFTER `reason`",
	],
	'gamecenter_room_action' => [
		'data' => "varchar(2048) NOT NULL DEFAULT '' AFTER `cell`",
	],
];
$gc_cols['gamecenter_play']['stats'] = "varchar(500) NOT NULL DEFAULT '' AFTER `mode`";
foreach($gc_cols as $gc_t => $gc_list) {
	$gc_tn = DB::table($gc_t);
	if(!DB::fetch_first("SHOW TABLES LIKE '".str_replace('_', '\\_', $gc_tn)."'")) {
		continue;
	}
	foreach($gc_list as $gc_c => $gc_def) {
		if(!DB::fetch_first('SHOW COLUMNS FROM '.$gc_tn." LIKE '".$gc_c."'")) {
			DB::query('ALTER TABLE '.$gc_tn.' ADD COLUMN `'.$gc_c.'` '.$gc_def);
		}
	}
}
$gc_tn = DB::table('gamecenter_session');
if(!DB::fetch_first('SHOW INDEX FROM '.$gc_tn." WHERE Key_name='daily'")) {
	DB::query('ALTER TABLE '.$gc_tn.' ADD INDEX `daily` (`uid`, `gkey`, `mode`, `pkey`)');
}
$gc_tn = DB::table('gamecenter_best');
if(!DB::fetch_first('SHOW INDEX FROM '.$gc_tn." WHERE Key_name='rid'")) {
	DB::query('ALTER TABLE '.$gc_tn.' ADD INDEX `rid` (`rid`)');
}
$gc_tn = DB::table('gamecenter_settle');
$gc_c = DB::fetch_first('SHOW COLUMNS FROM '.$gc_tn." LIKE 'yw'");
if($gc_c && stripos($gc_c['Type'], 'varchar(12)') === false) {
	DB::query('ALTER TABLE '.$gc_tn." MODIFY `yw` varchar(12) NOT NULL DEFAULT ''");
}

$gc_upgrading = true;
include __DIR__.'/install.php';

// 1.4.0：1.3.0 的五子棋房間搬進通用欄位（只搬 gkey 還是空的列），座位表補齊
$gc_tn = DB::table('gamecenter_room');
$gc_c = DB::fetch_first('SHOW COLUMNS FROM '.$gc_tn." LIKE 'board'");
if($gc_c && $gc_c['Default'] === null && strtoupper((string)$gc_c['Null']) === 'NO') {
	DB::query('ALTER TABLE '.$gc_tn." MODIFY `board` varchar(225) NOT NULL DEFAULT ''");
}
if(!DB::fetch_first('SHOW INDEX FROM '.$gc_tn." WHERE Key_name='gkey'")) {
	DB::query('ALTER TABLE '.$gc_tn.' ADD INDEX `gkey` (`gkey`, `status`, `updated_ms`)');
}
foreach(DB::fetch_all('SELECT id, black_uid, white_uid, black_name, white_name, board, turn, last_cell FROM %t WHERE gkey=%s', ['gamecenter_room', '']) as $gc_r) {
	$gc_players = [['uid' => (int)$gc_r['black_uid'], 'name' => (string)$gc_r['black_name']]];
	if((int)$gc_r['white_uid'] > 0) {
		$gc_players[] = ['uid' => (int)$gc_r['white_uid'], 'name' => (string)$gc_r['white_name']];
	}
	DB::update('gamecenter_room', [
		'gkey' => 'gomoku', 'nplayers' => 2, 'players' => json_encode($gc_players, JSON_UNESCAPED_UNICODE),
		'state' => json_encode(['b' => strlen((string)$gc_r['board']) === 225 ? (string)$gc_r['board'] : str_repeat('0', 225), 'last' => (int)$gc_r['last_cell'], 'turn' => (int)$gc_r['turn']]),
	], DB::field('id', (int)$gc_r['id']));
	foreach($gc_players as $gc_i => $gc_p) {
		DB::query('INSERT IGNORE INTO %t (room_id, uid, seat, dateline) VALUES (%d, %d, %d, %d)', ['gamecenter_room_seat', (int)$gc_r['id'], (int)$gc_p['uid'], $gc_i + 1, TIMESTAMP]);
	}
}

$finish = true;
