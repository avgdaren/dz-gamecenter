<?php

/**
 * 遊戲中心 gamecenter — 後台「遊戲管理」。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 遊戲：重新掃描 games/ 資料夾、開放／關閉、排序、每款的積分獎勵與週榜獎勵、清空排行。
 * 紀錄：每局成績（可依遊戲、UID 篩選），刪掉作弊成績後自動重算該會員的排行。
 * 獎勵：每局獎勵與週榜獎勵的發放紀錄；週榜結算結果。
 * 水族馆存檔（1.8.1）：配置版本分布、維護開關、全部存檔分批檢查（異常唯讀／可自動修）、單一 UID 查看；除維護開關外都唯讀。
 */

if(!defined('IN_DISCUZ') || !defined('IN_ADMINCP')) {
	exit('Access Denied');
}
if((int)$_G['adminid'] !== 1) {
	cpmsg('只有管理員可以使用遊戲管理', '', 'error');
}

require_once DISCUZ_PLUGIN('gamecenter').'/lib/core.php';
require_once DISCUZ_PLUGIN('gamecenter').'/lib/room.php';

$gc_base = ADMINSCRIPT.'?action=plugins&operation=config&do='.(int)$pluginid.'&identifier=gamecenter&pmod=admincp';
$gc_e = function($s) {
	return dhtmlspecialchars((string)$s);
};
$gc_tab = (string)getgpc('tab');
$gc_aq = is_file(DISCUZ_PLUGIN('gamecenter').'/lib/aquarium.php') && is_dir(DISCUZ_PLUGIN('gamecenter').'/games/aquarium');
$gc_tab = in_array($gc_tab, ['games', 'plays', 'rewards', 'rooms', 'aquarium'], true) && ($gc_tab !== 'aquarium' || $gc_aq) ? $gc_tab : 'games';
$gc_fh = '<input type="hidden" name="formhash" value="'.FORMHASH.'">';

/* ---------- 動作 ---------- */
if(submitcheck('gcscansubmit')) {
	$gc_add = gamecenter_core::sync_games(false);
	cpmsg($gc_add ? '找到新遊戲：'.$gc_e(implode('、', $gc_add)).'（預設不開放，設定好再勾「開放」）' : '沒有找到新遊戲', $gc_base, 'succeed');
}
if(submitcheck('gcsavesubmit')) {
	foreach((array)($_POST['g'] ?? []) as $gc_k => $gc_v) {
		if(!gamecenter_core::valid_key($gc_k) || !is_array($gc_v)) {
			continue;
		}
		// 檔案已經刪掉的遊戲：勾「移除」就連同成績、排行一起清掉（獎勵紀錄保留）
		if(!empty($gc_v['remove']) && !gamecenter_core::manifest($gc_k)) {
			foreach(['gamecenter_game', 'gamecenter_best', 'gamecenter_play', 'gamecenter_session', 'gamecenter_settle', 'gamecenter_rating', 'gamecenter_match', 'gamecenter_save'] as $gc_t) {
				DB::delete($gc_t, DB::field('gkey', $gc_k));
			}
			continue;
		}
		$gc_rw = implode(',', array_filter(array_map('intval', preg_split('/[,，\s]+/u', (string)($gc_v['weekrewards'] ?? ''), -1, PREG_SPLIT_NO_EMPTY)), function($x) {
			return $x > 0;
		}));
		$gc_old = DB::fetch_first('SELECT weekrewards, dailyrewards FROM %t WHERE gkey=%s', ['gamecenter_game', $gc_k]);
		$gc_dr = implode(',', array_filter(array_map('intval', preg_split('/[,，\s]+/u', (string)($gc_v['dailyrewards'] ?? ''), -1, PREG_SPLIT_NO_EMPTY)), function($x) {
			return $x > 0;
		}));
		DB::update('gamecenter_game', [
			'available' => empty($gc_v['available']) ? 0 : 1,
			'displayorder' => (int)($gc_v['displayorder'] ?? 0),
			'credit' => max(0, min(8, (int)($gc_v['credit'] ?? 0))),
			'ratio' => max(0, (int)($gc_v['ratio'] ?? 0)),
			'percap' => max(0, (int)($gc_v['percap'] ?? 0)),
			'daycap' => max(0, (int)($gc_v['daycap'] ?? 0)),
			'weekrewards' => substr($gc_rw, 0, 255),
			'maxscore' => max(0, (int)($gc_v['maxscore'] ?? 0)),
			'dailytries' => max(0, min(20, (int)($gc_v['dailytries'] ?? 0))),
			'dailyrewards' => substr($gc_dr, 0, 255),
		], DB::field('gkey', $gc_k));
		// 每日挑戰獎勵從「沒設」改成「有設」：昨天沒公布獎勵，標記成已結算，從今天開始才發
		if($gc_dr !== '' && $gc_old && $gc_old['dailyrewards'] === '') {
			DB::query('INSERT IGNORE INTO %t (gkey, yw, result, dateline) VALUES (%s, %s, %s, %d)',
				['gamecenter_settle', $gc_k, gamecenter_core::ymd(TIMESTAMP - 86400), '', TIMESTAMP]);
		}
		// 週榜獎勵從「沒設」改成「有設」：上週當時沒公布獎勵，標記成已結算，從這週開始才發
		if($gc_rw !== '' && $gc_old && $gc_old['weekrewards'] === '') {
			DB::query('INSERT IGNORE INTO %t (gkey, yw, result, dateline) VALUES (%s, %s, %s, %d)',
				['gamecenter_settle', $gc_k, gamecenter_core::yw(TIMESTAMP - 7 * 86400), '', TIMESTAMP]);
		}
	}
	cpmsg('遊戲設定已儲存', $gc_base, 'succeed');
}
if(submitcheck('gcclearsubmit')) {
	$gc_k = (string)getgpc('gkey', 'P');
	$gc_what = (string)getgpc('what', 'P');
	if(gamecenter_core::valid_key($gc_k)) {
		if($gc_what === 'all') {
			DB::delete('gamecenter_best', DB::field('gkey', $gc_k));
			DB::delete('gamecenter_play', DB::field('gkey', $gc_k));
			DB::delete('gamecenter_rating', DB::field('gkey', $gc_k));   // 1.4.0：聯機遊戲的「全部」＝等級分（對局紀錄保留）
			DB::update('gamecenter_game', ['plays' => 0], DB::field('gkey', $gc_k));
		} else {
			DB::query('DELETE FROM %t WHERE gkey=%s AND period=%s AND pkey=%s', ['gamecenter_best', $gc_k, 'w', gamecenter_core::yw()]);
		}
	}
	cpmsg($gc_what === 'all' ? '已清空這個遊戲的所有成績與排行' : '已清空這個遊戲的本週排行（總榜與每局紀錄保留）', $gc_base, 'succeed');
}
if(submitcheck('gcdelsubmit')) {
	$gc_ids = array_filter(array_map('intval', (array)($_POST['ids'] ?? [])));
	$gc_touch = [];
	if($gc_ids) {
		foreach(DB::fetch_all('SELECT id, gkey, uid FROM %t WHERE '.DB::field('id', $gc_ids), ['gamecenter_play']) as $gc_r) {
			$gc_touch[$gc_r['gkey'].'|'.$gc_r['uid']] = [$gc_r['gkey'], (int)$gc_r['uid']];
		}
		DB::delete('gamecenter_play', DB::field('id', $gc_ids));
		foreach($gc_touch as [$gc_k, $gc_u]) {
			gamecenter_core::rebuild_best($gc_k, $gc_u);
		}
	}
	cpmsg('已刪除 '.count($gc_ids).' 局成績，並重算 '.count($gc_touch).' 位會員的排行（已發的積分不收回，要收回請到會員積分手動調整）',
		$gc_base.'&tab=plays&gkey='.rawurlencode((string)getgpc('fgkey', 'P')).'&uid='.(int)getgpc('fuid', 'P'), 'succeed');
}

