<?php
/** 作者：Carinoasd。诊断日志：走原生 writelog、不再写进网站可下载的 games/aquarium/data/。CLI，不连数据库。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) { $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; } };
$legacy = __DIR__.'/../../source/plugin/gamecenter/games/aquarium/data/diag.log';
$before = is_file($legacy) ? filesize($legacy) : -1;

// 没有论坛环境：什么都不写
gamecenter_aquarium::diag('no-forum', 1);
$check((is_file($legacy) ? filesize($legacy) : -1) === $before, '没有 helper_log 时不写 data/diag.log');

// 模拟原生 helper_log（条件式宣告，PHP 不会提前载入，上面那一步才真的是「没有论坛环境」）
$check(!class_exists('helper_log'), '前一步确实没有 helper_log');
if(!class_exists('helper_log')) {
    final class helper_log {
        public static array $calls = [];
        public static function writelog($file, $log): void { self::$calls[] = [$file, $log]; }
    }
}
gamecenter_aquarium::diag("line1\nline2\t".str_repeat('x', 500), 42);
$call = helper_log::$calls[0] ?? null;
$check($call !== null && $call[0] === 'gamecenter_aquarium', '写进 gamecenter_aquarium 日志');
$check($call !== null && str_contains($call[1], "uid=42") && !str_contains(substr($call[1], strpos($call[1], 'uid=')), "\n"), '只有一行，带 uid');
$check($call !== null && strlen(explode("\t", $call[1], 3)[2] ?? '') <= 200, '讯息截到 200 字');
$check((is_file($legacy) ? filesize($legacy) : -1) === $before, '有 helper_log 时也不写 data/diag.log');

echo "\n".json_encode(['status' => $fail ? 'FAIL' : 'PASS', 'checks' => $checks, 'fail' => $fail])."\n";
exit($fail ? 1 : 0);
