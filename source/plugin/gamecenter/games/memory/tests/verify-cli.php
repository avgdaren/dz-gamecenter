<?php
/** 作者：GPT / Codex。仅供 CLI 自测，不提供 HTTP 接口。 */
if(PHP_SAPI !== 'cli') {
	http_response_code(404);
	exit;
}
define('IN_DISCUZ', true);
require dirname(__DIR__).'/verify.php';
try {
	$cases = json_decode(stream_get_contents(STDIN), true, 32, JSON_THROW_ON_ERROR);
	$results = [];
	foreach($cases as $case) {
		$results[] = ($case['op'] ?? '') === 'deck'
			? gamecenter_verify_memory::deck($case['seed'])
			: gamecenter_verify_memory::verify($case['seed'], $case['data']);
	}
	echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch(Throwable $e) {
	fwrite(STDERR, $e->getMessage()."\n");
	exit(1);
}