/* ---------- 畫面 ---------- */
// ---------- 1.8.1 水族馆存檔 ----------
if($gc_aq) {
	require_once DISCUZ_PLUGIN('gamecenter').'/lib/aquarium.php';
	$gc_ab = $gc_base.'&tab=aquarium';
	$gc_maint = gamecenter_aquarium_configs::maintenance_admin_file();
	$gc_maint_manual = gamecenter_aquarium_configs::maintenance_file();
	if(submitcheck('gcaqmaintsubmit')) {
		if((int)getgpc('on', 'P')) {
			if(!is_dir(dirname($gc_maint))) {
				@mkdir(dirname($gc_maint), 0777, true);
			}
			@file_put_contents($gc_maint, date('c'));
			clearstatcache();
			cpmsg(is_file($gc_maint) ? '水族馆已進入維護（玩家只看到維護提示，存檔不動）' : '寫不進 games/aquarium/data/stats/（資料夾權限），請讓網站帳號可寫入，或手動在 games/aquarium/data/ 放一個 MAINTENANCE 檔案', $gc_ab, is_file($gc_maint) ? 'succeed' : 'error');
		}
		foreach([$gc_maint, $gc_maint_manual] as $gc_f) {
			if(is_file($gc_f)) {
				@unlink($gc_f);
			}
		}
		clearstatcache();
		cpmsg(gamecenter_aquarium_configs::maintenance() ? '刪不掉 games/aquarium/data/MAINTENANCE（資料夾權限），請手動刪除' : '水族馆已結束維護', $gc_ab, gamecenter_aquarium_configs::maintenance() ? 'error' : 'succeed');
	}
	// 全部存檔分批檢查：每批 300 列，結果暫存在快取 gamecenter_aqscan，續跑網址帶 formhash
	$gc_scanstep = function($gc_cursor) use ($gc_ab) {
		require_once libfile('function/cache');
		loadcache('gamecenter_aqscan');
		$gc_st = $gc_cursor === 0 ? ['total' => 0, 'verdict' => [], 'why' => [], 'uids' => [], 'started' => TIMESTAMP, 'done' => 0] : (array)getglobal('cache/gamecenter_aqscan');
		$gc_svc = new gamecenter_aquarium();
		$gc_rows = DB::fetch_all('SELECT uid,save_version,config_version,state_json,version,updated_ms FROM %t WHERE uid>%d ORDER BY uid ASC LIMIT 300', ['gamecenter_aquarium_save', $gc_cursor]);
		foreach($gc_rows as $gc_r) {
			foreach(['uid', 'save_version', 'version', 'updated_ms'] as $gc_k) {
				$gc_r[$gc_k] = (int)$gc_r[$gc_k];
			}
			list($gc_v, $gc_w) = $gc_svc->inspect($gc_r);
			$gc_st['total']++;
			$gc_st['verdict'][$gc_v] = ($gc_st['verdict'][$gc_v] ?? 0) + 1;
			if($gc_v !== 'ok') {
				$gc_key = $gc_v.'｜'.preg_replace('/:.*/', '', (string)$gc_w);
				$gc_st['why'][$gc_key] = ($gc_st['why'][$gc_key] ?? 0) + 1;
				if(count($gc_st['uids'][$gc_key] ?? []) < 30) {
					$gc_st['uids'][$gc_key][] = $gc_r['uid'];
				}
			}
			$gc_cursor = $gc_r['uid'];
		}
		$gc_st['done'] = count($gc_rows) < 300 ? TIMESTAMP : 0;
		savecache('gamecenter_aqscan', $gc_st);
		if(!$gc_st['done']) {
			cpmsg('已檢查 '.(int)$gc_st['total'].' 份存檔，繼續中…', $gc_ab.'&aqscan=1&cursor='.$gc_cursor.'&formhash='.FORMHASH, 'loadingform');
		}
		cpmsg('檢查完成：共 '.(int)$gc_st['total'].' 份存檔', $gc_ab, 'succeed');
	};
	if(submitcheck('gcaqscansubmit')) {
		$gc_scanstep(0);
	}
	if(getgpc('aqscan') && (string)getgpc('formhash') === FORMHASH) {
		$gc_scanstep(max(0, (int)getgpc('cursor')));
	}
}

