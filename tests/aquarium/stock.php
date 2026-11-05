<?php
/** 作者：小蓝（DSH）。库存模式分类器验收：覆盖复审提出的误判与反例。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_configs.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_stock.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_shop.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

$c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$base = gamecenter_aquarium_rules::initial(1, str_repeat('ab', 16), 1700000000000, $c);
$base = gamecenter_aquarium_shop::defaults($base, $c);
$fid = $c['initial_fish'];

$legacy = $base;
foreach($legacy['fish'] as $k=>$f) { unset($legacy['fish'][$k]['owned_count'], $legacy['fish'][$k]['sold_count']); }
unset($legacy['inventory_schema']);

/* 1) 纯旧档（A1 关键场景：有展示鱼）必须判为 legacy */
$l1 = $legacy;
$l1['fish'][$fid]['catch_count'] = 20;
$l1['layout']['fish'][0] = $fid;
$r = gamecenter_aquarium_stock::classify($l1, $c);
$check($r['kind'] === 'legacy', 'A1 有展示鱼的正常旧档 → legacy（实际 '.$r['kind'].'/'.$r['why'].'）');

/* 2) 旧档展示数超过 catch_count → overdisplay */
$l2 = $l1;
$l2['fish'][$fid]['catch_count'] = 1;
$l2['layout']['fish'] = [$fid,$fid,null,null];   // 展示 2 条，但只钓到 1 条
$r = gamecenter_aquarium_stock::classify($l2, $c);
$check($r['kind'] === 'anomaly' && strpos($r['why'],'overdisplay') === 0, '旧档展示超捕获 → overdisplay');

/* 3) 新档合法 → new */
$r = gamecenter_aquarium_stock::classify($base, $c);
$check($r['kind'] === 'new', '新档 → new');

/* 4) 新档缺标记 → needs-marker（只补标记，不重置 sold） */
$n1 = $base; unset($n1['inventory_schema']);
$r = gamecenter_aquarium_stock::classify($n1, $c);
$check($r['kind'] === 'needs-marker', '新档缺标记 → needs-marker');

/* 4b) 旧档 catch_count 类型错误 → anomaly（不能当可迁移旧档） */
foreach(['"20"', '-1', 'missing'] as $bad) {
    $x = $legacy;
    if($bad === 'missing') { unset($x['fish'][$fid]['catch_count']); }
    else { $x['fish'][$fid]['catch_count'] = $bad === '-1' ? -1 : '20'; if($bad === '-1') { $x['fish'][$fid]['catch_count'] = -1; } }
    $r = gamecenter_aquarium_stock::classify($x, $c);
    $check($r['kind'] === 'anomaly', '旧档 catch_count '.$bad.' → anomaly');
}

/* 4c) 空 fish → anomaly（不能当 legacy） */
$e1 = $legacy; $e1['fish'] = [];
$r = gamecenter_aquarium_stock::classify($e1, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'no-fish', '空 fish → anomaly');

/* 4d) 显式 schema=null / 0 → anomaly（只有键缺失才算未标记） */
$s0 = $legacy; $s0['inventory_schema'] = null;
$r = gamecenter_aquarium_stock::classify($s0, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'schema-unknown', 'schema=null → anomaly');
$s0b = $legacy; $s0b['inventory_schema'] = 0;
$r = gamecenter_aquarium_stock::classify($s0b, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'schema-unknown', 'schema=0 → anomaly');

/* 4e) 配置哈希不符 → anomaly */
$h2 = $base; $h2['config_hash'] = str_repeat('0', 64);
$r = gamecenter_aquarium_stock::classify($h2, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'config_hash', '配置哈希不符 → anomaly');

/* 4f) 已标记异常优先于其他判定 */
$f2 = $legacy; $f2['inventory_anomaly'] = true;
$r = gamecenter_aquarium_stock::classify($f2, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'flagged', '已标记异常优先 → flagged');

/* 5) 混合：一条新库存 + 一条两字段都缺 → mixed */
$m1 = $base;
$m1['fish']['pond_leaf'] = ['discovered_at'=>1700000000000,'catch_count'=>5];
$r = gamecenter_aquarium_stock::classify($m1, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'mixed', '混合行 → mixed（不许当旧档补齐）');

