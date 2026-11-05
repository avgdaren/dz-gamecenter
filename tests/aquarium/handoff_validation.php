<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。Issue #60 接手负例；CLI 内存 store，不连接数据库。 */
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('IN_DISCUZ', true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium.php';
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium_migrate.php';

class HandoffMemoryStore {
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
$legacy = $base;
foreach($legacy['fish'] as &$f) { unset($f['owned_count'],$f['sold_count']); } unset($f,$legacy['inventory_schema']);
$marker = $base; unset($marker['inventory_schema']);
$sold = $base;
$sold['fish'][$dst['initial_fish']]['catch_count']=8;
$sold['fish'][$dst['initial_fish']]['owned_count']=5; $sold['fish'][$dst['initial_fish']]['sold_count']=3;
$cap3 = $base; $cap3['fish']['pond_curl_seahorse']=['discovered_at'=>$now,'catch_count'=>3,'owned_count'=>3,'sold_count'=>0];
$preShop = $base; unset($preShop['layout'],$preShop['decor_owned'],$preShop['fish_capacity']);
foreach(['current'=>$base, 'old_to_v2'=>$initial($src), 'legacy'=>$legacy, 'marker'=>$marker,
    'sold'=>$sold, 'cap3'=>$cap3, 'pre_shop'=>$preShop] as $label=>$state) {
    foreach(['init','catalog','sync','layout'] as $action) {
        $store = new HandoffMemoryStore($row($state));
        $service = new gamecenter_aquarium($store, static fn()=>$now + 240000, $dst);
        $data = ['action'=>$action, 'client_version'=>gamecenter_aquarium::CLIENT];
        if($action === 'layout') {
            $data += ['expected_version'=>$label === 'old_to_v2' ? 11 : 10, 'layout'=>$base['layout']];
        }
        $r = $service->request(6060, true, $data);
        $record($label.':'.$action, $r['ok'] === 1, ['code'=>$r['code'], 'writes'=>$store->writes]);
        $again = $service->request(6060,true,['action'=>'sync','client_version'=>gamecenter_aquarium::CLIENT]);
        $record($label.':'.$action.':next_request', $again['ok'] === 1
            && $store->row['config_version'] === $dst['version'], ['code'=>$again['code']]);
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

foreach(['uid'=>42,'save_version'=>2,'version'=>'1bad','updated_ms'=>$now+1] as $key=>$value) {
    $r=$row($base); $r[$key]=$value; $cases['header_'.$key]=$r;
}
foreach(['inventory_schema'=>null,'pool_hash'=>str_repeat('0',64),'config_hash'=>str_repeat('1',64),
    'inventory_anomaly'=>true,'fish_capacity'=>'4'] as $key=>$value) {
    $s=$base; $s[$key]=$value; $cases['state_'.$key]=$row($s);
}
$s=$base; unset($s['fish'][$dst['initial_fish']]['sold_count']); $cases['partial_stock']=$row($s);
$s=$base; $s['layout']['fish']=[null,42,null,null]; $cases['layout_number']=$row($s);
$s=$base; $s['layout']['fish']=['x'=>null,'y'=>null,'z'=>null,'w'=>null]; $cases['layout_not_list']=$row($s);
$s=$base; $s['layout']['background']='unknown'; $cases['layout_background']=$row($s);
$s=$base; $s['layout']['decor']['front']=['building_bridge']; $cases['unowned_decor']=$row($s);
$s=$base; $s['config_version']=$src['version']; $cases['json_row_version']=$row($base); $cases['json_row_version']['state_json']=json_encode($s);
$r=$row($base); $r['state_json']='{bad'; $cases['json_syntax']=$r;
$s=$base; $s['recent_summary']=['from_ms'=>'bad']; $cases['summary_invalid']=$row($s);
$s=$base; $s['recent_summary']=false; $cases['summary_type']=$row($s);
$badActions = [
    'init'=>[], 'catalog'=>[], 'sync'=>[], 'layout'=>['layout'=>$base['layout']],
    'upgrade'=>['target_level'=>1], 'expand'=>[], 'unlock'=>['water_id'=>'bay'],
    'switch'=>['water_id'=>'pond'], 'buy'=>['decor_id'=>array_key_first($dst['decor'])],
    'sell'=>['fish_id'=>$dst['initial_fish'],'qty'=>1], 'devgrant'=>[],
];
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
    foreach($badActions as $action=>$extra) {
        $store = new HandoffMemoryStore($raw);
        $service = new gamecenter_aquarium($store, static fn()=>$now + 240000, $dst);
        $data = ['action'=>$action, 'client_version'=>gamecenter_aquarium::CLIENT];
        if(!in_array($action,['init','catalog','sync'],true)) { $data += ['expected_version'=>10] + $extra; }
        $r = $service->request(6060, true, $data, true);
        $isolated = $r['ok'] === 0 || ($r['snapshot']['inventory']['anomaly'] ?? false) === true;
        $record($label.':'.$action, $isolated && $store->writes === 0,
            ['ok'=>$r['ok'], 'code'=>$r['code'], 'writes'=>$store->writes,
             'anomaly'=>$r['snapshot']['inventory']['anomaly'] ?? null]);
    }
}
// Migrating plus an actual mutation must keep the target row header for the next request.
$store=new HandoffMemoryStore($row($initial($src)));
$service=new gamecenter_aquarium($store,static fn()=>$now+240000,$dst);
$r=$service->request(6060,true,['action'=>'upgrade','client_version'=>gamecenter_aquarium::CLIENT,'expected_version'=>11,'target_level'=>1]);
$again=$service->request(6060,true,['action'=>'sync','client_version'=>gamecenter_aquarium::CLIENT]);
$record('migration_then_upgrade_header', $r['ok']===1 && $again['ok']===1 && $store->row['config_version']===$dst['version'], ['code'=>$again['code']]);
foreach(['{bad','null','42'] as $layout) {
    $store=new HandoffMemoryStore($row($base)); $service=new gamecenter_aquarium($store,static fn()=>$now,$dst);
    $r=$service->request(6060,true,['action'=>'layout','client_version'=>gamecenter_aquarium::CLIENT,'expected_version'=>10,'layout'=>$layout]);
    $record('input_layout:'.$layout,$r['code']==='input' && $store->writes===0,['code'=>$r['code']]);
}
// 模拟存储失败必须逃到事务边界；绝不能提交一个假成功的迁移版本。
final class RetryHandoffStore extends HandoffMemoryStore {
    public int $attempts=0; public int $rollbacks=0; public bool $permanent=false;
    public function transaction(callable $work) {
        while(++$this->attempts <= 3) {
            try { return parent::transaction($work); }
            catch(RuntimeException $e) { $this->rollbacks++; if($this->attempts===3) { throw $e; } }
        }
    }
    public function save_versioned(array $row): void {
        parent::save_versioned($row);
        if($this->permanent || $this->attempts===1) { throw new RuntimeException('synthetic deadlock',1213); }
    }
}
foreach([false,true] as $permanent) {
    $original=$row($initial($src)); $store=new RetryHandoffStore($original); $store->permanent=$permanent;
    $service=new gamecenter_aquarium($store,static fn()=>$now+240000,$dst);
    $r=$service->request(6060,true,['action'=>'sync','client_version'=>gamecenter_aquarium::CLIENT]);
    $ok=$permanent ? ($r['code']==='busy' && $r['snapshot']===null && $store->row===$original && $store->writes===0 && $store->rollbacks===3)
        : ($r['ok']===1 && $store->attempts===2 && $store->rollbacks===1 && $store->writes===1 && $store->row['version']===11);
    $record('migration_db_failure:'.($permanent?'permanent':'retry'),$ok,['code'=>$r['code'],'attempts'=>$store->attempts,'rollbacks'=>$store->rollbacks]);
}
$failed = count(array_filter($results, static fn($r)=>!$r['pass']));
echo json_encode(['status'=>$failed ? 'FAIL' : 'PASS', 'checks'=>count($results), 'failed'=>$failed,
    'scope'=>'actual PHP service/migrator + synthetic memory store; NOT HTTP/Discuz/InnoDB',
    'results'=>$results], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), "\n";
exit($failed ? 1 : 0);
