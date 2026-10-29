<?php

/**
 * 長局範例 — 伺服器校驗：操作紀錄由前台分段先交（api.checkpoint），平台把各段照順序放進 $data['_chunks']；
 * 這裡把所有段接起來重算分數（每個 'x' 10 分），並回傳附加資料（stats）給「我的紀錄」顯示。
 * 作者：Carinoasd  ·  (C) 2026 Carinoasd
 */

if(!defined('IN_DISCUZ')) {
	exit('Access Denied');
}

class gamecenter_verify__longexample {
	public static function verify($seed, array $data) {
		$log = implode('', (array)($data['_chunks'] ?? [])).(string)($data['tail'] ?? '');
		if($log === '' || strlen($log) > 200000 || !preg_match('/^[x.]+$/', $log)) {   // PCRE 的 {n,m} 上限 65535，長度另外檢查
			return ['ok' => 0, 'reason' => '操作纪录格式不对'];
		}
		$hits = substr_count($log, 'x');
		return ['ok' => 1, 'score' => $hits * 10, 'minms' => $hits * 100,
			'stats' => ['段数' => count((array)($data['_chunks'] ?? [])), '操作数' => strlen($log), '关卡' => (int)($data['level'] ?? 1)]];
	}
}