echo '<style>.gcad td,.gcad th{padding:6px 8px;vertical-align:middle}.gcad input.t{width:60px}.gcad input.w{width:110px}.gcad .m{color:#888}.gctabs a{display:inline-block;padding:6px 14px;margin-right:4px;border:1px solid #ccc;border-bottom:0;border-radius:6px 6px 0 0;text-decoration:none}.gctabs a.on{background:#2f7ae5;color:#fff;border-color:#2f7ae5}</style>';
echo '<div class="gctabs" style="margin:6px 0 0">';
foreach(['games' => '遊戲', 'plays' => '成績紀錄', 'rewards' => '獎勵與週榜結算', 'rooms' => '聯機對局'] + ($gc_aq ? ['aquarium' => '水族馆存檔'] : []) as $gc_k => $gc_t) {
	echo '<a href="'.$gc_base.'&tab='.$gc_k.'"'.($gc_k === $gc_tab ? ' class="on"' : '').'>'.$gc_t.'</a>';
}
echo '</div>';

$gc_credits = ['0' => '不發'];
foreach((array)$_G['setting']['extcredits'] as $gc_i => $gc_c) {
	$gc_credits[$gc_i] = $gc_i.' '.$gc_c['title'];
}

if($gc_tab === 'games') {
	$gc_games = gamecenter_core::games(false);
	echo '<form method="post" action="'.$gc_base.'">'.$gc_fh.'<table class="tb tb2 gcad"><tr class="header"><th>開放</th><th>排序</th><th>遊戲</th><th>校驗</th><th>獎勵積分</th>'
		.'<th>每 N 分得 1 點</th><th>單局上限</th><th>每人每天上限</th><th>週榜獎勵（第1名,第2名,…）</th><th>分數上限</th><th>每日挑戰次數</th><th>每日挑戰獎勵</th><th>局數</th></tr>';
	foreach($gc_games as $gc_k => $gc_g) {
		$gc_m = $gc_g['m'];
		$gc_n = 'g['.$gc_k.']';
		$gc_sel = '<select name="'.$gc_n.'[credit]">';
		foreach($gc_credits as $gc_i => $gc_t) {
			$gc_sel .= '<option value="'.$gc_i.'"'.((int)$gc_g['credit'] === (int)$gc_i ? ' selected' : '').'>'.$gc_e($gc_t).'</option>';
		}
		$gc_sel .= '</select>';
		echo '<tr><td><input type="checkbox" class="checkbox" name="'.$gc_n.'[available]" value="1"'.($gc_g['available'] ? ' checked' : '').($gc_m ? '' : ' disabled').'></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[displayorder]" value="'.(int)$gc_g['displayorder'].'"></td>'
			.'<td>'.($gc_m ? '<a href="plugin.php?id=gamecenter&mod=play&game='.$gc_k.'" target="_blank"><b>'.$gc_e($gc_m['name']).'</b></a> <span class="m">'.$gc_k.' v'.$gc_e($gc_m['version']).'</span>'
				.($gc_m['author'] ? '<br><span class="m">作者 '.$gc_e($gc_m['author']).'</span>' : '').($gc_m && gamecenter_core::standalone($gc_g) !== '' ? '<br><span class="m">獨立記錄（服務端結算／存檔）：不進排行、不發積分（下面的積分設定對它無效）</span>' : '')
				.($gc_m && !empty($gc_m['room']) ? '<br><span class="m">聯機對戰（'.(int)gamecenter_room::config($gc_g)['players'].' 人、每回合 '.intdiv(gamecenter_room::config($gc_g)['turn_ms'], 1000).' 秒）：等級分制，不進單機排行、不發積分（下面的積分設定對它無效）'.(gamecenter_room::rules_class($gc_k) ? '' : '<br><b style="color:#c00">缺少 rules.php，無法對局</b>').'</span>' : '')
				: '<b style="color:#c00">'.$gc_k.'：檔案不見了</b><br><span class="m">games/'.$gc_k.'/ 缺 game.json 或腳本</span>'
					.'<br><label><input type="checkbox" class="checkbox" name="'.$gc_n.'[remove]" value="1"> 移除（連同成績與排行）</label>').'</td>'
			.'<td>'.($gc_m && (!empty($gc_m['room']) || gamecenter_core::standalone($gc_g) !== '') ? '<span style="color:#1a9e5c">服务端对局</span>' : ($gc_m && $gc_m['verified'] ? '<span style="color:#1a9e5c">伺服器重播</span>' : '<span style="color:#c60" title="成績由瀏覽器回報，可被偽造；有發積分時請設分數上限">無</span>')).'</td>'
			.'<td>'.$gc_sel.'</td>'
			.'<td><input class="txt t" name="'.$gc_n.'[ratio]" value="'.(int)$gc_g['ratio'].'"></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[percap]" value="'.(int)$gc_g['percap'].'"></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[daycap]" value="'.(int)$gc_g['daycap'].'"></td>'
			.'<td><input class="txt w" name="'.$gc_n.'[weekrewards]" value="'.$gc_e($gc_g['weekrewards']).'" placeholder="例 100,50,30"></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[maxscore]" value="'.(int)$gc_g['maxscore'].'"></td>'
			.(gamecenter_core::supports($gc_g)
				? '<td><input class="txt t" name="'.$gc_n.'[dailytries]" value="'.(int)$gc_g['dailytries'].'"></td>'
					.'<td><input class="txt w" name="'.$gc_n.'[dailyrewards]" value="'.$gc_e($gc_g['dailyrewards']).'" placeholder="例 50,30,20"></td>'
				: '<td colspan="2" class="m">不支援挑戰<input type="hidden" name="'.$gc_n.'[dailytries]" value="'.(int)$gc_g['dailytries'].'"><input type="hidden" name="'.$gc_n.'[dailyrewards]" value="'.$gc_e($gc_g['dailyrewards']).'"></td>')
			.'<td>'.(int)$gc_g['plays'].'</td></tr>';
	}
	if(!$gc_games) {
		echo '<tr><td colspan="13">還沒有登記任何遊戲，按下方「重新掃描」。</td></tr>';
	}
	echo '<tr><td colspan="13"><input type="submit" class="btn" name="gcsavesubmit" value="儲存"></td></tr></table></form>';
	echo '<div class="m" style="margin:6px 0 14px;line-height:1.8;color:#666">「每 N 分得 1 點」填 0＝每局不發積分；上限填 0＝不限。週榜在下一週第一個有人打開遊戲中心時結算，每週只結算一次；'
		.'「分數上限」只對沒有伺服器校驗的遊戲有用（超過的成績不收），0＝不限。<br>'
		.'「每日挑戰次數」0＝關閉每日挑戰；每日挑戰與幽靈挑戰的成績不進一般排行、不發每局積分。「每日挑戰獎勵」隔天第一個有人打開遊戲中心時結算昨天的挑戰榜。<br>新遊戲：把資料夾放進 <code>source/plugin/gamecenter/games/&lt;識別碼&gt;/</code> 再按「重新掃描」；'
		.'新遊戲預設不開放，管理員可以先從上面的名稱連結進去試玩。寫法見插件內的 <code>DEVELOP.md</code>。</div>';
	$gc_freed = gamecenter_core::cleanup();
	$gc_rs = DB::fetch_first('SELECT COUNT(*) n, SUM(LENGTH(data)) b FROM %t', ['gamecenter_replay']);
	echo '<div class="m" style="margin:0 0 12px;color:#666">挑戰用的重播：'.(int)$gc_rs['n'].' 筆，約 '.round((int)$gc_rs['b'] / 1024).' KB'
		.($gc_freed ? '（剛清掉 '.$gc_freed.' 筆過期的）' : '').'。只保留還掛在排行上的：總榜、近 8 週週榜、近 7 天日榜、近 30 天每日挑戰榜與挑戰紀錄。</div>';
	echo '<form method="post" action="'.$gc_base.'" style="display:inline">'.$gc_fh.'<input type="submit" class="btn" name="gcscansubmit" value="重新掃描 games/ 資料夾"></form>';
	if($gc_games) {
		echo '<form method="post" action="'.$gc_base.'" style="display:inline;margin-left:20px" onsubmit="return confirm(\'確定要清空嗎？\')">'.$gc_fh
			.'清空排行：<select name="gkey">';
		foreach($gc_games as $gc_k => $gc_g) {
			echo '<option value="'.$gc_k.'">'.$gc_e($gc_g['m'] ? $gc_g['m']['name'] : $gc_k).'</option>';
		}
		echo '</select> <select name="what"><option value="week">只清本週排行</option><option value="all">全部成績與排行</option></select> '
			.'<input type="submit" class="btn" name="gcclearsubmit" value="清空"></form>';
	}
}

