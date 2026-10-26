<?php

/**
 * 遊戲中心 gamecenter — 安裝：建自有表、登記內建遊戲。可重複執行（表已存在不重建）。
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
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`token`),
  KEY `uid` (`uid`, `dateline`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_play')." (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT '0',
  `score` int(11) NOT NULL DEFAULT '0',
  `duration` int(10) unsigned NOT NULL DEFAULT '0',
  `verified` tinyint(1) NOT NULL DEFAULT '0',
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
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`, `period`, `pkey`, `uid`),
  KEY `rank` (`gkey`, `period`, `pkey`, `score`, `dateline`)
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
  `yw` char(6) NOT NULL DEFAULT '',
  `result` text NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`gkey`, `yw`)
) ENGINE=InnoDB;
");

require_once __DIR__.'/lib/room_schema.php';
runquery(gamecenter_room_schema::sql());
require_once DISCUZ_PLUGIN('gamecenter').'/lib/core.php';
gamecenter_core::sync_games(empty($gc_upgrading));   // 全新安裝：內建遊戲直接開放；更新：新遊戲預設不開放

$finish = true;
