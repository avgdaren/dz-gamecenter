<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。仅安装/升级调用，禁止请求时自动建表。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
final class gamecenter_aquarium_schema {
    public static function sql(): string {
        return 'CREATE TABLE IF NOT EXISTS '.DB::table('gamecenter_aquarium_save')." (
 uid int unsigned NOT NULL,
 save_version int unsigned NOT NULL,
 config_version varchar(64) NOT NULL,
 state_json mediumtext NOT NULL,
 version bigint unsigned NOT NULL,
 updated_ms bigint unsigned NOT NULL,
 PRIMARY KEY (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;";
    }
}