if($gc_tab === 'plays') {
	$gc_fk = (string)getgpc('gkey');
	$gc_fu = (int)getgpc('uid');
	$gc_where = '1';
	$gc_args = ['gamecenter_play', 'common_member'];
	if(gamecenter_core::valid_key($gc_fk)) {
		$gc_where .= ' AND p.gkey=%s';
		$gc_args[] = $gc_fk;
	}
	if($gc_fu) {
		$gc_where .= ' AND p.uid=%d';
		$gc_args[] = $gc_fu;
	}
	$gc_page = max(1, (int)getgpc('page'));
	$gc_total = (int)DB::result_first('SELECT COUNT(*) FROM %t p WHERE '.$gc_where, array_merge(['gamecenter_play'], array_slice($gc_args, 2)));
	$gc_rows = DB::fetch_all('SELECT p.*, m.username FROM %t p LEFT JOIN %t m ON m.uid=p.uid WHERE '.$gc_where.' ORDER BY p.id DESC '.DB::limit(($gc_page - 1) * 50, 50), $gc_args);
	echo '<form method="get" action="'.ADMINSCRIPT.'" style="margin:10px 0"><input type="hidden" name="action" value="plugins"><input type="hidden" name="operation" value="config">'
		.'<input type="hidden" name="do" value="'.(int)$pluginid.'"><input type="hidden" name="identifier" value="gamecenter"><input type="hidden" name="pmod" value="admincp"><input type="hidden" name="tab" value="plays">'
		.'遊戲識別碼 <input class="txt" style="width:100px" name="gkey" value="'.$gc_e($gc_fk).'"> UID <input class="txt" style="width:80px" name="uid" value="'.($gc_fu ?: '').'"> <input type="submit" class="btn" value="篩選"></form>';
	echo '<form method="post" action="'.$gc_base.'" onsubmit="return confirm(\'確定刪除勾選的成績？\')">'.$gc_fh.'<input type="hidden" name="fgkey" value="'.$gc_e($gc_fk).'"><input type="hidden" name="fuid" value="'.$gc_fu.'">'
		.'<table class="tb tb2 gcad"><tr class="header"><th></th><th>ID</th><th>時間</th><th>遊戲</th><th>模式</th><th>會員</th><th>成績</th><th>詳情</th><th>用時</th><th>校驗</th><th>獎勵</th><th>IP</th></tr>';
	foreach($gc_rows as $gc_r) {
		echo '<tr><td><input type="checkbox" class="checkbox" name="ids[]" value="'.(int)$gc_r['id'].'"></td><td>'.(int)$gc_r['id'].'</td><td>'.dgmdate((int)$gc_r['dateline'], 'Y-m-d H:i:s').'</td>'
			.'<td>'.$gc_e($gc_r['gkey']).'</td><td>'.(['' => '一般', 'daily' => '每日挑戰', 'ghost' => '幽靈挑戰'][$gc_r['mode']] ?? $gc_e($gc_r['mode'])).'</td><td><a href="'.$gc_base.'&tab=plays&uid='.(int)$gc_r['uid'].'">'.$gc_e($gc_r['username']).'</a> <span class="m">('.(int)$gc_r['uid'].')</span></td>'
			.'<td><b>'.(int)$gc_r['score'].'</b></td><td class="m">'.$gc_e(gamecenter_core::stats_text($gc_r['stats'] ?? '')).'</td><td>'.gamecenter_core::fmt_duration((int)$gc_r['duration']).'</td><td>'.($gc_r['verified'] ? '✔' : '-').'</td>'
			.'<td>'.($gc_r['reward'] ? '+'.(int)$gc_r['reward'] : '-').'</td><td>'.$gc_e($gc_r['ip']).'</td></tr>';
	}
	if(!$gc_rows) {
		echo '<tr><td colspan="12">沒有紀錄</td></tr>';
	}
	echo '<tr><td colspan="12"><input type="submit" class="btn" name="gcdelsubmit" value="刪除勾選的成績並重算排行"> <span class="m">共 '.$gc_total.' 局</span></td></tr></table></form>';
	echo multi($gc_total, 50, $gc_page, $gc_base.'&tab=plays&gkey='.rawurlencode($gc_fk).'&uid='.$gc_fu);
}

