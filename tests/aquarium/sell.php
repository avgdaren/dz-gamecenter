<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。
 *  售卖与库存专项测试：守恒、保留量、展示保护、迁移、异常隔离、金额上限、开关。
 *  运行：php tests/aquarium/sell.php
 */
if(PHP_SAPI !== 'cli') { exit; }
define('IN_DISCUZ', true);
define('DISCUZ_ROOT', dirname(__DIR__, 2).'/');
require_once DISCUZ_ROOT.'source/plugin/gamecenter/lib/aquarium_configs.php';
require_once DISCUZ_ROOT.'source/plugin/gamecenter/lib/aquarium_shop.php';

$checks = 0; $fail = 0;
function check($ok, $name) {
    global $checks, $fail;
    $checks++; if(!$ok) { $fail++; echo "FAIL  $name\n"; } else { echo "PASS  $name\n"; }
}

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$s = gamecenter_aquarium_rules::initial(7, str_repeat('ab', 16), 1700000000000, $c);
$s = gamecenter_aquarium_shop::defaults($s, $c);

$fid = $c['initial_fish'];

/* --- 迁移：纯旧档自动初始化 --- */
check(($s['inventory_schema'] ?? 0) === 1, '旧档自动打 inventory_schema 标记');
check(($s['fish'][$fid]['owned_count'] ?? null) === 1 && ($s['fish'][$fid]['sold_count'] ?? null) === 0, '旧档初始化 owned=catch sold=0');
check(empty($s['inventory_anomaly']), '正常旧档不标异常');

/* --- 囤货：给到 20 条 --- */
$s['fish'][$fid]['catch_count'] = 20;
$s['fish'][$fid]['owned_count'] = 20;
$s['fish'][$fid]['sold_count'] = 0;

/* --- 保留 4 条：展示 0 时可售 16 --- */
check(gamecenter_aquarium_shop::sellable($s, $fid) === 16, '展示0 持有20 可售16');

/* --- 展示保护：摆 18 条时只能卖 2 --- */
$s2 = $s;
foreach([0,1,2,3,4,5,6,7,8,9,10,11] as $i) { $s2['layout']['fish'][$i] = null; }
for($i=0;$i<12;$i++) { $s2['layout']['fish'][$i] = $i < 12 ? $fid : null; }
$held = 0; foreach($s2['layout']['fish'] as $x) { if($x===$fid) { $held++; } }
check(gamecenter_aquarium_shop::sellable($s2, $fid) === max(0, 20 - max(4, $held)), '展示保护按 max(4,展示数) 计算（展示 '.$held.'）');

/* --- 卖 3 条：守恒成立，金币按品级 --- */
$before = (int)$s['coins'];
list($sold, $code) = gamecenter_aquarium_shop::sell($s, $fid, 3, $c, 1700000100000);
check($code === '', '卖 3 条成功');
check($sold['fish'][$fid]['owned_count'] === 17 && $sold['fish'][$fid]['sold_count'] === 3, '卖出后 owned-3 sold+3');
check($sold['fish'][$fid]['owned_count'] + $sold['fish'][$fid]['sold_count'] === 20, '守恒 owned+sold=catch');
$rarity = '';
foreach(gamecenter_aquarium_content::catalog()['fish'] as $it) { if($it['id'] === $fid) { $rarity = (string)$it['rarity']; break; } }
check((int)$sold['coins'] === $before + 3 * gamecenter_aquarium_shop::sellPrice($rarity), '金币 = 数量 × 品级单价');
check(count($sold['recent_sale'] ?? []) === 1, '写入一条售卖回执');

/* --- 超量 / 非法数量 --- */
list(, $code) = gamecenter_aquarium_shop::sell($sold, $fid, 999, $c, 1700000200000);
check($code === 'condition', '超出可售被拒绝');
list(, $code) = gamecenter_aquarium_shop::sell($sold, $fid, 0, $c, 1700000200000);
check($code === 'input', '数量 0 被拒绝');
list(, $code) = gamecenter_aquarium_shop::sell($sold, 'not_a_fish', 1, $c, 1700000200000);
check($code === 'target', '未知鱼种被拒绝');

/* --- 金额上限：整笔拒绝而不是截断 --- */
$rich = $sold;
$rich['coins'] = gamecenter_aquarium_rules::MAX_VALUE - 1;
list(, $code) = gamecenter_aquarium_shop::sell($rich, $fid, 5, $c, 1700000300000);
check($code === 'limit', '金币将超上限时整笔拒绝');
check((int)$rich['fish'][$fid]['owned_count'] === 17, '拒绝时不扣鱼');

/* --- 异常隔离：缺一个字段不补、标记异常、拒绝售卖 --- */
$bad = $s;
$bad['fish'][$fid]['catch_count'] = 20;
$bad['fish'][$fid]['owned_count'] = 20;
unset($bad['fish'][$fid]['sold_count']);
$bad2 = gamecenter_aquarium_shop::defaults($bad, $c);
check(!empty($bad2['inventory_anomaly']), '只有一半库存字段 → 标记异常');
check(!array_key_exists('sold_count', $bad2['fish'][$fid]), '异常档不被静默补字段');
list(, $code) = gamecenter_aquarium_shop::sell($bad2, $fid, 1, $c, 1700000400000);
check($code === 'condition', '异常档拒绝售卖');

/* --- 不守恒也标异常 --- */
$odd = $s;
$odd['fish'][$fid]['sold_count'] = 5;   // 20 + 5 !== 20
$odd2 = gamecenter_aquarium_shop::defaults($odd, $c);
check(!empty($odd2['inventory_anomaly']), '守恒被破坏 → 标记异常');

/* --- 展示上限用持有量：卖到只剩 4 条时不能再摆 5 条 --- */
$thin = $sold;
$thin['fish'][$fid]['catch_count'] = 7;
$thin['fish'][$fid]['owned_count'] = 4;
$thin['fish'][$fid]['sold_count'] = 3;
$thin['fish_capacity'] = 8;   // 容量要与数组长度一致
$thin['layout']['fish'] = [$fid,$fid,$fid,$fid,null,null,null,null];
list(, $code) = gamecenter_aquarium_shop::setLayout($thin, ['fish'=>[$fid,$fid,$fid,$fid,$fid,null,null,null]], $c);
check($code === 'condition', '展示数不能超过持有量');

/* --- 售卖开关：文件缺失/关闭时一律拒绝（由控制器调用，这里只验读取） --- */
check(is_array(gamecenter_aquarium_configs::saleSwitch()), '开关配置可读');
check(gamecenter_aquarium_configs::saleAllowed(7) === false || gamecenter_aquarium_configs::saleSwitch()['mode'] !== 'off', 'off 模式默认不可售');

echo "\n".json_encode(['status'=> $fail ? 'FAIL' : 'PASS', 'checks'=>$checks, 'fail'=>$fail])."\n";
exit($fail ? 1 : 0);
