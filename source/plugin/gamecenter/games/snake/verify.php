<?php

/**
 * 遊戲中心 gamecenter — 貪食蛇伺服器校驗：用開局種子重播玩家的轉向紀錄，算出真正的分數。
 *
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 *
 * 規則（第 2 版，1.1.0 起）必須與 game.js 完全一致：
 *   棋盤 30×30；蛇一開始在 (15,15)(14,15)(13,15) 向右；方向 0右 1下 2左 3上。
 *   亂數 Park–Miller：s = s*48271 mod 2147483647。
 *   放東西＝空格（由上而下、由左而右，不含蛇身、食物、金星）第 next()%空格數 格。
 *   每一步（tick 從 1 起算）：先套用該步的轉向（不能直接回頭），再前進；
 *     沒吃到食物也沒吃到金星時尾巴先縮；撞牆或撞到自己＝結束。
 *     吃到金星 +50 分（蛇變長、不加速）；吃到食物 +10 分、已吃數 +1，然後放新食物；
 *     已吃數是 5 的倍數且場上沒有金星時放金星，第 t+50 步結束時消失。
 *     填滿棋盤＝過關。
 *   連擊：食物出現時記下「蛇頭到食物的曼哈頓距離 d」與當時步數；從出現起 d+2 步內吃到＝連擊 +1，否則連擊歸零。
 *     吃食物得 10 + 5×min(連擊, 4) 分（最多 30）。金星不影響連擊。
 *   每步的間隔 max(55, 115 - 已吃數×2) 毫秒，用來算「最少要花多久」。
 * 前台送來：v（規則版本，必須是 2）、score、ticks（結束在第幾步）、moves（"步:方向,步:方向…"）。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_verify_snake {

	const RULE = 2;
	const W = 30;
	const H = 30;
	const MAXTICKS = 60000;
	const BONUS_EVERY = 5;
	const BONUS_LIFE = 50;
	const BONUS_SCORE = 50;
	const FOOD_SCORE = 10;
	const COMBO_STEP = 5;
	const COMBO_MAX = 4;
	const COMBO_SLACK = 2;

	public static function interval($eaten) {
		return max(55, 115 - $eaten * 2);
	}

	public static function verify($seed, array $data) {
		if((int)($data['v'] ?? 0) !== self::RULE) {
			return ['ok' => 0, 'reason' => '游戏已更新，请重新整理页面后再玩'];
		}
		$ticks = (int)($data['ticks'] ?? 0);
		$claim = (int)($data['score'] ?? -1);
		$raw = (string)($data['moves'] ?? '');
		if($ticks < 1 || $ticks > self::MAXTICKS) {
			return ['ok' => 0, 'reason' => '步数不合理'];
		}
		if($raw !== '' && !preg_match('/^\d+:[0-3](,\d+:[0-3])*$/', $raw)) {
			return ['ok' => 0, 'reason' => '操作纪录格式错误'];
		}
		$moves = [];
		$prev = 0;
		foreach($raw === '' ? [] : explode(',', $raw) as $p) {
			[$t, $d] = explode(':', $p);
			$t = (int)$t;
			if($t <= $prev || $t > $ticks) {
				return ['ok' => 0, 'reason' => '操作纪录顺序错误'];
			}
			$moves[$t] = (int)$d;
			$prev = $t;
		}

		$W = self::W;
		$H = self::H;
		$s = (int)$seed;
		$occ = [];
		$body = [[15, 15], [14, 15], [13, 15]];   // 頭在前
		foreach($body as [$x, $y]) {
			$occ[$y * $W + $x] = true;
		}
		$food = -1;
		$bonus = -1;
		$place = function() use (&$occ, &$s, &$food, &$bonus, $W, $H) {
			$free = [];
			for($i = 0; $i < $W * $H; $i++) {
				if(empty($occ[$i]) && $i !== $food && $i !== $bonus) {
					$free[] = $i;
				}
			}
			if(!$free) {
				return -1;
			}
			$s = ($s * 48271) % 2147483647;
			return $free[$s % count($free)];
		};
		$food = $place();
		$foodtick = 0;
		$fooddist = $food < 0 ? 0 : abs($food % $W - 15) + abs(intdiv($food, $W) - 15);
		$streak = 0;
		$bonusexp = 0;
		$dir = 0;
		$eaten = 0;
		$score = 0;
		$minms = 0;
		$dx = [1, 0, -1, 0];
		$dy = [0, 1, 0, -1];
		$end = 0;
		for($t = 1; $t <= $ticks; $t++) {
			$minms += self::interval($eaten);
			if(isset($moves[$t]) && $moves[$t] !== ($dir + 2) % 4) {
				$dir = $moves[$t];
			}
			$hx = $body[0][0] + $dx[$dir];
			$hy = $body[0][1] + $dy[$dir];
			if($hx < 0 || $hy < 0 || $hx >= $W || $hy >= $H) {
				$end = $t;
				break;
			}
			$hi = $hy * $W + $hx;
			$eat = $hi === $food;
			$star = $hi === $bonus;
			if(!$eat && !$star) {
				$tail = array_pop($body);
				unset($occ[$tail[1] * $W + $tail[0]]);
			}
			if(!empty($occ[$hi])) {
				$end = $t;
				break;
			}
			array_unshift($body, [$hx, $hy]);
			$occ[$hi] = true;
			if($star) {
				$score += self::BONUS_SCORE;
				$bonus = -1;
			}
			if($eat) {
				$eaten++;
				$streak = $t - $foodtick <= $fooddist + self::COMBO_SLACK ? $streak + 1 : 0;
				$score += self::FOOD_SCORE + self::COMBO_STEP * min($streak, self::COMBO_MAX);
				$food = -1;
				$food = $place();
				if($food < 0) {
					$end = $t;   // 填滿棋盤
					break;
				}
				$foodtick = $t;
				$fooddist = abs($food % $W - $hx) + abs(intdiv($food, $W) - $hy);
				if($eaten % self::BONUS_EVERY === 0 && $bonus < 0) {
					$bonus = $place();
					$bonusexp = $t + self::BONUS_LIFE;
				}
			}
			if($bonus >= 0 && $t >= $bonusexp) {
				$bonus = -1;
			}
		}
		if($end !== $ticks) {
			return ['ok' => 0, 'reason' => '重播结果与成绩不符'];
		}
		if($claim !== $score) {
			return ['ok' => 0, 'reason' => '重播分数与成绩不符'];
		}
		return ['ok' => 1, 'score' => $score, 'minms' => $minms];
	}
}
