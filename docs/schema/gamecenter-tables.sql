/*M!999999\- enable the sandbox mode */ 

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
  `plays` int(10) unsigned NOT NULL DEFAULT 0,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
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
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`token`),
  KEY `uid` (`uid`,`dateline`),
  KEY `dateline` (`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
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
  `reward` int(10) unsigned NOT NULL DEFAULT 0,
  `ymd` char(8) NOT NULL DEFAULT '',
  `yw` char(6) NOT NULL DEFAULT '',
  `ip` varchar(45) NOT NULL DEFAULT '',
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `gkey` (`gkey`,`dateline`),
  KEY `uid` (`uid`,`gkey`,`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `pre_gamecenter_best`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_best` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `period` char(1) NOT NULL DEFAULT 'a',
  `pkey` char(8) NOT NULL DEFAULT '',
  `uid` int(10) unsigned NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL DEFAULT 0,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`,`period`,`pkey`,`uid`),
  KEY `rank` (`gkey`,`period`,`pkey`,`score`,`dateline`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
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
DROP TABLE IF EXISTS `pre_gamecenter_settle`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pre_gamecenter_settle` (
  `gkey` varchar(32) NOT NULL DEFAULT '',
  `yw` char(6) NOT NULL DEFAULT '',
  `result` text NOT NULL,
  `dateline` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`gkey`,`yw`)
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

