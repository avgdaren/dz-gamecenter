<?php

/** tests/board-cli.php — 读入 [{seed,first}…]，输出每盘的雷位（0/1 数组），用来和 game.js 对拍。 */

define('IN_DISCUZ', true);
require __DIR__.'/../verify.php';

$raw = stream_get_contents(STDIN);
$in = json_decode((string)$raw, true);
if(!is_array($in)) {
	fwrite(STDERR, "invalid json input\n");
	exit(1);
}
$out = [];
foreach($in as $row) {
	$out[] = gamecenter_verify_minesweeper::board((int)$row['seed'], (int)$row['first']);
}
echo json_encode($out);
