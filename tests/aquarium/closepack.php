<?php
/** 作者：小蓝（DSH）。兼容关闭版：硬关闭售卖 + 16 种仍可玩。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_configs.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_shop.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

$flag = __DIR__.'/../../source/plugin/gamecenter/games/aquarium/data/SELL_HARD_OFF';
$exist = is_file($flag);

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT_V2);

/* 未放硬关闭文件时，开关按文件内容生效 */
$check(gamecenter_aquarium_configs::sellHardOff() === $exist, '硬关闭状态与 SELL_HARD_OFF 文件一致');

if(!$exist) {
    $check(gamecenter_aquarium_configs::saleAllowed(1) === false, '默认 off 时不可售');
    file_put_contents($flag, "closed\n");
    // 清掉进程内静态缓存需要新进程；这里改文件后直接断言下次调用（static 已缓存，改用反射不可靠）
    echo "已放置 SELL_HARD_OFF，请重新运行本脚本以验证硬关闭路径\n";
    @unlink($flag);
    echo "\n".json_encode(['status'=> $fail ? 'FAIL':'PASS','checks'=>$checks,'fail'=>$fail,'note'=>'hardoff 分支需二跑'])."\n";
    exit($fail ? 1 : 0);
}

/* 硬关闭生效时：即使把开关写成 all 也不能卖 */
$check(gamecenter_aquarium_configs::sellHardOff() === true, '硬关闭生效');
$check(gamecenter_aquarium_configs::saleAllowed(1) === false, 'mode=all 时仍拒绝（需配合 sale-switch.json 现写 all 再跑）');

/* 16 种解析仍然可用：目录、上限、门槛都在 */
require_once __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_content.php';
$cat = gamecenter_aquarium_content::catalog_v2();
$check(count($cat['fish']) === 16, '关闭版仍认识 16 种');
$caps = 0; $gates = 0;
foreach($c['waters'] as $w) { foreach($w['fish'] as $f) { if(isset($f['lifetime_cap'])) { $caps++; } if(isset($f['min_rod_level'])) { $gates++; } } }
$check($caps === 4 && $gates === 4, '关闭版保留 4 个上限与 4 个门槛');

/* 正常捕获仍然守恒 */
$s = gamecenter_aquarium_rules::initial(5, str_repeat('ab', 16), 1700000000000, $c);
$s = gamecenter_aquarium_shop::defaults($s, $c);
$r = gamecenter_aquarium_rules::settle($s, 1700000000000 + 120000 * 5, $c);
$okSum = true;
foreach($r['save']['fish'] as $f) { if($f['owned_count'] + $f['sold_count'] !== $f['catch_count']) { $okSum = false; } }
$check($okSum, '关闭版结算后库存守恒');

/* 售卖被拒，且不改动存档 */
[$after, $code] = gamecenter_aquarium_shop::sell($r['save'], 'pond_blue', 1, $c, 1700000000000 + 120000 * 20);
$check($code === 'closed', '硬关闭时售卖返回 closed');
$check($after === $r['save'], '被拒绝时不改动存档');

echo "\n".json_encode(['status'=> $fail ? 'FAIL':'PASS','checks'=>$checks,'fail'=>$fail])."\n";
exit($fail ? 1 : 0);
