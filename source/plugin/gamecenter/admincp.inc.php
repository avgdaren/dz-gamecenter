<?php

/**
 * 遊戲中心 gamecenter — 後台「遊戲管理」。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 遊戲：重新掃描 games/ 資料夾、開放／關閉、排序、每款的積分獎勵與週榜獎勵、清空排行。
 * 紀錄：每局成績（可依遊戲、UID 篩選），刪掉作弊成績後自動重算該會員的排行。
 * 獎勵：每局獎勵與週榜獎勵的發放紀錄；週榜結算結果。
 */

if(!defined('IN_DISCUZ') || !defined('IN_ADMINCP')) {
	exit('Access Denied');
}
if((int)$_G['adminid'] !== 1) {
	cpmsg('只有管理員可以使用遊戲管理', '', 'error');
}

require_once DISCUZ_PLUGIN('gamecenter').'/lib/core.php';

$gc_base = ADMINSCRIPT.'?action=plugins&operation=config&do='.(int)$pluginid.'&identifier=gamecenter&pmod=admincp';
$gc_e = function($s) {
	return dhtmlspecialchars((string)$s);
};
$gc_tab = (string)getgpc('tab');
$gc_tab = in_array($gc_tab, ['games', 'plays', 'rewards'], true) ? $gc_tab : 'games';
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
			foreach(['gamecenter_game', 'gamecenter_best', 'gamecenter_play', 'gamecenter_session', 'gamecenter_settle'] as $gc_t) {
				DB::delete($gc_t, DB::field('gkey', $gc_k));
			}
			continue;
		}
		$gc_rw = implode(',', array_filter(array_map('intval', preg_split('/[,，\s]+/u', (string)($gc_v['weekrewards'] ?? ''), -1, PREG_SPLIT_NO_EMPTY)), function($x) {
			return $x > 0;
		}));
		$gc_old = DB::fetch_first('SELECT weekrewards FROM %t WHERE gkey=%s', ['gamecenter_game', $gc_k]);
		DB::update('gamecenter_game', [
			'available' => empty($gc_v['available']) ? 0 : 1,
			'displayorder' => (int)($gc_v['displayorder'] ?? 0),
			'credit' => max(0, min(8, (int)($gc_v['credit'] ?? 0))),
			'ratio' => max(0, (int)($gc_v['ratio'] ?? 0)),
			'percap' => max(0, (int)($gc_v['percap'] ?? 0)),
			'daycap' => max(0, (int)($gc_v['daycap'] ?? 0)),
			'weekrewards' => substr($gc_rw, 0, 255),
			'maxscore' => max(0, (int)($gc_v['maxscore'] ?? 0)),
		], DB::field('gkey', $gc_k));
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
echo '<style>.gcad td,.gcad th{padding:6px 8px;vertical-align:middle}.gcad input.t{width:60px}.gcad input.w{width:110px}.gcad .m{color:#888}.gctabs a{display:inline-block;padding:6px 14px;margin-right:4px;border:1px solid #ccc;border-bottom:0;border-radius:6px 6px 0 0;text-decoration:none}.gctabs a.on{background:#2f7ae5;color:#fff;border-color:#2f7ae5}</style>';
echo '<div class="gctabs" style="margin:6px 0 0">';
foreach(['games' => '遊戲', 'plays' => '成績紀錄', 'rewards' => '獎勵與週榜結算'] as $gc_k => $gc_t) {
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
		.'<th>每 N 分得 1 點</th><th>單局上限</th><th>每人每天上限</th><th>週榜獎勵（第1名,第2名,…）</th><th>分數上限</th><th>局數</th></tr>';
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
				.($gc_m['author'] ? '<br><span class="m">作者 '.$gc_e($gc_m['author']).'</span>' : '').($gc_k === 'gomoku' ? '<br><span class="m">独立对局记录；本阶段不参与单机榜或积分奖励</span>' : '')
				: '<b style="color:#c00">'.$gc_k.'：檔案不見了</b><br><span class="m">games/'.$gc_k.'/ 缺 game.json 或腳本</span>'
					.'<br><label><input type="checkbox" class="checkbox" name="'.$gc_n.'[remove]" value="1"> 移除（連同成績與排行）</label>').'</td>'
			.'<td>'.($gc_k === 'gomoku' ? '<span style="color:#1a9e5c">服务端对局</span>' : ($gc_m && $gc_m['verified'] ? '<span style="color:#1a9e5c">伺服器重播</span>' : '<span style="color:#c60" title="成績由瀏覽器回報，可被偽造；有發積分時請設分數上限">無</span>')).'</td>'
			.'<td>'.$gc_sel.'</td>'
			.'<td><input class="txt t" name="'.$gc_n.'[ratio]" value="'.(int)$gc_g['ratio'].'"></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[percap]" value="'.(int)$gc_g['percap'].'"></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[daycap]" value="'.(int)$gc_g['daycap'].'"></td>'
			.'<td><input class="txt w" name="'.$gc_n.'[weekrewards]" value="'.$gc_e($gc_g['weekrewards']).'" placeholder="例 100,50,30"></td>'
			.'<td><input class="txt t" name="'.$gc_n.'[maxscore]" value="'.(int)$gc_g['maxscore'].'"></td>'
			.'<td>'.(int)$gc_g['plays'].'</td></tr>';
	}
	if(!$gc_games) {
		echo '<tr><td colspan="11">還沒有登記任何遊戲，按下方「重新掃描」。</td></tr>';
	}
	echo '<tr><td colspan="11"><input type="submit" class="btn" name="gcsavesubmit" value="儲存"></td></tr></table></form>';
	echo '<div class="m" style="margin:6px 0 14px;line-height:1.8;color:#666">「每 N 分得 1 點」填 0＝每局不發積分；上限填 0＝不限。週榜在下一週第一個有人打開遊戲中心時結算，每週只結算一次；'
		.'「分數上限」只對沒有伺服器校驗的遊戲有用（超過的成績不收），0＝不限。<br>新遊戲：把資料夾放進 <code>source/plugin/gamecenter/games/&lt;識別碼&gt;/</code> 再按「重新掃描」；'
		.'新遊戲預設不開放，管理員可以先從上面的名稱連結進去試玩。寫法見插件內的 <code>DEVELOP.md</code>。</div>';
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
		.'<table class="tb tb2 gcad"><tr class="header"><th></th><th>ID</th><th>時間</th><th>遊戲</th><th>會員</th><th>成績</th><th>用時</th><th>校驗</th><th>獎勵</th><th>IP</th></tr>';
	foreach($gc_rows as $gc_r) {
		echo '<tr><td><input type="checkbox" class="checkbox" name="ids[]" value="'.(int)$gc_r['id'].'"></td><td>'.(int)$gc_r['id'].'</td><td>'.dgmdate((int)$gc_r['dateline'], 'Y-m-d H:i:s').'</td>'
			.'<td>'.$gc_e($gc_r['gkey']).'</td><td><a href="'.$gc_base.'&tab=plays&uid='.(int)$gc_r['uid'].'">'.$gc_e($gc_r['username']).'</a> <span class="m">('.(int)$gc_r['uid'].')</span></td>'
			.'<td><b>'.(int)$gc_r['score'].'</b></td><td>'.gamecenter_core::fmt_duration((int)$gc_r['duration']).'</td><td>'.($gc_r['verified'] ? '✔' : '-').'</td>'
			.'<td>'.($gc_r['reward'] ? '+'.(int)$gc_r['reward'] : '-').'</td><td>'.$gc_e($gc_r['ip']).'</td></tr>';
	}
	if(!$gc_rows) {
		echo '<tr><td colspan="10">沒有紀錄</td></tr>';
	}
	echo '<tr><td colspan="10"><input type="submit" class="btn" name="gcdelsubmit" value="刪除勾選的成績並重算排行"> <span class="m">共 '.$gc_total.' 局</span></td></tr></table></form>';
	echo multi($gc_total, 50, $gc_page, $gc_base.'&tab=plays&gkey='.rawurlencode($gc_fk).'&uid='.$gc_fu);
}

