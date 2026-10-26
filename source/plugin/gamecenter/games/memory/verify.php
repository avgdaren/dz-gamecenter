<?php

/**
 * memory — 翻牌配对的确定性重播校验，规则版本 1。
 * 作者：GPT / Codex。适配 gamecenter（原作者 Carinoasd，(C) 2026）。
 * 本文件不读写数据库、不发积分；平台负责凭证和保存成绩。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_verify_memory {

	const RULE = 1;
	const MAX_ATTEMPTS = 256;
	const MAX_BYTES = 2048;

	/** 与 game.js 相同的 Fisher–Yates 顺序；运行环境为 64 位 PHP。 */
	public static function deck($seed) {
		$cards = [];
		for($i = 0; $i < 8; $i++) {
			$cards[] = $i;
			$cards[] = $i;
		}
		$s = (int)$seed;
		for($i = 15; $i > 0; $i--) {
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
		if((string)$data['v'] !== (string)self::RULE) {
			return ['ok' => 0, 'reason' => '游戏已更新，请刷新页面后重新开始'];
		}
		$claim = (string)$data['score'];
		if(strlen($claim) > 3 || !preg_match('/\A[1-9][0-9]*\z/', $claim)
			|| (int)$claim < 8 || (int)$claim > self::MAX_ATTEMPTS) {
			return ['ok' => 0, 'reason' => '尝试次数不正确'];
		}
		$raw = (string)$data['moves'];
		if(strlen($raw) > self::MAX_BYTES
			|| !preg_match('/\A(?:[0-9]|1[0-5])(?:,(?:[0-9]|1[0-5]))*\z/', $raw)) {
			return ['ok' => 0, 'reason' => '翻牌记录格式错误或过长'];
		}
		$moves = explode(',', $raw);
		$count = count($moves);
		if($count < 16 || $count > self::MAX_ATTEMPTS * 2 || $count % 2 !== 0) {
			return ['ok' => 0, 'reason' => '翻牌记录数量不正确'];
		}
		if(!is_int($seed) || $seed < 1 || $seed > 2147483646) {
			return ['ok' => 0, 'reason' => '开局数据不正确，请重新开始'];
		}
		$cards = self::deck($seed);
		$matched = array_fill(0, 16, false);
		$pairs = 0;
		for($i = 0; $i < $count; $i += 2) {
			$a = (int)$moves[$i];
			$b = (int)$moves[$i + 1];
			if($pairs === 8) {
				return ['ok' => 0, 'reason' => '已完成配对后仍有多余操作'];
			}
			if($a === $b || $matched[$a] || $matched[$b]) {
				return ['ok' => 0, 'reason' => '不能重复翻开同一张或已配对的牌'];
			}
			if($cards[$a] === $cards[$b]) {
				$matched[$a] = $matched[$b] = true;
				$pairs++;
			}
		}
		if($pairs !== 8) {
			return ['ok' => 0, 'reason' => '尚未完成全部配对'];
		}
		$score = intdiv($count, 2);
		if((int)$claim !== $score) {
			return ['ok' => 0, 'reason' => '重播次数与提交成绩不符'];
		}
		return ['ok' => 1, 'score' => $score];
	}
}
