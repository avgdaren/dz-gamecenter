-- Author: GPT / Codex; original plugin (C) 2026 Carinoasd.
-- Aquarium only: run after checking the actual table prefix.
CREATE TABLE IF NOT EXISTS pre_gamecenter_aquarium_save (
 uid int unsigned NOT NULL,
 save_version int unsigned NOT NULL,
 config_version varchar(64) NOT NULL,
 state_json mediumtext NOT NULL,
 version bigint unsigned NOT NULL,
 updated_ms bigint unsigned NOT NULL,
 PRIMARY KEY (uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
