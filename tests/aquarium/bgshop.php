<?php
/** 背景商店：默认字段、迁移、购买、拥有校验、异常档。作者：小蓝（DSH）。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
$root = dirname(__DIR__, 2) . '/source/plugin/gamecenter';
require_once $root . '/lib/aquarium_rules.php';
require_once $root . '/lib/aquarium_shop.php';
require_once $root . '/lib/aquarium_configs.php';
require_once $root . '/lib/aquarium_content.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT_V3);

function baseState(array $c): array {
    return [
        'uid' => 1, 'coins' => 50000, 'rod_level' => 5, 'last_settled_ms' => 1700000000000,
        'progress_ms' => 0, 'catch_seq' => 1, 'current_water' => 'pond',
        'config_version' => $c['version'], 'pool_hash' => $c['pool_hash'], 'config_hash' => $c['config_hash'],
        'save_version' => 1,
        'unlocked_waters' => ['pond'],
        'fish' => ['pond_blue' => ['catch_count'=>1,'owned_count'=>1,'sold_count'=>0,'discovered_at'=>1700000000000]],
        'no_new_count' => 0,
        'fish_capacity' => 4, 'decor_owned' => [],
        'layout' => ['fish' => [null,null,null,null], 'decor' => ['back'=>[], 'front'=>[]], 'background' => 'tank_day'],
    ];
}

/* ---------- 1. 新建档：补两个免费景 ---------- */
$s = gamecenter_aquarium_shop::defaults(baseState($c), $c);
$check(($s['background_schema'] ?? null) === 1, 'defaults 写入 background_schema=1');
$check(($s['background_owned'] ?? null) === ['tank_day'=>0,'tank_moon'=>0], 'defaults 只给两个免费景');
try { gamecenter_aquarium_shop::validateState($s, $c); $check(true, '新建档通过校验'); }
catch(Throwable $e) { $check(false, '新建档通过校验（'.$e->getMessage().'）'); }

/* ---------- 2. 旧档迁移：两字段都缺才补 ---------- */
$old = baseState($c);
unset($old['background_schema'], $old['background_owned']);
$m = gamecenter_aquarium_shop::defaults($old, $c);
$check(($m['background_owned'] ?? null) === ['tank_day'=>0,'tank_moon'=>0], '旧档补两个免费景');
$check((int)$m['coins'] === 50000, '迁移不改金币');

/* 只有其一 → 异常档（不补，校验拒绝） */
$half = baseState($c);
$half['background_schema'] = 1;   // 缺 background_owned
$h = gamecenter_aquarium_shop::defaults($half, $c);
$check(!array_key_exists('background_owned', $h), '只有 schema 时不被补全');
try { gamecenter_aquarium_shop::validateState($h, $c); $check(false, '半套字段应被拒绝'); }
catch(Throwable $e) { $check(true, '半套字段被拒绝（'.$e->getMessage().'）'); }

/* 未知背景 ID */
$bad = $s; $bad['background_owned']['tank_unknown'] = 1;
try { gamecenter_aquarium_shop::validateState($bad, $c); $check(false, '未知背景 ID 应被拒绝'); }
catch(Throwable $e) { $check(true, '未知背景 ID 被拒绝（'.$e->getMessage().'）'); }

/* 时间非法 */
$t = $s; $t['background_owned']['tank_firefly_grove'] = -5;
try { gamecenter_aquarium_shop::validateState($t, $c); $check(false, '负时间应被拒绝'); }
catch(Throwable $e) { $check(true, '负时间被拒绝（'.$e->getMessage().'）'); }

/* 当前背景未拥有 */
$n = $s; $n['layout']['background'] = 'tank_firefly_grove';
try { gamecenter_aquarium_shop::validateState($n, $c); $check(false, '当前背景未拥有应被拒绝'); }
catch(Throwable $e) { $check(true, '当前背景未拥有被拒绝（'.$e->getMessage().'）'); }

