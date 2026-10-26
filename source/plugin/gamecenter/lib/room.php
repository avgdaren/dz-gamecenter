<?php
/** 作者：GPT / Codex。五子棋房间服务；鉴权由论坛适配，规则集中在 gomoku.php。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/gomoku.php';
require_once __DIR__.'/room_store.php';

class gamecenter_room {
	private $db;
	private $clock;
	public function __construct(?gamecenter_room_store $db = null, ?callable $clock = null) {
		$this->db = $db ?? new gamecenter_room_store();
		$this->clock = $clock ?? fn() => (int)floor(microtime(true) * 1000);
	}
	private function now(): int { return (int)($this->clock)(); }
	private function error(string $code, ?array $r = null): array {
		$text = ['login'=>'请先登录论坛账号', 'permission'=>'当前账号没有参与权限', 'input'=>'请求参数不正确',
			'not_found'=>'房间不存在或你没有访问权限', 'full'=>'房间已满或已经结束', 'active'=>'你已有活动房间，请先完成或取消',
			'conflict'=>'局面已更新，请查看最新棋盘', 'turn'=>'还没有轮到你', 'cell'=>'这个位置不能落子',
			'ended'=>'这一局已经结束', 'request_conflict'=>'请求标识已被其他操作使用，请同步棋盘',
			'upgrade'=>'请管理员先升级游戏中心，创建联机数据表', 'rate'=>'创建房间过于频繁，请稍后再试', 'busy'=>'服务暂时繁忙，请稍后重试'];
		return ['ok'=>0, 'code'=>$code, 'msg'=>$text[$code] ?? $text['busy'], 'server_ms'=>$this->now(), 'room'=>$r ? $this->snapshot($r) : null];
	}
	private function snapshot(array $r): array {
		$out = [];
		foreach(['code','board','black_name','white_name','reason'] as $key) { $out[$key] = (string)$r[$key]; }
		foreach(['black_uid','white_uid','status','turn','winner','version','deadline_ms','last_cell','created_ms','updated_ms'] as $key) { $out[$key] = (int)$r[$key]; }
		return $out;
	}
	private function ok(?array $r, array $extra = []): array {
		return ['ok'=>1, 'server_ms'=>$this->now(), 'room'=>$r ? $this->snapshot($r) : null] + $extra;
	}
	private function member(array $r, int $uid): bool { return in_array($uid, [(int)$r['black_uid'], (int)$r['white_uid']], true); }
	private function fresh(array $r, ?int $now = null): array {
		$next = gamecenter_gomoku::expire($r, $now ?? $this->now());
		if((int)$next['version'] !== (int)$r['version']) { $this->db->save($next); }
		return $next;
	}
	private function lockCode(string $code): array { return $this->db->first('SELECT * FROM %t WHERE code=%s FOR UPDATE', ['gamecenter_room',$code]); }
	private function lockId(int $id): array { return $this->db->first('SELECT * FROM %t WHERE id=%d FOR UPDATE', ['gamecenter_room',$id]); }
	private function pointer(int $uid): array {
		$this->db->query('INSERT IGNORE INTO %t (uid,room_id) VALUES (%d,0)', ['gamecenter_room_member',$uid]);
		return $this->db->first('SELECT * FROM %t WHERE uid=%d FOR UPDATE', ['gamecenter_room_member',$uid]);
	}
	private static function number($value, int $max): ?int {
		if((!is_int($value) && !is_string($value)) || !preg_match('/\A(?:0|[1-9][0-9]{0,9})\z/', (string)$value)) { return null; }
		$n = (int)$value; return $n <= $max ? $n : null;
	}

	/** $uid/$name/$allowed 必须由调用层从论坛会话取得。 */
	public function request(int $uid, string $name, bool $allowed, array $data): array {
		if($uid < 1) { return $this->error('login'); }
		if(!$allowed) { return $this->error('permission'); }
		if(strlen(serialize($data)) > 4096) { return $this->error('input'); }
		foreach($data as $value) { if(!is_scalar($value)) { return $this->error('input'); } }
		$action = (string)($data['action'] ?? '');
		if(!in_array($action, ['current','create','join','state','move','resign','history'], true)) { return $this->error('input'); }
		$code = strtoupper((string)($data['room'] ?? ''));
		if(in_array($action, ['join','state','move','resign'], true) && !preg_match('/\A[A-F0-9]{12}\z/', $code)) { return $this->error('input'); }
		$rid = (string)($data['request_id'] ?? '');
		if(in_array($action, ['create','move','resign'], true) && !preg_match('/\A[a-f0-9]{32}\z/', $rid)) { return $this->error('input'); }
		$version = self::number($data['version'] ?? '', 4294967295);
		$cell = self::number($data['cell'] ?? '', 224);
		if(in_array($action, ['move','resign'], true) && ($version === null || $version < 1 || ($action === 'move' && $cell === null))) { return $this->error('input'); }
		preg_match('/\A.{0,40}/us', $name, $match); $name = $match[0] ?? 'UID '.$uid;
		try {
			if($action === 'create') {
				$result = $this->create($uid, $name, $rid);
				try { $this->sweep(); } catch(Throwable $cleanupError) { /* 不把已确认创建变成失败。 */ }
			}
			elseif($action === 'join') { $result = $this->join($uid, $name, $code); }
			elseif($action === 'move' || $action === 'resign') { $result = $this->mutate($uid,$code,$action,$version,$cell ?? -1,$rid); }
			elseif($action === 'history') {
				$rows = $this->db->rows('SELECT * FROM %t WHERE (black_uid=%d OR white_uid=%d) AND status>=2 ORDER BY updated_ms DESC,id DESC LIMIT 10', ['gamecenter_room',$uid,$uid]);
				$result = $this->ok(null, ['history'=>array_map(fn($r)=>$this->snapshot($r),$rows)]);
			} else {
				if($action === 'current') {
					$p = $this->db->first('SELECT room_id FROM %t WHERE uid=%d', ['gamecenter_room_member',$uid]);
					if(empty($p['room_id'])) { return $this->ok(null); }
					$result = $this->read($uid, '', (int)$p['room_id']);
				} else { $result = $this->read($uid,$code); }
			}
			return $result;
		} catch(Throwable $e) {
			if(function_exists('runlog')) { runlog('gamecenter_room','operation failed; code='.(int)$e->getCode()); }
			return (int)$e->getCode() === 1146 ? $this->error('upgrade') : $this->error('busy') + ['retryable'=>1];
		}
	}

	private function create(int $uid, string $name, string $rid): array {
		return $this->db->transaction(function() use($uid,$name,$rid) {
			$this->pointer($uid);
			$old = $this->db->first('SELECT * FROM %t WHERE black_uid=%d AND create_request=%s FOR UPDATE', ['gamecenter_room',$uid,$rid]);
			if($old) { return $this->ok($this->fresh($old), ['replayed'=>1]); }
			$p = $this->db->first('SELECT room_id FROM %t WHERE uid=%d', ['gamecenter_room_member',$uid]);
			if(!empty($p['room_id'])) {
				$old = $this->lockId((int)$p['room_id']);
				if($old) { $old = $this->fresh($old); if((int)$old['status'] < 2) { return $this->error('active',$old); } }
			}
			$now = $this->now();
			$rate = $this->db->first('SELECT COUNT(*) AS n FROM %t WHERE black_uid=%d AND created_ms>%d', ['gamecenter_room',$uid,$now-600000]);
			if((int)$rate['n'] >= 30) { return $this->error('rate'); }
			$code = strtoupper(bin2hex(random_bytes(6)));
			$this->db->query('INSERT INTO %t (code,black_uid,black_name,create_request,board,deadline_ms,created_ms,updated_ms) VALUES (%s,%d,%s,%s,%s,%d,%d,%d)',
				['gamecenter_room',$code,$uid,$name,$rid,str_repeat('0',225),$now+gamecenter_gomoku::WAIT_MS,$now,$now]);
			$id = (int)DB::insert_id();
			$this->db->query('UPDATE %t SET room_id=%d WHERE uid=%d', ['gamecenter_room_member',$id,$uid]);
			return $this->ok($this->lockId($id));
		});
	}
	private function join(int $uid, string $name, string $code): array {
		return $this->db->transaction(function() use($uid,$name,$code) {
			$p = $this->pointer($uid);
			if(!empty($p['room_id'])) {
				$previous = $this->lockId((int)$p['room_id']);
				if($previous) { $previous = $this->fresh($previous); if($previous['code'] !== $code && (int)$previous['status'] < 2) { return $this->error('active',$previous); } }
			}
			$r = $this->lockCode($code);
			if(!$r) { return $this->error('not_found'); }
			// 加入者只获得等待房间的快照；结束/已满房间不会泄露给第三人。
			if($this->member($r,$uid)) { return $this->ok($this->fresh($r), ['replayed'=>1]); }
			$now = $this->now(); $r = $this->fresh($r, $now);
			if((int)$r['status'] !== gamecenter_gomoku::WAITING || (int)$r['white_uid'] !== 0) { return $this->error('full'); }
			$r['white_uid'] = $uid; $r['white_name'] = $name; $r['status'] = gamecenter_gomoku::PLAYING;
			$r['version']++; $r['updated_ms'] = $now; $r['deadline_ms'] = $now + gamecenter_gomoku::TURN_MS;
			$this->db->save($r);
			$this->db->query('UPDATE %t SET room_id=%d WHERE uid=%d', ['gamecenter_room_member',$r['id'],$uid]);
			return $this->ok($r);
		});
	}
	private function read(int $uid, string $code, int $id = 0): array {
		return $this->db->transaction(function() use($uid,$code,$id) {
			$r = $id ? $this->lockId($id) : $this->lockCode($code);
			if(!$r || !$this->member($r,$uid)) { return $this->error('not_found'); }
			return $this->ok($this->fresh($r));
		});
	}
	private function mutate(int $uid, string $code, string $action, int $version, int $cell, string $rid): array {
		return $this->db->transaction(function() use($uid,$code,$action,$version,$cell,$rid) {
			$r = $this->lockCode($code);
			if(!$r || !$this->member($r,$uid)) { return $this->error('not_found'); }
			$fingerprint = hash('sha256', $action.'|'.$version.'|'.$cell);
			$prior = $this->db->first('SELECT fingerprint,version FROM %t WHERE room_id=%d AND uid=%d AND request_id=%s', ['gamecenter_room_action',$r['id'],$uid,$rid]);
			if($prior) {
				$r = $this->fresh($r);
				return hash_equals($prior['fingerprint'],$fingerprint) ? $this->ok($r,['replayed'=>1,'accepted_version'=>(int)$prior['version']]) : $this->error('request_conflict',$r);
			}
			$now = $this->now();
			$r = $this->fresh($r, $now);
			if($action === 'move') { $next = gamecenter_gomoku::move($r,$uid,$cell,$version,$now); }
			else {
				if((int)$r['version'] !== $version) { $next = 'conflict'; }
				elseif((int)$r['status'] >= 2) { $next = 'ended'; }
				else {
					$next = $r; $next['version']++; $next['updated_ms'] = $now;
					if((int)$r['status'] === gamecenter_gomoku::WAITING) { $next['status'] = gamecenter_gomoku::CANCELLED; $next['reason'] = 'cancelled'; }
					else { $next['status'] = gamecenter_gomoku::FINISHED; $next['reason'] = 'resign'; $next['winner'] = (int)$r[(int)$r['black_uid'] === $uid ? 'white_uid' : 'black_uid']; }
				}
			}
			if(is_string($next)) { return $this->error($next,$r); }
			$this->db->save($next);
			$this->db->query('INSERT INTO %t (room_id,uid,request_id,fingerprint,action,cell,version,created_ms) VALUES (%d,%d,%s,%s,%s,%d,%d,%d)',
				['gamecenter_room_action',$r['id'],$uid,$rid,$fingerprint,$action,$cell,$next['version'],$now]);
			return $this->ok($next,['accepted_version'=>(int)$next['version']]);
		});
	}
	/** 供创建请求或插件调度调用；每轮最多处理 limit 个到期房间，保留历史。 */
	public function sweep(int $limit = 5): int {
		$limit = max(1,min(50,$limit)); $now = $this->now();
		$rows = $this->db->rows('SELECT id FROM %t WHERE status<2 AND deadline_ms<=%d ORDER BY deadline_ms LIMIT '.$limit, ['gamecenter_room',$now]);
		foreach($rows as $row) { $this->db->transaction(function() use($row) { $r = $this->lockId((int)$row['id']); if($r) { $this->fresh($r); } }); }
		return count($rows);
	}
}
