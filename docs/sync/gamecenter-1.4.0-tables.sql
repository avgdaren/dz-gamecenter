/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.19-MariaDB, for Win64 (AMD64)
--
-- Host: 127.0.0.1    Database: discuz
-- ------------------------------------------------------
-- Server version	10.11.19-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `pre_gamecenter_game`
--

DROP TABLE IF EXISTS `pre_gamecenter_game`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_game` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `available` tinyint(1) NOT NULL DEFAULT 0,
  `displayorder` smallint(6) NOT NULL DEFAULT 0,
  `credit` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `ratio` int(10) unsigned NOT NULL DEFAULT 0,
  `percap` int(10) unsigned NOT NULL DEFAULT 0,
  `daycap` int(10) unsigned NOT NULL DEFAULT 0,
  `weekrewards` varchar(255) NOT NULL DEFAULT '',
  `maxscore` int(10) unsigned NOT NULL DEFAULT 0,
  `dailytries` smallint(5) unsigned NOT NULL DEFAULT 3,
  `dailyrewards` varchar(255) NOT NULL DEFAULT '',
  `plays` int(10) unsigned NOT NULL DEFAULT 0,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_session`
--

DROP TABLE IF EXISTS `pre_gamecenter_session`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_session` (
  `token` char(32) NOT NULL DEFAULT '',
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `seed` int(10) unsigned NOT NULL DEFAULT 0,
  `startms` bigint(20) unsigned NOT NULL DEFAULT 0,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `mode` varchar(8) NOT NULL DEFAULT '',
  `ref` int(10) unsigned NOT NULL DEFAULT 0,
  `pkey` char(8) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`token`),
  KEY `uid` (`uid`,`dateline`),
  KEY `daily` (`uid`,`gkey`,`mode`,`pkey`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_play`
--

DROP TABLE IF EXISTS `pre_gamecenter_play`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_play` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `duration` int(10) unsigned NOT NULL DEFAULT 0,
  `verified` tinyint(1) NOT NULL DEFAULT 0,
  `mode` varchar(8) NOT NULL DEFAULT '',
  `stats` varchar(500) NOT NULL DEFAULT '',
  `reward` int(10) unsigned NOT NULL DEFAULT 0,
  `ymd` char(8) NOT NULL DEFAULT '',
  `yw` char(6) NOT NULL DEFAULT '',
  `ip` varchar(45) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `gkey` (`gkey`,`dateline`),
  KEY `uid` (`uid`,`gkey`,`dateline`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_best`
--

