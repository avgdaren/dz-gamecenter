<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。A阶段服务端存档服务，路由限管理员；不发论坛积分。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_config.php';
require_once __DIR__.'/aquarium_configs.php';
require_once __DIR__.'/aquarium_store.php';
final class gamecenter_aquarium {
    const CLIENT='aquarium-foundation-1';
    private $db;
    private $clock;
    private array $c;
    public function __construct($store=null,?callable $clock=null,?array $config=null) {
        $this->db=$store ?? new gamecenter_aquarium_store();
        $this->clock=$clock ?? static fn()=>(int)floor(microtime(true)*1000);
        $this->c=$config===null ? gamecenter_aquarium_configs::active() : gamecenter_aquarium_rules::prepare($config);
    }
    private function result(string $code='',?array $snapshot=null): array {
        $messages=['login'=>'登录论坛账号后才能建立水族馆','permission'=>'当前用户组暂不能操作水族馆','input'=>'参数不正确',
            'client'=>'请刷新页面后重试','uninitialized'=>'尚未建立测试存档','conflict'=>'状态已更新，请查看最新进度后重新选择',
            'target'=>'目标等级或水域已变化','coins'=>'游戏金币不足','condition'=>'尚未满足条件',
            'maintenance'=>'水族馆正在维护，你的存档不会丢失，请稍后回来',
            'config'=>'配置或存档版本不匹配，请等待维护，不要清空存档','busy'=>'暂时无法同步，请稍后重试'];
        return ['ok'=>$code===''?1:0,'code'=>$code,'msg'=>$code===''?'已同步':($messages[$code]??$messages['busy']),'snapshot'=>$snapshot];
    }
    private function decode(array $row,int $uid): array {
        if((int)$row['uid']!==$uid || (int)$row['save_version']!==1 || $row['config_version']!==$this->c['version']
            || !ctype_digit((string)$row['version']) || (int)$row['version']<1 || (int)$row['version']>=gamecenter_aquarium_rules::MAX_VALUE
            || strlen($row['state_json'])>131072) { throw new DomainException('state'); }
        $s=json_decode($row['state_json'],true,32,JSON_THROW_ON_ERROR);
        if(!is_array($s) || ($s['uid']??null)!==$uid || ($s['last_settled_ms']??null)!==(int)$row['updated_ms']) { throw new DomainException('state'); }
        gamecenter_aquarium_rules::validate($s,$this->c); return $s;
    }
    private function snapshot(array $s,int $version): array {
        $out=[];
        foreach(['coins','rod_level','last_settled_ms','progress_ms','catch_seq','current_water','unlocked_waters','fish','no_new_count'] as $k) { $out[$k]=$s[$k]; }
        $out['version']=$version;
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
            'waters'=>array_map(static fn($w)=>['cost'=>$w['cost'],'requires_count'=>$w['requires_count']],$this->c['waters'])];
        return $out;
    }
    public function request(int $uid,bool $allowed,array $data): array {
        if($uid<1) { return $this->result('login'); }
        if(!$allowed) { return $this->result('permission'); }
        if(gamecenter_aquarium_configs::maintenance()) { return $this->result('maintenance'); }
        if(strlen(serialize($data))>4096 || ($data['client_version']??'')!==self::CLIENT) { return $this->result('client'); }
        $action=$data['action']??'';
        if(!is_string($action) || !in_array($action,['init','sync','upgrade','unlock','switch'],true)) { return $this->result('input'); }
        $keys=['action','client_version','formhash'];
        $mutating=in_array($action,['upgrade','unlock','switch'],true);
        if($mutating) { $keys[]='expected_version'; }
        if($action==='upgrade') { $keys[]='target_level'; }
        if(in_array($action,['unlock','switch'],true)) { $keys[]='water_id'; }
        foreach($data as $k=>$v) { if(!in_array($k,$keys,true) || (!is_string($v) && !is_int($v))) { return $this->result('input'); } }
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
        try {
            return $this->db->transaction(function()use($uid,$data,$action,$mutating) {
                $row=$this->db->lock($uid); $now=($this->clock)();
                if(!$row) {
                    if($action!=='init') { return $this->result('uninitialized'); }
                    $s=gamecenter_aquarium_rules::initial($uid,bin2hex(random_bytes(16)),$now,$this->c);
                    $row=['uid'=>$uid,'save_version'=>1,'config_version'=>$this->c['version'],'state_json'=>json_encode($s,JSON_THROW_ON_ERROR),
                        'version'=>1,'updated_ms'=>$now];
                    $this->db->insert($row); return $this->result('',$this->snapshot($s,1));
                }
                $s=$this->decode($row,$uid); $version=(int)$row['version'];
                if($action==='init') { return $this->result('',$this->snapshot($s,$version)); }
                if($mutating && $data['expected_version']!==$version) { return $this->result('conflict',$this->snapshot($s,$version)); }
                $r=gamecenter_aquarium_rules::settle($s,$now,$this->c); $next=$r['save']; $code='';
                if($mutating) { $op=gamecenter_aquarium_rules::operate($next,$data,$this->c); $next=$op['save']; $code=$op['code']; }
                if($r['catches'] || $r['discarded_ms']) {
                    $next['recent_summary']=['from_ms'=>$s['last_settled_ms'],'to_ms'=>$next['last_settled_ms'],
                        'coins'=>array_sum(array_column($r['catches'],'coins')),'catch_count'=>count($r['catches']),
                        'new_fish_ids'=>array_values(array_column(array_filter($r['catches'],static fn($x)=>$x['is_new']),'fish_id')),
                        'effective_ms'=>$r['effective_ms'],'discarded_ms'=>$r['discarded_ms']];
                }
                if($next!==$s) {
                    $version++; $row['state_json']=json_encode($next,JSON_THROW_ON_ERROR); $row['version']=$version; $row['updated_ms']=$next['last_settled_ms'];
                    $this->db->save($row);
                }
                return $this->result($code,$this->snapshot($next,$version));
            });
        } catch(DomainException $e) { return $this->result('config'); }
        catch(Throwable $e) { return $this->result('busy'); }
    }
}
