<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。Issue #60 接手负例；CLI 内存 store，不连接数据库。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_migrate.php';

final class HandoffMemoryStore {
    public array $row;
    public int $writes = 0;
    public function __construct(array $row) { $this->row = $row; }
    public function transaction(callable $work) {
        $before = $this->row; $writes = $this->writes;
        try { return $work(); }
        catch(Throwable $e) { $this->row = $before; $this->writes = $writes; throw $e; }
    }
    public function lock(int $uid): array { return $this->row; }
    public function rows(string $sql, array $args = []): array { return [$this->row]; }
    public function save(array $row): void { $this->row = $row; $this->writes++; }
    public function save_versioned(array $row): void { $this->save($row); }
    public function insert(array $row): void { $this->save($row); }
}

$src = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
$dst = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT_V2);
$now = 1700000000000;
$initial = static function(array $c) use ($now): array {
    return gamecenter_aquarium_shop::defaults(
        gamecenter_aquarium_rules::initial(6060, str_repeat('ab', 16), $now, $c), $c);
};
$row = static function(array $s): array {
    return ['uid'=>$s['uid'], 'save_version'=>1, 'config_version'=>$s['config_version'],
        'state_json'=>json_encode($s, JSON_THROW_ON_ERROR), 'version'=>10, 'updated_ms'=>$s['last_settled_ms']];
};
$base = $initial($dst);
$results = [];
$record = static function(string $case, bool $ok, array $evidence) use (&$results): void {
    $results[] = ['case'=>$case, 'pass'=>$ok] + $evidence;
};

// Positive controls: actual service, normal same-version saves and healthy v1 -> v2 saves.
foreach(['current'=>$base, 'old_to_v2'=>$initial($src)] as $label=>$state) {
    foreach(['init','catalog','sync','layout'] as $action) {
        $store = new HandoffMemoryStore($row($state));
        $service = new gamecenter_aquarium($store, static fn()=>$now + 240000, $dst);
        $data = ['action'=>$action, 'client_version'=>gamecenter_aquarium::CLIENT];
        if($action === 'layout') {
            $data += ['expected_version'=>$label === 'old_to_v2' ? 11 : 10, 'layout'=>$base['layout']];
        }
        $r = $service->request(6060, true, $data);
        $record($label.':'.$action, $r['ok'] === 1, ['code'=>$r['code'], 'writes'=>$store->writes]);
    }
}

$cases = [];
$s = $base; $s['inventory_schema'] = 99; $cases['schema99'] = $row($s);
$s = $base; $s['fish'][$dst['initial_fish']]['sold_count']++; $cases['conservation'] = $row($s);
$s = $base; $s['layout']['fish'] = [$dst['initial_fish'], $dst['initial_fish'], null, null]; $cases['overdisplay'] = $row($s);
$s = $base;
$s['fish']['pond_curl_seahorse'] = ['discovered_at'=>$now, 'catch_count'=>4, 'owned_count'=>4, 'sold_count'=>0];
ksort($s['fish'], SORT_STRING); $cases['lifetime_cap4'] = $row($s);
$r = $row($base); $r['config_version'] = $src['version']; $cases['row_json_version'] = $r;

foreach($cases as $label=>$raw) {
    if($label !== 'row_json_version') {
        $store = new HandoffMemoryStore($raw);
        $mig = new gamecenter_aquarium_migrate($store, $src, $dst);
        try { $classified = $mig->classify($raw, $now + 240000)['status']; }
        catch(Throwable $e) { $classified = 'rejected:'.$e->getMessage(); }
        $v = $mig->verify();
        $record($label.':classify', $classified !== 'skipped', ['observed'=>$classified]);
        $record($label.':verify', $v['target'] === 0 && count($v['broken']) === 1,
            ['target'=>$v['target'], 'broken'=>count($v['broken'])]);
    }
    foreach(['init','catalog','sync','layout'] as $action) {
        $store = new HandoffMemoryStore($raw);
        $service = new gamecenter_aquarium($store, static fn()=>$now + 240000, $dst);
        $data = ['action'=>$action, 'client_version'=>gamecenter_aquarium::CLIENT];
        if($action === 'layout') { $data += ['expected_version'=>10, 'layout'=>$base['layout']]; }
        $r = $service->request(6060, true, $data);
        $isolated = $r['ok'] === 0 || ($r['snapshot']['inventory']['anomaly'] ?? false) === true;
        $record($label.':'.$action, $isolated && $store->writes === 0,
            ['ok'=>$r['ok'], 'code'=>$r['code'], 'writes'=>$store->writes,
             'anomaly'=>$r['snapshot']['inventory']['anomaly'] ?? null]);
    }
}
$failed = count(array_filter($results, static fn($r)=>!$r['pass']));
echo json_encode(['status'=>$failed ? 'FAIL' : 'PASS', 'checks'=>count($results), 'failed'=>$failed,
    'scope'=>'actual PHP service/migrator + synthetic memory store; NOT HTTP/Discuz/InnoDB',
    'results'=>$results], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
exit($failed ? 1 : 0);
