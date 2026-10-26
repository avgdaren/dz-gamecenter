<?php
/** 作者：GPT / Codex。五子棋纯规则；不依赖 Discuz 会话或数据库。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }

class gamecenter_gomoku {
	const WAITING = 0;
	const PLAYING = 1;
	const FINISHED = 2;
	const CANCELLED = 3;
	const TURN_MS = 60000;
	const WAIT_MS = 300000;

	public static function expire(array $r, int $now): array {
		if($now < (int)$r['deadline_ms']) { return $r; }
		if((int)$r['status'] === self::WAITING) {
			$r['status'] = self::CANCELLED;
			$r['reason'] = 'expired';
		} elseif((int)$r['status'] === self::PLAYING) {
			$r['status'] = self::FINISHED;
			$r['winner'] = (int)$r[(int)$r['turn'] === 1 ? 'white_uid' : 'black_uid'];
			$r['reason'] = 'timeout';
		} else { return $r; }
		$r['version']++;
		$r['updated_ms'] = $now;
		return $r;
	}

	public static function won(string $board, int $cell, string $stone): bool {
		$x = $cell % 15; $y = intdiv($cell, 15);
		foreach([[1, 0], [0, 1], [1, 1], [1, -1]] as [$dx, $dy]) {
			$count = 1;
			foreach([-1, 1] as $sign) {
				for($n = 1; $n < 15; $n++) {
					$nx = $x + $dx * $n * $sign; $ny = $y + $dy * $n * $sign;
					if($nx < 0 || $nx > 14 || $ny < 0 || $ny > 14 || $board[$ny * 15 + $nx] !== $stone) { break; }
					$count++;
				}
			}
			if($count >= 5) { return true; }
		}
		return false;
	}

	/** 返回错误码；成功以新房间数组返回。调用方先在锁内执行 expire。 */
	public static function move(array $r, int $uid, int $cell, int $version, int $now): array|string {
		if((int)$r['status'] !== self::PLAYING) { return 'ended'; }
		if((int)$r['version'] !== $version) { return 'conflict'; }
		$side = (int)$r['turn'];
		if((int)$r[$side === 1 ? 'black_uid' : 'white_uid'] !== $uid) { return 'turn'; }
		if($cell < 0 || $cell >= 225 || $r['board'][$cell] !== '0') { return 'cell'; }
		$r['board'][$cell] = (string)$side;
		$r['last_cell'] = $cell;
		$r['version']++;
		$r['updated_ms'] = $now;
		if(self::won($r['board'], $cell, (string)$side)) {
			$r['status'] = self::FINISHED; $r['winner'] = $uid; $r['reason'] = 'five';
		} elseif(strpos($r['board'], '0') === false) {
			$r['status'] = self::FINISHED; $r['winner'] = 0; $r['reason'] = 'draw';
		} else { $r['turn'] = 3 - $side; $r['deadline_ms'] = $now + self::TURN_MS; }
		return $r;
	}
}
