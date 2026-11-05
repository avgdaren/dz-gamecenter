<?php

/**
 * 遊戲中心 gamecenter — 安裝：建自有表、登記內建遊戲。可重複執行（表已存在不重建；舊表缺的欄位由 upgrade.php 補）。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

runquery("
CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_game')." (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `available` tinyint(1) NOT NULL DEFAULT '0',
  `displayorder` smallint(6) NOT NULL DEFAULT '0',
  `credit` tinyint(3) unsigned NOT NULL DEFAULT '0',
  `ratio` int(10) unsigned NOT NULL DEFAULT '0',
  `percap` int(10) unsigned NOT NULL DEFAULT '0',
  `daycap` int(10) unsigned NOT NULL DEFAULT '0',
  `weekrewards` varchar(255) NOT NULL DEFAULT '',
  `maxscore` int(10) unsigned NOT NULL DEFAULT '0',
  `dailytries` smallint(5) unsigned NOT NULL DEFAULT '3',
  `dailyrewards` varchar(255) NOT NULL DEFAULT '',
  `plays` int(10) unsigned NOT NULL DEFAULT '0',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_session')." (
  `token` char(32) NOT NULL DEFAULT '',
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `seed` int(10) unsigned NOT NULL DEFAULT '0',
  `startms` bigint(20) unsigned NOT NULL DEFAULT '0',
  `used` tinyint(1) NOT NULL DEFAULT '0',
  `mode` varchar(8) NOT NULL DEFAULT '',
  `ref` int(10) unsigned NOT NULL DEFAULT '0',
  `pkey` char(8) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`token`),
  KEY `uid` (`uid`, `dateline`),
  KEY `daily` (`uid`, `gkey`, `mode`, `pkey`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_play')." (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `score` int(11) NOT NULL DEFAULT '0',
  `duration` int(10) unsigned NOT NULL DEFAULT '0',
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `mode` varchar(8) NOT NULL DEFAULT '',
  `stats` varchar(500) NOT NULL DEFAULT '',
  `reward` int(10) unsigned NOT NULL DEFAULT '0',
  `ymd` char(8) NOT NULL DEFAULT '',
  `yw` char(6) NOT NULL DEFAULT '',
  `ip` varchar(45) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `gkey` (`gkey`, `dateline`),
  KEY `uid` (`uid`, `gkey`, `dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_best')." (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `period` char(1) NOT NULL DEFAULT 'a',
  `pkey` char(8) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `score` int(11) NOT NULL DEFAULT '0',
  `rid` int(10) unsigned NOT NULL DEFAULT '0',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`, `period`, `pkey`, `uid`),
  KEY `rank` (`gkey`, `period`, `pkey`, `score`, `dateline`),
  KEY `rid` (`rid`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_reward')." (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `kind` varchar(8) NOT NULL DEFAULT '',
  `credit` tinyint(3) unsigned NOT NULL DEFAULT '0',
  `amount` int(11) NOT NULL DEFAULT '0',
  `ymd` char(8) NOT NULL DEFAULT '',
  `note` varchar(255) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`, `gkey`, `ymd`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_settle')." (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `yw` varchar(12) NOT NULL DEFAULT '',
  `result` text NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`, `yw`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_replay')." (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `mode` varchar(8) NOT NULL DEFAULT '',
  `pkey` char(8) NOT NULL DEFAULT '',
  `seed` int(10) unsigned NOT NULL DEFAULT '0',
  `score` int(11) NOT NULL DEFAULT '0',
  `data` mediumtext NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_challenge')." (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `touid` int(10) unsigned NOT NULL DEFAULT '0',
  `ref` int(10) unsigned NOT NULL DEFAULT '0',
  `score` int(11) NOT NULL DEFAULT '0',
  `toscore` int(11) NOT NULL DEFAULT '0',
  `win` tinyint(1) NOT NULL DEFAULT '0',
  `rid` int(10) unsigned NOT NULL DEFAULT '0',
  `notified` tinyint(1) NOT NULL DEFAULT '0',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`, `dateline`),
  KEY `touid` (`touid`, `dateline`),
  KEY `rid` (`rid`)
) ENGINE=InnoDB;
");


// 1.3.0／1.4.0：聯機房間（房間、座位、每人目前房間指標、操作去重＋回放、配對佇列、等級分）；1.4.0：存檔、分段提交
runquery("
CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room')." (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(12) NOT NULL DEFAULT '',
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `kind` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `nplayers` tinyint(1) unsigned NOT NULL DEFAULT '2',
  `players` text NOT NULL,
  `state` mediumtext NOT NULL,
  `seed` int(10) unsigned NOT NULL DEFAULT '0',
  `black_uid` int(10) unsigned NOT NULL DEFAULT '0',
  `white_uid` int(10) unsigned NOT NULL DEFAULT '0',
  `black_name` varchar(80) NOT NULL DEFAULT '',
  `white_name` varchar(80) NOT NULL DEFAULT '',
  `create_request` char(32) NOT NULL DEFAULT '',
  `board` varchar(225) NOT NULL DEFAULT '',
  `status` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `turn` tinyint(1) unsigned NOT NULL DEFAULT '1',
  `winner` int(10) unsigned NOT NULL DEFAULT '0',
  `reason` varchar(16) NOT NULL DEFAULT '',
  `ratings` varchar(500) NOT NULL DEFAULT '',
  `version` int(10) unsigned NOT NULL DEFAULT '1',
  `deadline_ms` bigint(20) unsigned NOT NULL DEFAULT '0',
  `last_cell` smallint(6) NOT NULL DEFAULT '-1',
  `created_ms` bigint(20) unsigned NOT NULL DEFAULT '0',
  `updated_ms` bigint(20) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `creator_request` (`black_uid`, `create_request`),
  KEY `expiry` (`status`, `deadline_ms`),
  KEY `gkey` (`gkey`, `status`, `updated_ms`),
  KEY `black_history` (`black_uid`, `updated_ms`),
  KEY `white_history` (`white_uid`, `updated_ms`),
  KEY `creation_rate` (`black_uid`, `created_ms`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room_member')." (
  `uid` int(10) unsigned NOT NULL,
  `room_id` bigint(20) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `room_id` (`room_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room_seat')." (
  `room_id` bigint(20) unsigned NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `seat` tinyint(1) unsigned NOT NULL DEFAULT '1',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`room_id`, `uid`),
  KEY `uid` (`uid`, `room_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room_action')." (
  `room_id` bigint(20) unsigned NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `request_id` char(32) NOT NULL,
  `fingerprint` char(64) NOT NULL DEFAULT '',
  `action` varchar(8) NOT NULL DEFAULT '',
  `cell` smallint(6) NOT NULL DEFAULT '-1',
  `data` varchar(2048) NOT NULL DEFAULT '',
  `version` int(10) unsigned NOT NULL DEFAULT '0',
  `created_ms` bigint(20) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`room_id`, `uid`, `request_id`),
  KEY `replay` (`room_id`, `version`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_match')." (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`, `uid`),
  KEY `wait` (`gkey`, `dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_rating')." (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL,
  `rating` int(11) NOT NULL DEFAULT '1500',
  `wins` int(10) unsigned NOT NULL DEFAULT '0',
  `losses` int(10) unsigned NOT NULL DEFAULT '0',
  `draws` int(10) unsigned NOT NULL DEFAULT '0',
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`, `uid`),
  KEY `board` (`gkey`, `rating`, `wins`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_save')." (
  `uid` int(10) unsigned NOT NULL,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `slot` tinyint(1) unsigned NOT NULL DEFAULT '0',
  `data` mediumtext NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`, `gkey`, `slot`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_chunk')." (
  `token` char(32) NOT NULL DEFAULT '',
  `seq` smallint(5) unsigned NOT NULL DEFAULT '0',
  `data` mediumtext NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`token`, `seq`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_raid_room')." (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `code` char(12) NOT NULL,
  `creator_uid` int unsigned NOT NULL,
  `creator_name` varchar(80) NOT NULL,
  `slot0_uid` int unsigned NOT NULL,
  `slot1_uid` int unsigned NOT NULL DEFAULT '0',
  `slot1_name` varchar(80) NOT NULL DEFAULT '',
  `create_request` char(32) NOT NULL,
  `mode` varchar(4) NOT NULL,
  `rules_version` varchar(40) NOT NULL,
  `status` tinyint unsigned NOT NULL,
  `round_no` tinyint unsigned NOT NULL,
  `version` int unsigned NOT NULL,
  `deadline_ms` bigint unsigned NOT NULL,
  `state_json` text NOT NULL,
  `result_json` text NOT NULL,
  `created_ms` bigint unsigned NOT NULL,
  `started_ms` bigint unsigned NOT NULL DEFAULT '0',
  `updated_ms` bigint unsigned NOT NULL,
  `ended_ms` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `creator_request` (`creator_uid`, `create_request`),
  KEY `expiry` (`status`, `deadline_ms`),
  KEY `creation_rate` (`creator_uid`, `created_ms`),
  KEY `slot0_history` (`slot0_uid`, `updated_ms`, `id`),
  KEY `slot1_history` (`slot1_uid`, `updated_ms`, `id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_raid_member')." (
  `uid` int unsigned NOT NULL,
  `room_id` bigint unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`uid`),
  KEY `room_id` (`room_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_raid_action')." (
  `room_id` bigint unsigned NOT NULL,
  `uid` int unsigned NOT NULL,
  `request_id` char(32) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `action` varchar(8) NOT NULL,
  `round_no` tinyint unsigned NOT NULL,
  `params` varchar(256) NOT NULL,
  `accepted_version` int unsigned NOT NULL,
  `created_ms` bigint unsigned NOT NULL,
  PRIMARY KEY (`room_id`, `uid`, `request_id`),
  KEY `round_actions` (`room_id`, `round_no`)
) ENGINE=InnoDB;
");

// 1.6.0：天使水族馆的伺服器存檔（每人一列）
require_once DISCUZ_PLUGIN('gamecenter').'/lib/aquarium_schema.php';
runquery(gamecenter_aquarium_schema::sql());

require_once DISCUZ_PLUGIN('gamecenter').'/lib/core.php';

gamecenter_core::sync_games(empty($gc_upgrading));   // 全新安裝：內建遊戲直接開放；更新：新遊戲預設不開放

$finish = true;