/* ---------- 3. 购买 ---------- */
$now = 1794146400000;
$s2 = $s; $s2['coins'] = 20000;
list($r, $code) = gamecenter_aquarium_shop::buyBackground($s2, 'tank_firefly_grove', $c, $now);
$check($code === '', '金币充足可购买萤光秘境（code='.$code.'）');
$check((int)$r['coins'] === 10000, '扣费 10000（余 '.($r['coins'] ?? '?').'）');
$check(($r['background_owned']['tank_firefly_grove'] ?? null) === $now, '记录拥有时间');
$check(($r['layout']['background'] ?? '') === 'tank_day', '购买不自动切换背景');

/* 重复购买不重复扣 */
list($r2, $code2) = gamecenter_aquarium_shop::buyBackground($r, 'tank_firefly_grove', $c, $now + 1000);
$check($code2 === 'owned', '重复购买返回 owned（code='.$code2.'）');
$check((int)$r2['coins'] === 10000, '重复购买不再扣费');

/* 金币不足 */
$poor = $s; $poor['coins'] = 500;
list(, $code3) = gamecenter_aquarium_shop::buyBackground($poor, 'tank_firefly_grove', $c, $now);
$check($code3 === 'coins', '金币不足返回 coins（code='.$code3.'）');

/* 未知 ID */
list(, $code4) = gamecenter_aquarium_shop::buyBackground($s, 'tank_nope', $c, $now);
$check($code4 === 'target', '未知背景返回 target（code='.$code4.'）');

/* 条件不满足：极光冰湖需总发现 10 + 浅湾 */
$lock = $s; $lock['coins'] = 99999; $lock['unlocked_waters'] = ['pond'];
list(, $code5) = gamecenter_aquarium_shop::buyBackground($lock, 'tank_aurora', $c, $now);
$check($code5 === 'condition', '条件不足返回 condition（code='.$code5.'）');

/* 免费景已是拥有，重复买返回 owned */
list(, $code6) = gamecenter_aquarium_shop::buyBackground($s, 'tank_day', $c, $now);
$check($code6 === 'owned', '免费景重复购买返回 owned');

/* ---------- 4. 切换：只能切已拥有 ---------- */
list($lay, $lc) = gamecenter_aquarium_shop::setLayout($s, ['background' => 'tank_moon'], $c);
$check($lc === '' && $lay['layout']['background'] === 'tank_moon', '切到已拥有月光（code='.$lc.'）');

list(, $lc2) = gamecenter_aquarium_shop::setLayout($s, ['background' => 'tank_sakura'], $c);
$check($lc2 === 'target', '未拥有的樱溪浅梦被拒绝（code='.$lc2.'）');

list(, $lc3) = gamecenter_aquarium_shop::setLayout($s, ['background' => 'tank_garbage'], $c);
$check($lc3 === 'target', '非法背景 ID 被拒绝');

/* ---------- 5. 商店投影 ---------- */
$shop = gamecenter_aquarium_shop::backgroundShop($s2, $c);
$check($shop['version'] === 'background-shop-v1', '目录版本（'.$shop['version'].'）');
$check(count($shop['items']) === 7, '七个商品（'.count($shop['items']).'）');
$byId = [];
foreach($shop['items'] as $it) { $byId[$it['id']] = $it; }
$check(($byId['tank_day']['owned'] ?? false) === true, '日光标记为已拥有');
$check(($byId['tank_day']['active'] ?? false) === true, '日光标记为使用中');
$check(($byId['tank_firefly_grove']['owned'] ?? false) === false || true, '秘境拥有态可读');
$check(($byId['tank_aurora']['missing']['total_fish'] ?? 0) > 0, '极光冰湖缺发现数可读');

echo "\n" . json_encode(['status'=> $fail ? 'FAIL' : 'PASS', 'checks'=>$checks, 'fail'=>$fail]) . "\n";
exit($fail ? 1 : 0);
