<?php

/**
 * memory — 翻牌配对的确定性重播校验。
 * 作者：GPT / Codex / 小蓝。适配 gamecenter（原作者 Carinoasd，(C) 2026）。
 * 本文件不读写数据库、不发积分；平台负责凭证和保存成绩。
 *
 * 规则版本：
 *   v=1  固定 8 对（16 张），保持对旧版在途成绩的兼容
 *   v=2  按 pairs 组装牌桌（自由 8 对、每日挑战 15 对）；未带 pairs 时按 8 对
 * 两版共用同一套洗牌与重放逻辑，仅牌桌规模不同。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_verify_memory {

	const RULE = 2;
	const RULE_LEGACY = 1;
	const MIN_PAIRS = 8;
	const MAX_PAIRS = 15;
	const MAX_ATTEMPTS = 512;
	const MAX_BYTES = 4096;

	/** 与 game.js 相同的 Fisher–Yates 顺序；运行环境为 64 位 PHP。 */
	public static function deck($seed, $pairs = self::MIN_PAIRS) {
		$cards = [];
		for($i = 0; $i < $pairs; $i++) {
			$cards[] = $i;
			$cards[] = $i;
		}
		$total = $pairs * 2;
		$s = (int)$seed;
		for($i = $total - 1; $i > 0; $i--) {
			$s = ($s * 48271) % 2147483647;
			$j = $s % ($i + 1);
			[$cards[$i], $cards[$j]] = [$cards[$j], $cards[$i]];
		}
		return $cards;
	}

	public static function verify($seed, array $data) {
		foreach(['v', 'score', 'moves'] as $key) {
			if(!isset($data[$key]) || (!is_string($data[$key]) && !is_int($data[$key]))) {
				return ['ok' => 0, 'reason' => '成绩数据不完整或格式不正确'];
			}
		}
		$rule = (string)$data['v'];
		if($rule !== (string)self::RULE && $rule !== (string)self::RULE_LEGACY) {
			return ['ok' => 0, 'reason' => '游戏已更新，请刷新页面后重新开始'];
		}
		// 规则 1 只能 8 对；规则 2 按 pairs（未带按 8 对）
		$pairs_target = self::MIN_PAIRS;
		if($rule === (string)self::RULE && isset($data['pairs'])) {
			$p = (string)$data['pairs'];
			if(!preg_match('/\A[1-9][0-9]?\z/', $p)
				|| (int)$p < self::MIN_PAIRS || (int)$p > self::MAX_PAIRS) {
				return ['ok' => 0, 'reason' => '对数量不正确'];
			}
			$pairs_target = (int)$p;
		}
		$cards_total = $pairs_target * 2;
		$claim = (string)$data['score'];
		if(strlen($claim) > 4 || !preg_match('/\A[1-9][0-9]*\z/', $claim)
			|| (int)$claim < $pairs_target || (int)$claim > self::MAX_ATTEMPTS) {
			return ['ok' => 0, 'reason' => '尝试次数不正确'];
		}
		$raw = (string)$data['moves'];
		if(strlen($raw) > self::MAX_BYTES
			|| !preg_match('/\A[0-9]{1,2}(?:,[0-9]{1,2})*\z/', $raw)) {
			return ['ok' => 0, 'reason' => '翻牌记录格式错误或过长'];
		}
		$moves = explode(',', $raw);
		$count = count($moves);
		if($count < $cards_total || $count > self::MAX_ATTEMPTS * 2 || $count % 2 !== 0) {
			return ['ok' => 0, 'reason' => '翻牌记录数量不正确'];
		}
		if(!is_int($seed) || $seed < 1 || $seed > 2147483646) {
			return ['ok' => 0, 'reason' => '开局数据不正确，请重新开始'];
		}
		$cards = self::deck($seed, $pairs_target);
		$matched = array_fill(0, $cards_total, false);
		$pairs = 0;
		for($i = 0; $i < $count; $i += 2) {
			$a = (int)$moves[$i];
			$b = (int)$moves[$i + 1];
			if($pairs === $pairs_target) {
				return ['ok' => 0, 'reason' => '已完成配对后仍有多余操作'];
			}
			if($a < 0 || $b < 0 || $a >= $cards_total || $b >= $cards_total) {
				return ['ok' => 0, 'reason' => '翻牌的牌位超出本局范围'];
			}
			if($a === $b || $matched[$a] || $matched[$b]) {
				return ['ok' => 0, 'reason' => '不能重复翻开同一张或已配对的牌'];
			}
			if($cards[$a] === $cards[$b]) {
				$matched[$a] = $matched[$b] = true;
				$pairs++;
			}
		}
		if($pairs !== $pairs_target) {
			return ['ok' => 0, 'reason' => '尚未完成全部配对'];
		}
		$score = intdiv($count, 2);
		if((int)$claim !== $score) {
			return ['ok' => 0, 'reason' => '重播次数与提交成绩不符'];
		}
		return ['ok' => 1, 'score' => $score];
	}
}
