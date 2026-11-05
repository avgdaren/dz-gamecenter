<?php

/**
 * 遊戲中心 gamecenter — 通用聯機房間（1.4.0）。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 * 1.3.0 的五子棋專用房間（GPT / Codex）改寫成通用框架：規則搬到 games/<gkey>/rules.php，
 * 平台負責開房、加入、自動配對、狀態同步、回合限時、重送去重、認輸、逾時判定、等級分、對局紀錄與回放。
 *
 * 一款聯機遊戲只要寫 games/<gkey>/rules.php（繼承 gamecenter_rules）：
 *   const PLAYERS = 2;            幾個人一局（2～4）
 *   const TURN_MS = 60000;        每回合限時（毫秒）
 *   const WAIT_MS = 300000;       等人加入的時限（毫秒）
 *   const RATING  = true;         要不要算等級分（只有 2 人遊戲會算）
 *   static init($seed, $players)                  → 初始狀態（陣列，一定要有 'turn' => 1）
 *   static move($state, $seat, $payload, $seed)   → 新狀態，或錯誤碼字串（'cell'／'turn'／'input'…）
 *                                                    結束時狀態帶 'over' => 1、'winner' => 座位（0＝和棋）、'reason' => 原因
 *   static timeout($state, $seat)                 → 選用；某座位超時後的狀態（預設：這一位判負）
 *   static view($state, $seat)                    → 選用；給某座位看的狀態（有隱藏資訊的遊戲用；0＝旁觀／回放）
 * 狀態是陣列，平台以 JSON 存進 pre_gamecenter_room.state；每一步的 payload 存進 room_action（回放用）。
 *
 * 資料表：gamecenter_room（房間）、room_seat（誰坐哪一座）、room_member（每人目前的房間指標）、
 *        room_action（操作去重＋回放）、match（配對佇列）、rating（等級分）。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

require_once __DIR__.'/room_store.php';

/** 規則檔的基底：給預設的超時與檢視行為。 */
abstract class gamecenter_rules {
	const PLAYERS = 2;
	const TURN_MS = 60000;
	const WAIT_MS = 300000;
	const RATING = true;

	abstract public static function init($seed, $players);
	abstract public static function move($state, $seat, $payload, $seed);

	/** 預設：超時的那一位判負（2 人）；多人則整局結束、無勝者。 */
	public static function timeout($state, $seat) {
		$state['over'] = 1;
		$state['reason'] = 'timeout';
		$state['winner'] = static::PLAYERS === 2 ? 3 - (int)$seat : 0;
		return $state;
	}

	public static function view($state, $seat) {
		return $state;
	}
}

class gamecenter_room {
	const WAITING = 0;
	const PLAYING = 1;
	const FINISHED = 2;
	const CANCELLED = 3;
	const PAYLOAD_MAX = 2048;    // 一步的資料上限（JSON 位元組）
	const QUEUE_TTL = 90;        // 配對佇列多久沒心跳就當離開（秒）
	const ELO_K = 32;

	private $db;
	private $game;
	private $rules;
	private $cfg;
	private $clock;

	/** $game 是 gamecenter_core::game() 的結果。 */
	public function __construct(array $game, ?gamecenter_room_store $db = null, ?callable $clock = null) {
		$this->game = $game;
		$this->db = $db ?? new gamecenter_room_store();
		$this->clock = $clock ?? fn() => (int)floor(microtime(true) * 1000);
		$this->rules = self::rules_class($game['gkey']);
		$this->cfg = self::config($game);
	}

	/** 載入規則類別，沒有就回 ''。 */
	public static function rules_class($gkey) {
		if(!gamecenter_core::valid_key($gkey)) {
			return '';
		}
		$f = gamecenter_core::game_dir($gkey).'/rules.php';
		$cls = 'gamecenter_rules_'.$gkey;
		if(!class_exists($cls, false) && is_file($f)) {
			require_once $f;
		}
		return class_exists($cls, false) && is_subclass_of($cls, 'gamecenter_rules') ? $cls : '';
	}

	/** 房間設定：規則常數為主，game.json 的 room 物件可覆寫 players／turn_ms／wait_ms／rating。 */
	public static function config(array $game) {
		$cls = self::rules_class($game['gkey']);
		$o = is_array($game['m']['room'] ?? null) ? $game['m']['room'] : [];
		$players = (int)($o['players'] ?? ($cls ? $cls::PLAYERS : 2));
		return [
			'players' => max(2, min(4, $players)),
			'turn_ms' => max(5000, min(86400000, (int)($o['turn_ms'] ?? ($cls ? $cls::TURN_MS : 60000)))),
			'wait_ms' => max(30000, min(86400000, (int)($o['wait_ms'] ?? ($cls ? $cls::WAIT_MS : 300000)))),
			'rating' => (bool)($o['rating'] ?? ($cls ? $cls::RATING : true)),
		];
	}

