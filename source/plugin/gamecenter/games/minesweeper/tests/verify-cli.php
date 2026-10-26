<?php

/** tests/verify-cli.php — 读入 {seed, data:{…}}，输出 verify() 的 JSON 结果。 */

define('IN_DISCUZ', true);
require __DIR__.'/../verify.php';

$raw = stream_get_contents(STDIN);
$in = json_decode((string)$raw, true);
if(!is_array($in) || !isset($in['data']) || !is_array($in['data'])) {
	fwrite(STDERR, "invalid json input\n");
	exit(1);
}
echo json_encode(gamecenter_verify_minesweeper::verify((int)$in['seed'], $in['data']), JSON_UNESCAPED_UNICODE);
