<?php
/** 作者：小蓝（DSH）。购买/扩容/布置的纯规则验收；不碰数据库与 HTTP。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_configs.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_shop.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++;
    if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$now = 1700000000000;
$s = gamecenter_aquarium_rules::initial(1, str_repeat('ab', 16), $now, $c);
$s = gamecenter_aquarium_shop::defaults($s, $c);
gamecenter_aquarium_shop::validateState($s, $c);
$check($s['fish_capacity'] === 4, 'initial capacity 4');
$check(count($s['layout']['fish']) === 4, 'layout has 4 fish slots');
$check($s['layout']['background'] === 'tank_day', 'default background');
$check($s['decor_owned'] === [], 'no decor owned');

// 买装饰：金币不足
$s['coins'] = 10;
list($x, $code) = gamecenter_aquarium_shop::buy($s, 'plant_meadow', $c, $now);
$check($code === 'coins', 'buy without coins rejected: '.$code);
$check($x === $s, 'failed buy does not mutate');

// 买装饰：成功并扣款
$s['coins'] = 500;
list($s, $code) = gamecenter_aquarium_shop::buy($s, 'plant_meadow', $c, $now);
$check($code === '', 'buy succeeds: '.$code);
$check($s['coins'] === 420, 'coins charged 80, left '.$s['coins']);
$check(isset($s['decor_owned']['plant_meadow']), 'decor owned');

// 重复购买不重扣
list($s2, $code2) = gamecenter_aquarium_shop::buy($s, 'plant_meadow', $c, $now);
$check($code2 === 'owned' && $s2['coins'] === $s['coins'], 'duplicate buy rejected without charge');

// 条件不足（需要浅湾）
list($x, $code) = gamecenter_aquarium_shop::buy($s, 'scape_coral', $c, $now);
$check($code === 'condition', 'water-gated decor rejected: '.$code);

// 扩容：金币不足 / 成功
$s['coins'] = 100;
list($x, $code) = gamecenter_aquarium_shop::expand($s, $c);
$check($code === 'coins', 'expand without coins rejected');
$s['coins'] = 900;
list($s, $code) = gamecenter_aquarium_shop::expand($s, $c);
$check($code === '', 'expand succeeds');
$check($s['fish_capacity'] === 8 && count($s['layout']['fish']) === 8, 'capacity 8 with 8 slots');
$check($s['coins'] === 100, 'expand cost 800, left '.$s['coins']);

// 布置：没发现的鱼不能放
$fid = $c['initial_fish'];
list($x, $code) = gamecenter_aquarium_shop::setLayout($s, ['fish'=>['pond_orange_tail',null,null,null,null,null,null,null]], $c);
$check($code === 'target', 'undiscovered fish rejected: '.$code);

// 布置：已发现的鱼可以放，并且不能重复
list($s, $code) = gamecenter_aquarium_shop::setLayout($s, ['fish'=>[$fid,null,null,null,null,null,null,null]], $c);
$check($code === '', 'discovered fish placed');
list($s, $code) = gamecenter_aquarium_shop::setLayout($s, ['fish'=>[$fid,$fid,null,null,null,null,null,null]], $c);
$check($code === '', 'duplicate fish allowed: '.$code);
$check(count(array_filter($s['layout']['fish'])) === 2, 'two same fish kept');

// 布置：没买的装饰不能放
list($x, $code) = gamecenter_aquarium_shop::setLayout($s, ['decor'=>['back'=>['scape_pebbles'],'front'=>[]]], $c);
$check($code === 'target', 'unowned decor rejected');

// 布置：已拥有的装饰放到允许层
list($s, $code) = gamecenter_aquarium_shop::setLayout($s, ['decor'=>['front'=>['plant_meadow'],'back'=>[]]], $c);
$check($code === '', 'owned decor placed on allowed layer');

// 布置：层不对
$c2 = $c; // plant_meadow 允许 front/back；换一件只允许 back 的
list($x, $code) = gamecenter_aquarium_shop::setLayout($s, ['decor'=>['front'=>['building_angel_gate'],'back'=>[]]], $c);
$check($code !== '', 'decor on disallowed layer rejected: '.$code);

// 布置：超过单层上限
$cap = gamecenter_aquarium_shop::decor_slots_per_layer();
list($x, $code) = gamecenter_aquarium_shop::setLayout($s, ['decor'=>['front'=>array_fill(0, $cap + 1, 'plant_meadow'),'back'=>[]]], $c);
$check($code === 'input' || $code === 'target', 'too many decor in layer rejected: '.$code);

// 布置：背景
list($s, $code) = gamecenter_aquarium_shop::setLayout($s, ['background'=>'tank_moon'], $c);
$check($code === '' && $s['layout']['background'] === 'tank_moon', 'background switch works');
list($x, $code) = gamecenter_aquarium_shop::setLayout($s, ['background'=>'not_a_bg'], $c);
$check($code === 'target', 'unknown background rejected');

// 客户端伪造字段一律拒绝
list($x, $code) = gamecenter_aquarium_shop::setLayout($s, ['coins'=>999999], $c);
$check($code === 'input', 'unknown layout key rejected');

// 状态校验：容量与槽位不一致
$bad = $s; $bad['fish_capacity'] = 12;
$threw = false;
try { gamecenter_aquarium_shop::validateState($bad, $c); } catch(DomainException $e) { $threw = true; }
$check($threw, 'capacity/slot mismatch rejected');

echo json_encode(['status'=>$fail === 0 ? 'PASS' : 'FAIL', 'checks'=>$checks, 'fail'=>$fail], JSON_UNESCAPED_UNICODE), "\n";
exit($fail === 0 ? 0 : 1);
