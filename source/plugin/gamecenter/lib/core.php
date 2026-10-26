<?php

/**
 * 遊戲中心 gamecenter — 核心：遊戲登記、開局／交成績、排行榜、積分獎勵、週榜結算。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 帳號：不另設註冊，一律用論壇帳號（uid）；遊客只能試玩，不記成績。
 * 遊戲：每款一個資料夾 games/<gkey>/，放 game.json（名稱、簡介、排序方向…）、game.js（前台），
 *       有伺服器校驗的再放 verify.php（類別 gamecenter_verify_<gkey>，靜態方法 verify()）。
 *       資料夾放進去後，後台「遊戲管理」按一次「重新掃描」就會登記（新遊戲預設不開放）。
 * 成績：開局向伺服器拿一次性 token＋亂數種子；交成績時 token 作廢，有 verify.php 的遊戲由伺服器重播操作算分。
 * 排行：gamecenter_best 存每人每個區間的最佳成績（period a＝總榜、w＝週榜、d＝日榜）。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_core {

	const ID = 'gamecenter';
	const SESSION_TTL = 7200;        // 開局後 2 小時內要交成績
	const START_LIMIT = 30;          // 10 分鐘內最多開幾局
	const MAX_PAYLOAD = 600000;      // 成績資料上限（位元組）

	/* ---------- 共用 ---------- */

	public static function esc($s) {
		return dhtmlspecialchars((string)$s);
	}

	public static function vars() {
		global $_G;
		static $v = null;
		if($v === null) {
			if(!isset($_G['cache']['plugin'][self::ID])) {
				loadcache('plugin');
			}
			$v = (array)($_G['cache']['plugin'][self::ID] ?? []);
		}
		return $v;
	}

	public static function groups_var($key) {
		$v = self::vars();
		$r = $v[$key] ?? '';
		$r = is_array($r) ? $r : (array)dunserialize($r);
		return array_values(array_filter(array_map('intval', $r)));
	}

	/** 站台時區（不跟會員自己的時區走，大家的「今天」一樣）。 */
	public static function local($ts = 0) {
		global $_G;
		return ($ts ?: TIMESTAMP) + (float)($_G['setting']['timeoffset'] ?? 8) * 3600;
	}

	public static function ymd($ts = 0) {
		return gmdate('Ymd', (int)self::local($ts));
	}

	public static function yw($ts = 0) {
		return gmdate('oW', (int)self::local($ts));
	}

	public static function msnow() {
		return (int)floor(microtime(true) * 1000);
	}

	/* ---------- 遊戲登記 ---------- */

	public static function game_dir($gkey) {
		return DISCUZ_PLUGIN(self::ID).'/games/'.$gkey;
	}

	public static function valid_key($gkey) {
		return is_string($gkey) && preg_match('/^[a-z][a-z0-9_]{1,31}$/', $gkey);
	}

	/** 讀 games/<gkey>/game.json。 */
	public static function manifest($gkey) {
		static $cache = [];
		if(!self::valid_key($gkey)) {
			return null;
		}
		if(!array_key_exists($gkey, $cache)) {
			$f = self::game_dir($gkey).'/game.json';
			$m = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
			if(is_array($m) && !empty($m['name']) && is_file(self::game_dir($gkey).'/'.($m['script'] ?? 'game.js'))) {
				$m += ['intro' => '', 'version' => '1.0.0', 'order' => 'desc', 'unit' => '分', 'script' => 'game.js', 'icon' => '', 'author' => '', 'help' => ''];
				$m['order'] = $m['order'] === 'asc' ? 'asc' : 'desc';
				$m['verified'] = is_file(self::game_dir($gkey).'/verify.php');
				$cache[$gkey] = $m;
			} else {
				$cache[$gkey] = null;
			}
		}
		return $cache[$gkey];
	}

	/** 掃描 games/ 資料夾，把新遊戲登記進表（$install＝安裝時：內建遊戲直接開放）。回傳新登記的 gkey。 */
	public static function sync_games($install = false) {
		$added = [];
		foreach((array)glob(DISCUZ_PLUGIN(self::ID).'/games/*', GLOB_ONLYDIR) as $dir) {
			$gkey = basename($dir);
			$m = self::manifest($gkey);
			if(!$m) {
				continue;
			}
			if(!DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s', ['gamecenter_game', $gkey])) {
				DB::insert('gamecenter_game', [
					'gkey' => $gkey,
					'available' => $install ? 1 : 0,
					'displayorder' => (int)($m['displayorder'] ?? 0),
					'dateline' => TIMESTAMP,
				], false, true);
				$added[] = $gkey;
			}
		}
		return $added;
	}

	/** 全部登記過的遊戲（含設定與 manifest），照排序。$onlyopen＝只要開放中、檔案還在的。 */
	public static function games($onlyopen = true) {
		$out = [];
		foreach(DB::fetch_all('SELECT * FROM %t ORDER BY displayorder, gkey', ['gamecenter_game']) as $r) {
			$m = self::manifest($r['gkey']);
			if($onlyopen && (!$m || !$r['available'])) {
				continue;
			}
			$r['m'] = $m;
			$out[$r['gkey']] = $r;
		}
		return $out;
	}

	public static function game($gkey, $onlyopen = true) {
		if(!self::valid_key($gkey)) {
			return null;
		}
		$r = DB::fetch_first('SELECT * FROM %t WHERE gkey=%s', ['gamecenter_game', $gkey]);
		if(!$r) {
			return null;
		}
		$r['m'] = self::manifest($gkey);
		if($onlyopen && (!$r['m'] || !$r['available'])) {
			return null;
		}
		return $r;
	}

	/* ---------- 權限 ---------- */

	/** 這位會員能不能玩（記成績）。回傳 '' 表示可以，否則是原因。 */
	public static function can_play() {
		global $_G;
		if(!$_G['uid']) {
			return '登录论坛账号后成绩才会记录';
		}
		$v = self::vars();
		if(!empty($v['limitplay'])) {
			$g = self::groups_var('playgroups');
			if(!in_array((int)$_G['groupid'], $g, true)) {
				return '你所在的用户组不能参加游戏排行';
			}
		}
		return '';
	}

	public static function can_reward($groupid) {
		$v = self::vars();
		if(!empty($v['noreward_on']) && in_array((int)$groupid, self::groups_var('noreward'), true)) {
			return false;
		}
		return true;
	}

	public static function credit_name($i) {
		global $_G;
		$c = $_G['setting']['extcredits'][$i] ?? null;
		return $c ? $c['title'] : '';
	}

	/* ---------- 開局 ---------- */

	public static function start($game) {
		if($game['gkey'] === 'raid') { return ['ok'=>0,'msg'=>'请通过讨伐房间开始挑战']; }
		global $_G;
		$uid = (int)$_G['uid'];
		$seed = random_int(1, 2147483646);
		if(self::can_play() !== '') {
			return ['ok' => 1, 'guest' => 1, 'seed' => $seed, 'msg' => self::can_play()];
		}
		if(mt_rand(1, 50) === 1) {
			DB::query('DELETE FROM %t WHERE dateline<%d', ['gamecenter_session', TIMESTAMP - 86400]);
		}
		$n = (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE uid=%d AND dateline>%d', ['gamecenter_session', $uid, TIMESTAMP - 600]);
		if($n >= self::START_LIMIT) {
			return ['ok' => 0, 'msg' => '开局太频繁了，休息一下再来吧'];
		}
		$token = md5(random_bytes(16).$uid.microtime());
		DB::insert('gamecenter_session', [
			'token' => $token,
			'gkey' => $game['gkey'],
			'uid' => $uid,
			'seed' => $seed,
			'startms' => self::msnow(),
			'dateline' => TIMESTAMP,
		]);
		return ['ok' => 1, 'guest' => 0, 'token' => $token, 'seed' => $seed];
	}

	/* ---------- 交成績 ---------- */

	/**
	 * $data：前台送來的成績（score、以及遊戲自己的重播資料）。
	 * 回傳給前台的結果：ok、score、best、newbest、rank（週榜名次）、reward、msg。
	 */
	public static function submit($game, $token, array $data) {
		if($game['gkey'] === 'raid') { return ['ok'=>0,'msg'=>'讨伐结果由服务器独立保存，不接受单机成绩']; }
		global $_G;
		$uid = (int)$_G['uid'];
		if(($why = self::can_play()) !== '') {
			return ['ok' => 0, 'guest' => 1, 'msg' => $why];
		}
		$s = DB::fetch_first('SELECT * FROM %t WHERE token=%s', ['gamecenter_session', (string)$token]);
		if(!$s || (int)$s['uid'] !== $uid || $s['gkey'] !== $game['gkey']) {
			return ['ok' => 0, 'msg' => '这一局的凭证无效，请重新开始'];
		}
		if($s['used']) {
			return ['ok' => 0, 'msg' => '这一局的成绩已经交过了'];
		}
		if(TIMESTAMP - (int)$s['dateline'] > self::SESSION_TTL) {
			return ['ok' => 0, 'msg' => '这一局开始太久了，成绩不予记录'];
		}
		// 先作廢 token（同時送兩次只有一次成功）
		DB::query('UPDATE %t SET used=1 WHERE token=%s AND used=0', ['gamecenter_session', $s['token']]);
		if(DB::affected_rows() < 1) {
			return ['ok' => 0, 'msg' => '这一局的成绩已经交过了'];
		}
		$elapsed = max(0, self::msnow() - (int)$s['startms']);
		$score = (int)($data['score'] ?? 0);
		$verified = 0;

		if($game['m']['verified']) {
			require_once self::game_dir($game['gkey']).'/verify.php';
			$cls = 'gamecenter_verify_'.$game['gkey'];
			$r = $cls::verify((int)$s['seed'], $data);
			if(empty($r['ok'])) {
				return ['ok' => 0, 'msg' => '成绩校验失败（'.($r['reason'] ?? '数据不一致').'），这一局不予记录'];
			}
			// 實際花的時間不可能比遊戲邏輯要求的最短時間還短（留 15%＋1.5 秒的網路誤差）
			if(isset($r['minms']) && $elapsed < $r['minms'] * 0.85 - 1500) {
				return ['ok' => 0, 'msg' => '成绩校验失败（游戏速度异常），这一局不予记录'];
			}
			$score = (int)$r['score'];
			$verified = 1;
		} else {
			if($score < 0 || ($game['maxscore'] && $score > (int)$game['maxscore'])) {
				return ['ok' => 0, 'msg' => '分数超出这个游戏允许的范围，这一局不予记录'];
			}
		}

		$ymd = self::ymd();
		$yw = self::yw();
		$id = DB::insert('gamecenter_play', [
			'gkey' => $game['gkey'],
			'uid' => $uid,
			'score' => $score,
			'duration' => min($elapsed, 4294967295),
			'verified' => $verified,
			'ymd' => $ymd,
			'yw' => $yw,
			'ip' => (string)$_G['clientip'],
			'dateline' => TIMESTAMP,
		], true);
		DB::query('UPDATE %t SET plays=plays+1 WHERE gkey=%s', ['gamecenter_game', $game['gkey']]);

		$old = self::best_of($game['gkey'], 'a', '0', $uid);
		$asc = $game['m']['order'] === 'asc';
		foreach([['a', '0'], ['w', $yw], ['d', $ymd]] as [$p, $k]) {
			self::put_best($game['gkey'], $p, $k, $uid, $score, $asc, TIMESTAMP);
		}
		$best = self::best_of($game['gkey'], 'a', '0', $uid);
		$newbest = $old === null || ($asc ? $score < $old : $score > $old);

		$reward = self::reward_play($game, $uid, $score, (int)$id);

		return [
			'ok' => 1,
			'score' => $score,
			'best' => $best,
			'newbest' => $newbest ? 1 : 0,
			'rank' => self::rank_of($game, 'w', $yw, $uid),
			'reward' => $reward['amount'],
			'rewardtext' => $reward['text'],
			'verified' => $verified,
			'rivals' => self::rivals($game),
		];
	}

	/* ---------- 排行 ---------- */

	public static function put_best($gkey, $period, $pkey, $uid, $score, $asc, $ts) {
		DB::query('INSERT IGNORE INTO %t (gkey, period, pkey, uid, score, dateline) VALUES (%s, %s, %s, %d, %d, %d)',
			['gamecenter_best', $gkey, $period, (string)$pkey, $uid, $score, $ts]);
		if(DB::affected_rows() < 1) {
			DB::query('UPDATE %t SET score=%d, dateline=%d WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d AND score'.($asc ? '>' : '<').'%d',
				['gamecenter_best', $score, $ts, $gkey, $period, (string)$pkey, $uid, $score]);
		}
	}

	public static function best_of($gkey, $period, $pkey, $uid) {
		$r = DB::result_first('SELECT score FROM %t WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d',
			['gamecenter_best', $gkey, $period, (string)$pkey, $uid]);
		return $r === false || $r === null ? null : (int)$r;
	}

	/** 排行榜：回傳 [[uid, username, score, dateline], …]。同分先達成的在前。 */
	public static function board($game, $period, $pkey, $limit = 20, $start = 0) {
		$asc = $game['m']['order'] === 'asc';
		return DB::fetch_all('SELECT b.uid, b.score, b.dateline, m.username FROM %t b LEFT JOIN %t m ON m.uid=b.uid
			WHERE b.gkey=%s AND b.period=%s AND b.pkey=%s ORDER BY b.score '.($asc ? 'ASC' : 'DESC').', b.dateline ASC, b.uid ASC '.DB::limit($start, $limit),
			['gamecenter_best', 'common_member', $game['gkey'], $period, (string)$pkey]);
	}

	public static function board_count($game, $period, $pkey) {
		return (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND period=%s AND pkey=%s',
			['gamecenter_best', $game['gkey'], $period, (string)$pkey]);
	}

	/** 本週排行前 50 名給前台（追分目標用）：[{u, n, s}]。 */
	public static function rivals($game) {
		$out = [];
		foreach(self::board($game, 'w', self::yw(), 50) as $r) {
			$out[] = ['u' => (int)$r['uid'], 'n' => (string)$r['username'], 's' => (int)$r['score']];
		}
		return $out;
	}

	/** 某人在某區間的名次（沒成績回 0）。 */
	public static function rank_of($game, $period, $pkey, $uid) {
		$me = DB::fetch_first('SELECT score, dateline FROM %t WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d',
			['gamecenter_best', $game['gkey'], $period, (string)$pkey, $uid]);
		if(!$me) {
			return 0;
		}
		$op = $game['m']['order'] === 'asc' ? '<' : '>';
		return 1 + (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND period=%s AND pkey=%s
			AND (score'.$op.'%d OR (score=%d AND (dateline<%d OR (dateline=%d AND uid<%d))))',
			['gamecenter_best', $game['gkey'], $period, (string)$pkey, $me['score'], $me['score'], $me['dateline'], $me['dateline'], $uid]);
	}

	/** 依 gamecenter_play 重算某人某遊戲的所有最佳成績（後台刪紀錄後用）。 */
	public static function rebuild_best($gkey, $uid) {
		$m = self::manifest($gkey);
		$asc = $m && $m['order'] === 'asc';
		DB::query('DELETE FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_best', $gkey, $uid]);
		foreach(DB::fetch_all('SELECT score, ymd, yw, dateline FROM %t WHERE gkey=%s AND uid=%d ORDER BY dateline, id', ['gamecenter_play', $gkey, $uid]) as $p) {
			foreach([['a', '0'], ['w', $p['yw']], ['d', $p['ymd']]] as [$per, $k]) {
				self::put_best($gkey, $per, $k, $uid, (int)$p['score'], $asc, (int)$p['dateline']);
			}
		}
	}

	/* ---------- 獎勵 ---------- */

	/** 每局獎勵：每 ratio 分 1 點、單局上限 percap、每人每天上限 daycap（0＝不限）。 */
	public static function reward_play($game, $uid, $score, $playid) {
		global $_G;
		$none = ['amount' => 0, 'text' => ''];
		$c = (int)$game['credit'];
		$ratio = (int)$game['ratio'];
		if(!$c || !$ratio || !self::credit_name($c) || $score <= 0 || !self::can_reward($_G['groupid'])) {
			return $none;
		}
		$amt = intdiv($score, $ratio);
		if($game['percap']) {
			$amt = min($amt, (int)$game['percap']);
		}
		if($amt <= 0) {
			return $none;
		}
		$ymd = self::ymd();
		$lock = 'gc_rw_'.$uid;
		DB::query('DO GET_LOCK(%s, 5)', [$lock]);
		try {
			if($game['daycap']) {
				$got = (int)DB::result_first('SELECT SUM(amount) FROM %t WHERE uid=%d AND gkey=%s AND ymd=%s AND kind=%s',
					['gamecenter_reward', $uid, $game['gkey'], $ymd, 'play']);
				$amt = min($amt, max(0, (int)$game['daycap'] - $got));
			}
			if($amt <= 0) {
				return ['amount' => 0, 'text' => '今天这个游戏的奖励已经领满了'];
			}
			$title = $game['m']['name'];
			DB::insert('gamecenter_reward', [
				'uid' => $uid, 'gkey' => $game['gkey'], 'kind' => 'play', 'credit' => $c, 'amount' => $amt,
				'ymd' => $ymd, 'note' => '成绩 '.$score, 'dateline' => TIMESTAMP,
			]);
			DB::query('UPDATE %t SET reward=%d WHERE id=%d', ['gamecenter_play', $amt, $playid]);
			updatemembercount($uid, [$c => $amt], true, '', 0, '', '游戏中心', $title.' 成绩 '.$score);
		} finally {
			DB::query('DO RELEASE_LOCK(%s)', [$lock]);
		}
		return ['amount' => $amt, 'text' => self::credit_name($c).' +'.$amt];
	}

	/** 週榜獎勵設定「100,50,30」→ [100, 50, 30]。 */
	public static function week_rewards($game) {
		if($game['gkey'] === 'raid') { return []; }
		$out = [];
		foreach(preg_split('/[,，\s]+/u', (string)$game['weekrewards'], -1, PREG_SPLIT_NO_EMPTY) as $x) {
			$x = (int)$x;
			if($x > 0) {
				$out[] = $x;
			}
			if(count($out) >= 50) {
				break;
			}
		}
		return $out;
	}

	/**
	 * 結算上週週榜（請求觸發；每款遊戲每週只結算一次，靠 gamecenter_settle 主鍵搶）。
	 * 被排除領獎的用戶組照樣佔名次，只是不發。
	 */
	public static function settle_weeks() {
		global $_G;
		$last = self::yw(TIMESTAMP - 7 * 86400);
		$done = (string)($_G['cookie']['gc_settled'] ?? '');
		if($done === $last) {
			return;
		}
		foreach(self::games(true) as $g) {
			$rw = self::week_rewards($g);
			if(!$rw || !$g['credit'] || !self::credit_name($g['credit'])) {
				continue;
			}
			if(DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND yw=%s', ['gamecenter_settle', $g['gkey'], $last])) {
				continue;
			}
			DB::query('INSERT IGNORE INTO %t (gkey, yw, result, dateline) VALUES (%s, %s, %s, %d)', ['gamecenter_settle', $g['gkey'], $last, '', TIMESTAMP]);
			if(DB::affected_rows() < 1) {
				continue;
			}
			$list = self::board($g, 'w', $last, count($rw));
			$res = [];
			$cname = self::credit_name($g['credit']);
			foreach($list as $i => $r) {
				$uid = (int)$r['uid'];
				$gid = (int)DB::result_first('SELECT groupid FROM %t WHERE uid=%d', ['common_member', $uid]);
				$amt = $rw[$i];
				$given = self::can_reward($gid) && $gid;
				$res[] = ['rank' => $i + 1, 'uid' => $uid, 'username' => (string)$r['username'], 'score' => (int)$r['score'], 'amount' => $given ? $amt : 0];
				if(!$given) {
					continue;
				}
				DB::insert('gamecenter_reward', [
					'uid' => $uid, 'gkey' => $g['gkey'], 'kind' => 'week', 'credit' => (int)$g['credit'], 'amount' => $amt,
					'ymd' => self::ymd(), 'note' => $last.' 周榜第 '.($i + 1).' 名', 'dateline' => TIMESTAMP,
				]);
				updatemembercount($uid, [(int)$g['credit'] => $amt], true, '', 0, '', '游戏中心', $g['m']['name'].' 周榜第 '.($i + 1).' 名');
				notification_add($uid, 'system', '恭喜！你在「'.self::safe($g['m']['name']).'」上周排行榜获得第 '.($i + 1).' 名，奖励 '
					.self::safe($cname).' '.$amt.'。 <a href="plugin.php?id=gamecenter&mod=rank&game='.$g['gkey'].'&period=w&pkey='.$last.'">查看排行</a>', [], 1);
			}
			DB::query('UPDATE %t SET result=%s WHERE gkey=%s AND yw=%s', ['gamecenter_settle', json_encode($res, JSON_UNESCAPED_UNICODE), $g['gkey'], $last]);
		}
		dsetcookie('gc_settled', $last, 3600);
	}

	/** 寫進站內提醒的文字：跳脫，並把 { } : 轉成數字實體（避免被 lang() 當成變數／語言鍵代換）。 */
	public static function safe($s) {
		return strtr(dhtmlspecialchars((string)$s), ['{' => '&#123;', '}' => '&#125;', ':' => '&#58;']);
	}

	/** 週次 202643 → 「2026 年第 43 周（10/19～10/25）」。 */
	public static function week_label($yw) {
		$y = (int)substr($yw, 0, 4);
		$w = (int)substr($yw, 4);
		$d = new DateTime('now', new DateTimeZone('UTC'));
		$d->setISODate($y, $w, 1);
		$a = $d->format('n/j');
		$d->modify('+6 day');
		return $y.' 年第 '.$w.' 周（'.$a.'～'.$d->format('n/j').'）';
	}

	public static function fmt_duration($ms) {
		$s = intdiv((int)$ms, 1000);
		return $s >= 60 ? intdiv($s, 60).' 分 '.($s % 60).' 秒' : $s.' 秒';
	}
}
