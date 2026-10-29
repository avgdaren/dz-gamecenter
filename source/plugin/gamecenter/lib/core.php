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
 * 排行：gamecenter_best 存每人每個區間的最佳成績（period a＝總榜、w＝週榜、d＝日榜、c＝每日挑戰）。
 * 1.2.0 挑戰（game.json 有 "replay": true 且有 verify.php 的遊戲）：
 *   每日挑戰 mode=daily：全站同一顆種子（站台密鑰＋日期算出），每人每天限 dailytries 次（開局就算一次），
 *     只進每日挑戰榜（period c），不進一般排行、不發每局積分；前幾名隔天結算發獎。
 *   幽靈挑戰 mode=ghost：用別人某筆紀錄的種子開局、前台同步重播他的操作；不進排行、不發積分，
 *     只記勝負（gamecenter_challenge）；贏了通知對方並存下這局給對方「回敬」。
 *   重播（gamecenter_replay）只存「刷新了某個排行最佳」的那局；排行列上的 rid 指向它，過期的定期釋放。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_core {

	const ID = 'gamecenter';
	const SESSION_TTL = 7200;        // 開局後 2 小時內要交成績
	const START_LIMIT = 30;          // 10 分鐘內最多開幾局
	const MAX_PAYLOAD = 600000;      // 成績資料上限（位元組）
	const CHUNKS_MAX = 100;          // 1.4.0：一局最多分幾段先交
	const SAVE_MAX = 65536;          // 1.4.0：存檔上限（位元組）
	const SAVE_SLOTS = 3;            // 1.4.0：每人每款遊戲幾個存檔格（0～2）
	const STATS_MAX = 500;           // 1.4.0：成績附加資料上限（JSON 位元組）
	const TTL_MAX_H = 168;           // 1.4.0：game.json ttl 最多幾小時（開局後多久內要交成績）

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
				// 1.3.0／1.4.0：聯機對戰遊戲（game.json "room": true 或 {players, turn_ms, wait_ms, rating}）：走房間介面、不進單機排行與積分
				$m['room'] = !empty($m['room']) ? (is_array($m['room']) ? $m['room'] : ['on' => 1]) : false;
				$m['ttl'] = max(1, min(self::TTL_MAX_H, (int)($m['ttl'] ?? 2)));   // 1.4.0：開局後幾小時內要交成績（長局遊戲可放寬）
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
					'available' => $install && $gkey !== 'aquarium' ? 1 : 0,
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

	/* ---------- 挑戰 ---------- */

	/** 這款遊戲能不能做幽靈挑戰／每日挑戰：要有伺服器校驗（重播）且 game.json 宣告 "replay": true。 */
	/** 1.3.0：聯機對戰遊戲（目前只有五子棋）：不走 start／submit、不進排行、不發積分。 */
	public static function is_room($game) {
		return $game && $game['m'] && !empty($game['m']['room']);
	}

	public static function supports($game) {
		if($game && $game['gkey'] === 'aquarium') { return false; }
		return $game && $game['m'] && $game['m']['verified'] && !empty($game['m']['replay']) && empty($game['m']['room']);
	}

	public static function daily_on($game) {
		return self::supports($game) && (int)$game['dailytries'] > 0;
	}

	/** 每日挑戰的種子：站台密鑰＋遊戲＋日期，事先猜不到，同一天全站一樣。 */
	public static function daily_seed($gkey, $ymd) {
		global $_G;
		$h = md5('gamecenter|daily|'.$gkey.'|'.$ymd.'|'.($_G['config']['security']['authkey'] ?? ''));
		return 1 + hexdec(substr($h, 0, 7)) % 2147483646;
	}

	/** 這位會員今天已經開了幾次每日挑戰（開局就算一次）。 */
	public static function daily_used($game, $uid, $ymd = '') {
		return (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE uid=%d AND gkey=%s AND mode=%s AND pkey=%s',
			['gamecenter_session', $uid, $game['gkey'], 'daily', $ymd ?: self::ymd()]);
	}

	/**
	 * 這筆重播現在能不能拿來挑戰：今天的每日挑戰紀錄，要等自己今天的次數用完才能看（不然等於先看別人怎麼走）。
	 * 回傳 '' 表示可以，否則是原因。
	 */
	public static function ghost_allowed($game, $rp) {
		global $_G;
		if($rp['mode'] === 'daily' && $rp['pkey'] === self::ymd() && self::daily_on($game)) {
			if(!$_G['uid'] || self::daily_used($game, (int)$_G['uid']) < (int)$game['dailytries']) {
				return '今天的每日挑战纪录要等你今天的挑战次数用完才能挑战（明天起不限）';
			}
		}
		return '';
	}

	public static function replay($rid) {
		$rp = $rid ? DB::fetch_first('SELECT r.*, m.username FROM %t r LEFT JOIN %t m ON m.uid=r.uid WHERE r.id=%d', ['gamecenter_replay', 'common_member', $rid]) : null;
		return $rp ?: null;
	}

	/** 給前台的幽靈資料：誰、幾分、他交成績時送的資料（遊戲自己的重播格式）。 */
	public static function ghost_info($rp) {
		$d = json_decode((string)$rp['data'], true);
		return ['rid' => (int)$rp['id'], 'uid' => (int)$rp['uid'], 'name' => (string)$rp['username'], 'score' => (int)$rp['score'],
			'mode' => (string)$rp['mode'], 'data' => is_array($d) ? $d : []];
	}

	private static function save_replay($game, $uid, $mode, $pkey, $seed, $score, array $data) {
		return (int)DB::insert('gamecenter_replay', [
			'gkey' => $game['gkey'], 'uid' => $uid, 'mode' => $mode, 'pkey' => (string)$pkey, 'seed' => $seed,
			'score' => $score, 'data' => json_encode($data, JSON_UNESCAPED_UNICODE), 'dateline' => TIMESTAMP,
		], true);
	}

	/**
	 * 釋放過期的重播：舊的日榜（7 天）、週榜（8 週）、每日挑戰榜（30 天）、挑戰紀錄（30 天）不再指向重播，
	 * 沒被任何排行／挑戰指到、建立超過 3 小時的重播刪掉（3 小時是讓進行中的幽靈挑戰交得了成績）。
	 */
	public static function cleanup() {
		DB::query('UPDATE %t SET rid=0 WHERE period=%s AND pkey<%s AND rid>0', ['gamecenter_best', 'd', self::ymd(TIMESTAMP - 7 * 86400)]);
		DB::query('UPDATE %t SET rid=0 WHERE period=%s AND pkey<%s AND rid>0', ['gamecenter_best', 'w', self::yw(TIMESTAMP - 56 * 86400)]);
		DB::query('UPDATE %t SET rid=0 WHERE period=%s AND pkey<%s AND rid>0', ['gamecenter_best', 'c', self::ymd(TIMESTAMP - 30 * 86400)]);
		DB::query('UPDATE %t SET rid=0 WHERE dateline<%d AND rid>0', ['gamecenter_challenge', TIMESTAMP - 30 * 86400]);
		DB::query('DELETE FROM %t WHERE dateline<%d', ['gamecenter_challenge', TIMESTAMP - 90 * 86400]);
		$ids = [];
		foreach(DB::fetch_all('SELECT r.id FROM %t r LEFT JOIN %t b ON b.rid=r.id LEFT JOIN %t c ON c.rid=r.id
			WHERE b.rid IS NULL AND c.rid IS NULL AND r.dateline<%d LIMIT 300',
			['gamecenter_replay', 'gamecenter_best', 'gamecenter_challenge', TIMESTAMP - 3 * 3600]) as $r) {
			$ids[] = (int)$r['id'];
		}
		if($ids) {
			DB::delete('gamecenter_replay', DB::field('id', $ids));
		}
		// 1.4.0：交成績期限最長 168 小時，開局紀錄與分段資料留 8 天；存檔 180 天沒更新就清
		DB::query('DELETE FROM %t WHERE dateline<%d', ['gamecenter_session', TIMESTAMP - 8 * 86400]);
		DB::query('DELETE FROM %t WHERE dateline<%d', ['gamecenter_chunk', TIMESTAMP - 8 * 86400]);
		DB::query('DELETE FROM %t WHERE dateline<%d', ['gamecenter_save', TIMESTAMP - 180 * 86400]);
		return count($ids);
	}

	/* ---------- 開局 ---------- */

	/**
	 * $mode：'' 一般、'daily' 每日挑戰、'ghost' 幽靈挑戰（$ref＝重播 id）。
	 * 回傳：ok、guest、token、seed、mode，挑戰時另有 ghost／daily。
	 */
	public static function start($game, $mode = '', $ref = 0) {
		if($game['gkey'] === 'aquarium') { return ['ok'=>0,'msg'=>'水族馆使用独立权威存档']; }
		global $_G;
		$uid = (int)$_G['uid'];
		$seed = random_int(1, 2147483646);
		$out = ['ok' => 1, 'mode' => ''];
		$pkey = '';
		if($mode === 'daily') {
			if(!self::daily_on($game)) {
				return ['ok' => 0, 'msg' => '这个游戏没有开放每日挑战'];
			}
			if(!$uid) {
				return ['ok' => 0, 'msg' => '每日挑战要登录论坛账号才能参加'];
			}
			if(($why = self::can_play()) !== '') {
				return ['ok' => 0, 'msg' => $why];
			}
			$pkey = self::ymd();
			$used = self::daily_used($game, $uid, $pkey);
			$tries = (int)$game['dailytries'];
			if($used >= $tries) {
				return ['ok' => 0, 'msg' => '今天的每日挑战 '.$tries.' 次都用完了，明天再来！（可以去挑战排行榜上别人的纪录）'];
			}
			$seed = self::daily_seed($game['gkey'], $pkey);
			$out = ['ok' => 1, 'mode' => 'daily', 'daily' => ['try' => $used + 1, 'tries' => $tries]];
		} elseif($mode === 'ghost') {
			$rp = self::supports($game) ? self::replay((int)$ref) : null;
			if(!$rp || $rp['gkey'] !== $game['gkey']) {
				return ['ok' => 0, 'msg' => '这笔纪录已经不在了（可能被刷新了），请回排行榜重新选一个对手'];
			}
			if(($why = self::ghost_allowed($game, $rp)) !== '') {
				return ['ok' => 0, 'msg' => $why];
			}
			$seed = (int)$rp['seed'];
			$out = ['ok' => 1, 'mode' => 'ghost', 'ghost' => self::ghost_info($rp)];
			$ref = (int)$rp['id'];
		}
		if(self::can_play() !== '') {
			return $out + ['guest' => 1, 'seed' => $seed, 'msg' => self::can_play().'（挑战结果不会记录）'];
		}
		if(mt_rand(1, 50) === 1) {
			self::cleanup();
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
			'mode' => $out['mode'],
			'ref' => $out['mode'] === 'ghost' ? (int)$ref : 0,
			'pkey' => $pkey,
			'dateline' => TIMESTAMP,
		]);
		return $out + ['guest' => 0, 'token' => $token, 'seed' => $seed];
	}

	/* ---------- 交成績 ---------- */

	/**
	 * $data：前台送來的成績（score、以及遊戲自己的重播資料）。
	 * 回傳給前台的結果：ok、score、best、newbest、rank（週榜名次）、reward、msg。
	 */
	public static function submit($game, $token, array $data) {
		if($game['gkey'] === 'aquarium') { return ['ok'=>0,'msg'=>'水族馆使用独立权威存档']; }
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
		if(TIMESTAMP - (int)$s['dateline'] > (int)$game['m']['ttl'] * 3600) {
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
		// 1.4.0：先前分段交上來的資料照順序接在 $data['_chunks']（字串陣列）給 verify 用；交完就刪
		$chunks = [];
		foreach(DB::fetch_all('SELECT data FROM %t WHERE token=%s ORDER BY seq', ['gamecenter_chunk', $s['token']]) as $c) {
			$chunks[] = (string)$c['data'];
		}
		DB::delete('gamecenter_chunk', DB::field('token', $s['token']));
		if($chunks) {
			$data['_chunks'] = $chunks;
		}
		$stats = '';
		if(isset($data['stats']) && is_string($data['stats']) && $data['stats'] !== '' && strlen($data['stats']) <= self::STATS_MAX && is_array(json_decode($data['stats'], true))) {
			$stats = $data['stats'];   // 沒有校驗的遊戲：照前台送的（只是展示用）
		}
		@set_time_limit(60);

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
			if(isset($r['stats']) && is_array($r['stats'])) {
				$stats = json_encode($r['stats'], JSON_UNESCAPED_UNICODE);   // 有校驗的遊戲：以伺服器算出的為準
				$stats = strlen($stats) <= self::STATS_MAX ? $stats : '';
			}
		} else {
			if($score < 0 || ($game['maxscore'] && $score > (int)$game['maxscore'])) {
				return ['ok' => 0, 'msg' => '分数超出这个游戏允许的范围，这一局不予记录'];
			}
		}

		$ymd = self::ymd();
		$yw = self::yw();
		$mode = (string)$s['mode'];
		$id = DB::insert('gamecenter_play', [
			'gkey' => $game['gkey'],
			'uid' => $uid,
			'score' => $score,
			'duration' => min($elapsed, 4294967295),
			'verified' => $verified,
			'mode' => $mode,
			'stats' => $stats,
			'ymd' => $ymd,
			'yw' => $yw,
			'ip' => (string)$_G['clientip'],
			'dateline' => TIMESTAMP,
		], true);
		DB::query('UPDATE %t SET plays=plays+1 WHERE gkey=%s', ['gamecenter_game', $game['gkey']]);
		if(mt_rand(1, 20) === 1) {
			self::cleanup();
		}
		$asc = $game['m']['order'] === 'asc';
		$keep = self::supports($game) ? $data : null;   // 能做挑戰的遊戲才存重播

		// 幽靈挑戰：不進排行、不發積分，只記勝負
		if($mode === 'ghost') {
			return ['ok' => 1, 'score' => $score, 'verified' => $verified, 'mode' => 'ghost',
				'challenge' => self::record_challenge($game, $uid, (int)$s['ref'], (int)$s['seed'], $score, $asc, $keep)];
		}

		// 每日挑戰：只進每日挑戰榜（以開局那天為準），不發每局積分
		if($mode === 'daily') {
			$day = (string)$s['pkey'];
			$old = self::best_of($game['gkey'], 'c', $day, $uid);
			if(self::put_best($game['gkey'], 'c', $day, $uid, $score, $asc, TIMESTAMP) && $keep !== null) {
				self::attach_replay($game, $uid, [['c', $day]], self::save_replay($game, $uid, 'daily', $day, (int)$s['seed'], $score, $keep));
			}
			$used = self::daily_used($game, $uid, $day);
			return [
				'ok' => 1, 'score' => $score, 'verified' => $verified, 'mode' => 'daily',
				'best' => self::best_of($game['gkey'], 'c', $day, $uid),
				'newbest' => $old === null || ($asc ? $score < $old : $score > $old) ? 1 : 0,
				'daily' => ['rank' => self::rank_of($game, 'c', $day, $uid), 'used' => $used, 'tries' => (int)$game['dailytries'],
					'left' => max(0, (int)$game['dailytries'] - $used)],
			];
		}

		$old = self::best_of($game['gkey'], 'a', '0', $uid);
		$changed = [];
		foreach([['a', '0'], ['w', $yw], ['d', $ymd]] as [$p, $k]) {
			if(self::put_best($game['gkey'], $p, $k, $uid, $score, $asc, TIMESTAMP)) {
				$changed[] = [$p, $k];
			}
		}
		if($changed && $keep !== null) {
			self::attach_replay($game, $uid, $changed, self::save_replay($game, $uid, '', '', (int)$s['seed'], $score, $keep));
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

	private static function attach_replay($game, $uid, array $periods, $rid) {
		foreach($periods as [$p, $k]) {
			DB::query('UPDATE %t SET rid=%d WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d',
				['gamecenter_best', $rid, $game['gkey'], $p, (string)$k, $uid]);
		}
	}

	/** 記一筆幽靈挑戰的勝負；贏了別人就存下這局（給對方回敬）並通知對方（同一對每天最多一次）。 */
	private static function record_challenge($game, $uid, $ref, $seed, $score, $asc, $keep) {
		global $_G;
		$rp = self::replay($ref);
		if(!$rp) {
			return ['gone' => 1, 'score' => $score];
		}
		$to = (int)$rp['uid'];
		$win = $asc ? $score < (int)$rp['score'] : $score > (int)$rp['score'];
		$self = $to === $uid;
		$rid = $win && !$self && $keep !== null ? self::save_replay($game, $uid, 'ghost', '', $seed, $score, $keep) : 0;
		$notify = $win && !$self && !DB::result_first('SELECT COUNT(*) FROM %t WHERE uid=%d AND touid=%d AND notified=1 AND dateline>%d',
			['gamecenter_challenge', $uid, $to, TIMESTAMP - 86400]);
		DB::insert('gamecenter_challenge', [
			'gkey' => $game['gkey'], 'uid' => $uid, 'touid' => $to, 'ref' => $ref, 'score' => $score, 'toscore' => (int)$rp['score'],
			'win' => $win ? 1 : 0, 'rid' => $rid, 'notified' => $notify ? 1 : 0, 'dateline' => TIMESTAMP,
		]);
		if($notify) {
			notification_add($to, 'system', '<a href="home.php?mod=space&uid='.$uid.'">'.self::safe($_G['username']).'</a> 在「'.self::safe($game['m']['name'])
				.'」挑战你的 '.(int)$rp['score'].' 分纪录，以 '.$score.' 分获胜！ <a href="plugin.php?id=gamecenter&mod=play&game='.$game['gkey'].'&ghost='.$rid.'">回敬一局</a>', [], 1);
		}
		return ['win' => $win ? 1 : 0, 'self' => $self ? 1 : 0, 'score' => $score, 'toscore' => (int)$rp['score'],
			'name' => (string)$rp['username'], 'rid' => $rid, 'ref' => $ref];
	}

	/* ---------- 1.4.0：分段提交、存檔 ---------- */

	/** 長局分段提交：同一個開局憑證最多 CHUNKS_MAX 段，seq 要連號（1 起），每段 ≤ MAX_PAYLOAD。 */
	public static function chunk($game, $token, $seq, $piece) {
		if($game['gkey'] === 'aquarium') { return ['ok'=>0,'msg'=>'水族馆使用独立权威存档']; }
		global $_G;
		$uid = (int)$_G['uid'];
		if(!$uid) {
			return ['ok' => 0, 'guest' => 1, 'msg' => '登录后才会记录'];
		}
		$s = DB::fetch_first('SELECT token, uid, gkey, used, dateline FROM %t WHERE token=%s', ['gamecenter_session', (string)$token]);
		if(!$s || (int)$s['uid'] !== $uid || $s['gkey'] !== $game['gkey'] || $s['used']) {
			return ['ok' => 0, 'msg' => '这一局的凭证无效'];
		}
		$seq = (int)$seq;
		$piece = (string)$piece;
		if($seq < 1 || $seq > self::CHUNKS_MAX || strlen($piece) > self::MAX_PAYLOAD) {
			return ['ok' => 0, 'msg' => '分段资料不正确'];
		}
		$have = (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE token=%s', ['gamecenter_chunk', $s['token']]);
		if($seq === $have) {
			return ['ok' => 1, 'seq' => $seq, 'dup' => 1];   // 重送同一段
		}
		if($seq !== $have + 1) {
			return ['ok' => 0, 'msg' => '分段顺序不对（应为第 '.($have + 1).' 段）', 'expect' => $have + 1];
		}
		DB::insert('gamecenter_chunk', ['token' => $s['token'], 'seq' => $seq, 'data' => $piece, 'dateline' => TIMESTAMP]);
		return ['ok' => 1, 'seq' => $seq];
	}

	public static function save_put($game, $slot, $data) {
		if($game['gkey'] === 'aquarium') { return ['ok'=>0,'msg'=>'水族馆使用独立权威存档']; }
		global $_G;
		$uid = (int)$_G['uid'];
		$slot = (int)$slot;
		$data = (string)$data;
		if(!$uid) {
			return ['ok' => 0, 'msg' => '登录后才能存档'];
		}
		if($slot < 0 || $slot >= self::SAVE_SLOTS) {
			return ['ok' => 0, 'msg' => '存档位不正确'];
		}
		if(strlen($data) > self::SAVE_MAX) {
			return ['ok' => 0, 'msg' => '存档太大（上限 '.intdiv(self::SAVE_MAX, 1024).' KB）'];
		}
		if($data === '' || json_decode($data, true) === null) {
			return ['ok' => 0, 'msg' => '存档内容不正确'];
		}
		DB::query('INSERT INTO %t (uid, gkey, slot, data, dateline) VALUES (%d, %s, %d, %s, %d) ON DUPLICATE KEY UPDATE data=%s, dateline=%d',
			['gamecenter_save', $uid, $game['gkey'], $slot, $data, TIMESTAMP, $data, TIMESTAMP]);
		return ['ok' => 1, 'slot' => $slot, 'dateline' => TIMESTAMP];
	}

	public static function save_get($game, $slot) {
		if($game['gkey'] === 'aquarium') { return ['ok'=>0,'msg'=>'水族馆使用独立权威存档']; }
		global $_G;
		$uid = (int)$_G['uid'];
		if(!$uid) {
			return ['ok' => 0, 'msg' => '登录后才能读档'];
		}
		$r = DB::fetch_first('SELECT data, dateline FROM %t WHERE uid=%d AND gkey=%s AND slot=%d', ['gamecenter_save', $uid, $game['gkey'], (int)$slot]);
		return ['ok' => 1, 'slot' => (int)$slot, 'data' => $r ? (string)$r['data'] : '', 'dateline' => $r ? (int)$r['dateline'] : 0];
	}

	public static function save_del($game, $slot) {
		if($game['gkey'] === 'aquarium') { return ['ok'=>0,'msg'=>'水族馆使用独立权威存档']; }
		global $_G;
		if(!$_G['uid']) {
			return ['ok' => 0];
		}
		DB::delete('gamecenter_save', DB::field('uid', (int)$_G['uid']).' AND '.DB::field('gkey', $game['gkey']).' AND '.DB::field('slot', (int)$slot));
		return ['ok' => 1];
	}

	/** 成績附加資料（JSON）→ 「鍵 值、鍵 值」給頁面顯示。 */
	public static function stats_text($json) {
		$a = json_decode((string)$json, true);
		if(!is_array($a) || !$a) {
			return '';
		}
		$out = [];
		foreach(array_slice($a, 0, 8, true) as $k => $v) {
			if(is_scalar($v)) {
				$out[] = mb_substr((string)$k, 0, 12, 'UTF-8').' '.mb_substr((string)$v, 0, 20, 'UTF-8');
			}
		}
		return implode('、', $out);
	}

	/* ---------- 排行 ---------- */

	/** 寫入最佳成績；有新增或刷新回傳 true（舊的重播指向會被清掉，由呼叫端掛上新的）。 */
	public static function put_best($gkey, $period, $pkey, $uid, $score, $asc, $ts) {
		DB::query('INSERT IGNORE INTO %t (gkey, period, pkey, uid, score, rid, dateline) VALUES (%s, %s, %s, %d, %d, 0, %d)',
			['gamecenter_best', $gkey, $period, (string)$pkey, $uid, $score, $ts]);
		if(DB::affected_rows() > 0) {
			return true;
		}
		DB::query('UPDATE %t SET score=%d, rid=0, dateline=%d WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d AND score'.($asc ? '>' : '<').'%d',
			['gamecenter_best', $score, $ts, $gkey, $period, (string)$pkey, $uid, $score]);
		return DB::affected_rows() > 0;
	}

	public static function best_of($gkey, $period, $pkey, $uid) {
		$r = DB::result_first('SELECT score FROM %t WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d',
			['gamecenter_best', $gkey, $period, (string)$pkey, $uid]);
		return $r === false || $r === null ? null : (int)$r;
	}

	/** 排行榜：回傳 [[uid, username, score, dateline], …]。同分先達成的在前。 */
	public static function board($game, $period, $pkey, $limit = 20, $start = 0) {
		$asc = $game['m']['order'] === 'asc';
		return DB::fetch_all('SELECT b.uid, b.score, b.rid, b.dateline, m.username FROM %t b LEFT JOIN %t m ON m.uid=b.uid
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
		// 重算前記下每個區間原本的分數與重播：重算後分數沒變的區間把重播接回去（刪的不是那一局）
		$keep = [];
		foreach(DB::fetch_all('SELECT period, pkey, score, rid FROM %t WHERE gkey=%s AND uid=%d AND rid>0', ['gamecenter_best', $gkey, $uid]) as $r) {
			$keep[$r['period'].'|'.$r['pkey']] = [(int)$r['score'], (int)$r['rid']];
		}
		DB::query('DELETE FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_best', $gkey, $uid]);
		// 一般成績進總／週／日榜，每日挑戰進挑戰榜，幽靈挑戰都不進
		foreach(DB::fetch_all('SELECT score, mode, ymd, yw, dateline FROM %t WHERE gkey=%s AND uid=%d AND mode IN (%n) ORDER BY dateline, id',
			['gamecenter_play', $gkey, $uid, ['', 'daily']]) as $p) {
			$list = $p['mode'] === 'daily' ? [['c', $p['ymd']]] : [['a', '0'], ['w', $p['yw']], ['d', $p['ymd']]];
			foreach($list as [$per, $k]) {
				self::put_best($gkey, $per, $k, $uid, (int)$p['score'], $asc, (int)$p['dateline']);
			}
		}
		foreach($keep as $k => [$score, $rid]) {
			[$p, $pk] = explode('|', $k, 2);
			DB::query('UPDATE %t SET rid=%d WHERE gkey=%s AND period=%s AND pkey=%s AND uid=%d AND score=%d',
				['gamecenter_best', $rid, $gkey, $p, $pk, $uid, $score]);
		}
	}

	/* ---------- 獎勵 ---------- */

	/** 每局獎勵：每 ratio 分 1 點、單局上限 percap、每人每天上限 daycap（0＝不限）。 */
	/**
	 * 取得 MySQL 命名鎖，回傳是否真的拿到。一定要送主庫：先用結尾的 FOR UPDATE，資料庫不接受時改用開頭多一個空格的同一句
	 * （原生讀寫分離只看前 6 個字元是不是 SELECT）。
	 */
	public static function get_lock($name, $wait) {
		foreach(['SELECT GET_LOCK(%s, %d) AS g FOR UPDATE', ' SELECT GET_LOCK(%s, %d) AS g'] as $sql) {
			DB::table('gamecenter_reward');
			$q = DB::query($sql, [$name, (int)$wait], true);
			$row = $q ? DB::fetch($q) : false;
			if($row) {
				return (string)$row['g'] === '1';
			}
		}
		return false;
	}

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
		// 1.3.0：確認真的拿到鎖才發（拿不到就不發，避免同一人同時交兩局衝過每日上限）
		if(!self::get_lock($lock, 5)) {
			return ['amount' => 0, 'text' => '奖励结算忙碌中，这局没有发奖励，请稍后再玩'];
		}
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
		if(($game['gkey'] ?? '') === 'aquarium') { return []; }
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

	/** 每日挑戰獎勵設定「50,30,20」→ [50, 30, 20]。 */
	public static function daily_rewards($game) {
		if($game['gkey'] === 'aquarium') { return []; }
		return self::week_rewards(['weekrewards' => $game['dailyrewards'] ?? '']);
	}

	/**
	 * 結算上週週榜與昨天的每日挑戰榜（請求觸發；每款遊戲每個區間只結算一次，靠 gamecenter_settle 主鍵搶）。
	 * 被排除領獎的用戶組照樣佔名次，只是不發。結算鍵：週榜 6 碼週次、每日挑戰 8 碼日期。
	 */
	public static function settle_weeks() {
		global $_G;
		$lastw = self::yw(TIMESTAMP - 7 * 86400);
		$lastd = self::ymd(TIMESTAMP - 86400);
		$mark = $lastw.'|'.$lastd;
		if((string)($_G['cookie']['gc_settled'] ?? '') === $mark) {
			return;
		}
		foreach(self::games(true) as $g) {
			if(!$g['credit'] || !self::credit_name($g['credit']) || self::is_room($g)) {
				continue;
			}
			if($rw = self::week_rewards($g)) {
				self::settle_one($g, 'w', $lastw, $rw);
			}
			if(self::daily_on($g) && ($rw = self::daily_rewards($g))) {
				self::settle_one($g, 'c', $lastd, $rw);
			}
		}
		dsetcookie('gc_settled', $mark, 3600);
	}

	/**
	 * 1.3.0：結算可以接續。result＝'' 表示「結算中」；超過 10 分鐘還沒寫完（中途出錯、逾時）就由下一個請求接手重跑，
	 * 已經發過的名次（reward 表有同一筆 note）跳過，不會重複發。
	 */
	private static function settle_one($g, $period, $key, array $rw) {
		$row = DB::fetch_first('SELECT result, dateline FROM %t WHERE gkey=%s AND yw=%s', ['gamecenter_settle', $g['gkey'], $key]);
		if($row) {
			if((string)$row['result'] !== '' || (int)$row['dateline'] > TIMESTAMP - 600) {
				return;   // 結算完了，或別的請求正在結算
			}
			DB::query('UPDATE %t SET dateline=%d WHERE gkey=%s AND yw=%s AND result=%s AND dateline=%d',
				['gamecenter_settle', TIMESTAMP, $g['gkey'], $key, '', (int)$row['dateline']]);
		} else {
			DB::query('INSERT IGNORE INTO %t (gkey, yw, result, dateline) VALUES (%s, %s, %s, %d)', ['gamecenter_settle', $g['gkey'], $key, '', TIMESTAMP]);
		}
		if(DB::affected_rows() < 1) {
			return;   // 搶輸了
		}
		$week = $period === 'w';
		$what = $week ? '上周排行榜' : '昨天的每日挑战';
		$list = self::board($g, $period, $key, count($rw));
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
			$note = $week ? $key.' 周榜第 '.($i + 1).' 名' : $key.' 每日挑战第 '.($i + 1).' 名';
			if(DB::result_first('SELECT COUNT(*) FROM %t WHERE uid=%d AND gkey=%s AND kind=%s AND note=%s',
				['gamecenter_reward', $uid, $g['gkey'], $week ? 'week' : 'daily', $note])) {
				continue;   // 上次中斷前已經發過
			}
			DB::insert('gamecenter_reward', [
				'uid' => $uid, 'gkey' => $g['gkey'], 'kind' => $week ? 'week' : 'daily', 'credit' => (int)$g['credit'], 'amount' => $amt,
				'ymd' => self::ymd(), 'note' => $note, 'dateline' => TIMESTAMP,
			]);
			updatemembercount($uid, [(int)$g['credit'] => $amt], true, '', 0, '', '游戏中心', $g['m']['name'].' '.($week ? '周榜' : '每日挑战').'第 '.($i + 1).' 名');
			notification_add($uid, 'system', '恭喜！你在「'.self::safe($g['m']['name']).'」'.$what.'获得第 '.($i + 1).' 名，奖励 '
				.self::safe($cname).' '.$amt.'。 <a href="plugin.php?id=gamecenter&mod=rank&game='.$g['gkey'].'&period='.$period.'&pkey='.$key.'">查看排行</a>', [], 1);
		}
		DB::query('UPDATE %t SET result=%s WHERE gkey=%s AND yw=%s', ['gamecenter_settle', json_encode($res, JSON_UNESCAPED_UNICODE), $g['gkey'], $key]);
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