if($gc_tab === 'rewards') {
	$gc_page = max(1, (int)getgpc('page'));
	$gc_total = (int)DB::result_first('SELECT COUNT(*) FROM %t', ['gamecenter_reward']);
	$gc_rows = DB::fetch_all('SELECT r.*, m.username FROM %t r LEFT JOIN %t m ON m.uid=r.uid ORDER BY r.id DESC '.DB::limit(($gc_page - 1) * 50, 50), ['gamecenter_reward', 'common_member']);
	echo '<h3 style="margin:12px 0 6px">週榜／每日挑戰結算</h3><table class="tb tb2 gcad"><tr class="header"><th>遊戲</th><th>區間</th><th>結算時間</th><th>名次與獎勵</th></tr>';
	$gc_settles = DB::fetch_all('SELECT * FROM %t ORDER BY dateline DESC LIMIT 20', ['gamecenter_settle']);
	foreach($gc_settles as $gc_s) {
		$gc_list = [];
		foreach((array)json_decode($gc_s['result'], true) as $gc_x) {
			$gc_list[] = '第'.(int)$gc_x['rank'].' '.$gc_e($gc_x['username']).'（'.(int)$gc_x['score'].'）'.($gc_x['amount'] ? ' +'.(int)$gc_x['amount'] : ' 不發（用戶組排除）');
		}
		$gc_lbl = strlen($gc_s['yw']) === 8 ? '每日挑戰 '.substr($gc_s['yw'], 0, 4).'-'.substr($gc_s['yw'], 4, 2).'-'.substr($gc_s['yw'], 6) : '週榜 '.gamecenter_core::week_label($gc_s['yw']);
		echo '<tr><td>'.$gc_e($gc_s['gkey']).'</td><td>'.$gc_e($gc_lbl).($gc_s['result'] === '' ? '<br><span class="m">（獎勵設定前的區間，不發）</span>' : '').'</td><td>'.dgmdate((int)$gc_s['dateline'], 'Y-m-d H:i').'</td><td>'.($gc_list ? implode('<br>', $gc_list) : '<span class="m">那週沒有人上榜</span>').'</td></tr>';
	}
	if(!$gc_settles) {
		echo '<tr><td colspan="4">還沒有結算過</td></tr>';
	}
	echo '</table><h3 style="margin:16px 0 6px">發放紀錄</h3><table class="tb tb2 gcad"><tr class="header"><th>時間</th><th>會員</th><th>遊戲</th><th>來源</th><th>積分</th></tr>';
	foreach($gc_rows as $gc_r) {
		echo '<tr><td>'.dgmdate((int)$gc_r['dateline'], 'Y-m-d H:i:s').'</td><td>'.$gc_e($gc_r['username']).' <span class="m">('.(int)$gc_r['uid'].')</span></td><td>'.$gc_e($gc_r['gkey']).'</td>'
			.'<td>'.(['week' => '週榜：', 'daily' => '每日挑戰：'][$gc_r['kind']] ?? '每局：').$gc_e($gc_r['note']).'</td><td>'.$gc_e(gamecenter_core::credit_name((int)$gc_r['credit'])).' +'.(int)$gc_r['amount'].'</td></tr>';
	}
	if(!$gc_rows) {
		echo '<tr><td colspan="5">沒有紀錄</td></tr>';
	}
	echo '</table>'.multi($gc_total, 50, $gc_page, $gc_base.'&tab=rewards');
}

