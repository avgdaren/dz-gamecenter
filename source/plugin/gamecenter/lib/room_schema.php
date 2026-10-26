<?php
/** 作者：GPT / Codex。房间表仅由插件安装/升级入口创建。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
class gamecenter_room_schema {
	public static function sql(): string {
		return "CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room')." (
 id bigint unsigned NOT NULL AUTO_INCREMENT,
 code char(12) NOT NULL,
 black_uid int unsigned NOT NULL,
 white_uid int unsigned NOT NULL DEFAULT 0,
 black_name varchar(80) NOT NULL DEFAULT '',
 white_name varchar(80) NOT NULL DEFAULT '',
 create_request char(32) NOT NULL,
 board varchar(225) NOT NULL,
 status tinyint unsigned NOT NULL DEFAULT 0,
 turn tinyint unsigned NOT NULL DEFAULT 1,
 winner int unsigned NOT NULL DEFAULT 0,
 reason varchar(16) NOT NULL DEFAULT '',
 version int unsigned NOT NULL DEFAULT 1,
 deadline_ms bigint unsigned NOT NULL,
 last_cell smallint NOT NULL DEFAULT -1,
 created_ms bigint unsigned NOT NULL,
 updated_ms bigint unsigned NOT NULL,
 PRIMARY KEY (id), UNIQUE KEY code (code), UNIQUE KEY creator_request (black_uid,create_request),
 KEY expiry (status,deadline_ms), KEY black_history (black_uid,updated_ms), KEY white_history (white_uid,updated_ms), KEY creation_rate (black_uid,created_ms)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room_member')." (
 uid int unsigned NOT NULL, room_id bigint unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (uid), KEY room_id (room_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_room_action')." (
 room_id bigint unsigned NOT NULL, uid int unsigned NOT NULL,
 request_id char(32) NOT NULL, fingerprint char(64) NOT NULL,
 action varchar(8) NOT NULL, cell smallint NOT NULL DEFAULT -1,
 version int unsigned NOT NULL, created_ms bigint unsigned NOT NULL,
 PRIMARY KEY (room_id,uid,request_id), KEY replay (room_id,version)
) ENGINE=InnoDB;";
	}
}
