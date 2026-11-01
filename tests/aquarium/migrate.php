<?php
/** 作者：小蓝（DSH）。迁移校验负例：坏档必须 failed，不能 skipped/migrated。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_configs.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_migrate.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_shop.php';

$checks = 0; $fail = 0;
$check = function(bool $ok, string $msg) use (&$checks, &$fail) {
    $checks++; if(!$ok) { $fail++; echo "FAIL $msg\n"; }
};

// 只用于构造分类器的最小 store 替身（classify 不落库）
final class StubStore {
    public function first(string $sql, array $args = []): array { return []; }
    public function rows(string $sql, array $args = []): array { return []; }
    public function query(string $sql, array $args = []) { return null; }
    public function transaction(callable $work) { return $work(); }
    public function lock(int $uid): array { return []; }
    public function save_versioned(array $row): void {}
    public function insert(array $row): void {}
}

$src = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$dst = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT_V2);
$mig = new gamecenter_aquarium_migrate(new StubStore(), $src, $dst);

$now = 1700000000000;
$s = gamecenter_aquarium_rules::initial(1, str_repeat('ab', 16), $now, $dst);
$s = gamecenter_aquarium_shop::defaults($s, $dst);

$row = function(array $state, array $over = []) {
    return array_merge([
        'uid' => (int)$state['uid'],
        'save_version' => 1,
        'config_version' => $state['config_version'],
        'state_json' => json_encode($state),
        'version' => 10,
        'updated_ms' => (int)$state['last_settled_ms'],
    ], $over);
};

/* 正常目标行 → skipped */
$r = $mig->classify($row($s), $now + 1000);
$check($r['status'] === 'skipped', '健康的目标行 → skipped');

/* 守恒被破坏 → failed */
$bad = $s; $fid = array_key_first($bad['fish']); $bad['fish'][$fid]['sold_count'] += 5;
$r = $mig->classify($row($bad), $now + 1000);
$check($r['status'] === 'failed' && strpos($r['reason'], 'stock:') === 0, '守恒破坏 → failed（实际 '.$r['status'].'/'.($r['reason'] ?? '').'）');

/* 异常标记 → failed */
$bad2 = $s; $bad2['inventory_anomaly'] = true;
$r = $mig->classify($row($bad2), $now + 1000);
$check($r['status'] === 'failed', '已标记异常 → failed');

/* 锚点不一致 → failed */
$r = $mig->classify($row($s, ['updated_ms' => $now + 99999]), $now + 1000);
$check($r['status'] === 'failed' && $r['reason'] === 'anchor-mismatch', '锚点不一致 → failed');

/* 坏行版本 → failed */
$r = $mig->classify($row($s, ['version' => 0]), $now + 1000);
$check($r['status'] === 'failed' && $r['reason'] === 'row-version', '行版本 0 → failed');

/* JSON.uid 与行 uid 不一致 → failed */
$r = $mig->classify($row($s, ['uid' => 2]), $now + 1000);
$check($r['status'] === 'failed' && $r['reason'] === 'target-uid', 'uid 不一致 → failed');

/* 展示超持有 → failed */
$bad3 = $s; $fid = array_key_first($bad3['fish']);
$bad3['fish'][$fid]['owned_count'] = 0; $bad3['fish'][$fid]['sold_count'] = (int)$bad3['fish'][$fid]['catch_count'];
$bad3['layout']['fish'][0] = $fid;
$r = $mig->classify($row($bad3), $now + 1000);
$check($r['status'] === 'failed', '展示超持有 → failed（实际 '.$r['status'].'/'.($r['reason'] ?? '').'）');

/* 源行异常（缺库存字段但没标记）→ failed */
$legacy = $s;
foreach($legacy['fish'] as $k=>$f) { unset($legacy['fish'][$k]['owned_count'], $legacy['fish'][$k]['sold_count']); }
unset($legacy['inventory_schema']);
$legacy['config_version'] = $src['version']; $legacy['pool_hash'] = $src['pool_hash']; $legacy['config_hash'] = $src['config_hash'];
$r = $mig->classify($row($legacy), $now + 1000);
$check($r['status'] === 'failed' && strpos($r['reason'], 'stock:') === 0, '源档未完成库存迁移 → failed（实际 '.$r['status'].'/'.($r['reason'] ?? '').'）');

/* cutoff：不再被未来的锚点抬高 */
$cut = $mig->cutoff($now);
$check($cut === $now, 'cutoff 默认等于给定 now');
$check($mig->cutoff($now, 12345) === 12345, 'cutoff 可显式固定');

echo "\n".json_encode(['status'=> $fail ? 'FAIL' : 'PASS', 'checks'=>$checks, 'fail'=>$fail])."\n";
exit($fail ? 1 : 0);
