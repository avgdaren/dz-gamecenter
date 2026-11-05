<?php

/**
 * 黑白棋 — 規則（8×8，夾住翻面；沒棋可下自動讓手；雙方都沒棋或滿盤結束，子多者勝）。
 * 平台 1.4.0 內建的第二款聯機遊戲，用來驗證通用房間框架：只有這個檔和 game.js，沒有碰平台。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 * 狀態：['b' => 64 字元棋盤（0 空／1 黑／2 白）, 'last' => 最後落子格, 'turn' => 輪到的座位, 'passed' => 剛被讓手的座位（0 無）]
 * 一步：['cell' => 0～63]
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_rules_reversi extends gamecenter_rules {
	const PLAYERS = 2;
	const TURN_MS = 60000;
	const WAIT_MS = 300000;
	const RATING = true;

	public static function init($seed, $players) {
		$b = str_repeat('0', 64);
		$b[27] = '2';
		$b[28] = '1';
		$b[35] = '1';
		$b[36] = '2';
		return ['b' => $b, 'last' => -1, 'turn' => 1, 'passed' => 0];
	}

	/** 下在 $cell 會翻掉哪些格；空陣列＝不合法。 */
	public static function flips($b, $cell, $me) {
		$op = $me === '1' ? '2' : '1';
		if($cell < 0 || $cell >= 64 || $b[$cell] !== '0') {
			return [];
		}
		$x = $cell % 8;
		$y = intdiv($cell, 8);
		$out = [];
		foreach([[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as [$dx, $dy]) {
			$line = [];
			$nx = $x + $dx;
			$ny = $y + $dy;
			while($nx >= 0 && $nx < 8 && $ny >= 0 && $ny < 8 && $b[$ny * 8 + $nx] === $op) {
				$line[] = $ny * 8 + $nx;
				$nx += $dx;
				$ny += $dy;
			}
			if($line && $nx >= 0 && $nx < 8 && $ny >= 0 && $ny < 8 && $b[$ny * 8 + $nx] === $me) {
				$out = array_merge($out, $line);
			}
		}
		return $out;
	}

	public static function has_move($b, $me) {
		for($i = 0; $i < 64; $i++) {
			if($b[$i] === '0' && self::flips($b, $i, $me)) {
				return true;
			}
		}
		return false;
	}

	public static function move($state, $seat, $payload, $seed) {
		$cell = (int)($payload['cell'] ?? -1);
		$b = (string)($state['b'] ?? '');
		if(strlen($b) !== 64) {
			return 'rules';
		}
		$me = (string)$seat;
		$fl = self::flips($b, $cell, $me);
		if(!$fl) {
			return 'cell';
		}
		$b[$cell] = $me;
		foreach($fl as $i) {
			$b[$i] = $me;
		}
		$state['b'] = $b;
		$state['last'] = $cell;
		$state['passed'] = 0;
		$other = 3 - $seat;
		if(self::has_move($b, (string)$other)) {
			$state['turn'] = $other;
		} elseif(self::has_move($b, $me)) {
			$state['turn'] = $seat;        // 對方沒棋，讓手
			$state['passed'] = $other;
		} else {
			$n1 = substr_count($b, '1');
			$n2 = substr_count($b, '2');
			$state['over'] = 1;
			$state['winner'] = $n1 === $n2 ? 0 : ($n1 > $n2 ? 1 : 2);
			$state['reason'] = $n1 === $n2 ? 'draw' : 'end';
		}
		return $state;
	}
}
