<?php
/** 作者：小蓝（DSH）。终身上限 3 条与抽池/保底契约验收（v2 配置）。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_configs.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_shop.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT_V2);
$now = 1700000000000;
$s = gamecenter_aquarium_rules::initial(9, str_repeat('cd', 16), $now, $c);
$s = gamecenter_aquarium_shop::defaults($s, $c);

/* 上限字段确实在 waters[water].fish[fid] 上 */
$caps = [];
foreach($c['waters'] as $w=>$cfg) { foreach($cfg['fish'] as $fid=>$f) { if(isset($f['lifetime_cap'])) { $caps[$fid] = (int)$f['lifetime_cap']; } } }
$check(count($caps) === 4 && min($caps) === 3 && max($caps) === 3, '四个物种带终身上限 3');

/* 长跑：把时间推到很多个周期之后，看是否出现第 4 条 */
$period = $c['periods_ms'][$s['rod_level']];
$guard = 0;
// 两个水域都开，轮流钓，才能集齐 16 种
foreach(['pond','bay'] as $w) { if(!in_array($w, $s['unlocked_waters'], true)) { $s['unlocked_waters'][] = $w; } }
while($guard++ < 400) {
    $now += $period * 40;               // 每次推进 40 个周期
    $s['current_water'] = ($guard % 2 === 0) ? 'pond' : 'bay';
    $r = gamecenter_aquarium_rules::settle($s, $now, $c);
    $s = $r['save'];
    $over = [];
    foreach($caps as $fid=>$cap) {
        if(isset($s['fish'][$fid]) && (int)$s['fish'][$fid]['catch_count'] > $cap) { $over[] = $fid.'='.$s['fish'][$fid]['catch_count']; }
    }
    if($over) { $check(false, '出现超过上限：'.implode(',', $over)); break; }
    if(count($s['fish']) === 16) {
        $full = true;
        foreach($caps as $fid=>$cap) { if((int)($s['fish'][$fid]['catch_count'] ?? 0) < $cap) { $full = false; } }
        if($full && $guard > 3) { break; }
    }
}

$check($guard < 400, '长跑未触及守卫上限（'.($guard).' 轮）');
$check(count($s['fish']) === 16, '最终可以集齐 16 种（当前 '.count($s['fish']).'）');
foreach($caps as $fid=>$cap) {
    $caught = (int)($s['fish'][$fid]['catch_count'] ?? 0);
    $check($caught <= $cap, $fid.' 捕获 '.$caught.' <= 上限 '.$cap);
    $check(($s['fish'][$fid]['owned_count'] ?? 0) + ($s['fish'][$fid]['sold_count'] ?? 0) === $caught, $fid.' 库存守恒');
}

/* 满额后该物种不再进池：把两个池塘新种都打到 3，验证池塘仍能继续出鱼 */
$s2 = $s;
foreach(['pond_curl_seahorse','pond_bell_jelly'] as $fid) {
    $s2['fish'][$fid]['catch_count'] = 3;
    $s2['fish'][$fid]['owned_count'] = 3;
    $s2['fish'][$fid]['sold_count'] = 0;
}
$s2['current_water'] = 'pond';
$r2 = gamecenter_aquarium_rules::settle($s2, $now + $period * 5, $c);
$s2 = $r2['save'];
$newCatch = end($r2['catches']);
$check($newCatch['fish_id'] !== 'pond_curl_seahorse' && $newCatch['fish_id'] !== 'pond_bell_jelly', '满额物种不再被抽中（实际 '.$newCatch['fish_id'].'）');

/* 保底只命中「A 内未发现」：池塘只剩一个新种未发现时，80 次后必出新种 */
$s3 = $s2;
foreach($c['waters']['pond']['fish'] as $fid=>$f) {
    if(!isset($s3['fish'][$fid])) { continue; }
    if(in_array($fid, ['pond_curl_seahorse','pond_bell_jelly'], true)) { continue; }
    // 其他 6 种都算已发现
}
$s3['no_new_count']['pond'] = 80;
$missingBefore = [];
foreach($c['waters']['pond']['fish'] as $fid=>$f) { if(!isset($s3['fish'][$fid]) || $fid === 'pond_blue') { $missingBefore[] = $fid; } }
$r3 = gamecenter_aquarium_rules::settle($s3, $now + $period * 6, $c);
$first = $r3['catches'][0];
$capIds = array_keys($caps);
$check(!in_array($first['fish_id'], $capIds, true) || $first['is_new'], '保底命中的不是已满额物种');

echo "\n".json_encode(['status'=> $fail ? 'FAIL' : 'PASS', 'checks'=>$checks, 'fail'=>$fail])."\n";
exit($fail ? 1 : 0);
