<?php
/** 作者：GPT / Codex。Discuz DB 适配；所有状态变化在原连接的事务内完成。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
class gamecenter_room_store {
	/**
	 * RETRY 前缀阻止 X5 驱动在事务中自动重连/重放；unbuffered 保留原始结果，
	 * 让 PDO execute 失败的 errorInfo 也能转换为可捕获的异常。
	 */
	public function query(string $sql, array $args = []) {
		$q = DB::query($sql, $args, 'RETRY', true);
		if($q === false) { throw new RuntimeException('room database query failed', (int)DB::errno()); }
		if($q instanceof PDOStatement && $q->errorCode() !== '00000') {
			$info = $q->errorInfo(); throw new RuntimeException('room database query failed', (int)($info[1] ?? 0));
		}
		return $q;
	}
	public function rows(string $sql, array $args = []): array {
		$q = $this->query($sql, $args); $rows = [];
		while($row = DB::fetch($q)) { $rows[] = $row; }
		DB::free_result($q);
		return $rows;
	}
	public function first(string $sql, array $args = []): array {
		return $this->rows($sql, $args)[0] ?? [];
	}
	public function transaction(callable $work) {
		// 在 begin 之前固定并校验三个房间表的物理连接，拒绝跨库映射破坏原子性。
		$connection = null;
		foreach(['gamecenter_room','gamecenter_room_member','gamecenter_room_action'] as $table) {
			DB::table($table);
			$current = DB::object()->curlink;
			if($connection !== null && $current !== $connection) { throw new RuntimeException('room tables must share one connection'); }
			$connection = $current;
		}
		DB::table('gamecenter_room');
		// SELECT @@SESSION 会被 Discuz querysafe 拦截；通过 SHOW 读取同一连接的值。
		$timeout = $this->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'");
		if(!isset($timeout['Value']) || !preg_match('/^[0-9]+$/D', (string)$timeout['Value'])) {
			throw new RuntimeException('cannot read room lock wait timeout');
		}
		$previousTimeout = (int)$timeout['Value'];
		$roomTimeout = min(2, $previousTimeout);
		if($previousTimeout !== $roomTimeout) { $this->query('SET SESSION innodb_lock_wait_timeout='.$roomTimeout); }
		try {
		for($attempt = 0; $attempt < 3; $attempt++) {
			try {
				if(DB::begin_transaction() === false) { throw new RuntimeException('cannot start room transaction'); }
				$result = $work();
				if(DB::commit() === false) { throw new RuntimeException('cannot commit room transaction'); }
				return $result;
			} catch(Throwable $e) {
				try { DB::rollback(); } catch(Throwable $ignored) {}
				$code = (int)$e->getCode();
				if(!in_array($code, [1213, 1205, 1062], true) || $attempt === 2) { throw $e; }
				usleep(random_int(10000, 30000));
			}
		}
		} finally {
			// 不把房间专用的短等待设置遗留给其他论坛操作或持久连接。
			if($previousTimeout !== $roomTimeout) {
				try { $this->query('SET SESSION innodb_lock_wait_timeout='.$previousTimeout); } catch(Throwable $ignored) {}
			}
		}
	}
	public function save(array $r): void {
		$this->query('UPDATE %t SET white_uid=%d,white_name=%s,board=%s,status=%d,turn=%d,winner=%d,reason=%s,version=%d,deadline_ms=%d,last_cell=%d,updated_ms=%d WHERE id=%d',
			['gamecenter_room', $r['white_uid'], $r['white_name'], $r['board'], $r['status'], $r['turn'], $r['winner'], $r['reason'], $r['version'], $r['deadline_ms'], $r['last_cell'], $r['updated_ms'], $r['id']]);
	}
}