DROP TABLE IF EXISTS `pre_gamecenter_best`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_best` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `period` char(1) NOT NULL DEFAULT 'a',
  `pkey` char(8) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `rid` int(10) unsigned NOT NULL DEFAULT 0,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`,`period`,`pkey`,`uid`),
  KEY `rank` (`gkey`,`period`,`pkey`,`score`,`dateline`),
  KEY `rid` (`rid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_reward`
--

DROP TABLE IF EXISTS `pre_gamecenter_reward`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_reward` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `kind` varchar(8) NOT NULL DEFAULT '',
  `credit` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `amount` int(11) NOT NULL DEFAULT 0,
  `ymd` char(8) NOT NULL DEFAULT '',
  `note` varchar(255) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`,`gkey`,`ymd`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_settle`
--

DROP TABLE IF EXISTS `pre_gamecenter_settle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_settle` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `yw` varchar(12) NOT NULL DEFAULT '',
  `result` text NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`,`yw`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_replay`
--

DROP TABLE IF EXISTS `pre_gamecenter_replay`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_replay` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `mode` varchar(8) NOT NULL DEFAULT '',
  `pkey` char(8) NOT NULL DEFAULT '',
  `seed` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `data` mediumtext NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_challenge`
--

DROP TABLE IF EXISTS `pre_gamecenter_challenge`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_challenge` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `touid` int(10) unsigned NOT NULL DEFAULT 0,
  `ref` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `toscore` int(11) NOT NULL DEFAULT 0,
  `win` tinyint(1) NOT NULL DEFAULT 0,
  `rid` int(10) unsigned NOT NULL DEFAULT 0,
  `notified` tinyint(1) NOT NULL DEFAULT 0,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `uid` (`uid`,`dateline`),
  KEY `touid` (`touid`,`dateline`),
  KEY `rid` (`rid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_room`
--

DROP TABLE IF EXISTS `pre_gamecenter_room`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_room` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(12) NOT NULL DEFAULT '',
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `kind` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `nplayers` tinyint(1) unsigned NOT NULL DEFAULT 2,
  `players` text NOT NULL,
  `state` mediumtext NOT NULL,
  `seed` int(10) unsigned NOT NULL DEFAULT 0,
  `black_uid` int(10) unsigned NOT NULL DEFAULT 0,
  `white_uid` int(10) unsigned NOT NULL DEFAULT 0,
  `black_name` varchar(80) NOT NULL DEFAULT '',
  `white_name` varchar(80) NOT NULL DEFAULT '',
  `create_request` char(32) NOT NULL DEFAULT '',
  `board` varchar(225) NOT NULL DEFAULT '',
  `status` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `turn` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `winner` int(10) unsigned NOT NULL DEFAULT 0,
  `reason` varchar(16) NOT NULL DEFAULT '',
  `ratings` varchar(500) NOT NULL DEFAULT '',
  `version` int(10) unsigned NOT NULL DEFAULT 1,
  `deadline_ms` bigint(20) unsigned NOT NULL DEFAULT 0,
  `last_cell` smallint(6) NOT NULL DEFAULT -1,
  `created_ms` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_ms` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `creator_request` (`black_uid`,`create_request`),
  KEY `expiry` (`status`,`deadline_ms`),
  KEY `gkey` (`gkey`,`status`,`updated_ms`),
  KEY `black_history` (`black_uid`,`updated_ms`),
  KEY `white_history` (`white_uid`,`updated_ms`),
  KEY `creation_rate` (`black_uid`,`created_ms`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_room_member`
--

DROP TABLE IF EXISTS `pre_gamecenter_room_member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_room_member` (
  `uid` int(10) unsigned NOT NULL,
  `room_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`),
  KEY `room_id` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_room_seat`
--

DROP TABLE IF EXISTS `pre_gamecenter_room_seat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_room_seat` (
  `room_id` bigint(20) unsigned NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `seat` tinyint(1) unsigned NOT NULL DEFAULT 1,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`room_id`,`uid`),
  KEY `uid` (`uid`,`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_room_action`
--

DROP TABLE IF EXISTS `pre_gamecenter_room_action`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_room_action` (
  `room_id` bigint(20) unsigned NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `request_id` char(32) NOT NULL,
  `fingerprint` char(64) NOT NULL DEFAULT '',
  `action` varchar(8) NOT NULL DEFAULT '',
  `cell` smallint(6) NOT NULL DEFAULT -1,
  `data` varchar(2048) NOT NULL DEFAULT '',
  `version` int(10) unsigned NOT NULL DEFAULT 0,
  `created_ms` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`room_id`,`uid`,`request_id`),
  KEY `replay` (`room_id`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_match`
--

DROP TABLE IF EXISTS `pre_gamecenter_match`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_match` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`,`uid`),
  KEY `wait` (`gkey`,`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_rating`
--

DROP TABLE IF EXISTS `pre_gamecenter_rating`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_rating` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL,
  `rating` int(11) NOT NULL DEFAULT 1500,
  `wins` int(10) unsigned NOT NULL DEFAULT 0,
  `losses` int(10) unsigned NOT NULL DEFAULT 0,
  `draws` int(10) unsigned NOT NULL DEFAULT 0,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`,`uid`),
  KEY `board` (`gkey`,`rating`,`wins`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_save`
--

DROP TABLE IF EXISTS `pre_gamecenter_save`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_save` (
  `uid` int(10) unsigned NOT NULL,
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `slot` tinyint(1) unsigned NOT NULL DEFAULT 0,
  `data` mediumtext NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`,`gkey`,`slot`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_chunk`
--

DROP TABLE IF EXISTS `pre_gamecenter_chunk`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_chunk` (
  `token` char(32) NOT NULL DEFAULT '',
  `seq` smallint(5) unsigned NOT NULL DEFAULT 0,
  `data` mediumtext NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`token`,`seq`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_raid_room`
--

DROP TABLE IF EXISTS `pre_gamecenter_raid_room`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_raid_room` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(12) NOT NULL,
  `creator_uid` int(10) unsigned NOT NULL,
  `creator_name` varchar(80) NOT NULL,
  `slot0_uid` int(10) unsigned NOT NULL,
  `slot1_uid` int(10) unsigned NOT NULL DEFAULT 0,
  `slot1_name` varchar(80) NOT NULL DEFAULT '',
  `create_request` char(32) NOT NULL,
  `mode` varchar(4) NOT NULL,
  `rules_version` varchar(40) NOT NULL,
  `status` tinyint(3) unsigned NOT NULL,
  `round_no` tinyint(3) unsigned NOT NULL,
  `version` int(10) unsigned NOT NULL,
  `deadline_ms` bigint(20) unsigned NOT NULL,
  `state_json` text NOT NULL,
  `result_json` text NOT NULL,
  `created_ms` bigint(20) unsigned NOT NULL,
  `started_ms` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_ms` bigint(20) unsigned NOT NULL,
  `ended_ms` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `creator_request` (`creator_uid`,`create_request`),
  KEY `expiry` (`status`,`deadline_ms`),
  KEY `creation_rate` (`creator_uid`,`created_ms`),
  KEY `slot0_history` (`slot0_uid`,`updated_ms`,`id`),
  KEY `slot1_history` (`slot1_uid`,`updated_ms`,`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_raid_member`
--

DROP TABLE IF EXISTS `pre_gamecenter_raid_member`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_raid_member` (
  `uid` int(10) unsigned NOT NULL,
  `room_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`uid`),
  KEY `room_id` (`room_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pre_gamecenter_raid_action`
--

DROP TABLE IF EXISTS `pre_gamecenter_raid_action`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_raid_action` (
  `room_id` bigint(20) unsigned NOT NULL,
  `uid` int(10) unsigned NOT NULL,
  `request_id` char(32) NOT NULL,
  `fingerprint` char(64) NOT NULL,
  `action` varchar(8) NOT NULL,
  `round_no` tinyint(3) unsigned NOT NULL,
  `params` varchar(256) NOT NULL,
  `accepted_version` int(10) unsigned NOT NULL,
  `created_ms` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`room_id`,`uid`,`request_id`),
  KEY `round_actions` (`room_id`,`round_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 18:40:39
