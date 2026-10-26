<?php

/**
 * 遊戲中心 gamecenter — 更新：補表（可重複執行）＋登記新放進 games/ 的遊戲。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

$gc_upgrading = true;
include __DIR__.'/install.php';

$finish = true;