if($gc_tab === 'rewards') {
	$gc_page = max(1, (int)getgpc('page'));
	$gc_total = (int)DB::result_first('SELECT COUNT(*) FROM %t', ['gamecenter_reward']);
	$gc_rows = DB::fetch_all('SELECT r.*, m.username FROM %t r LEFT JOIN %t m ON m.uid=r.uid ORDER BY r.id DESC '.DB::limit(($gc_page - 1) * 50, 50), ['gamecenter_reward', 'common_member']);
	echo '<h3 style="margin:12px 0 6px">週榜結算</h3><table class="tb tb2 gcad"><tr class="header"><th>遊戲</th><th>週次</th><th>結算時間</th><th>名次與獎勵</th></tr>';
	$gc_settles = DB::fetch_all('SELECT * FROM %t ORDER BY dateline DESC LIMIT 20', ['gamecenter_settle']);
	foreach($gc_settles as $gc_s) {
		$gc_list = [];
		foreach((array)json_decode($gc_s['result'], true) as $gc_x) {
			$gc_list[] = '第'.(int)$gc_x['rank'].' '.$gc_e($gc_x['username']).'（'.(int)$gc_x['score'].'）'.($gc_x['amount'] ? ' +'.(int)$gc_x['amount'] : ' 不發（用戶組排除）');
		}
		echo '<tr><td>'.$gc_e($gc_s['gkey']).'</td><td>'.$gc_e(gamecenter_core::week_label($gc_s['yw'])).'</td><td>'.dgmdate((int)$gc_s['dateline'], 'Y-m-d H:i').'</td><td>'.($gc_list ? implode('<br>', $gc_list) : '<span class="m">那週沒有人上榜</span>').'</td></tr>';
	}
	if(!$gc_settles) {
		echo '<tr><td colspan="4">還沒有結算過</td></tr>';
	}
	echo '</table><h3 style="margin:16px 0 6px">發放紀錄</h3><table class="tb tb2 gcad"><tr class="header"><th>時間</th><th>會員</th><th>遊戲</th><th>來源</th><th>積分</th></tr>';
	foreach($gc_rows as $gc_r) {
		echo '<tr><td>'.dgmdate((int)$gc_r['dateline'], 'Y-m-d H:i:s').'</td><td>'.$gc_e($gc_r['username']).' <span class="m">('.(int)$gc_r['uid'].')</span></td><td>'.$gc_e($gc_r['gkey']).'</td>'
			.'<td>'.($gc_r['kind'] === 'week' ? '週榜：' : '每局：').$gc_e($gc_r['note']).'</td><td>'.$gc_e(gamecenter_core::credit_name((int)$gc_r['credit'])).' +'.(int)$gc_r['amount'].'</td></tr>';
	}
	if(!$gc_rows) {
		echo '<tr><td colspan="5">沒有紀錄</td></tr>';
	}
	echo '</table>'.multi($gc_total, 50, $gc_page, $gc_base.'&tab=rewards');
}

echo '<div style="margin-top:16px;color:#999;font-size:12px">遊戲中心 gamecenter · (C) 2026 Carinoasd</div>';
