<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。水族馆 Discuz DB 适配；所有状态变化在原连接的事务内完成。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
class gamecenter_aquarium_store {
	/**
	 * RETRY 前缀阻止 X5 驱动在事务中自动重连/重放；unbuffered 保留原始结果，
	 * 让 PDO execute 失败的 errorInfo 也能转换为可捕获的异常。
	 */
	public function query(string $sql, array $args = []) {
		$q = DB::query($sql, $args, 'RETRY', true);
		if($q === false) { throw new RuntimeException('aquarium database query failed', (int)DB::errno()); }
		if($q instanceof PDOStatement && $q->errorCode() !== '00000') {
			$info = $q->errorInfo(); throw new RuntimeException('aquarium database query failed', (int)($info[1] ?? 0));
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
		// 在 begin 之前固定并校验水族馆表的物理连接，拒绝跨库映射破坏原子性。
		$connection = null;
		foreach(['gamecenter_aquarium_save'] as $table) {
			DB::table($table);
			$current = DB::object()->curlink;
			if($connection !== null && $current !== $connection) { throw new RuntimeException('aquarium tables must share one connection'); }
			$connection = $current;
		}
		DB::table('gamecenter_aquarium_save');
		// SELECT @@SESSION 会被 Discuz querysafe 拦截；通过 SHOW 读取同一连接的值。
		$timeout = $this->first("SHOW SESSION VARIABLES LIKE 'innodb_lock_wait_timeout'");
		if(!isset($timeout['Value']) || !preg_match('/^[0-9]+$/D', (string)$timeout['Value'])) {
			throw new RuntimeException('cannot read aquarium lock wait timeout');
		}
		$previousTimeout = (int)$timeout['Value'];
		$roomTimeout = min(2, $previousTimeout);
		if($previousTimeout !== $roomTimeout) { $this->query('SET SESSION innodb_lock_wait_timeout='.$roomTimeout); }
		try {
		for($attempt = 0; $attempt < 3; $attempt++) {
			try {
				if(DB::begin_transaction() === false) { throw new RuntimeException('cannot start aquarium transaction'); }
				$result = $work();
				if(DB::commit() === false) { throw new RuntimeException('cannot commit aquarium transaction'); }
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
    public function lock(int $uid): array {
        return $this->first('SELECT * FROM %t WHERE uid=%d FOR UPDATE',['gamecenter_aquarium_save',$uid]);
    }
    public function insert(array $row): void {
        $this->query('INSERT INTO %t (uid,save_version,config_version,state_json,version,updated_ms) VALUES (%d,%d,%s,%s,%d,%d)',
            ['gamecenter_aquarium_save',$row['uid'],$row['save_version'],$row['config_version'],$row['state_json'],$row['version'],$row['updated_ms']]);
    }
    public function save(array $row): void {
        $this->query('UPDATE %t SET state_json=%s,version=%d,updated_ms=%d WHERE uid=%d',
            ['gamecenter_aquarium_save',$row['state_json'],$row['version'],$row['updated_ms'],$row['uid']]);
    }
}