/* 6) 半字段 */
$h1 = $base; unset($h1['fish'][$fid]['sold_count']);
$r = gamecenter_aquarium_stock::classify($h1, $c);
$check($r['kind'] === 'anomaly' && strpos($r['why'],'stock') === 0, '半字段 → anomaly');

/* 7) 字符串 catch_count */
$t1 = $base; $t1['fish'][$fid]['catch_count'] = '20';
$r = gamecenter_aquarium_stock::classify($t1, $c);
$check($r['kind'] === 'anomaly', '字符串 catch_count → anomaly');

/* 8) 负数 */
$g1 = $base; $g1['fish'][$fid]['sold_count'] = -1; $g1['fish'][$fid]['owned_count'] = 3; $g1['fish'][$fid]['catch_count'] = 2;
$r = gamecenter_aquarium_stock::classify($g1, $c);
$check($r['kind'] === 'anomaly', '负数库存 → anomaly');

/* 9) 守恒被破坏 */
$s1 = $base; $s1['fish'][$fid]['sold_count'] = 5;
$r = gamecenter_aquarium_stock::classify($s1, $c);
$check($r['kind'] === 'anomaly' && strpos($r['why'],'stock') === 0, '守恒破坏 → anomaly');

/* 10) 未知鱼种 */
$u1 = $base; $u1['fish']['not_a_fish'] = ['discovered_at'=>1700000000000,'catch_count'=>1,'owned_count'=>1,'sold_count'=>0];
$r = gamecenter_aquarium_stock::classify($u1, $c);
$check($r['kind'] === 'anomaly' && strpos($r['why'],'unknown-fish') === 0, '未知鱼种 → anomaly');

/* 11) schema 非 1 */
$v1 = $base; $v1['inventory_schema'] = 2;
$r = gamecenter_aquarium_stock::classify($v1, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'schema-unknown', 'schema=2 → schema-unknown');

/* 12) 已有异常标记 → flagged（不自动清标） */
$f1 = $base; $f1['inventory_anomaly'] = true;
$r = gamecenter_aquarium_stock::classify($f1, $c);
$check($r['kind'] === 'anomaly' && $r['why'] === 'flagged', '已标记异常 → flagged');

/* 13) 行头不一致 */
$hdr = ['uid'=>999,'save_version'=>1,'config_version'=>$base['config_version'],'updated_ms'=>$base['last_settled_ms']];
$r = gamecenter_aquarium_stock::classify($base, $c, $hdr);
$check($r['kind'] === 'anomaly' && $r['why'] === 'uid-mismatch', '行头 uid 不一致 → uid-mismatch');

/* 14) migrate 只动库存字段 */
$before = $l1;
$after = gamecenter_aquarium_stock::migrate($l1);
$check($after['inventory_schema'] === 1, 'migrate 打标记');
$check((int)$after['fish'][$fid]['owned_count'] === 20 && (int)$after['fish'][$fid]['sold_count'] === 0, 'migrate 补 owned/sold');
$check($after['coins'] === $before['coins'] && $after['layout'] === $before['layout'], 'migrate 不动金币与布局');
$check($after['fish'][$fid]['catch_count'] === $before['fish'][$fid]['catch_count'], 'migrate 不动捕获数');


/* 15) markOnly：只补标记，不动 sold/owned */
$mk = $base; unset($mk['inventory_schema']);
$mk['fish'][$fid]['owned_count'] = 9; $mk['fish'][$fid]['sold_count'] = 3; $mk['fish'][$fid]['catch_count'] = 12;
$mk2 = gamecenter_aquarium_stock::markOnly($mk);
$check($mk2['inventory_schema'] === 1, 'markOnly 补标记');
$check($mk2['fish'][$fid]['owned_count'] === 9 && $mk2['fish'][$fid]['sold_count'] === 3, 'markOnly 不动库存与售出');
$check($mk2['coins'] === $mk['coins'] && $mk2['layout'] === $mk['layout'], 'markOnly 不动金币与布局');
echo "\n".json_encode(['status'=> $fail ? 'FAIL' : 'PASS', 'checks'=>$checks, 'fail'=>$fail])."\n";
exit($fail ? 1 : 0);
