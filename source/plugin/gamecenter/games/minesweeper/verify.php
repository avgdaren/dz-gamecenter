<?php

/**
 * minesweeper — 16×16 / 40 雷的确定性重播校验，规则版本 1。
 * 作者：小蓝。适配 gamecenter（原作者 Carinoasd，(C) 2026）。
 * 本文件不读写数据库、不发积分；平台负责凭证与保存成绩。
 *
 * 盘面 = 种子 + 首个点开的格子（与 game.js 完全一致）：
 *   Park–Miller：s = s × 48271 mod 2147483647
 *   从 0..255 里用部分 Fisher–Yates 抽出 40 个雷；
 *   首点周围九宫格若含雷，按同一随机流把雷挪到九宫格外的空格。
 * 提交 { v, score, first, open }：open 为翻开的格子（逗号分隔）。
 * 恰好 216 个互不相同的非雷格 = 全部安全格，即通关；score 为用时毫秒。
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_verify_minesweeper {

	const W = 16;
	const H = 16;
	const CELLS = 256;
	const MINES = 40;
	const SAFE = 216;
	const RULE = 1;
	const MIN_MS = 3000;
	const MAX_MS = 7200000;
	const MAX_BYTES = 2000;

	/** 与 game.js 的 makeBoard() 逐行对应。回传长度 256 的 0/1 数组。 */
	public static function board($seed, $first) {
		$idx = range(0, self::CELLS - 1);
		$s = (int)$seed;
		for($i = 0; $i < self::MINES; $i++) {
			$s = ($s * 48271) % 2147483647;
			$j = $i + $s % (self::CELLS - $i);
			$t = $idx[$i];
			$idx[$i] = $idx[$j];
			$idx[$j] = $t;
		}
		$mine = array_fill(0, self::CELLS, 0);
		for($i = 0; $i < self::MINES; $i++) {
			$mine[$idx[$i]] = 1;
		}

		$fx = $first % self::W;
		$fy = intdiv($first, self::W);
		$guard = [];
		for($dy = -1; $dy <= 1; $dy++) {
			for($dx = -1; $dx <= 1; $dx++) {
				$x = $fx + $dx;
				$y = $fy + $dy;
				if($x >= 0 && $y >= 0 && $x < self::W && $y < self::H) {
					$guard[$y * self::W + $x] = 1;
				}
			}
		}
		$hit = false;
		for($i = 0; $i < self::MINES; $i++) {
			if(isset($guard[$idx[$i]])) {
				$hit = true;
				break;
			}
		}
		if($hit) {
			$free = [];
			for($i = 0; $i < self::CELLS; $i++) {
				if(!$mine[$i] && !isset($guard[$i])) {
					$free[] = $i;
				}
			}
			for($i = 0; $i < self::MINES; $i++) {
				$k = $idx[$i];
				if(!isset($guard[$k])) {
					continue;
				}
				$s = ($s * 48271) % 2147483647;
				$p = $s % count($free);
				$to = $free[$p];
				$last = count($free) - 1;
				$free[$p] = $free[$last];
				array_pop($free);
				$mine[$k] = 0;
				$mine[$to] = 1;
			}
		}
		return $mine;
	}

	public static function verify($seed, array $data) {
		foreach(['v', 'score', 'first', 'open'] as $key) {
			if(!isset($data[$key]) || (!is_string($data[$key]) && !is_int($data[$key]))) {
				return ['ok' => 0, 'reason' => '成绩数据不完整或格式不正确'];
			}
		}
		if((string)$data['v'] !== (string)self::RULE) {
			return ['ok' => 0, 'reason' => '游戏已更新，请刷新页面后重新开始'];
		}

		$claim = (string)$data['score'];
		if(!preg_match('/\A[1-9][0-9]{0,6}\z/', $claim)) {
			return ['ok' => 0, 'reason' => '计时格式不正确'];
		}
		$ms = (int)$claim;
		if($ms < self::MIN_MS || $ms > self::MAX_MS) {
			return ['ok' => 0, 'reason' => '计时不在合理范围内'];
		}

		$first = (string)$data['first'];
		if(!preg_match('/\A[0-9]{1,3}\z/', $first) || (int)$first >= self::CELLS) {
			return ['ok' => 0, 'reason' => '首点位置不正确'];
		}
		$first = (int)$first;

		if(!is_int($seed) || $seed < 1 || $seed > 2147483646) {
			return ['ok' => 0, 'reason' => '开局数据不正确，请重新开始'];
		}

		$raw = (string)$data['open'];
		if(strlen($raw) > self::MAX_BYTES || !preg_match('/\A[0-9]{1,3}(?:,[0-9]{1,3})*\z/', $raw)) {
			return ['ok' => 0, 'reason' => '开格记录格式错误或过长'];
		}
		$cells = explode(',', $raw);
		if(count($cells) !== self::SAFE) {
			return ['ok' => 0, 'reason' => '还没扫完，或开格记录数量不对'];
		}

		$mine = self::board($seed, $first);
		$seen = [];
		foreach($cells as $text) {
			$i = (int)$text;
			if($i >= self::CELLS) {
				return ['ok' => 0, 'reason' => '开格记录超出棋盘'];
			}
			if(isset($seen[$i])) {
				return ['ok' => 0, 'reason' => '开格记录有重复'];
			}
			$seen[$i] = 1;
			if($mine[$i]) {
				return ['ok' => 0, 'reason' => '开格记录里出现了雷'];
			}
		}
		// 216 个互不相同的非雷格，等于把全部安全格都翻开了。
		// 注意：这里只校验「翻开了哪些格」，不校验「真的用了多久」。
		// minms = 申报值，平台要求真实耗时 ≥ 0.85×score − 1500 ms；
		// 申报 3000 ms 时门槛只有 1050 ms——拦得住秒交，拦不住把成绩改短。
		return ['ok' => 1, 'score' => $ms, 'minms' => $ms];
	}
}