if(submitcheck('gcratingsubmit')) {
	$gc_k = (string)getgpc('gkey', 'P');
	if(gamecenter_core::valid_key($gc_k)) {
		DB::delete('gamecenter_rating', DB::field('gkey', $gc_k));
		cpmsg('已清空「'.$gc_e($gc_k).'」的等級分（對局紀錄保留）', $gc_base.'&tab=rooms', 'succeed');
	}
	cpmsg('遊戲識別碼不正確', $gc_base.'&tab=rooms', 'error');
}

if($gc_tab === 'rooms') {
	$gc_games = gamecenter_core::games(false);
	echo '<div class="m" style="margin:10px 0;color:#666">聯機對戰的對局都由伺服器判定並保存。逾時房間在有人讀取時即時判定，另有計劃任務「gamecenter:cron_room」每 5 分鐘清一次沒人再打開的房間；配對佇列 '.gamecenter_room::QUEUE_TTL.' 秒沒心跳就移除。</div>';
	echo '<table class="tb tb2 gcad"><tr class="header"><th>遊戲</th><th>規則檔</th><th>設定</th><th>已結束對局</th><th>進行中</th><th>配對佇列</th><th>有等級分的人</th><th></th></tr>';
	foreach($gc_games as $gc_k => $gc_g) {
		if(!$gc_g['m'] || !gamecenter_core::is_room($gc_g)) {
			continue;
		}
		$gc_c = gamecenter_room::config($gc_g);
		echo '<tr><td>'.$gc_e($gc_g['m']['name']).' <span class="m">'.$gc_e($gc_k).'</span></td><td>'.(gamecenter_room::rules_class($gc_k) ? '✔' : '<b style="color:#c00">缺</b>').'</td>'
			.'<td>'.(int)$gc_c['players'].' 人、每回合 '.intdiv($gc_c['turn_ms'], 1000).' 秒、等人 '.intdiv($gc_c['wait_ms'], 1000).' 秒、'.($gc_c['rating'] ? '算等級分' : '不算等級分').'</td>'
			.'<td>'.(int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND status=2', ['gamecenter_room', $gc_k]).'</td>'
			.'<td>'.(int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND status<2', ['gamecenter_room', $gc_k]).'</td>'
			.'<td>'.(int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND dateline>%d', ['gamecenter_match', $gc_k, TIMESTAMP - gamecenter_room::QUEUE_TTL]).'</td>'
			.'<td>'.gamecenter_room::rating_count($gc_k).'</td>'
			.'<td><form method="post" action="'.$gc_base.'&tab=rooms" style="display:inline" onsubmit="return confirm(\'確定清空這款遊戲的等級分？\')">'.$gc_fh.'<input type="hidden" name="gkey" value="'.$gc_k.'"><input type="submit" class="btn" name="gcratingsubmit" value="清空等級分"></form></td></tr>';
	}
	echo '</table>';
	$gc_page = max(1, (int)getgpc('page'));
	$gc_total = (int)DB::result_first('SELECT COUNT(*) FROM %t', ['gamecenter_room']);
	$gc_rows = DB::fetch_all('SELECT * FROM %t ORDER BY id DESC '.DB::limit(($gc_page - 1) * 50, 50), ['gamecenter_room']);
	$gc_st = [0 => '等人', 1 => '進行中', 2 => '結束', 3 => '取消'];
	echo '<h3 style="margin:16px 0 6px">最近對局</h3><table class="tb tb2 gcad"><tr class="header"><th>時間</th><th>遊戲</th><th>房間</th><th>玩家</th><th>狀態</th><th>結果</th><th>步數</th><th>等級分變動</th></tr>';
	foreach($gc_rows as $gc_r) {
		$gc_rt = [];
		foreach((array)json_decode((string)$gc_r['ratings'], true) as $gc_x) {
			$gc_rt[] = (int)$gc_x['uid'].'：'.(int)$gc_x['before'].'→'.(int)$gc_x['after'];
		}
		echo '<tr><td>'.dgmdate((int)($gc_r['updated_ms'] / 1000), 'Y-m-d H:i').'</td><td>'.$gc_e($gc_r['gkey']).'</td><td><code>'.$gc_e($gc_r['code']).'</code>'.((int)$gc_r['kind'] === 1 ? ' <span class="m">配對</span>' : '').'</td>'
			.'<td>'.$gc_e(gamecenter_room::players_text($gc_r)).'</td><td>'.($gc_st[(int)$gc_r['status']] ?? $gc_r['status']).'</td><td>'.$gc_e((int)$gc_r['status'] >= 2 ? gamecenter_room::outcome_text($gc_r) : '').'</td>'
			.'<td>'.(int)DB::result_first('SELECT COUNT(*) FROM %t WHERE room_id=%d AND action=%s', ['gamecenter_room_action', (int)$gc_r['id'], 'move']).'</td><td class="m">'.$gc_e(implode('；', $gc_rt)).'</td></tr>';
	}
	if(!$gc_rows) {
		echo '<tr><td colspan="8">還沒有對局</td></tr>';
	}
	echo '</table>'.multi($gc_total, 50, $gc_page, $gc_base.'&tab=rooms');
}

if($gc_tab === 'aquarium') {
	$gc_vn = ['ok' => '正常', 'heal' => '可自動修（下次同步寫回）', 'anomaly' => '異常（唯讀）', 'other' => '不是目前配置', 'broken' => '讀不出來'];
	$gc_active = gamecenter_aquarium_configs::active_version();
	$gc_on = gamecenter_aquarium_configs::maintenance();
	echo '<table class="tb tb2 gcad" style="margin-top:10px"><tr class="header"><th>配置版本</th><th>存檔數</th></tr>';
	foreach(DB::fetch_all('SELECT config_version v, COUNT(*) c FROM %t GROUP BY config_version ORDER BY c DESC', ['gamecenter_aquarium_save']) as $gc_r) {
		echo '<tr><td><code>'.$gc_e($gc_r['v']).'</code>'.($gc_r['v'] === $gc_active ? ' <b style="color:#2a7">目前</b>' : '').'</td><td>'.(int)$gc_r['c'].'</td></tr>';
	}
	echo '</table>';
	echo '<form method="post" action="'.$gc_ab.'" style="margin:10px 0">'.$gc_fh.'<input type="hidden" name="on" value="'.($gc_on ? 0 : 1).'">'
		.'維護：'.($gc_on ? '<b style="color:#c00">維護中</b>' : '關閉').' <input type="submit" class="btn" name="gcaqmaintsubmit" value="'.($gc_on ? '結束維護' : '進入維護').'"'.($gc_on ? '' : ' onclick="return confirm(\'進入維護後玩家只看到維護提示，確定？\')"').'></form>';

	require_once libfile('function/cache');
	loadcache('gamecenter_aqscan');
	$gc_st = (array)getglobal('cache/gamecenter_aqscan');
	echo '<h3 style="margin:16px 0 6px">全部存檔檢查</h3><form method="post" action="'.$gc_ab.'" style="margin-bottom:8px">'.$gc_fh.'<input type="submit" class="btn" name="gcaqscansubmit" value="開始檢查">'
		.(!empty($gc_st['done']) ? ' <span class="m">上次：'.dgmdate((int)$gc_st['done'], 'Y-m-d H:i').'，'.(int)$gc_st['total'].' 份</span>' : '').'</form>';
	if(!empty($gc_st['done'])) {
		echo '<table class="tb tb2 gcad"><tr class="header"><th>結果</th><th>份數</th></tr>';
		foreach($gc_vn as $gc_k => $gc_t) {
			if(!empty($gc_st['verdict'][$gc_k])) {
				echo '<tr><td>'.$gc_t.'</td><td>'.(int)$gc_st['verdict'][$gc_k].'</td></tr>';
			}
		}
		echo '</table>';
		if(!empty($gc_st['why'])) {
			echo '<table class="tb tb2 gcad" style="margin-top:8px"><tr class="header"><th>結果</th><th>原因</th><th>份數</th><th>UID</th></tr>';
			foreach($gc_st['why'] as $gc_k => $gc_n) {
				list($gc_v, $gc_w) = explode('｜', $gc_k, 2);
				$gc_links = [];
				foreach((array)($gc_st['uids'][$gc_k] ?? []) as $gc_u) {
					$gc_links[] = '<a href="'.$gc_ab.'&uid='.(int)$gc_u.'">'.(int)$gc_u.'</a>';
				}
				echo '<tr><td>'.($gc_vn[$gc_v] ?? $gc_e($gc_v)).'</td><td><code>'.$gc_e($gc_w).'</code></td><td>'.(int)$gc_n.'</td><td>'.implode(' ', $gc_links).'</td></tr>';
			}
			echo '</table>';
		}
	}

	$gc_qu = (int)getgpc('uid');
	echo '<h3 style="margin:16px 0 6px">查看單一存檔</h3><form method="get" action="'.ADMINSCRIPT.'">'
		.'<input type="hidden" name="action" value="plugins"><input type="hidden" name="operation" value="config"><input type="hidden" name="do" value="'.(int)$pluginid.'"><input type="hidden" name="identifier" value="gamecenter"><input type="hidden" name="pmod" value="admincp"><input type="hidden" name="tab" value="aquarium">'
		.'UID <input type="text" class="txt w" name="uid" value="'.($gc_qu ?: '').'"> <input type="submit" class="btn" value="查看"></form>';
	if($gc_qu > 0) {
		$gc_r = DB::fetch_first('SELECT uid,save_version,config_version,state_json,version,updated_ms FROM %t WHERE uid=%d', ['gamecenter_aquarium_save', $gc_qu]);
		if(!$gc_r) {
			echo '<p style="margin:8px 0">UID '.$gc_qu.' 沒有水族馆存檔</p>';
		} else {
			foreach(['uid', 'save_version', 'version', 'updated_ms'] as $gc_k) {
				$gc_r[$gc_k] = (int)$gc_r[$gc_k];
			}
			list($gc_v, $gc_w) = (new gamecenter_aquarium())->inspect($gc_r);
			$gc_s = json_decode((string)$gc_r['state_json'], true);
			$gc_s = is_array($gc_s) ? $gc_s : [];
			$gc_m = DB::fetch_first('SELECT username FROM %t WHERE uid=%d', ['common_member', $gc_qu]);
			$gc_fishn = 0;
			foreach((array)($gc_s['fish'] ?? []) as $gc_f) {
				$gc_fishn += (int)($gc_f['owned_count'] ?? $gc_f['catch_count'] ?? 0);
			}
			echo '<table class="tb tb2 gcad" style="margin-top:8px">'
				.'<tr><th style="width:120px">會員</th><td>'.$gc_e($gc_m['username'] ?? '').' <span class="m">('.$gc_qu.')</span></td></tr>'
				.'<tr><th>檢查結果</th><td>'.($gc_vn[$gc_v] ?? $gc_e($gc_v)).($gc_w !== '' ? ' <code>'.$gc_e($gc_w).'</code>' : '').'</td></tr>'
				.'<tr><th>配置</th><td><code>'.$gc_e($gc_r['config_version']).'</code>'.(($gc_s['config_version'] ?? '') !== $gc_r['config_version'] ? '（存檔內：<code>'.$gc_e((string)($gc_s['config_version'] ?? '')).'</code>）' : '').'</td></tr>'
				.'<tr><th>存檔版本</th><td>'.$gc_r['version'].'</td></tr>'
				.'<tr><th>最後結算</th><td>'.dgmdate(intdiv($gc_r['updated_ms'], 1000), 'Y-m-d H:i:s').'</td></tr>'
				.'<tr><th>金幣</th><td>'.$gc_e((string)($gc_s['coins'] ?? '')).'</td></tr>'
				.'<tr><th>鱼竿</th><td>Lv.'.(int)($gc_s['rod_level'] ?? 0).'</td></tr>'
				.'<tr><th>魚</th><td>'.count((array)($gc_s['fish'] ?? [])).' 種、'.$gc_fishn.' 條</td></tr>'
				.'<tr><th>裝飾</th><td>'.count((array)($gc_s['decor_owned'] ?? [])).' 件</td></tr>'
				.'</table>';
		}
	}
}

echo '<div style="margin-top:16px;color:#999;font-size:12px">遊戲中心 gamecenter · (C) 2026 Carinoasd</div>';
