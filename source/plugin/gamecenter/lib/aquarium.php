<?php
/** 作者：GPT / Codex · 小蓝（DSH）；原插件 (C) 2026 Carinoasd。水族馆服务端存档服务，路由限管理员；不发论坛积分。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_config.php';
require_once __DIR__.'/aquarium_configs.php';
require_once __DIR__.'/aquarium_shop.php';
require_once __DIR__.'/aquarium_store.php';
final class gamecenter_aquarium {
    const CLIENT='aquarium-foundation-1';
    const MAX_LAYOUT_BYTES=2048;
    private $db;
    private $clock;
    private array $c;
    public function __construct($store=null,?callable $clock=null,?array $config=null) {
        $this->db=$store ?? new gamecenter_aquarium_store();
        $this->clock=$clock ?? static fn()=>(int)floor(microtime(true)*1000);
        $this->c=$config===null ? gamecenter_aquarium_configs::active() : gamecenter_aquarium_rules::prepare($config);
    }
    /** 诊断：把真实异常写进论坛记录（不含存档内容，只记消息与 uid）
     *  1.8.1：原本写在 games/aquarium/data/diag.log（网站可直接下载、不会轮替），改用原生 writelog
     *  → data/log/<年月>_gamecenter_aquarium.php（每行有 exit 头、超过 2MB 自动换档）；命令行测试没有论坛环境时不写。 */
    public static function diag(string $msg, int $uid=0): void {
        if(!class_exists('helper_log', false) && !(defined('DISCUZ_ROOT') && class_exists('helper_log'))) { return; }
        helper_log::writelog('gamecenter_aquarium', date('c')."\tuid=".$uid."\t".substr(preg_replace('/[\r\n\t]+/', ' ', $msg), 0, 200));
    }

    /**
     * 1.8.1：同配置存档的完整检查（每次请求都跑；后台「水族馆存档」也用它）。
     * 原本同配置的存档只做宽松解码，库存检查只在跨配置迁移时才跑，异常档照常结算、写回。
     * 能安全修的直接修（只改内存，下一次写入才落库）：
     *   - 资料列的 config_version 栏位与 JSON 不一致（旧版只用 save() 写，不会改这一栏）→ 以 JSON 为准
     *   - 缸里同一种鱼的展示数超过持有数（重复展示功能早于库存功能）→ 多出来的格子清空
     *   - 有库存栏位但缺 inventory_schema → 补标记
     * 修不了的（守恒不对、未知 schema、超过终身上限、装饰／容量不合法…）→ 只在内存标 inventory_anomaly，走既有的只读隔离，
     * 不写回原档；之后程序修好或人工修档后自然解除。
     * 回传 [存档, 结论 ok|heal|anomaly, 原因]；rules::validate 不过照旧抛 DomainException（与原本行为相同）。
     */
    public function guard(array $s, array &$row): array {
        if(!isset($this->c['decor'],$this->c['fish_capacities'],$this->c['initial_fish_capacity'])) { return [$s,'ok','']; }
        if(($s['config_version'] ?? '') !== $this->c['version']) { return [$s,'ok','']; }
        if(!empty($s['inventory_anomaly'])) { return [$s,'anomaly','flagged']; }
        $heal=[];
        if((string)($row['config_version'] ?? '') !== $this->c['version']) { $row['config_version']=$this->c['version']; $heal[]='row-config'; }
        gamecenter_aquarium_rules::validate($s,$this->c);
        if(isset($s['layout']['fish']) && is_array($s['layout']['fish'])) {
            $cnt=[];
            foreach($s['layout']['fish'] as $i=>$fid) {
                if(!is_string($fid) || $fid==='' || !isset($s['fish'][$fid]) || !is_array($s['fish'][$fid])) { continue; }
                $f=$s['fish'][$fid];
                $held=(int)(array_key_exists('owned_count',$f) ? $f['owned_count'] : ($f['catch_count'] ?? 0));
                $cnt[$fid]=($cnt[$fid] ?? 0)+1;
                if($cnt[$fid]>$held) { $s['layout']['fish'][$i]=null; $heal['overdisplay']='overdisplay'; }
            }
        }
        $s=gamecenter_aquarium_shop::defaults($s,$this->c);
        unset($s['inventory_anomaly']);
        $cls=gamecenter_aquarium_stock::classify($s,$this->c,['uid'=>$row['uid'] ?? 0,'save_version'=>$row['save_version'] ?? 0,
            'config_version'=>$row['config_version'],'updated_ms'=>$row['updated_ms'] ?? -1]);
        if($cls['kind']==='needs-marker') { $s=gamecenter_aquarium_stock::markOnly($s); $heal[]='marker'; }
        elseif($cls['kind']!=='new') { $s['inventory_anomaly']=true; return [$s,'anomaly',$cls['why']]; }
        try { gamecenter_aquarium_shop::validateState($s,$this->c); }
        catch(DomainException $e) { $s['inventory_anomaly']=true; return [$s,'anomaly',$e->getMessage()]; }
        return [$s,$heal ? 'heal' : 'ok',implode(',',array_values($heal))];
    }

    /** 1.8.1 后台检查单一资料列：回 [结论, 原因]；结论多了 other（不是目前配置）与 broken（解码或基本校验失败） */
    public function inspect(array $row): array {
        $uid=(int)($row['uid'] ?? 0);
        try {
            $s=$this->decode($row,$uid,false);
            if(($s['config_version'] ?? '') !== $this->c['version']) { return ['other',(string)($s['config_version'] ?? '')]; }
            list(,$verdict,$why)=$this->guard($s,$row);
            return [$verdict,$why];
        } catch(Throwable $e) { return ['broken',substr($e->getMessage(),0,80)]; }
    }

    private function result(string $code='',?array $snapshot=null): array {
        $messages=['login'=>'登录论坛账号后才能建立水族馆','permission'=>'当前用户组暂不能操作水族馆','input'=>'参数不正确',
            'client'=>'请刷新页面后重试','uninitialized'=>'尚未建立测试存档','conflict'=>'状态已更新，请查看最新进度后重新选择',
            'target'=>'目标等级或水域已变化','coins'=>'游戏金币不足','condition'=>'尚未满足条件','owned'=>'已经拥有这件装饰',
            'maintenance'=>'水族馆正在维护，你的存档不会丢失，请稍后回来',
            'config'=>'配置或存档版本不匹配，请等待维护，不要清空存档','busy'=>'暂时无法同步，请稍后重试',
        'migrate_readonly'=>'存档正在升级，暂时只能查看，收益和操作稍后恢复',
            'limit'=>'这次数量会让金币超出上限，请分批卖','closed'=>'售卖功能暂未开放'];
        return ['ok'=>$code===''?1:0,'code'=>$code,'msg'=>$code===''?'已同步':($messages[$code]??$messages['busy']),'snapshot'=>$snapshot];
    }
    private function decode(array $row,int $uid,bool $strictVersion=true): array {
        if((int)$row['uid']!==$uid || (int)$row['save_version']!==1 || ($strictVersion && $row['config_version']!==$this->c['version'])
            || !ctype_digit((string)$row['version']) || (int)$row['version']<1 || (int)$row['version']>=gamecenter_aquarium_rules::MAX_VALUE
            || strlen($row['state_json'])>131072) { throw new DomainException('state'); }
        $s=json_decode($row['state_json'],true,32,JSON_THROW_ON_ERROR);
        if(!is_array($s) || ($s['uid']??null)!==$uid || ($s['last_settled_ms']??null)!==(int)$row['updated_ms']) { throw new DomainException('state'); }
        if($strictVersion) { gamecenter_aquarium_rules::validate($s,$this->c); }
        if($strictVersion && isset($this->c['decor'],$this->c['fish_capacities'],$this->c['initial_fish_capacity'])) {
            $s=gamecenter_aquarium_shop::defaults($s,$this->c);
            gamecenter_aquarium_shop::validateState($s,$this->c);
        }
        return $s;
    }
    private function snapshot(array $s,int $version): array {
        $out=[];
        foreach(['coins','rod_level','last_settled_ms','progress_ms','catch_seq','current_water','unlocked_waters','fish','no_new_count',
                 'fish_capacity','decor_owned','layout'] as $k) { $out[$k]=$s[$k]??null; }
        $out['version']=$version;
        $out['is_admin']=((int)($GLOBALS['_G']['adminid']??0))===1;
        $out['capabilities']=['sell'=>gamecenter_aquarium_configs::saleAllowed((int)$s['uid'])
            && empty($s['inventory_anomaly']) && (int)($s['inventory_schema'] ?? 0) === 1];
        $out['inventory']=['schema'=>(int)($s['inventory_schema']??0),'anomaly'=>!empty($s['inventory_anomaly'])];
        $out['recent_sale']=$s['recent_sale'] ?? [];
        require_once __DIR__.'/aquarium_stats.php';
        // 1.8.0 併入平台：原設計由排程呼叫 refresh()，平台沒有這個排程，改成讀快取時超過 10 分鐘就順手刷新一次
        //（非阻塞鎖、一次 COUNT；拿不到鎖或寫不進快取目錄就沿用舊值／不顯示）
        $participants=gamecenter_aquarium_stats::display();
        if($participants===null || time()-$participants['updated_at']>600) {
            $fresh=gamecenter_aquarium_stats::refresh();
            if($fresh!==null) { $participants=$fresh; }
        }
        $out['participants']=$participants;
        $out['summary']=null;
        if(isset($s['recent_summary']) && is_array($s['recent_summary'])) {
            $x=$s['recent_summary']; $clean=[];
            foreach(['from_ms','to_ms','coins','catch_count','effective_ms','discarded_ms'] as $k) {
                if(!gamecenter_aquarium_rules::number($x[$k]??null)) { throw new DomainException('state'); }
                $clean[$k]=$x[$k];
            }
            $clean['new_fish_ids']=[];
            if(!is_array($x['new_fish_ids']??null)) { throw new DomainException('state'); }
            foreach($x['new_fish_ids'] as $fid) {
                if(!is_string($fid) || !isset($s['fish'][$fid])) { throw new DomainException('state'); }
                $clean['new_fish_ids'][]=$fid;
            }
            $out['summary']=$clean;
        }
        $out['rules']=['cap_ms'=>$this->c['cap_ms'],'periods_ms'=>$this->c['periods_ms'],'rod_costs'=>$this->c['rod_costs'],
            'waters'=>array_map(static fn($w)=>['cost'=>$w['cost'],'requires_count'=>$w['requires_count']],$this->c['waters']),
            'fish_capacities'=>$this->c['fish_capacities'] ?? [],'fish_capacity_costs'=>$this->c['fish_capacity_costs'] ?? [],
            'decor_slots_per_layer'=>gamecenter_aquarium_shop::decor_slots_per_layer(),
            'backgrounds'=>gamecenter_aquarium_shop::backgrounds()];
        return $out;
    }
    /** 管理员测试补给：加金币、开全部装饰与水域。只影响自己的存档，走同一套校验与版本控制。 */
    private static function devgrant(array $s,array $c,int $now): array {
        $add=100000;
        $s['coins']=min(gamecenter_aquarium_rules::MAX_VALUE,$s['coins']+$add);
        if(!isset($s['decor_owned']) || !is_array($s['decor_owned'])) { $s['decor_owned']=[]; }
        if(isset($c['decor']) && is_array($c['decor'])) {
            foreach(array_keys($c['decor']) as $id) {
                if(!isset($s['decor_owned'][$id])) { $s['decor_owned'][$id]=$now; }
            }
            ksort($s['decor_owned'],SORT_STRING);
        }
        if(isset($c['waters']) && is_array($c['waters'])) {
            $list=$s['unlocked_waters'] ?? [];
            foreach(array_keys($c['waters']) as $wid) { if(!in_array($wid,$list,true)) { $list[]=$wid; } }
            sort($list,SORT_STRING);
            $s['unlocked_waters']=$list;
        }
        return [$s,''];
    }

    /** 目录：名称/品级/文案来自内容模块，价格与条件来自服务端配置；客户端不提交任何价格或币值。 */
    private function catalog(array $s): array {
        require_once __DIR__.'/aquarium_content.php';
        // 图鉴按存档实际配置版本取：v2 是 16 种，v1 保持 12 种
        $v2 = (($this->c['version'] ?? '') === gamecenter_aquarium_configs::CONTENT_V2);
        $meta = $v2 ? gamecenter_aquarium_content::catalog_v2() : gamecenter_aquarium_content::catalog();

        // 展示位里每种鱼占几格
        $shown = [];
        foreach(($s['layout']['fish'] ?? []) as $slot) {
            if(is_string($slot) && $slot !== '') { $shown[$slot] = ($shown[$slot] ?? 0) + 1; }
        }
        $fish=[];
        foreach($meta['fish'] as $f) {
            $own=$s['fish'][$f['id']]??null;
            $owned=(int)($own['owned_count'] ?? 0);
            $f['discovered']=$own!==null;
            $f['discovered_at']=$own['discovered_at']??null;
            $f['catch_count']=$own['catch_count']??0;
            $f['owned']=$owned;
            $f['shown']=$shown[$f['id']] ?? 0;
            $f['lifetime_cap']=isset($f['lifetime_cap']) ? (int)$f['lifetime_cap'] : null;
            $f['rod_gate']=isset($f['min_rod_level']) ? (int)$f['min_rod_level'] : 0;
            $f['rod_ready']=$f['rod_gate'] === 0 || (int)$s['rod_level'] >= $f['rod_gate'];
            // 限量种不可售；普通种可售 = 持有 - max(4, 展示)
            $f['sellable'] = $f['lifetime_cap'] !== null ? 0 : max(0, $owned - max(4, $f['shown']));
            $fish[]=$f;
        }
        $discovered = 0;
        foreach($fish as $f) { if($f['discovered']) { $discovered++; } }
        $decor=[];
        foreach($meta['decor'] as $d) {
            $d['owned']=isset($s['decor_owned'][$d['id']]);
            $d['missing']=gamecenter_aquarium_shop::missing($s,$d['id'],$this->c);
            $decor[]=$d;
        }
        return ['fish'=>$fish,'decor'=>$decor,'waters'=>$meta['water_names'],
            'book'=>['discovered'=>$discovered,'total'=>count($fish)],
            'capacities'=>$this->c['fish_capacities'],'capacity_costs'=>$this->c['fish_capacity_costs'],
            'backgrounds'=>gamecenter_aquarium_shop::backgrounds(),
            'decor_slots_per_layer'=>gamecenter_aquarium_shop::decor_slots_per_layer(),
            'catalog_version'=>$meta['version'],'assets_version'=>gamecenter_aquarium_configs::assets_version()];
    }    public function request(int $uid,bool $allowed,array $data,bool $isAdmin=false): array {
        if($uid<1) { return $this->result('login'); }
        if(!$allowed) { return $this->result('permission'); }
        if(gamecenter_aquarium_configs::maintenance()) { return $this->result('maintenance'); }
        if(strlen(serialize($data))>8192 || ($data['client_version']??'')!==self::CLIENT) { return $this->result('client'); }
        $action=$data['action']??'';
        $actions=['init','sync','upgrade','unlock','switch','catalog','buy','expand','layout','devgrant','sell'];
        if(!is_string($action) || !in_array($action,$actions,true)) { return $this->result('input'); }
        // 购买/扩容/布置只存在于内容配置；foundation 阶段没有装饰与容量字段。
        if(in_array($action,['catalog','buy','expand','layout'],true)
            && (!isset($this->c['decor']) || !isset($this->c['fish_capacities']) || !isset($this->c['initial_fish_capacity']))) {
            return $this->result('config');
        }
        if($action==='devgrant' && !$isAdmin) { return $this->result('permission'); }
        $keys=['action','client_version','formhash'];
        $mutating=in_array($action,['upgrade','unlock','switch','buy','expand','layout','devgrant','sell'],true);
        if($mutating) { $keys[]='expected_version'; }
        if($action==='upgrade') { $keys[]='target_level'; }
        if(in_array($action,['unlock','switch'],true)) { $keys[]='water_id'; }
        if($action==='buy') { $keys[]='decor_id'; }
        if($action==='sell') { $keys[]='fish_id'; $keys[]='qty'; }
        if($action==='layout') { $keys[]='layout'; }
        foreach($data as $k=>$v) {
            if(!in_array($k,$keys,true)) { return $this->result('input'); }
            if($k==='layout') { if(!is_array($v) && !is_string($v)) { return $this->result('input'); } continue; }
            if(!is_string($v) && !is_int($v)) { return $this->result('input'); }
        }
        foreach($keys as $k) {
            if(in_array($k,['formhash'],true)) { continue; }
            if(!array_key_exists($k,$data)) { return $this->result('input'); }
        }
        foreach($mutating ? ['expected_version'] : [] as $k) {
            if(!preg_match('/\A[1-9][0-9]{0,12}\z/D',(string)$data[$k]) || (int)$data[$k]>=gamecenter_aquarium_rules::MAX_VALUE) { return $this->result('input'); }
            $data[$k]=(int)$data[$k];
        }
        if($action==='upgrade') {
            if(!preg_match('/\A[1-9][0-9]?\z/D',(string)$data['target_level'])) { return $this->result('input'); }
            $data['target_level']=(int)$data['target_level'];
        }
        if(isset($data['water_id']) && (!is_string($data['water_id']) || !isset($this->c['waters'][$data['water_id']]))) { return $this->result('input'); }
        if(isset($data['decor_id']) && (!is_string($data['decor_id']) || !gamecenter_aquarium_rules::id($data['decor_id']) || !isset($this->c['decor'][$data['decor_id']]))) { return $this->result('input'); }
        if(isset($data['fish_id']) && (!is_string($data['fish_id']) || !gamecenter_aquarium_rules::id($data['fish_id']))) { return $this->result('input'); }
        if(isset($data['qty']) && (!preg_match('/\A[1-9][0-9]{0,3}\z/D',(string)$data['qty']))) { return $this->result('input'); }
        if(isset($data['qty'])) { $data['qty']=(int)$data['qty']; }
        if(isset($data['layout']) && is_string($data['layout'])) {
            // 1.8.1：坏 JSON 原本在 try 外抛例外，玩家看到「请等待维护」；改回参数不正确
            try { $decoded=json_decode($data['layout'],true,8,JSON_THROW_ON_ERROR); } catch(JsonException $e) { return $this->result('input'); }
            if(!is_array($decoded)) { return $this->result('input'); }
            $data['layout']=$decoded;
        }
        if(isset($data['layout']) && strlen(json_encode($data['layout'])) > self::MAX_LAYOUT_BYTES) { return $this->result('input'); }
        try {
            return $this->db->transaction(function()use($uid,$data,$action,$mutating) {
                $row=$this->db->lock($uid); $now=($this->clock)();
                if(!$row) {
                    if($action!=='init') { return $this->result('uninitialized'); }
                    $s=gamecenter_aquarium_rules::initial($uid,bin2hex(random_bytes(16)),$now,$this->c);
                    if(isset($this->c['decor'],$this->c['fish_capacities'],$this->c['initial_fish_capacity'])) { $s=gamecenter_aquarium_shop::defaults($s,$this->c); }
                    $row=['uid'=>$uid,'save_version'=>1,'config_version'=>$this->c['version'],'state_json'=>json_encode($s,JSON_THROW_ON_ERROR),
                        'version'=>1,'updated_ms'=>$now];
                    $this->db->insert($row); return $this->result('',$this->snapshot($s,1));
                }
                // 先宽容解码（版本可能落后），迁移后再严格校验
                $s=$this->decode($row,$uid,false); $version=(int)$row['version'];

                // 配置版本落后于当前 ACTIVE_CONFIG：在同一个事务里做一次池切换
                // （旧配置结算到本次 now，再改标识；不额外结算、不重开 24h 预算）
                if(($s['config_version'] ?? '') !== $this->c['version']) {
                    require_once __DIR__.'/aquarium_migrate.php';
                    try {
                        $src = gamecenter_aquarium_configs::for_version((string)$s['config_version']);
                        // 老档可能没有库存字段：先按源配置补齐（只有整行纯旧档才补，异常档打标记）
                        // 1.8.1：foundation 配置没有容量／装饰栏位，不能拿它补库存（原本会读到不存在的 initial_fish_capacity）
                        if(isset($src['decor'],$src['fish_capacities'],$src['initial_fish_capacity'])) { $s = gamecenter_aquarium_shop::defaults($s, $src); }
                        if(!empty($s['inventory_anomaly'])) { return $this->result('maintenance', $this->snapshot($s,$version)); }
                        $mig = new gamecenter_aquarium_migrate($this->db, $src, $this->c);
                        if($mig->sameIds()) {
                            $sw = gamecenter_aquarium_migrate::switchPool($s, $src, $this->c, $now);
                            if($sw['changed']) {
                                $s = $sw['save'];
                                $version++;
                                $row['version']=$version;
                                // 1.8.1：标头跟着更新，后面的完整检查才不会把刚迁移的档当成标头不符
                                $row['config_version']=$s['config_version']; $row['updated_ms']=$s['last_settled_ms'];
                                $this->db->save_versioned([
                                    'uid'=>$uid,'save_version'=>1,'config_version'=>$s['config_version'],
                                    'state_json'=>json_encode($s,JSON_THROW_ON_ERROR),
                                    'version'=>$version,'updated_ms'=>$s['last_settled_ms'],
                                ]);
                            }
                        } else {
                            return $this->result('migrate_readonly', $this->snapshot($s,$version));   // 跨命名迁移需 CLI
                        }
                    } catch(Throwable $e) {
                        // 迁移不了也不能让玩家看到"还没有水族馆"：原档只读呈现，等维护修复
                        return $this->result('migrate_readonly', $this->snapshot($s,$version));
                    }
                }
                // 1.8.1：同配置存档也做完整检查（可修的修、修不了的只读隔离）；$orig 用来判断要不要写回
                $orig=$s; $rowCfgBad=(string)$row['config_version']!==$this->c['version'];
                list($s,$verdict)=$this->guard($s,$row);
                if($action==='init') { return $this->result('',$this->snapshot($s,$version)); }
                if(!empty($s['inventory_anomaly'])) {
                    // 库存异常账号：只读隔离。不结算、不购物、不布景、不售卖、不写原档。
                    if($action==='catalog') { $out=$this->result('',$this->snapshot($s,$version)); $out['catalog']=$this->catalog($s); return $out; }
                    if($action==='sync' || $action==='init') { return $this->result('',$this->snapshot($s,$version)); }
                    return $this->result('maintenance',$this->snapshot($s,$version));
                }
                if($action==='catalog') { $out=$this->result('',$this->snapshot($s,$version)); $out['catalog']=$this->catalog($s); return $out; }
                if($mutating && $data['expected_version']!==$version) { return $this->result('conflict',$this->snapshot($s,$version)); }
                $lastReceiptBefore = (!empty($s['recent_sale']) && is_array($s['recent_sale']))
                    ? json_encode(end($s['recent_sale'])) : '';
                $r=gamecenter_aquarium_rules::settle($s,$now,$this->c); $next=$r['save']; $code='';
                if(in_array($action,['upgrade','unlock','switch'],true)) { $op=gamecenter_aquarium_rules::operate($next,$data,$this->c); $next=$op['save']; $code=$op['code']; }
                elseif($action==='buy') { list($next,$code)=gamecenter_aquarium_shop::buy($next,$data['decor_id'],$this->c,$now); }
                elseif($action==='expand') { list($next,$code)=gamecenter_aquarium_shop::expand($next,$this->c); }
                elseif($action==='layout') { list($next,$code)=gamecenter_aquarium_shop::setLayout($next,$data['layout'],$this->c); }
                elseif($action==='devgrant') { list($next,$code)=self::devgrant($next,$this->c,$now); }
                elseif($action==='sell') {
                    if(!gamecenter_aquarium_configs::saleAllowed($uid)) { $code='closed'; }
                    else { list($next,$code)=gamecenter_aquarium_shop::sell($next,$data['fish_id'],(int)$data['qty'],$this->c,$now); }
                }
                if($r['catches'] || $r['discarded_ms']) {
                    $next['recent_summary']=['from_ms'=>$s['last_settled_ms'],'to_ms'=>$next['last_settled_ms'],
                        'coins'=>array_sum(array_column($r['catches'],'coins')),'catch_count'=>count($r['catches']),
                        'new_fish_ids'=>array_values(array_column(array_filter($r['catches'],static fn($x)=>$x['is_new']),'fish_id')),
                        'effective_ms'=>$r['effective_ms'],'discarded_ms'=>$r['discarded_ms']];
                }
                if($next!==$orig || $rowCfgBad) {
                    if(isset($this->c['decor'],$this->c['fish_capacities'],$this->c['initial_fish_capacity'])) { gamecenter_aquarium_shop::validateState($next,$this->c); }
                    $version++; $row['state_json']=json_encode($next,JSON_THROW_ON_ERROR); $row['version']=$version; $row['updated_ms']=$next['last_settled_ms'];
                    $lastReceiptAfter = (!empty($next['recent_sale']) && is_array($next['recent_sale']))
                        ? json_encode(end($next['recent_sale'])) : '';
                    // 只有本次确实新增了回执才绑定版本；失败的售卖不得改写上一笔成功记录
                    if($action==='sell' && $lastReceiptAfter !== '' && $lastReceiptAfter !== $lastReceiptBefore) {
                        // 用真实行版本补齐回执，便于丢响应时核对（不是幂等键）
                        $idx=count($next['recent_sale'])-1;
                        $next['recent_sale'][$idx]['before_version']=$version-1;
                        $next['recent_sale'][$idx]['after_version']=$version;
                        $row['state_json']=json_encode($next,JSON_THROW_ON_ERROR);
                    }
                    // 1.8.1：一律连 config_version 栏位一起写（旧版 save() 不写这一栏，栏位可能停在旧配置）
                    $row['config_version']=$this->c['version'];
                    $this->db->save_versioned($row);
                }
                return $this->result($code,$this->snapshot($next,$version));
            });
        } catch(DomainException $e) { self::diag('request:'.$e->getMessage(), $uid); return $this->result('config'); }
        catch(Throwable $e) { self::diag('request-throw:'.$e->getMessage(), $uid); return $this->result('busy'); }
    }
}
