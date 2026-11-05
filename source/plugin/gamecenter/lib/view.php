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
		if(gamecenter_core::is_room($g) || gamecenter_core::standalone($g) !== '') {
			return $out;   // 聯機對戰、獨立記錄的遊戲不發積分
		}
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
		$dr = gamecenter_core::daily_on($g) ? gamecenter_core::daily_rewards($g) : [];
		if($dr) {
			$parts = [];
			foreach(array_slice($dr, 0, 3) as $i => $a) {
				$parts[] = '第 '.($i + 1).' 名 '.$a;
			}
			$out[] = '每日挑战前 '.count($dr).' 名有奖（'.implode('、', $parts).(count($dr) > 3 ? '…' : '').' '.self::e($c).'）';
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
			// 1.3.0／1.4.0：聯機對戰遊戲走房間：卡片顯示等級分，不顯示排行與積分
			if(gamecenter_core::is_room($g)) {
				require_once __DIR__.'/room.php';
				$cfg = gamecenter_room::config($g);
				$top = gamecenter_room::rating_board($g['gkey'], 1);
				$mine = $_G['uid'] ? gamecenter_room::my_rating($g['gkey'], (int)$_G['uid']) : null;
				$h .= '<div class="gc-card"><a class="gc-card-head" href="'.self::game_url($g).'">'.self::icon($g).'<div><h3>'.self::e($g['m']['name']).'</h3>'
					.'<div class="gc-muted">'.(int)$cfg['players'].' 人联机 · 已玩 '.(int)$g['plays'].' 局 · 服务端判定</div></div></a>'
					.'<p class="gc-intro">'.self::e($g['m']['intro']).'</p><ul class="gc-facts">'
					.'<li>等级分第一：'.($top ? self::e($top[0]['username']).' <b>'.(int)$top[0]['rating'].'</b>' : '<span class="gc-muted">虚位以待</span>').'</li>'
					.($_G['uid'] ? '<li>我的等级分：'.($mine ? '<b>'.(int)$mine['rating'].'</b>（'.(int)$mine['wins'].' 胜 '.(int)$mine['losses'].' 负）' : '<span class="gc-muted">还没对局</span>').'</li>' : '')
					.'<li>自动匹配或房间号约战 · 每回合 '.intdiv($cfg['turn_ms'], 1000).' 秒 · 不发积分</li></ul>'
					.'<div class="gc-card-btns"><a class="gc-btn" href="'.self::game_url($g).'">开始对战</a><a class="gc-btn gc-ghost" href="'.self::game_url($g, 'rank').'">等级分榜</a></div></div>';
				continue;
			}
			// 1.5.0：獨立記錄的遊戲（天使讨伐令；1.6.0 加天使水族馆）：不進排行、不發積分，卡片只放介紹與開始鈕
			if(($alone = gamecenter_core::standalone($g)) !== '') {
				list($sub, $fact) = $alone === 'aquarium'
					? ['放置养成 · 服务端存档', '独立存档：离线也会继续自动钓鱼，金币只在缸内使用，不进排行榜、不发积分']
					: ['单人或双人合作 · 服务端结算', '独立记录：保存每人最近十次讨伐，不进排行榜、不发积分'];
				$h .= '<div class="gc-card"><a class="gc-card-head" href="'.self::game_url($g).'">'.self::icon($g).'<div><h3>'.self::e($g['m']['name']).'</h3>'
					.'<div class="gc-muted">'.$sub.'</div></div></a>'
					.'<p class="gc-intro">'.self::e($g['m']['intro']).'</p><ul class="gc-facts">'
					.'<li>'.$fact.'</li></ul>'
					.'<div class="gc-card-btns"><a class="gc-btn" href="'.self::game_url($g).'">开始游戏</a></div></div>';
				continue;
			}
			$top = gamecenter_core::board($g, 'w', $yw, 1);
			$mine = $_G['uid'] ? gamecenter_core::best_of($g['gkey'], 'a', '0', (int)$_G['uid']) : null;
			$h .= '<div class="gc-card">'
				.'<a class="gc-card-head" href="'.self::game_url($g).'">'.self::icon($g).'<div><h3>'.self::e($g['m']['name']).'</h3>'
				.'<div class="gc-muted">已玩 '.(int)$g['plays'].' 局'.($g['m']['verified'] ? ' · 成绩服务器校验' : '').'</div></div></a>'
				.'<p class="gc-intro">'.self::e($g['m']['intro']).'</p>'
				.'<ul class="gc-facts">'
				.'<li>本周第一：'.($top ? self::e($top[0]['username']).' <b>'.(int)$top[0]['score'].'</b>' : '<span class="gc-muted">虚位以待</span>').'</li>'
				.($_G['uid'] ? '<li>我的最佳：'.($mine === null ? '<span class="gc-muted">还没玩过</span>' : '<b>'.$mine.'</b>').'</li>' : '');
			$daily = gamecenter_core::daily_on($g);
			if($daily) {
				$dt = gamecenter_core::board($g, 'c', gamecenter_core::ymd(), 1);
				$left = $_G['uid'] ? max(0, (int)$g['dailytries'] - gamecenter_core::daily_used($g, (int)$_G['uid'])) : null;
				$h .= '<li class="gc-daily">📅 每日挑战：'.($dt ? self::e($dt[0]['username']).' <b>'.(int)$dt[0]['score'].'</b> 领先' : '今天还没人挑战')
					.($left !== null ? '，你还有 <b>'.$left.'</b> 次' : '').'</li>';
			}
			foreach(self::reward_lines($g) as $l) {
				$h .= '<li class="gc-rw">'.$l.'</li>';
			}
			$h .= '</ul><div class="gc-card-btns"><a class="gc-btn" href="'.self::game_url($g).'">开始游戏</a>'
				.($daily ? '<a class="gc-btn gc-btn-daily" href="'.self::game_url($g).'&amp;mode=daily">每日挑战</a>' : '')
				.'<a class="gc-btn gc-ghost" href="'.self::game_url($g, 'rank').'">排行榜</a></div></div>';
		}
		return self::shell($h.'</div>');
	}

	/* ---------- 遊戲頁 ---------- */

	public static function play_page($g) {
		global $_G;
		$m = $g['m'];
		$room = gamecenter_core::is_room($g);
		$alone = gamecenter_core::standalone($g) !== '';   // 1.5.0
		$wide = !empty($m['wide']);   // 1.6.0：game.json "wide": true＝遊戲畫面佔滿整行（不放右欄、標題列不重複簡介）
		$best = !$room && !$alone && $_G['uid'] ? gamecenter_core::best_of($g['gkey'], 'a', '0', (int)$_G['uid']) : null;
		$why = gamecenter_core::can_play();
		$base = 'source/plugin/gamecenter/';
		$h = '<div class="gc-hero gc-hero-sm">'.self::icon($g).'<div><h1>'.self::e($m['name']).'</h1>'.($wide ? '' : '<p>'.self::e($m['intro']).'</p>').'</div>'.self::nav('').'</div>';
		if(!$g['available']) {
			$h .= '<div class="gc-warn">这个游戏尚未开放，只有管理员看得到（试玩用，成绩照常记录）。</div>';
		}
		// 模式：一般／每日挑戰（&mode=daily）／幽靈挑戰（&ghost=重播 id）
		$mode = '';
		$ref = 0;
		$daily = gamecenter_core::daily_on($g);
		if($daily && getgpc('mode') === 'daily') {
			$mode = 'daily';
		} elseif(($rid = (int)getgpc('ghost')) && gamecenter_core::supports($g)) {
			$rp = gamecenter_core::replay($rid);
			if($rp && $rp['gkey'] === $g['gkey'] && ($lock = gamecenter_core::ghost_allowed($g, $rp)) === '') {
				$mode = 'ghost';
				$ref = $rid;
			} else {
				$h .= '<div class="gc-warn">'.($rp && $rp['gkey'] === $g['gkey'] ? self::e($lock) : '这笔纪录已经不在了（对方可能刷新了纪录），请回排行榜重新选一个对手。').'</div>';
			}
		}
		if($daily || $mode === 'ghost') {
			$h .= '<div class="gc-modes">';
			$h .= '<a href="'.self::game_url($g).'"'.($mode === '' ? ' class="on"' : '').'>🎮 自由模式</a>';
			if($daily) {
				$left = $_G['uid'] ? max(0, (int)$g['dailytries'] - gamecenter_core::daily_used($g, (int)$_G['uid'])) : null;
				$h .= '<a href="'.self::game_url($g).'&amp;mode=daily"'.($mode === 'daily' ? ' class="on"' : '').'>📅 每日挑战'
					.($left !== null ? '<small>剩 '.$left.'/'.(int)$g['dailytries'].' 次</small>' : '').'</a>';
			}
			if($mode === 'ghost') {
				$h .= '<a href="#" class="on">⚔ 幽灵挑战</a>';
			}
			$h .= '</div>';
		}
		if($mode === 'daily') {
			$h .= '<div class="gc-banner gc-banner-daily"><b>📅 每日挑战 · '.substr(gamecenter_core::ymd(), 4, 2).'/'.substr(gamecenter_core::ymd(), 6).'</b>'
				.'今天全站同一张地图，每人 '.(int)$g['dailytries'].' 次（开局就算一次），取最好的一次排名；不进一般排行、不发每局奖励。</div>';
		} elseif($mode === 'ghost') {
			$h .= '<div class="gc-banner gc-banner-ghost"><b>⚔ 挑战 '.self::e($rp['username'] ?: 'UID '.$rp['uid']).' 的 '.(int)$rp['score'].' '.self::e($m['unit']).'纪录</b>'
				.'同一张地图，对手以半透明幽灵同步出现；挑战成绩不进排行、不发奖励。 <a href="'.self::game_url($g).'">退出挑战</a></div>';
		}
		$h .= '<div class="gc-cols"><div class="gc-main">'
			.'<div id="gc-stage" class="gc-stage" data-url="'.self::BASE.'" data-game="'.$g['gkey'].'" data-formhash="'.formhash().'"'
			.' data-mode="'.$mode.'" data-ref="'.$ref.'"'
			.' data-dbest="'.($mode === 'daily' && $_G['uid'] ? (string)gamecenter_core::best_of($g['gkey'], 'c', gamecenter_core::ymd(), (int)$_G['uid']) : '').'"'
			.' data-best="'.($best === null ? '' : $best).'" data-unit="'.self::e($m['unit']).'"'
			.' data-login="'.($_G['uid'] ? '' : 'member.php?mod=logging&amp;action=login').'"'
			.' data-uid="'.(int)$_G['uid'].'" data-room="'.($room ? 1 : 0).'" data-rivals="'.self::e(json_encode($room ? [] : gamecenter_core::rivals($g), JSON_UNESCAPED_UNICODE)).'"></div>';
		if($why !== '') {
			// 1.6.0：水族馆是伺服器存檔，沒有試玩模式
			$h .= '<div class="gc-note">'.self::e($m['standalone'] === 'aquarium' ? ($_G['uid'] ? '当前用户组暂不能建立或查看水族馆。' : '请登录论坛账号后建立或查看水族馆。') : $why.'，现在是试玩模式。').'</div>';
		} elseif($m['standalone'] === 'aquarium') {
			$h .= '<div class="gc-note">本游戏不发论坛积分，金币只在缸内使用。</div>';
		}
		// 1.6.0：玩法說明可分行（game.json help 裡的換行各成一段）
		$h .= '<div class="gc-box"><h4>玩法</h4>';
		foreach(preg_split('/\r\n|\r|\n/', (string)($m['help'] ?: $m['intro'])) as $line) {
			if(($line = trim($line)) !== '') {
				$h .= '<p>'.self::e($line).'</p>';
			}
		}
		$rl = self::reward_lines($g);
		if($rl) {
			$h .= '<h4>奖励</h4><ul class="gc-list">';
			foreach($rl as $l) {
				$h .= '<li>'.$l.'</li>';
			}
			$h .= '</ul>';
		}
		if(gamecenter_core::supports($g)) {
			$h .= '<h4>挑战</h4><p>点排行榜上的 ⚔ 就能用同一张地图挑战那笔纪录，对手会以幽灵同步出现。'
				.($daily ? '每日挑战：每天全站同一张地图，每人 '.(int)$g['dailytries'].' 次。' : '').'</p>';
		}
		if($wide) {
			$h .= '</div></div></div>';   // 1.6.0：不放右欄，遊戲畫面佔滿整行
		} elseif($alone) {
			// 1.5.0：獨立記錄的遊戲沒有排行榜，右欄只說明記錄方式（讨伐記錄在遊戲畫面下方）
			$h .= '</div></div><aside class="gc-side"><div class="gc-box"><h4>记录</h4><p>本游戏独立记录：每人保存最近十次讨伐（在游戏画面下方「最近十次讨伐」），不进排行榜、不发积分。</p></div></aside></div>';
		} else {
			$h .= '</div></div><aside class="gc-side"><div id="gc-boards">'.self::boards($g, 10, $mode === 'daily' ? 'daily' : '').'</div></aside></div>';
		}
		$h .= '<script src="'.$base.'static/gc.js?v='.self::ver().'"></script>';
		if(!empty($m['style']) && preg_match('/^[\w.-]+\.css$/', $m['style'])) {
			$h .= '<link rel="stylesheet" href="'.$base.'games/'.$g['gkey'].'/'.$m['style'].'?v='.rawurlencode($m['version']).'">';
		}
		$h .= '<script src="'.$base.'games/'.$g['gkey'].'/'.rawurlencode($m['script']).'?v='.rawurlencode($m['version']).'"></script>';
		return self::shell($h);
	}

	/** 右側排行榜三個分頁（今日／本周／总榜），交成績後也用這段刷新。 */
	public static function boards($g, $n, $mode = '') {
		global $_G;
		if(gamecenter_core::standalone($g) !== '') {
			return '';   // 1.5.0：獨立記錄的遊戲沒有排行榜
		}
		if(gamecenter_core::is_room($g)) {
			return self::rating_box($g, $n);
		}
		if($mode === 'daily' && gamecenter_core::daily_on($g)) {
			$tabs = [['c', '今日挑战', gamecenter_core::ymd(), 'c'], ['cy', '昨日挑战', gamecenter_core::ymd(TIMESTAMP - 86400), 'c']];
			$on = 'c';
		} else {
			$tabs = [['d', '今日', gamecenter_core::ymd(), 'd'], ['w', '本周', gamecenter_core::yw(), 'w'], ['a', '总榜', '0', 'a']];
			$on = 'w';
		}
		$h = '<div class="gc-box gc-tabsbox"><div class="gc-tabs">';
		foreach($tabs as [$tab, $t]) {
			$h .= '<a href="#" data-gc-tab="'.$tab.'"'.($tab === $on ? ' class="on"' : '').'>'.$t.'</a>';
		}
		$h .= '</div>';
		foreach($tabs as [$tab, $t, $k, $p]) {
			$list = gamecenter_core::board($g, $p, $k, $n);
			$h .= '<div data-gc-pane="'.$tab.'"'.($tab === $on ? '' : ' style="display:none"').'>'.self::rank_list($list, 0, $g, false, $p, $k);
			if($_G['uid']) {
				$r = gamecenter_core::rank_of($g, $p, $k, (int)$_G['uid']);
				$h .= '<div class="gc-me">'.($r ? '我的名次：第 '.$r.' 名（'.(int)gamecenter_core::best_of($g['gkey'], $p, $k, (int)$_G['uid']).'）' : '这段时间还没有成绩').'</div>';
			}
			$h .= '<a class="gc-more" href="'.self::game_url($g, 'rank').'&amp;period='.$p.'&amp;pkey='.$k.'">完整排行 »</a></div>';
		}
		return $h.'</div>';
	}

	/** 1.4.0：聯機遊戲右欄＝等級分前幾名＋我的；對局結束後也用這段刷新。 */
	public static function rating_box($g, $n) {
		global $_G;
		require_once __DIR__.'/room.php';
		$cfg = gamecenter_room::config($g);
		$h = '<div class="gc-box"><h4>等级分榜</h4>'.self::rating_list(gamecenter_room::rating_board($g['gkey'], $n), 0);
		if($_G['uid']) {
			$me = gamecenter_room::my_rating($g['gkey'], (int)$_G['uid']);
			$h .= '<div class="gc-me">'.($me ? '我的等级分：<b>'.(int)$me['rating'].'</b>　第 '.(int)$me['rank'].' 名　'.(int)$me['wins'].' 胜 '.(int)$me['losses'].' 负 '.(int)$me['draws'].' 和' : '还没有对局，初始 1500 分').'</div>';
		}
		$h .= '<a class="gc-more" href="'.self::game_url($g, 'rank').'">完整等级分榜 »</a></div>';
		$h .= '<div class="gc-box"><h4>怎么玩</h4><p>「自动匹配」等一位在线玩家，或「创建房间」把房间号／邀请链接给好友。'.(int)$cfg['players'].' 人一局，每回合 '.intdiv($cfg['turn_ms'], 1000).' 秒，超时判负；刷新页面可恢复对局。</p>'
			.'<p class="gc-muted">胜负由服务端判定，计入等级分（Elo，初始 1500）；不进单机排行、不发积分。</p></div>';
		return $h;
	}

	private static function rating_list($list, $start) {
		global $_G;
		if(!$list) {
			return '<div class="gc-empty gc-empty-sm">还没有人下过，来当第一个！</div>';
		}
		$h = '<ol class="gc-rank">';
		foreach($list as $i => $r) {
			$n = $start + $i + 1;
			$h .= '<li'.((int)$r['uid'] === (int)$_G['uid'] ? ' class="me"' : '').'><span class="gc-no gc-no'.min($n, 4).'">'.$n.'</span>'
				.'<a href="home.php?mod=space&amp;uid='.(int)$r['uid'].'" class="gc-who"><img src="'.self::e(avatar((int)$r['uid'], 'small', 1)).'" loading="lazy" alt=""><span>'.self::e($r['username'] ?: 'UID '.$r['uid']).'</span></a>'
				.'<span class="gc-time">'.(int)$r['wins'].'胜 '.(int)$r['losses'].'负'.((int)$r['draws'] ? ' '.(int)$r['draws'].'和' : '').'</span>'
				.'<b class="gc-sc">'.(int)$r['rating'].'</b></li>';
		}
		return $h.'</ol>';
	}

	/** 1.4.0：聯機遊戲的完整等級分榜（分頁）。 */
	public static function rating_page($g) {
		global $_G;
		require_once __DIR__.'/room.php';
		$per = 50;
		$page = max(1, (int)getgpc('page'));
		$total = gamecenter_room::rating_count($g['gkey']);
		$h = '<div class="gc-hero gc-hero-sm">'.self::icon($g).'<div><h1>'.self::e($g['m']['name']).' · 等级分榜</h1>'
			.'<p><a href="'.self::game_url($g).'">« 回去玩</a></p></div>'.self::nav('').'</div>';
		$h .= '<div class="gc-box">'.self::rating_list(gamecenter_room::rating_board($g['gkey'], $per, ($page - 1) * $per), ($page - 1) * $per);
		$h .= multi($total, $per, $page, self::game_url($g, 'rank'));
		if($_G['uid']) {
			$me = gamecenter_room::my_rating($g['gkey'], (int)$_G['uid']);
			$h .= '<div class="gc-me">'.($me ? '我的等级分：<b>'.(int)$me['rating'].'</b>　第 '.(int)$me['rank'].' 名' : '我还没有对局').'　共 '.$total.' 人</div>';
		}
		$h .= '<p class="gc-muted">Elo 等级分：初始 1500，赢了分数高的人加得多；和棋各半。只有分出胜负（含认输、超时）的对局才计分。</p>';
		return self::shell($h.'</div>');
	}

	private static function rank_list($list, $start, $g, $time = false, $period = '', $pkey = '') {
		global $_G;
		if(!$list) {
			return '<div class="gc-empty gc-empty-sm">还没有人上榜，快来抢第一！</div>';
		}
		// 今天的每日挑戰榜：自己今天的次數用完前不給挑戰（不然等於先看別人的路線）
		$can = gamecenter_core::supports($g);
		if($can && $period === 'c' && $pkey === gamecenter_core::ymd() && gamecenter_core::daily_on($g)) {
			$can = $_G['uid'] && gamecenter_core::daily_used($g, (int)$_G['uid']) >= (int)$g['dailytries'];
		}
		$h = '<ol class="gc-rank">';
		foreach($list as $i => $r) {
			$n = $start + $i + 1;
			$h .= '<li'.((int)$r['uid'] === (int)$_G['uid'] ? ' class="me"' : '').'><span class="gc-no gc-no'.min($n, 4).'">'.$n.'</span>'
				.'<a href="home.php?mod=space&amp;uid='.(int)$r['uid'].'" class="gc-who"><img src="'.self::e(avatar((int)$r['uid'], 'small', 1)).'" loading="lazy" alt=""><span>'.self::e($r['username'] ?: 'UID '.$r['uid']).'</span></a>'
				.($time ? '<span class="gc-time">'.dgmdate((int)$r['dateline'], 'u').'</span>' : '')
				.'<b class="gc-sc">'.(int)$r['score'].'</b>'
				.($can && !empty($r['rid']) ? '<a class="gc-vs" href="'.self::game_url($g).'&amp;ghost='.(int)$r['rid'].'" title="用同一张地图挑战这笔纪录">⚔</a>' : '')
				.'</li>';
		}
		return $h.'</ol>';
	}

	/* ---------- 完整排行榜 ---------- */

	public static function rank_page($g) {
		global $_G;
		$period = (string)getgpc('period');
		$daily = gamecenter_core::daily_on($g);
		$period = in_array($period, $daily ? ['d', 'w', 'a', 'c'] : ['d', 'w', 'a'], true) ? $period : 'w';
		$opts = [];
		if($period === 'd' || $period === 'c') {
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
		foreach(['d' => '日榜', 'w' => '周榜', 'a' => '总榜'] + ($daily ? ['c' => '每日挑战'] : []) as $p => $t) {
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
		if($period === 'w' || $period === 'c') {
			$settle = DB::fetch_first('SELECT result, dateline FROM %t WHERE gkey=%s AND yw=%s', ['gamecenter_settle', $g['gkey'], $pkey]);
			if($settle && $settle['result'] !== '') {
				$h .= '<div class="gc-note">'.($period === 'w' ? '这一周的排行' : '这一天的每日挑战').'已于 '.dgmdate((int)$settle['dateline'], 'Y-m-d H:i').' 结算发奖。</div>';
			}
		}
		$per = 50;
		$page = max(1, (int)getgpc('page'));
		$total = gamecenter_core::board_count($g, $period, $pkey);
		$list = gamecenter_core::board($g, $period, $pkey, $per, ($page - 1) * $per);
		$h .= self::rank_list($list, ($page - 1) * $per, $g, true, $period, $pkey);
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
		$h .= '<div class="gc-box"><h4>最近 20 局</h4><table class="gc-table"><tr><th>时间</th><th>游戏</th><th>成绩</th><th>用时</th><th>详情</th><th>奖励</th></tr>';
		foreach($plays as $p) {
			$g = $games[$p['gkey']] ?? null;
			$h .= '<tr><td>'.dgmdate((int)$p['dateline'], 'u').'</td><td>'.self::e($g && $g['m'] ? $g['m']['name'] : $p['gkey']).'</td><td>'.(int)$p['score'].'</td>'
				.'<td>'.gamecenter_core::fmt_duration((int)$p['duration']).'</td><td class="gc-muted">'.self::e(gamecenter_core::stats_text($p['stats'] ?? '')).'</td><td>'.($p['reward'] ? '+'.(int)$p['reward'] : '-').'</td></tr>';
		}
		if(!$plays) {
			$h .= '<tr><td colspan="6" class="gc-muted">没有纪录</td></tr>';
		}
		$h .= '</table></div>';
		// 1.4.0：聯機對戰
		require_once __DIR__.'/room.php';
		$rooms = gamecenter_room::recent_of($uid, 20);
		$h .= '<div class="gc-box"><h4>联机对战</h4><table class="gc-table"><tr><th>游戏</th><th>等级分</th><th>名次</th><th>胜 / 负 / 和</th></tr>';
		$anyr = false;
		foreach($games as $g) {
			if(!$g['m'] || !gamecenter_core::is_room($g)) {
				continue;
			}
			$me = gamecenter_room::my_rating($g['gkey'], $uid);
			if(!$me) {
				continue;
			}
			$anyr = true;
			$h .= '<tr><td><a href="'.self::game_url($g).'">'.self::e($g['m']['name']).'</a></td><td><b>'.(int)$me['rating'].'</b></td><td>'.(int)$me['rank'].'</td><td>'.(int)$me['wins'].' / '.(int)$me['losses'].' / '.(int)$me['draws'].'</td></tr>';
		}
		if(!$anyr) {
			$h .= '<tr><td colspan="4" class="gc-muted">还没有联机对局。</td></tr>';
		}
		$h .= '</table><table class="gc-table" style="margin-top:10px"><tr><th>时间</th><th>游戏</th><th>对手</th><th>结果</th><th>等级分</th></tr>';
		foreach($rooms as $r) {
			$g = $games[$r['gkey']] ?? null;
			$rt = '';
			foreach((array)json_decode((string)$r['ratings'], true) as $x) {
				if((int)($x['uid'] ?? 0) === $uid) {
					$d = (int)$x['after'] - (int)$x['before'];
					$rt = (int)$x['after'].'（'.($d >= 0 ? '+' : '').$d.'）';
				}
			}
			$h .= '<tr><td>'.dgmdate((int)($r['updated_ms'] / 1000), 'u').'</td><td>'.self::e($g && $g['m'] ? $g['m']['name'] : $r['gkey']).'</td><td>'.self::e(gamecenter_room::players_text($r)).'</td>'
				.'<td>'.(((int)$r['status'] === 2 && (int)$r['winner'] === $uid) ? '<span class="gc-win">胜</span>' : (((int)$r['status'] === 2 && (int)$r['winner']) ? '<span class="gc-lose">负</span>' : '')).' '.self::e(gamecenter_room::outcome_text($r)).'</td><td>'.$rt.'</td></tr>';
		}
		if(!$rooms) {
			$h .= '<tr><td colspan="5" class="gc-muted">没有纪录</td></tr>';
		}
		$h .= '</table></div>';
		$chs = DB::fetch_all('SELECT c.*, a.username AS uname, b.username AS toname FROM %t c LEFT JOIN %t a ON a.uid=c.uid LEFT JOIN %t b ON b.uid=c.touid
			WHERE c.uid=%d OR c.touid=%d ORDER BY c.id DESC LIMIT 20', ['gamecenter_challenge', 'common_member', 'common_member', $uid, $uid]);
		$h .= '<div class="gc-box"><h4>最近 20 场幽灵挑战</h4><table class="gc-table"><tr><th>时间</th><th>游戏</th><th>挑战</th><th>比分</th><th>结果</th><th></th></tr>';
		foreach($chs as $c) {
			$g = $games[$c['gkey']] ?? null;
			$mine = (int)$c['uid'] === $uid;
			$who = $mine ? '我 → '.self::e($c['toname'] ?: 'UID '.$c['touid']) : self::e($c['uname'] ?: 'UID '.$c['uid']).' → 我';
			$won = $mine ? (int)$c['win'] === 1 : (int)$c['win'] === 0;
			$act = '';
			if($g && $g['m'] && !$mine && $c['rid']) {
				$act = '<a href="'.self::game_url($g).'&amp;ghost='.(int)$c['rid'].'">回敬 ⚔</a>';
			} elseif($g && $g['m'] && $mine && !$c['win'] && $c['ref'] && gamecenter_core::replay((int)$c['ref'])) {
				$act = '<a href="'.self::game_url($g).'&amp;ghost='.(int)$c['ref'].'">再挑战</a>';
			}
			$h .= '<tr><td>'.dgmdate((int)$c['dateline'], 'u').'</td><td>'.self::e($g && $g['m'] ? $g['m']['name'] : $c['gkey']).'</td><td>'.$who.'</td>'
				.'<td>'.($mine ? (int)$c['score'].' : '.(int)$c['toscore'] : (int)$c['toscore'].' : '.(int)$c['score']).'</td>'
				.'<td>'.((int)$c['uid'] === (int)$c['touid'] ? '<span class="gc-muted">挑战自己</span>' : ($won ? '<span class="gc-win">胜</span>' : '<span class="gc-lose">负</span>')).'</td><td>'.$act.'</td></tr>';
		}
		if(!$chs) {
			$h .= '<tr><td colspan="6" class="gc-muted">还没有挑战纪录（在排行榜点 ⚔ 就能挑战别人的纪录）</td></tr>';
		}
		$h .= '</table></div>';
		$rws = DB::fetch_all('SELECT * FROM %t WHERE uid=%d ORDER BY id DESC LIMIT 20', ['gamecenter_reward', $uid]);
		$h .= '<div class="gc-box"><h4>最近 20 笔奖励</h4><table class="gc-table"><tr><th>时间</th><th>游戏</th><th>来源</th><th>奖励</th></tr>';
		foreach($rws as $r) {
			$g = $games[$r['gkey']] ?? null;
			$h .= '<tr><td>'.dgmdate((int)$r['dateline'], 'u').'</td><td>'.self::e($g && $g['m'] ? $g['m']['name'] : $r['gkey']).'</td>'
				.'<td>'.($r['kind'] === 'week' ? '周榜 · ' : ($r['kind'] === 'daily' ? '每日挑战 · ' : '')).self::e($r['note']).'</td><td>'.self::e(gamecenter_core::credit_name((int)$r['credit'])).' +'.(int)$r['amount'].'</td></tr>';
		}
		if(!$rws) {
			$h .= '<tr><td colspan="4" class="gc-muted">没有纪录</td></tr>';
		}
		return self::shell($h.'</table></div>');
	}
}
