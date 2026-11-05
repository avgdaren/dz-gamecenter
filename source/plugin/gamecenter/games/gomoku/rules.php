<?php

/**
 * 好友五子棋 — 規則（15×15，連五及以上獲勝，無禁手，滿盤和棋）。
 * 原規則：GPT / Codex（1.3.0 lib/gomoku.php）；1.4.0 改成平台通用房間的規則檔。
 *
 * 狀態：['b' => 225 字元的棋盤（0 空／1 黑／2 白）, 'last' => 最後落子格, 'turn' => 輪到的座位]
 * 一步：['cell' => 0～224]
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_rules_gomoku extends gamecenter_rules {
	const PLAYERS = 2;
	const TURN_MS = 60000;
	const WAIT_MS = 300000;
	const RATING = true;

	public static function init($seed, $players) {
		return ['b' => str_repeat('0', 225), 'last' => -1, 'turn' => 1];
	}

	public static function move($state, $seat, $payload, $seed) {
		$cell = (int)($payload['cell'] ?? -1);
		$b = (string)($state['b'] ?? '');
		if(strlen($b) !== 225) {
			return 'rules';
		}
		if($cell < 0 || $cell >= 225 || $b[$cell] !== '0') {
			return 'cell';
		}
		$b[$cell] = (string)$seat;
		$state['b'] = $b;
		$state['last'] = $cell;
		if(self::won($b, $cell, (string)$seat)) {
			$state['over'] = 1;
			$state['winner'] = $seat;
			$state['reason'] = 'five';
		} elseif(strpos($b, '0') === false) {
			$state['over'] = 1;
			$state['winner'] = 0;
			$state['reason'] = 'draw';
		} else {
			$state['turn'] = 3 - $seat;
		}
		return $state;
	}

	public static function won($board, $cell, $stone) {
		$x = $cell % 15;
		$y = intdiv($cell, 15);
		foreach([[1, 0], [0, 1], [1, 1], [1, -1]] as [$dx, $dy]) {
			$count = 1;
			foreach([-1, 1] as $sign) {
				for($n = 1; $n < 15; $n++) {
					$nx = $x + $dx * $n * $sign;
					$ny = $y + $dy * $n * $sign;
					if($nx < 0 || $nx > 14 || $ny < 0 || $ny > 14 || $board[$ny * 15 + $nx] !== $stone) {
						break;
					}
					$count++;
				}
			}
			if($count >= 5) {
				return true;
			}
		}
		return false;
	}
}
