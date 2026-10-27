<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。仅安装/升级入口执行。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
final class gamecenter_raid_schema {
    public static function sql(): string {
        return "CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_raid_room')." (
 id bigint unsigned NOT NULL AUTO_INCREMENT,
 code char(12) NOT NULL,
 creator_uid int unsigned NOT NULL,
 creator_name varchar(80) NOT NULL,
 slot0_uid int unsigned NOT NULL,
 slot1_uid int unsigned NOT NULL DEFAULT 0,
 slot1_name varchar(80) NOT NULL DEFAULT '',
 create_request char(32) NOT NULL,
 mode varchar(4) NOT NULL,
 rules_version varchar(40) NOT NULL,
 status tinyint unsigned NOT NULL,
 round_no tinyint unsigned NOT NULL,
 version int unsigned NOT NULL,
 deadline_ms bigint unsigned NOT NULL,
 state_json text NOT NULL,
 result_json text NOT NULL,
 created_ms bigint unsigned NOT NULL,
 started_ms bigint unsigned NOT NULL DEFAULT 0,
 updated_ms bigint unsigned NOT NULL,
 ended_ms bigint unsigned DEFAULT NULL,
 PRIMARY KEY (id), UNIQUE KEY code (code), UNIQUE KEY creator_request (creator_uid,create_request),
 KEY expiry (status,deadline_ms), KEY creation_rate (creator_uid,created_ms),
 KEY slot0_history (slot0_uid,updated_ms,id), KEY slot1_history (slot1_uid,updated_ms,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_raid_member')." (
 uid int unsigned NOT NULL, room_id bigint unsigned NOT NULL DEFAULT 0,
 PRIMARY KEY (uid), KEY room_id (room_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ".DB::table('gamecenter_raid_action')." (
 room_id bigint unsigned NOT NULL, uid int unsigned NOT NULL,
 request_id char(32) NOT NULL, fingerprint char(64) NOT NULL,
 action varchar(8) NOT NULL, round_no tinyint unsigned NOT NULL,
 params varchar(256) NOT NULL, accepted_version int unsigned NOT NULL,
 created_ms bigint unsigned NOT NULL,
 PRIMARY KEY (room_id,uid,request_id), KEY round_actions (room_id,round_no)
) ENGINE=InnoDB;";
    }
}