	private function now() {
		return (int)($this->clock)();
	}

	private function error($code, ?array $r = null, $me = 0) {
		$text = [
			'login' => '请先登录论坛账号', 'permission' => '当前账号没有参与权限', 'input' => '请求参数不正确',
			'not_found' => '房间不存在或你没有访问权限', 'full' => '房间已满或已经结束', 'active' => '你已有进行中的房间，请先完成或取消',
			'conflict' => '局面已更新，请查看最新棋盘', 'turn' => '还没有轮到你', 'cell' => '这个位置不能落子', 'rules' => '这一步不符合规则',
			'ended' => '这一局已经结束', 'request_conflict' => '请求标识已被其他操作使用，请同步棋盘',
			'upgrade' => '请管理员先在后台更新游戏中心', 'rate' => '创建房间过于频繁，请稍后再试', 'busy' => '服务暂时繁忙，请稍后重试',
			'norules' => '这个游戏缺少规则文件（rules.php）',
		];
		return ['ok' => 0, 'code' => $code, 'msg' => $text[$code] ?? $text['busy'], 'server_ms' => $this->now(), 'room' => $r ? $this->snapshot($r, $me) : null];
	}

	private function ok(?array $r, $me = 0, array $extra = []) {
		return ['ok' => 1, 'server_ms' => $this->now(), 'room' => $r ? $this->snapshot($r, $me) : null] + $extra;
	}

	/* ---------- 房間列的輔助 ---------- */

	private static function players_of(array $r) {
		$p = json_decode((string)$r['players'], true);
		return is_array($p) ? array_values($p) : [];
	}

	private static function state_of(array $r) {
		$s = json_decode((string)$r['state'], true);
		return is_array($s) ? $s : [];
	}

	/** 某人的座位（1 起），不在房裡回 0。 */
	public static function seat_of(array $r, $uid) {
		foreach(self::players_of($r) as $i => $p) {
			if((int)$p['uid'] === (int)$uid) {
				return $i + 1;
			}
		}
		return 0;
	}

	/** 給前台的房間快照；state 經過規則的 view()（隱藏資訊）。$me＝看的人的座位。 */
	public function snapshot(array $r, $me = 0) {
		$players = [];
		foreach(self::players_of($r) as $i => $p) {
			$players[] = ['seat' => $i + 1, 'uid' => (int)$p['uid'], 'name' => (string)$p['name']];
		}
		$state = self::state_of($r);
		if($this->rules) {
			$state = $this->rules::view($state, (int)$me);
		}
		return [
			'code' => (string)$r['code'], 'gkey' => (string)$r['gkey'], 'status' => (int)$r['status'], 'kind' => (int)$r['kind'],
			'players' => $players, 'nplayers' => (int)$r['nplayers'], 'me' => (int)$me,
			'turn' => (int)$r['turn'], 'state' => $state, 'version' => (int)$r['version'],
			'winner' => (int)$r['winner'], 'winner_seat' => (int)$r['winner'] ? self::seat_of($r, (int)$r['winner']) : 0,
			'reason' => (string)$r['reason'], 'deadline_ms' => (int)$r['deadline_ms'],
			'created_ms' => (int)$r['created_ms'], 'updated_ms' => (int)$r['updated_ms'],
			'ratings' => $r['ratings'] !== '' ? json_decode((string)$r['ratings'], true) : null,
		];
	}

	private static function number($value, $max) {
		if((!is_int($value) && !is_string($value)) || !preg_match('/\A(?:0|[1-9][0-9]{0,9})\z/', (string)$value)) {
			return null;
		}
		$n = (int)$value;
		return $n <= $max ? $n : null;
	}

	/* ---------- 入口 ---------- */

