<?php

/**
 * 遊戲中心 gamecenter — 前台 plugin.php?id=gamecenter。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 *   （無參數）              遊戲大廳
 *   &mod=play&game=<gkey>   玩遊戲（右側排行榜）；&mode=daily 每日挑戰、&ghost=<重播 id> 幽靈挑戰
 *   &mod=rank&game=<gkey>   完整排行榜：&period=d/w/a、&pkey=日期或週次、&page=
 *   &mod=my                 我的紀錄與獎勵
 *   op=start / op=submit    POST（ajax，JSON）：開局（mode＝daily／ghost，ref＝重播 id）、交成績
 *   op=chunk                POST：長局分段提交（token、seq、data）（1.4.0）
 *   op=save / load / delsave  POST：伺服器存檔（slot、data）（1.4.0）
 *   op=room                 POST：聯機房間（action＝current／create／join／match／state／move／resign／history／replay）（1.3.0／1.4.0）
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
		if($gc_game['gkey'] === 'aquarium') { exit('水族馆使用独立存档，不提供排行榜。'); }
		while(ob_get_level()) {
			@ob_end_clean();
		}
		header('Content-Type: text/html; charset=utf-8');
		echo gamecenter_view::boards($gc_game, 10, getgpc('mode') === 'daily' ? 'daily' : '');
		exit;
	}
	if(!in_array($gc_op, ['start', 'submit', 'room', 'chunk', 'save', 'load', 'delsave', 'raid', 'aquarium'], true)) {
		$gc_json(['ok' => 0, 'msg' => '未知操作']);
	}
	if($_SERVER['REQUEST_METHOD'] !== 'POST' || (string)getgpc('formhash', 'P') !== formhash()) {
		$gc_json(['ok' => 0, 'msg' => '页面已过期，请重新整理后再试']);
	}
	if(!$gc_game) {
		$gc_json(['ok' => 0, 'msg' => '这个游戏不存在或尚未开放']);
	}
	// 水族馆A阶段仅管理员诊断。独立权威档拒绝走通用槽位、分块或成绩入口。
	if($gc_game['gkey'] === 'aquarium' && !$gc_admin) { $gc_json(['ok'=>0,'code'=>'permission','msg'=>'水族馆底盘测试暂未开放']); }
	if($gc_op === 'aquarium') {
		if($gc_game['gkey'] !== 'aquarium') { $gc_json(['ok'=>0,'code'=>'input','msg'=>'这个游戏不支持水族馆存档']); }
		require_once __DIR__.'/lib/aquarium.php';
		try { $gc_json((new gamecenter_aquarium())->request((int)$_G['uid'],gamecenter_core::can_play()==='',$_POST)); }
		catch(Throwable $e) { $gc_json(['ok'=>0,'code'=>'config','msg'=>'暂时无法读取水族馆，请等待维护']); }
	}
	if($gc_game['gkey'] === 'aquarium') { $gc_json(['ok'=>0,'code'=>'input','msg'=>'请通过水族馆独立存档操作']); }
	// ---- 天使讨伐令：服务端权威战斗，独立记录，不发积分（增量补丁，不影响其它 op） ----
	if($gc_op === 'raid') {
		if($gc_game['gkey'] !== 'raid') {
			$gc_json(['ok' => 0, 'msg' => '这个游戏不支持讨伐']);
		}
		require_once __DIR__.'/lib/raid.php';
		$gc_json((new gamecenter_raid())->request((int)$_G['uid'], (string)($_G['username'] ?? ''), gamecenter_core::can_play() === '', $_POST));
	}
	// 1.4.0：伺服器存檔與分段提交（任何遊戲都能用）
	if($gc_op === 'save') {
		$gc_json(gamecenter_core::save_put($gc_game, (int)getgpc('slot', 'P'), (string)getgpc('data', 'P')));
	}
	if($gc_op === 'load') {
		$gc_json(gamecenter_core::save_get($gc_game, (int)getgpc('slot', 'P')));
	}
	if($gc_op === 'delsave') {
		$gc_json(gamecenter_core::save_del($gc_game, (int)getgpc('slot', 'P')));
	}
	if($gc_op === 'chunk') {
		$gc_json(gamecenter_core::chunk($gc_game, (string)getgpc('token', 'P'), (int)getgpc('seq', 'P'), (string)getgpc('data', 'P')));
	}
	// 1.3.0／1.4.0：聯機對戰走伺服器房間（通用框架，規則在 games/<gkey>/rules.php），不接受單機的開局／交成績
	if($gc_op === 'room') {
		if(!gamecenter_core::is_room($gc_game)) {
			$gc_json(['ok' => 0, 'msg' => '这个游戏不支持房间']);
		}
		require_once __DIR__.'/lib/room.php';
		$gc_json((new gamecenter_room($gc_game))->request((int)$_G['uid'], (string)($_G['username'] ?? ''), gamecenter_core::can_play() === '', $_POST));
	}
	if(gamecenter_core::is_room($gc_game)) {
		$gc_json(['ok' => 0, 'msg' => '请通过房间进行对局']);
	}
	if($gc_game['gkey'] === 'raid') {
		$gc_json(['ok' => 0, 'msg' => '请通过讨伐房间开始挑战；本游戏独立记录，不发积分']);
	}
	if($gc_op === 'start') {
		$gc_mode = (string)getgpc('mode', 'P');
		$gc_json(gamecenter_core::start($gc_game, in_array($gc_mode, ['daily', 'ghost'], true) ? $gc_mode : '', (int)getgpc('ref', 'P')));
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
if($gc_game && $gc_game['gkey']==='aquarium' && !$gc_admin) { showmessage('水族馆底盘测试暂未开放。', 'plugin.php?id=gamecenter'); }
if($gc_game && $gc_game['gkey']==='aquarium' && $gc_mod==='rank') { $gc_mod='play'; }
gamecenter_core::settle_weeks();
$gc_title = '游戏中心';
$gc_crumb = [];
if($gc_mod === 'play' || $gc_mod === 'rank') {
	if(!$gc_game) {
		showmessage('这个游戏不存在或尚未开放。', 'plugin.php?id=gamecenter');
	}
	$gc_title = $gc_game['m']['name'];
	$gc_crumb[] = [$gc_title, 'plugin.php?id=gamecenter&mod=play&game='.$gc_game['gkey']];
	if($gc_mod === 'rank' && gamecenter_core::is_room($gc_game)) {   // 1.4.0：聯機對戰的排行＝等級分榜
		$gc_crumb[] = ['等级分榜', ''];
		$gc_html = gamecenter_view::rating_page($gc_game);
	} elseif($gc_mod === 'rank') {
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
