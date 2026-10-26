<?php

/**
 * 遊戲中心 gamecenter — 前台頁面 HTML（大廳、遊戲頁、排行榜、我的紀錄）。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_view {

	const BASE = 'plugin.php?id=gamecenter';

	public static function ver() {
		global $_G;
		return rawurlencode((string)($_G['setting']['plugins']['version']['gamecenter'] ?? '1'));
	}

	private static function e($s) {
		return gamecenter_core::esc($s);
	}

	public static function game_url($g, $mod = 'play') {
		return self::BASE.'&mod='.$mod.'&game='.$g['gkey'];
	}

	public static function icon($g, $cls = 'gc-icon') {
		$m = $g['m'];
		if($m['icon'] && preg_match('/^[\w.-]+\.(svg|png|jpg|jpeg|gif|webp)$/i', $m['icon']) && is_file(gamecenter_core::game_dir($g['gkey']).'/'.$m['icon'])) {
			return '<img class="'.$cls.'" src="source/plugin/gamecenter/games/'.$g['gkey'].'/'.$m['icon'].'" alt="">';
		}
		return '<span class="'.$cls.' gc-icon-txt">'.self::e(mb_substr($m['name'], 0, 1)).'</span>';
	}

	/** 獎勵說明（給大廳卡片與遊戲頁）。 */
	public static function reward_lines($g) {
		$out = [];
		$c = gamecenter_core::credit_name((int)$g['credit']);
		if(!$c) {
			return $out;
		}
		if($g['ratio']) {
			$s = '每 '.(int)$g['ratio'].' '.self::e($g['m']['unit']).'得 1 '.self::e($c);
			if($g['percap']) {
				$s .= '，单局最多 '.(int)$g['percap'];
			}
			if($g['daycap']) {
				$s .= '，每天最多 '.(int)$g['daycap'];
			}
			$out[] = $s;
		}
		$rw = gamecenter_core::week_rewards($g);
		if($rw) {
			$parts = [];
			foreach(array_slice($rw, 0, 3) as $i => $a) {
				$parts[] = '第 '.($i + 1).' 名 '.$a;
			}
			$out[] = '周榜前 '.count($rw).' 名有奖（'.implode('、', $parts).(count($rw) > 3 ? '…' : '').' '.self::e($c).'）';
		}
		return $out;
	}

	private static function shell($inner) {
		return '<div class="gc">'.$inner.'<div class="gc-foot">游戏中心 gamecenter · (C) 2026 Carinoasd</div></div>';
	}

	private static function nav($cur) {
		global $_G;
		$a = [['lobby', '游戏大厅', self::BASE]];
		if($_G['uid']) {
			$a[] = ['my', '我的纪录', self::BASE.'&mod=my'];
		}
		$h = '<div class="gc-nav">';
		foreach($a as [$k, $t, $u]) {
			$h .= '<a href="'.$u.'"'.($k === $cur ? ' class="on"' : '').'>'.$t.'</a>';
		}
		return $h.'</div>';
	}

	/* ---------- 大廳 ---------- */

	public static function lobby() {
		global $_G;
		$games = gamecenter_core::games(true);
		$yw = gamecenter_core::yw();
		$h = '<div class="gc-hero"><div><h1>游戏中心</h1><p>用论坛账号直接玩，成绩进排行榜'
			.($_G['uid'] ? '' : '。<a href="member.php?mod=logging&amp;action=login">登录</a>后成绩才会记录').'</p></div>'.self::nav('lobby').'</div>';
		if(!$games) {
			return self::shell($h.'<div class="gc-empty">目前还没有开放的游戏。</div>');
		}
		$h .= '<div class="gc-grid">';
		foreach($games as $g) {
			$top = gamecenter_core::board($g, 'w', $yw, 1);
			$mine = $_G['uid'] ? gamecenter_core::best_of($g['gkey'], 'a', '0', (int)$_G['uid']) : null;
			$h .= '<div class="gc-card">'
				.'<a class="gc-card-head" href="'.self::game_url($g).'">'.self::icon($g).'<div><h3>'.self::e($g['m']['name']).'</h3>'
				.'<div class="gc-muted">已玩 '.(int)$g['plays'].' 局'.($g['m']['verified'] ? ' · 成绩服务器校验' : '').'</div></div></a>'
				.'<p class="gc-intro">'.self::e($g['m']['intro']).'</p>'
				.'<ul class="gc-facts">'
				.'<li>本周第一：'.($top ? self::e($top[0]['username']).' <b>'.(int)$top[0]['score'].'</b>' : '<span class="gc-muted">虚位以待</span>').'</li>'
				.($_G['uid'] ? '<li>我的最佳：'.($mine === null ? '<span class="gc-muted">还没玩过</span>' : '<b>'.$mine.'</b>').'</li>' : '');
			foreach(self::reward_lines($g) as $l) {
				$h .= '<li class="gc-rw">'.$l.'</li>';
			}
			$h .= '</ul><div class="gc-card-btns"><a class="gc-btn" href="'.self::game_url($g).'">开始游戏</a>'
				.'<a class="gc-btn gc-ghost" href="'.self::game_url($g, 'rank').'">排行榜</a></div></div>';
		}
		return self::shell($h.'</div>');
	}

	/* ---------- 遊戲頁 ---------- */

	public static function play_page($g) {
		global $_G;
		$m = $g['m'];
		$best = $_G['uid'] ? gamecenter_core::best_of($g['gkey'], 'a', '0', (int)$_G['uid']) : null;
		$why = gamecenter_core::can_play();
		$base = 'source/plugin/gamecenter/';
		$h = '<div class="gc-hero gc-hero-sm">'.self::icon($g).'<div><h1>'.self::e($m['name']).'</h1><p>'.self::e($m['intro']).'</p></div>'.self::nav('').'</div>';
		if(!$g['available']) {
			$h .= '<div class="gc-warn">这个游戏尚未开放，只有管理员看得到（试玩用，成绩照常记录）。</div>';
		}
		$h .= '<div class="gc-cols"><div class="gc-main">'
			.'<div id="gc-stage" class="gc-stage" data-url="'.self::BASE.'" data-game="'.$g['gkey'].'" data-formhash="'.formhash().'"'
			.' data-best="'.($best === null ? '' : $best).'" data-unit="'.self::e($m['unit']).'"'
			.' data-login="'.($_G['uid'] ? '' : 'member.php?mod=logging&amp;action=login').'"'
			.' data-uid="'.(int)$_G['uid'].'" data-rivals="'.self::e(json_encode(gamecenter_core::rivals($g), JSON_UNESCAPED_UNICODE)).'"></div>';
		if($why !== '') {
			$h .= '<div class="gc-note">'.self::e($why).'，现在是试玩模式。</div>';
		}
		$h .= '<div class="gc-box"><h4>玩法</h4><p>'.self::e($m['help'] ?: $m['intro']).'</p>';
		$rl = self::reward_lines($g);
		if($rl) {
			$h .= '<h4>奖励</h4><ul class="gc-list">';
			foreach($rl as $l) {
				$h .= '<li>'.$l.'</li>';
			}
			$h .= '</ul>';
		}
		$h .= '</div></div><aside class="gc-side"><div id="gc-boards">'.self::boards($g, 10).'</div></aside></div>';
		$h .= '<script src="'.$base.'static/gc.js?v='.self::ver().'"></script>';
		if(!empty($m['style']) && preg_match('/^[\w.-]+\.css$/', $m['style'])) {
			$h .= '<link rel="stylesheet" href="'.$base.'games/'.$g['gkey'].'/'.$m['style'].'?v='.rawurlencode($m['version']).'">';
		}
		$h .= '<script src="'.$base.'games/'.$g['gkey'].'/'.rawurlencode($m['script']).'?v='.rawurlencode($m['version']).'"></script>';
		return self::shell($h);
	}

	/** 右側排行榜三個分頁（今日／本周／总榜），交成績後也用這段刷新。 */
	public static function boards($g, $n) {
		global $_G;
		$tabs = [['d', '今日', gamecenter_core::ymd()], ['w', '本周', gamecenter_core::yw()], ['a', '总榜', '0']];
		$h = '<div class="gc-box gc-tabsbox"><div class="gc-tabs">';
		foreach($tabs as $i => [$p, $t]) {
			$h .= '<a href="#" data-gc-tab="'.$p.'"'.($p === 'w' ? ' class="on"' : '').'>'.$t.'</a>';
		}
		$h .= '</div>';
		foreach($tabs as [$p, $t, $k]) {
			$list = gamecenter_core::board($g, $p, $k, $n);
			$h .= '<div data-gc-pane="'.$p.'"'.($p === 'w' ? '' : ' style="display:none"').'>'.self::rank_list($list, 0, $g);
			if($_G['uid']) {
				$r = gamecenter_core::rank_of($g, $p, $k, (int)$_G['uid']);
				$h .= '<div class="gc-me">'.($r ? '我的名次：第 '.$r.' 名（'.(int)gamecenter_core::best_of($g['gkey'], $p, $k, (int)$_G['uid']).'）' : '这段时间还没有成绩').'</div>';
			}
			$h .= '<a class="gc-more" href="'.self::game_url($g, 'rank').'&amp;period='.$p.'">完整排行 »</a></div>';
		}
		return $h.'</div>';
	}

	private static function rank_list($list, $start, $g, $time = false) {
		global $_G;
		if(!$list) {
			return '<div class="gc-empty gc-empty-sm">还没有人上榜，快来抢第一！</div>';
		}
		$h = '<ol class="gc-rank">';
		foreach($list as $i => $r) {
			$n = $start + $i + 1;
			$h .= '<li'.((int)$r['uid'] === (int)$_G['uid'] ? ' class="me"' : '').'><span class="gc-no gc-no'.min($n, 4).'">'.$n.'</span>'
				.'<a href="home.php?mod=space&amp;uid='.(int)$r['uid'].'" class="gc-who"><img src="'.self::e(avatar((int)$r['uid'], 'small', 1)).'" loading="lazy" alt=""><span>'.self::e($r['username'] ?: 'UID '.$r['uid']).'</span></a>'
				.($time ? '<span class="gc-time">'.dgmdate((int)$r['dateline'], 'u').'</span>' : '')
				.'<b class="gc-sc">'.(int)$r['score'].'</b></li>';
		}
		return $h.'</ol>';
	}

	/* ---------- 完整排行榜 ---------- */

	public static function rank_page($g) {
		global $_G;
		$period = (string)getgpc('period');
		$period = in_array($period, ['d', 'w', 'a'], true) ? $period : 'w';
		$opts = [];
		if($period === 'd') {
			for($i = 0; $i < 14; $i++) {
				$k = gamecenter_core::ymd(TIMESTAMP - $i * 86400);
				$opts[$k] = $i === 0 ? '今天' : ($i === 1 ? '昨天' : substr($k, 0, 4).'-'.substr($k, 4, 2).'-'.substr($k, 6));
			}
		} elseif($period === 'w') {
			for($i = 0; $i < 12; $i++) {
				$k = gamecenter_core::yw(TIMESTAMP - $i * 7 * 86400);
				$opts[$k] = ($i === 0 ? '本周 · ' : ($i === 1 ? '上周 · ' : '')).gamecenter_core::week_label($k);
			}
		} else {
			$opts['0'] = '总榜';
		}
		$pkey = (string)getgpc('pkey');
		if(!isset($opts[$pkey])) {
			$pkey = (string)array_key_first($opts);
		}
		$url = self::game_url($g, 'rank').'&period='.$period;
		$h = '<div class="gc-hero gc-hero-sm">'.self::icon($g).'<div><h1>'.self::e($g['m']['name']).' · 排行榜</h1>'
			.'<p><a href="'.self::game_url($g).'">« 回去玩</a></p></div>'.self::nav('').'</div>';
		$h .= '<div class="gc-box"><div class="gc-tabs gc-tabs-link">';
		foreach(['d' => '日榜', 'w' => '周榜', 'a' => '总榜'] as $p => $t) {
			$h .= '<a href="'.self::game_url($g, 'rank').'&amp;period='.$p.'"'.($p === $period ? ' class="on"' : '').'>'.$t.'</a>';
		}
		$h .= '</div>';
		if(count($opts) > 1) {
			$h .= '<form method="get" action="plugin.php" class="gc-pick"><input type="hidden" name="id" value="gamecenter"><input type="hidden" name="mod" value="rank">'
				.'<input type="hidden" name="game" value="'.$g['gkey'].'"><input type="hidden" name="period" value="'.$period.'">'
				.'<select name="pkey" onchange="this.form.submit()">';
			foreach($opts as $k => $t) {
				$h .= '<option value="'.$k.'"'.((string)$k === $pkey ? ' selected' : '').'>'.self::e($t).'</option>';
			}
			$h .= '</select><noscript><button type="submit">查看</button></noscript></form>';
		}
		if($period === 'w') {
			$settle = DB::fetch_first('SELECT result, dateline FROM %t WHERE gkey=%s AND yw=%s', ['gamecenter_settle', $g['gkey'], $pkey]);
			if($settle) {
				$h .= '<div class="gc-note">这一周的排行已于 '.dgmdate((int)$settle['dateline'], 'Y-m-d H:i').' 结算发奖。</div>';
			}
		}
		$per = 50;
		$page = max(1, (int)getgpc('page'));
		$total = gamecenter_core::board_count($g, $period, $pkey);
		$list = gamecenter_core::board($g, $period, $pkey, $per, ($page - 1) * $per);
		$h .= self::rank_list($list, ($page - 1) * $per, $g, true);
		$h .= multi($total, $per, $page, $url.'&pkey='.$pkey);
		if($_G['uid']) {
			$r = gamecenter_core::rank_of($g, $period, $pkey, (int)$_G['uid']);
			$h .= '<div class="gc-me">'.($r ? '我的名次：第 '.$r.' 名' : '这段时间我还没有成绩').'　共 '.$total.' 人上榜</div>';
		}
		return self::shell($h.'</div>');
	}

	/* ---------- 我的紀錄 ---------- */

	public static function my_page() {
		global $_G;
		$uid = (int)$_G['uid'];
		$games = gamecenter_core::games(false);
		$h = '<div class="gc-hero gc-hero-sm"><div><h1>我的游戏纪录</h1><p>'.self::e($_G['username']).'</p></div>'.self::nav('my').'</div>';
		$h .= '<div class="gc-box"><h4>各游戏最佳</h4><table class="gc-table"><tr><th>游戏</th><th>最佳</th><th>总榜名次</th><th>本周最佳</th><th>本周名次</th></tr>';
		$any = false;
		foreach($games as $g) {
			if(!$g['m']) {
				continue;
			}
			$b = gamecenter_core::best_of($g['gkey'], 'a', '0', $uid);
			if($b === null) {
				continue;
			}
			$any = true;
			$yw = gamecenter_core::yw();
			$wb = gamecenter_core::best_of($g['gkey'], 'w', $yw, $uid);
			$h .= '<tr><td><a href="'.self::game_url($g).'">'.self::e($g['m']['name']).'</a></td><td><b>'.$b.'</b></td><td>'.gamecenter_core::rank_of($g, 'a', '0', $uid).'</td>'
				.'<td>'.($wb === null ? '-' : $wb).'</td><td>'.($wb === null ? '-' : gamecenter_core::rank_of($g, 'w', $yw, $uid)).'</td></tr>';
		}
		if(!$any) {
			$h .= '<tr><td colspan="5" class="gc-muted">还没有玩过任何游戏。</td></tr>';
		}
		$h .= '</table></div>';
		$plays = DB::fetch_all('SELECT * FROM %t WHERE uid=%d ORDER BY id DESC LIMIT 20', ['gamecenter_play', $uid]);
		$h .= '<div class="gc-box"><h4>最近 20 局</h4><table class="gc-table"><tr><th>时间</th><th>游戏</th><th>成绩</th><th>用时</th><th>奖励</th></tr>';
		foreach($plays as $p) {
			$g = $games[$p['gkey']] ?? null;
			$h .= '<tr><td>'.dgmdate((int)$p['dateline'], 'u').'</td><td>'.self::e($g && $g['m'] ? $g['m']['name'] : $p['gkey']).'</td><td>'.(int)$p['score'].'</td>'
				.'<td>'.gamecenter_core::fmt_duration((int)$p['duration']).'</td><td>'.($p['reward'] ? '+'.(int)$p['reward'] : '-').'</td></tr>';
		}
		if(!$plays) {
			$h .= '<tr><td colspan="5" class="gc-muted">没有纪录</td></tr>';
		}
		$h .= '</table></div>';
		$rws = DB::fetch_all('SELECT * FROM %t WHERE uid=%d ORDER BY id DESC LIMIT 20', ['gamecenter_reward', $uid]);
		$h .= '<div class="gc-box"><h4>最近 20 笔奖励</h4><table class="gc-table"><tr><th>时间</th><th>游戏</th><th>来源</th><th>奖励</th></tr>';
		foreach($rws as $r) {
			$g = $games[$r['gkey']] ?? null;
			$h .= '<tr><td>'.dgmdate((int)$r['dateline'], 'u').'</td><td>'.self::e($g && $g['m'] ? $g['m']['name'] : $r['gkey']).'</td>'
				.'<td>'.($r['kind'] === 'week' ? '周榜 · ' : '').self::e($r['note']).'</td><td>'.self::e(gamecenter_core::credit_name((int)$r['credit'])).' +'.(int)$r['amount'].'</td></tr>';
		}
		if(!$rws) {
			$h .= '<tr><td colspan="4" class="gc-muted">没有纪录</td></tr>';
		}
		return self::shell($h.'</table></div>');
	}
}