	/**
	 * $uid／$name／$allowed 由呼叫端從論壇會話取得。$data 是 POST。
	 * action：current／create／join／match／match_cancel／state／move／resign／history／replay
	 */
	public function request($uid, $name, $allowed, array $data) {
		$uid = (int)$uid;
		if($uid < 1) {
			return $this->error('login');
		}
		if(!$allowed) {
			return $this->error('permission');
		}
		if(!$this->rules) {
			return $this->error('norules');
		}
		if(strlen(serialize($data)) > 8192) {
			return $this->error('input');
		}
		foreach($data as $value) {
			if(!is_scalar($value)) {
				return $this->error('input');
			}
		}
		$action = (string)($data['action'] ?? '');
		if(!in_array($action, ['current', 'create', 'join', 'match', 'match_cancel', 'state', 'move', 'resign', 'history', 'replay'], true)) {
			return $this->error('input');
		}
		$code = strtoupper((string)($data['room'] ?? ''));
		if(in_array($action, ['join', 'state', 'move', 'resign', 'replay'], true) && !preg_match('/\A[A-F0-9]{12}\z/', $code)) {
			return $this->error('input');
		}
		$rid = (string)($data['request_id'] ?? '');
		if(in_array($action, ['create', 'move', 'resign', 'match'], true) && !preg_match('/\A[a-f0-9]{32}\z/', $rid)) {
			return $this->error('input');
		}
		$version = self::number($data['version'] ?? '', 4294967295);
		if(in_array($action, ['move', 'resign'], true) && ($version === null || $version < 1)) {
			return $this->error('input');
		}
		$payload = [];
		if($action === 'move') {
			$raw = (string)($data['data'] ?? '');
			if($raw === '' || strlen($raw) > self::PAYLOAD_MAX) {
				return $this->error('input');
			}
			$payload = json_decode($raw, true);
			if(!is_array($payload)) {
				return $this->error('input');
			}
		}
		preg_match('/\A.{0,40}/us', (string)$name, $match);
		$name = $match[0] !== '' ? $match[0] : 'UID '.$uid;
		try {
			switch($action) {
				case 'create':
					$result = $this->create($uid, $name, $rid);
					try {
						$this->sweep();
					} catch(Throwable $e) {
					}
					return $result;
				case 'join':
					return $this->join($uid, $name, $code);
				case 'match':
					$result = $this->match($uid, $name, $rid);
					try {
						$this->sweep();
					} catch(Throwable $e) {
					}
					return $result;
				case 'match_cancel':
					$this->db->query('DELETE FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_match', $this->game['gkey'], $uid]);
					return $this->ok(null);
				case 'move':
				case 'resign':
					return $this->mutate($uid, $code, $action, $version, $payload, $rid);
				case 'history':
					return $this->history($uid);
				case 'replay':
					return $this->replay($uid, $code);
				case 'current':
					return $this->current($uid);
				default:
					return $this->read($uid, $code);
			}
		} catch(Throwable $e) {
			if(function_exists('runlog')) {
				runlog('gamecenter_room', 'operation failed; code='.(int)$e->getCode().' '.$e->getMessage());
			}
			return (int)$e->getCode() === 1146 ? $this->error('upgrade') : $this->error('busy') + ['retryable' => 1];
		}
	}

	/* ---------- 讀 ---------- */

	private function lockCode($code) {
		return $this->db->first('SELECT * FROM %t WHERE code=%s FOR UPDATE', ['gamecenter_room', $code]);
	}

	private function lockId($id) {
		return $this->db->first('SELECT * FROM %t WHERE id=%d FOR UPDATE', ['gamecenter_room', (int)$id]);
	}

	/** 每人的「目前房間」指標（鎖住）。 */
	private function pointer($uid) {
		$this->db->query('INSERT IGNORE INTO %t (uid, room_id) VALUES (%d, 0)', ['gamecenter_room_member', $uid]);
		return $this->db->first('SELECT * FROM %t WHERE uid=%d FOR UPDATE', ['gamecenter_room_member', $uid]);
	}

	/** 逾時判定：WAITING 過期→取消；PLAYING 超時→規則的 timeout()。有變動就寫回。 */
	private function fresh(array $r, $now = null) {
		$now = $now ?? $this->now();
		if($now < (int)$r['deadline_ms'] || (int)$r['status'] >= self::FINISHED) {
			return $r;
		}
		$prev = (int)$r['status'];
		if($prev === self::WAITING) {
			$r['status'] = self::CANCELLED;
			$r['reason'] = 'expired';
		} else {
			$state = $this->rules::timeout(self::state_of($r), (int)$r['turn']);
			$r = $this->apply($r, $state);
			$r['status'] = self::FINISHED;
			$r['reason'] = (string)($state['reason'] ?? 'timeout');
		}
		$r['version'] = (int)$r['version'] + 1;
		$r['updated_ms'] = $now;
		$this->persist($r, $prev);
		return $r;
	}

	/** 把規則回傳的狀態套回房間列（turn／winner／state）。 */
	private function apply(array $r, array $state) {
		$r['state'] = json_encode($state, JSON_UNESCAPED_UNICODE);
		$r['turn'] = max(0, min(4, (int)($state['turn'] ?? $r['turn'])));
		if(!empty($state['over'])) {
			$ws = (int)($state['winner'] ?? 0);
			$players = self::players_of($r);
			$r['winner'] = $ws >= 1 && isset($players[$ws - 1]) ? (int)$players[$ws - 1]['uid'] : 0;
		}
		return $r;
	}

	/** 寫回房間；剛結束的一局算等級分、記局數（等級分變動寫回 $r，回給前台的快照才帶得到）。 */
	private function persist(array &$r, $prev) {
		$this->db->save($r);
		if($prev < self::FINISHED && (int)$r['status'] === self::FINISHED) {
			$r['ratings'] = $this->finish($r);
		}
	}

	private function current($uid) {
		$p = $this->db->first('SELECT room_id FROM %t WHERE uid=%d', ['gamecenter_room_member', $uid]);
		if(!empty($p['room_id'])) {
			$res = $this->db->transaction(function() use ($uid, $p) {
				$r = $this->lockId((int)$p['room_id']);
				if(!$r || !self::seat_of($r, $uid)) {
					return null;
				}
				$r = $this->fresh($r);
				return (int)$r['status'] < self::FINISHED ? $this->ok($r, self::seat_of($r, $uid)) : null;
			});
			if($res !== null) {
				return $res;
			}
		}
		// 在配對佇列裡：順便當心跳
		$q = $this->db->first('SELECT uid FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_match', $this->game['gkey'], $uid]);
		if($q) {
			$this->db->query('UPDATE %t SET dateline=%d WHERE gkey=%s AND uid=%d', ['gamecenter_match', TIMESTAMP, $this->game['gkey'], $uid]);
			$n = (int)$this->db->first('SELECT COUNT(*) AS n FROM %t WHERE gkey=%s AND dateline>%d', ['gamecenter_match', $this->game['gkey'], TIMESTAMP - self::QUEUE_TTL])['n'];
			return $this->ok(null, 0, ['queued' => 1, 'waiting' => $n]);
		}
		return $this->ok(null);
	}

	private function read($uid, $code) {
		return $this->db->transaction(function() use ($uid, $code) {
			$r = $this->lockCode($code);
			if(!$r || $r['gkey'] !== $this->game['gkey']) {
				return $this->error('not_found');
			}
			$me = self::seat_of($r, $uid);
			// 結束的對局成員以外也看得到（分享戰績）；進行中只有成員看得到
			if(!$me && (int)$r['status'] < self::FINISHED) {
				return $this->error('not_found');
			}
			return $this->ok($this->fresh($r), $me);
		});
	}

	/* ---------- 開房／加入／配對 ---------- */

	/** 這個人目前有沒有進行中的房間（在交易內、已鎖指標）。有回房間列。 */
	private function activeRoom($uid) {
		$p = $this->db->first('SELECT room_id FROM %t WHERE uid=%d', ['gamecenter_room_member', $uid]);
		if(empty($p['room_id'])) {
			return null;
		}
		$old = $this->lockId((int)$p['room_id']);
		if(!$old) {
			return null;
		}
		$old = $this->fresh($old);
		return (int)$old['status'] < self::FINISHED ? $old : null;
	}

	private function insertRoom(array $players, $status, $kind, $rid = '') {
		$now = $this->now();
		$seed = random_int(1, 2147483646);
		$state = $this->rules::init($seed, count($players));
		if(!is_array($state)) {
			$state = [];
		}
		$state['turn'] = max(1, (int)($state['turn'] ?? 1));
		$code = strtoupper(bin2hex(random_bytes(6)));
		$plist = [];
		foreach($players as $p) {
			$plist[] = ['uid' => (int)$p[0], 'name' => (string)$p[1]];
		}
		$this->db->query('INSERT INTO %t (code, gkey, kind, nplayers, players, state, seed, black_uid, white_uid, black_name, white_name, create_request, board, status, turn, deadline_ms, created_ms, updated_ms)
			VALUES (%s, %s, %d, %d, %s, %s, %d, %d, %d, %s, %s, %s, %s, %d, %d, %d, %d, %d)', [
			'gamecenter_room', $code, $this->game['gkey'], $kind, $this->cfg['players'], json_encode($plist, JSON_UNESCAPED_UNICODE), json_encode($state, JSON_UNESCAPED_UNICODE), $seed,
			(int)$plist[0]['uid'], (int)($plist[1]['uid'] ?? 0), $plist[0]['name'], (string)($plist[1]['name'] ?? ''), $rid, '',
			$status, $state['turn'], $now + ($status === self::PLAYING ? $this->cfg['turn_ms'] : $this->cfg['wait_ms']), $now, $now,
		]);
		$id = (int)DB::insert_id();
		foreach($plist as $i => $p) {
			$this->seat($id, (int)$p['uid'], $i + 1);
		}
		return $this->lockId($id);
	}

	private function seat($roomId, $uid, $seat) {
		$this->db->query('INSERT IGNORE INTO %t (room_id, uid, seat, dateline) VALUES (%d, %d, %d, %d)', ['gamecenter_room_seat', $roomId, $uid, $seat, TIMESTAMP]);
		$this->db->query('INSERT INTO %t (uid, room_id) VALUES (%d, %d) ON DUPLICATE KEY UPDATE room_id=%d', ['gamecenter_room_member', $uid, $roomId, $roomId]);
	}

	private function create($uid, $name, $rid) {
		return $this->db->transaction(function() use ($uid, $name, $rid) {
			$this->pointer($uid);
			$old = $this->db->first('SELECT * FROM %t WHERE black_uid=%d AND create_request=%s FOR UPDATE', ['gamecenter_room', $uid, $rid]);
			if($old) {
				return $this->ok($this->fresh($old), self::seat_of($old, $uid), ['replayed' => 1]);
			}
			if($active = $this->activeRoom($uid)) {
				return $this->error('active', $active, self::seat_of($active, $uid));
			}
			$now = $this->now();
			$rate = $this->db->first('SELECT COUNT(*) AS n FROM %t WHERE black_uid=%d AND created_ms>%d', ['gamecenter_room', $uid, $now - 600000]);
			if((int)$rate['n'] >= 30) {
				return $this->error('rate');
			}
			$this->db->query('DELETE FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_match', $this->game['gkey'], $uid]);
			$r = $this->insertRoom([[$uid, $name]], self::WAITING, 0, $rid);
			return $this->ok($r, 1);
		});
	}

	private function join($uid, $name, $code) {
		return $this->db->transaction(function() use ($uid, $name, $code) {
			$this->pointer($uid);
			$r = $this->lockCode($code);
			if(!$r || $r['gkey'] !== $this->game['gkey']) {
				return $this->error('not_found');
			}
			if($me = self::seat_of($r, $uid)) {
				return $this->ok($this->fresh($r), $me, ['replayed' => 1]);
			}
			if(($active = $this->activeRoom($uid)) && $active['code'] !== $code) {
				return $this->error('active', $active, self::seat_of($active, $uid));
			}
			$now = $this->now();
			$r = $this->fresh($r, $now);
			$players = self::players_of($r);
			if((int)$r['status'] !== self::WAITING || count($players) >= (int)$r['nplayers']) {
				return $this->error('full');
			}
			$players[] = ['uid' => $uid, 'name' => $name];
			$r['players'] = json_encode($players, JSON_UNESCAPED_UNICODE);
			if(count($players) === 2) {
				$r['white_uid'] = $uid;
				$r['white_name'] = $name;
			}
			$r['version'] = (int)$r['version'] + 1;
			$r['updated_ms'] = $now;
			if(count($players) >= (int)$r['nplayers']) {
				$r['status'] = self::PLAYING;
				$r['deadline_ms'] = $now + $this->cfg['turn_ms'];
			}
			$this->db->save($r);
			$this->seat((int)$r['id'], $uid, count($players));
			$this->db->query('DELETE FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_match', $this->game['gkey'], $uid]);
			return $this->ok($r, count($players));
		});
	}

	/** 自動配對：佇列裡湊滿人就直接開一間 PLAYING 的房；不夠就排隊（回 queued）。 */
	private function match($uid, $name, $rid) {
		return $this->db->transaction(function() use ($uid, $name, $rid) {
			$this->pointer($uid);
			if($active = $this->activeRoom($uid)) {
				return $this->ok($active, self::seat_of($active, $uid));
			}
			$gkey = $this->game['gkey'];
			$need = $this->cfg['players'] - 1;
			$this->db->query('DELETE FROM %t WHERE gkey=%s AND dateline<%d', ['gamecenter_match', $gkey, TIMESTAMP - self::QUEUE_TTL]);
			$others = $this->db->rows('SELECT uid FROM %t WHERE gkey=%s AND uid<>%d ORDER BY dateline, uid LIMIT '.$need.' FOR UPDATE', ['gamecenter_match', $gkey, $uid]);
			foreach($others as $i => $o) {
				$others[$i]['username'] = (string)DB::result_first('SELECT username FROM %t WHERE uid=%d', ['common_member', (int)$o['uid']]);
			}
			if(count($others) < $need) {
				$this->db->query('INSERT INTO %t (gkey, uid, dateline) VALUES (%s, %d, %d) ON DUPLICATE KEY UPDATE dateline=%d', ['gamecenter_match', $gkey, $uid, TIMESTAMP, TIMESTAMP]);
				return $this->ok(null, 0, ['queued' => 1, 'waiting' => count($others) + 1]);
			}
			// 對方若其實已經在別的房間（指標沒清乾淨），跳過他
			$players = [];
			foreach($others as $o) {
				$this->pointer((int)$o['uid']);
				if($this->activeRoom((int)$o['uid'])) {
					$this->db->query('DELETE FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_match', $gkey, (int)$o['uid']]);
					continue;
				}
				$players[] = [(int)$o['uid'], (string)($o['username'] ?: 'UID '.$o['uid'])];
			}
			if(count($players) < $need) {
				$this->db->query('INSERT INTO %t (gkey, uid, dateline) VALUES (%s, %d, %d) ON DUPLICATE KEY UPDATE dateline=%d', ['gamecenter_match', $gkey, $uid, TIMESTAMP, TIMESTAMP]);
				return $this->ok(null, 0, ['queued' => 1, 'waiting' => count($players) + 1]);
			}
			// 先排隊的人先手；自己排最後
			$players[] = [$uid, $name];
			$uids = array_map(fn($p) => $p[0], $players);
			$this->db->query('DELETE FROM %t WHERE gkey=%s AND uid IN (%n)', ['gamecenter_match', $gkey, $uids]);
			$r = $this->insertRoom($players, self::PLAYING, 1, $rid);
			return $this->ok($r, self::seat_of($r, $uid));
		});
	}

	/* ---------- 走子／認輸 ---------- */

	private function mutate($uid, $code, $action, $version, array $payload, $rid) {
		return $this->db->transaction(function() use ($uid, $code, $action, $version, $payload, $rid) {
			$r = $this->lockCode($code);
			if(!$r || $r['gkey'] !== $this->game['gkey'] || !($me = self::seat_of($r, $uid))) {
				return $this->error('not_found');
			}
			$raw = json_encode($payload, JSON_UNESCAPED_UNICODE);
			$fingerprint = hash('sha256', $action.'|'.$version.'|'.$raw);
			$prior = $this->db->first('SELECT fingerprint, version FROM %t WHERE room_id=%d AND uid=%d AND request_id=%s', ['gamecenter_room_action', $r['id'], $uid, $rid]);
			if($prior) {
				$r = $this->fresh($r);
				return hash_equals($prior['fingerprint'], $fingerprint)
					? $this->ok($r, $me, ['replayed' => 1, 'accepted_version' => (int)$prior['version']])
					: $this->error('request_conflict', $r, $me);
			}
			$now = $this->now();
			$prev = (int)$r['status'];
			$r = $this->fresh($r, $now);
			if((int)$r['version'] !== $version) {
				return $this->error('conflict', $r, $me);
			}
			if((int)$r['status'] >= self::FINISHED) {
				return $this->error('ended', $r, $me);
			}
			$next = $r;
			if($action === 'move') {
				if((int)$r['status'] !== self::PLAYING) {
					return $this->error('ended', $r, $me);
				}
				if((int)$r['turn'] !== $me) {
					return $this->error('turn', $r, $me);
				}
				$state = $this->rules::move(self::state_of($r), $me, $payload, (int)$r['seed']);
				if(!is_array($state)) {
					return $this->error(is_string($state) && $state !== '' ? $state : 'rules', $r, $me);
				}
				$next = $this->apply($r, $state);
				if(!empty($state['over'])) {
					$next['status'] = self::FINISHED;
					$next['reason'] = (string)($state['reason'] ?? 'end');
				} else {
					$next['deadline_ms'] = $now + $this->cfg['turn_ms'];
				}
			} else {
				if((int)$r['status'] === self::WAITING) {
					$next['status'] = self::CANCELLED;
					$next['reason'] = 'cancelled';
				} else {
					$next['status'] = self::FINISHED;
					$next['reason'] = 'resign';
					$players = self::players_of($r);
					// 2 人：對方贏；多人：剩下的人裡輪到的下一位算勝（簡化）
					$next['winner'] = count($players) === 2 ? (int)$players[$me === 1 ? 1 : 0]['uid'] : 0;
				}
			}
			$next['version'] = (int)$r['version'] + 1;
			$next['updated_ms'] = $now;
			$this->persist($next, $prev);
			$this->db->query('INSERT INTO %t (room_id, uid, request_id, fingerprint, action, cell, data, version, created_ms) VALUES (%d, %d, %s, %s, %s, %d, %s, %d, %d)',
				['gamecenter_room_action', $r['id'], $uid, $rid, $fingerprint, $action, (int)($payload['cell'] ?? -1), $raw, $next['version'], $now]);
			return $this->ok($next, $me, ['accepted_version' => (int)$next['version']]);
		});
	}

	/* ---------- 結束：等級分、局數 ---------- */

	private function finish(array $r) {
		DB::query('UPDATE %t SET plays=plays+1 WHERE gkey=%s', ['gamecenter_game', $r['gkey']]);
		$players = self::players_of($r);
		if(!$this->cfg['rating'] || count($players) !== 2 || in_array((string)$r['reason'], ['expired', 'cancelled'], true)) {
			return '';
		}
		$a = (int)$players[0]['uid'];
		$b = (int)$players[1]['uid'];
		if($a <= 0 || $b <= 0 || $a === $b) {
			return '';
		}
		$ra = $this->rating_row($r['gkey'], $a);
		$rb = $this->rating_row($r['gkey'], $b);
		$w = (int)$r['winner'];
		$sa = $w === $a ? 1.0 : ($w === $b ? 0.0 : 0.5);
		$ea = 1 / (1 + pow(10, ($rb['rating'] - $ra['rating']) / 400));
		$da = (int)round(self::ELO_K * ($sa - $ea));
		$na = max(100, $ra['rating'] + $da);
		$nb = max(100, $rb['rating'] - $da);
		$this->db->query('UPDATE %t SET rating=%d, wins=wins+%d, losses=losses+%d, draws=draws+%d, dateline=%d WHERE gkey=%s AND uid=%d',
			['gamecenter_rating', $na, $sa === 1.0 ? 1 : 0, $sa === 0.0 ? 1 : 0, $sa === 0.5 ? 1 : 0, TIMESTAMP, $r['gkey'], $a]);
		$this->db->query('UPDATE %t SET rating=%d, wins=wins+%d, losses=losses+%d, draws=draws+%d, dateline=%d WHERE gkey=%s AND uid=%d',
			['gamecenter_rating', $nb, $sa === 0.0 ? 1 : 0, $sa === 1.0 ? 1 : 0, $sa === 0.5 ? 1 : 0, TIMESTAMP, $r['gkey'], $b]);
		$ratings = json_encode([
			['uid' => $a, 'before' => $ra['rating'], 'after' => $na],
			['uid' => $b, 'before' => $rb['rating'], 'after' => $nb],
		]);
		$this->db->query('UPDATE %t SET ratings=%s WHERE id=%d', ['gamecenter_room', $ratings, (int)$r['id']]);
		return $ratings;
	}

	private function rating_row($gkey, $uid) {
		$this->db->query('INSERT IGNORE INTO %t (gkey, uid, rating, dateline) VALUES (%s, %d, 1500, %d)', ['gamecenter_rating', $gkey, $uid, TIMESTAMP]);
		$row = $this->db->first('SELECT rating FROM %t WHERE gkey=%s AND uid=%d FOR UPDATE', ['gamecenter_rating', $gkey, $uid]);
		return ['rating' => (int)($row['rating'] ?? 1500)];
	}

	/* ---------- 紀錄與回放 ---------- */

	private function history($uid) {
		$rows = $this->db->rows('SELECT r.* FROM %t s JOIN %t r ON r.id=s.room_id WHERE s.uid=%d AND r.gkey=%s AND r.status>=2 ORDER BY r.updated_ms DESC, r.id DESC LIMIT 10',
			['gamecenter_room_seat', 'gamecenter_room', $uid, $this->game['gkey']]);
		return $this->ok(null, 0, ['history' => array_map(fn($r) => $this->snapshot($r, self::seat_of($r, $uid)), $rows)]);
	}

	/** 回放：結束的對局，照順序回每一步（座位、payload）。非成員也能看結束的局。 */
	private function replay($uid, $code) {
		$r = $this->db->first('SELECT * FROM %t WHERE code=%s', ['gamecenter_room', $code]);
		if(!$r || $r['gkey'] !== $this->game['gkey'] || (int)$r['status'] < self::FINISHED) {
			return $this->error('not_found');
		}
		$moves = [];
		foreach($this->db->rows('SELECT uid, action, data, version, created_ms FROM %t WHERE room_id=%d AND action=%s ORDER BY version', ['gamecenter_room_action', (int)$r['id'], 'move']) as $a) {
			$d = json_decode((string)$a['data'], true);
			$moves[] = ['seat' => self::seat_of($r, (int)$a['uid']), 'data' => is_array($d) ? $d : ['cell' => -1], 'ms' => (int)$a['created_ms']];
		}
		return $this->ok($r, self::seat_of($r, $uid), ['moves' => $moves, 'seed' => (int)$r['seed']]);
	}

	/* ---------- 清理 ---------- */

	/** 逾時房間判定（每輪最多 $limit 間）＋清掉沒心跳的配對佇列。 */
	public function sweep($limit = 5) {
		$limit = max(1, min(50, (int)$limit));
		$now = $this->now();
		$rows = $this->db->rows('SELECT id FROM %t WHERE status<2 AND deadline_ms<=%d ORDER BY deadline_ms LIMIT '.$limit, ['gamecenter_room', $now]);
		foreach($rows as $row) {
			$this->db->transaction(function() use ($row) {
				$r = $this->lockId((int)$row['id']);
				if($r) {
					$this->fresh($r);
				}
			});
		}
		$this->db->query('DELETE FROM %t WHERE dateline<%d', ['gamecenter_match', TIMESTAMP - self::QUEUE_TTL]);
		return count($rows);
	}

	/** 所有聯機遊戲的逾時房間一起掃（計劃任務用）。 */
	public static function sweep_all($limit = 50) {
		$n = 0;
		foreach(gamecenter_core::games(false) as $g) {
			if(!gamecenter_core::is_room($g) || !self::rules_class($g['gkey'])) {
				continue;
			}
			$n += (new self($g))->sweep($limit);
		}
		return $n;
	}

	/* ---------- 給頁面用的查詢 ---------- */

	public static function rating_board($gkey, $limit = 10, $start = 0) {
		return DB::fetch_all('SELECT r.uid, r.rating, r.wins, r.losses, r.draws, m.username FROM %t r LEFT JOIN %t m ON m.uid=r.uid
			WHERE r.gkey=%s AND r.wins+r.losses+r.draws>0 ORDER BY r.rating DESC, r.wins DESC, r.uid ASC '.DB::limit($start, $limit),
			['gamecenter_rating', 'common_member', $gkey]);
	}

	public static function rating_count($gkey) {
		return (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND wins+losses+draws>0', ['gamecenter_rating', $gkey]);
	}

	public static function my_rating($gkey, $uid) {
		$r = DB::fetch_first('SELECT rating, wins, losses, draws FROM %t WHERE gkey=%s AND uid=%d', ['gamecenter_rating', $gkey, (int)$uid]);
		if(!$r) {
			return null;
		}
		$r['rank'] = 1 + (int)DB::result_first('SELECT COUNT(*) FROM %t WHERE gkey=%s AND wins+losses+draws>0 AND (rating>%d OR (rating=%d AND (wins>%d OR (wins=%d AND uid<%d))))',
			['gamecenter_rating', $gkey, $r['rating'], $r['rating'], $r['wins'], $r['wins'], (int)$uid]);
		return $r;
	}

	/** 某人最近的對局（給「我的紀錄」）。 */
	public static function recent_of($uid, $limit = 20) {
		return DB::fetch_all('SELECT r.* FROM %t s JOIN %t r ON r.id=s.room_id WHERE s.uid=%d AND r.status>=2 ORDER BY r.updated_ms DESC, r.id DESC '.DB::limit(0, $limit),
			['gamecenter_room_seat', 'gamecenter_room', (int)$uid]);
	}

	/** 對局結果的一句話（給頁面）。 */
	public static function outcome_text(array $r, $uid = 0) {
		$reason = ['five' => '连五', 'draw' => '和棋', 'resign' => '认输', 'timeout' => '超时', 'expired' => '无人加入', 'cancelled' => '已取消', 'end' => '终局'];
		$why = $reason[(string)$r['reason']] ?? (string)$r['reason'];
		if((int)$r['status'] === self::CANCELLED) {
			return $why;
		}
		$w = (int)$r['winner'];
		if(!$w) {
			return '和棋'.($why !== '和棋' ? '（'.$why.'）' : '');
		}
		$name = '';
		foreach(self::players_of($r) as $p) {
			if((int)$p['uid'] === $w) {
				$name = (string)$p['name'];
			}
		}
		if($uid) {
			return ($w === (int)$uid ? '胜' : '负').'（'.$why.'）';
		}
		return $name.' 胜（'.$why.'）';
	}

	public static function players_text(array $r) {
		$names = [];
		foreach(self::players_of($r) as $p) {
			$names[] = (string)$p['name'];
		}
		return implode(' vs ', $names);
	}
}
