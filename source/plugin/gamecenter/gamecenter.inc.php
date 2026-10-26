<?php

/**
 * 遊戲中心 gamecenter — 前台 plugin.php?id=gamecenter。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 *   （無參數）              遊戲大廳
 *   &mod=play&game=<gkey>   玩遊戲（右側排行榜）
 *   &mod=rank&game=<gkey>   完整排行榜：&period=d/w/a、&pkey=日期或週次、&page=
 *   &mod=my                 我的紀錄與獎勵
 *   op=start / op=submit    POST（ajax，JSON）：開局、交成績
 *   op=board                ajax：排行榜片段（交成績後刷新用）
 * 帳號就是論壇帳號；遊客只能試玩。管理員可以打開還沒開放的遊戲試玩（成績照記，方便測試新遊戲）。
 * 本檔在 plugin.php 的檔案作用域執行，自有變數一律 gc_ 前綴。前台文字照站台語言用简体。
 */

if(!defined('IN_DISCUZ') || !defined('CURMODULE')) {
	exit('Access Denied');
}

require_once __DIR__.'/lib/core.php';
require_once __DIR__.'/lib/view.php';

$gc_op = (string)getgpc('op');
$gc_mod = (string)getgpc('mod');
$gc_gkey = (string)getgpc('game');
$gc_admin = (int)$_G['adminid'] === 1;
$gc_game = $gc_gkey !== '' ? gamecenter_core::game($gc_gkey, !$gc_admin) : null;
if($gc_game && !$gc_game['m']) {
	$gc_game = null;
}

// ---------- ajax ----------
if($gc_op !== '') {
	$gc_json = function($a) {
		while(ob_get_level()) {
			@ob_end_clean();
		}
		header('Content-Type: application/json; charset=utf-8');
		header('Cache-Control: no-store');
		echo json_encode($a, JSON_UNESCAPED_UNICODE);
		exit;
	};
	if($gc_op === 'board') {
		if(!$gc_game) {
			exit;
		}
		while(ob_get_level()) {
			@ob_end_clean();
		}
		header('Content-Type: text/html; charset=utf-8');
		echo gamecenter_view::boards($gc_game, 10);
		exit;
	}
	if(!in_array($gc_op, ['start', 'submit'], true)) {
		$gc_json(['ok' => 0, 'msg' => '未知操作']);
	}
	if($_SERVER['REQUEST_METHOD'] !== 'POST' || (string)getgpc('formhash', 'P') !== formhash()) {
		$gc_json(['ok' => 0, 'msg' => '页面已过期，请重新整理后再试']);
	}
	if(!$gc_game) {
		$gc_json(['ok' => 0, 'msg' => '这个游戏不存在或尚未开放']);
	}
	if($gc_op === 'start') {
		$gc_json(gamecenter_core::start($gc_game));
	}
	$gc_d = $_POST['d'] ?? [];
	if(!is_array($gc_d) || strlen(serialize($gc_d)) > gamecenter_core::MAX_PAYLOAD) {
		$gc_json(['ok' => 0, 'msg' => '成绩数据不正确']);
	}
	$gc_d = array_map(function($x) {
		return is_scalar($x) ? (string)$x : '';
	}, $gc_d);
	$gc_json(gamecenter_core::submit($gc_game, (string)getgpc('token', 'P'), $gc_d));
}

// ---------- 頁面 ----------
gamecenter_core::settle_weeks();
$gc_title = '游戏中心';
$gc_crumb = [];
if($gc_mod === 'play' || $gc_mod === 'rank') {
	if(!$gc_game) {
		showmessage('这个游戏不存在或尚未开放。', 'plugin.php?id=gamecenter');
	}
	$gc_title = $gc_game['m']['name'];
	$gc_crumb[] = [$gc_title, 'plugin.php?id=gamecenter&mod=play&game='.$gc_game['gkey']];
	if($gc_mod === 'rank') {
		$gc_crumb[] = ['排行榜', ''];
		$gc_html = gamecenter_view::rank_page($gc_game);
	} else {
		$gc_html = gamecenter_view::play_page($gc_game);
	}
} elseif($gc_mod === 'my') {
	if(!$_G['uid']) {
		showmessage('to_login', '', [], ['showmsg' => true, 'login' => 1]);
	}
	$gc_title = '我的游戏纪录';
	$gc_crumb[] = [$gc_title, ''];
	$gc_html = gamecenter_view::my_page();
} else {
	$gc_html = gamecenter_view::lobby();
}
$navtitle = dhtmlspecialchars($gc_title);
$gc_css = 'source/plugin/gamecenter/static/gc.css?v='.gamecenter_view::ver();
include template('gamecenter:index');
