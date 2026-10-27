<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。账号由论坛传入，结算只在房间行锁内。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/raid_rules.php';
require_once __DIR__.'/raid_store.php';

final class gamecenter_raid {
    public const CLIENT = 'raid-client-1', WAITING = 0, CANCELLED = 4, WAIT_MS = 300000;
    private gamecenter_raid_store $db;
    private $clock;
    public function __construct(?gamecenter_raid_store $db = null, ?callable $clock = null) {
        $this->db = $db ?? new gamecenter_raid_store();
        $this->clock = $clock ?? fn() => (int)floor(microtime(true)*1000);
    }
    private function now(): int { return (int)($this->clock)(); }
    private function error(string $code, ?array $r = null, int $uid = 0): array {
        $messages = ['login'=>'请先登录论坛账号。','permission'=>'当前账号没有参与权限。',
            'input'=>'请求参数不正确。','client'=>'页面已更新，请刷新后继续。','not_found'=>'房间不存在或你没有访问权限。',
            'full'=>'邀请已过期、房间已满或已经结束。','active'=>'你已有活动讨伐，请先完成、取消或撤退。',
            'request_conflict'=>'请求标识与上次内容不一致，正在自动更新，请稍后重试。','ended'=>'这一局已经结束。',
            'round'=>'本轮已结算，请根据新预告行动。','locked'=>'本轮已经确认，不能改选。',
            'actor'=>'你已倒地、离场或正在撤退。','heal'=>'恢复次数已用完，或目标仍是满血。',
            'target'=>'目标不能接受这次行动。','conflict'=>'房间状态已变化，正在自动更新，请稍后重试。',
            'rate'=>'创建房间过于频繁，请稍后再试。','upgrade'=>'请管理员先升级游戏中心。',
            'busy'=>'服务暂时繁忙，请稍后重试。'];
        return ['ok'=>0,'code'=>$code,'msg'=>$messages[$code] ?? $messages['busy'],
            'server_ms'=>$this->now(),'snapshot'=>$r ? $this->snapshot($r,$uid) : null];
    }
    private function ok(?array $r, int $uid, array $extra = []): array {
        return ['ok'=>1,'code'=>'ok','server_ms'=>$this->now(),'snapshot'=>$r ? $this->snapshot($r,$uid) : null] + $extra;
    }
    private function seat(array $r, int $uid): int {
        if($uid > 0 && (int)$r['slot0_uid'] === $uid) { return 0; }
        return $uid > 0 && (int)$r['slot1_uid'] === $uid ? 1 : -1;
    }
    private function snapshot(array $r, int $uid): array {
        $s = $r['state']; $players = [];
        foreach([$r['slot0_uid'],$r['slot1_uid']] as $i=>$id) {
            if(!(int)$id) { continue; }
            $players[] = ['uid'=>(int)$id,'name'=>(string)$r[$i === 0 ? 'creator_name' : 'slot1_name'],
                'avatar'=>function_exists('avatar') ? avatar((int)$id,'small',1) : ''];
        }
        return $s + ['room'=>$r['code'],'seat'=>$this->seat($r,$uid),'players'=>$players,
            'created_ms'=>(int)$r['created_ms'],'result'=>$r['result']];
    }
    private static function json(array $x, int $limit): string {
        $json = json_encode($x,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
        if(strlen($json) > $limit) { throw new RuntimeException('raid json size'); }
        return $json;
    }
    private function summary(array $r): array {
        $s=$r['state'];
        if($s['status'] < 2) { return []; }
        return ['mode'=>$s['mode'],'rules_version'=>$s['rules_version'],'status'=>$s['status'],
            'reason'=>$s['reason'],'rounds'=>count($s['history']),'hp'=>$s['hp'],'pots'=>$s['pots'],
            'survivors'=>count(gamecenter_raid_rules::alive($s)),
            'duration_ms'=>$s['status'] === self::CANCELLED ? 0 : max(0,(int)$s['ended_ms']-(int)$r['started_ms'])];
    }
    private function decode(array $r): array {
        if(strlen($r['state_json']) > 16384 || strlen($r['result_json']) > 4096) { throw new RuntimeException('raid json size'); }
        $s=json_decode($r['state_json'],true,32,JSON_THROW_ON_ERROR);
        $result=json_decode($r['result_json'],true,16,JSON_THROW_ON_ERROR);
        if(!is_array($s) || !is_array($result)) { throw new RuntimeException('raid json shape'); }
        if(in_array($s['status'] ?? null,[self::WAITING,self::CANCELLED],true)) {
            // Waiting/cancelled rooms have never started. Validate their combat fields against the fixed initial state.
            $base=gamecenter_raid_rules::initial('duo',(int)$r['created_ms'],(string)$r['rules_version']);
            foreach(['status','version','deadline_ms','updated_ms','reason','ended_ms'] as $key) { $base[$key]=$s[$key] ?? null; }
            if($s !== $base || !in_array($s['reason'],['','cancelled','expired'],true) ||
                $s['deadline_ms'] !== (int)$r['created_ms']+self::WAIT_MS ||
                ($s['status'] === 0 && ($s['ended_ms'] !== null || $s['reason'] !== '' || $s['version'] !== 1)) ||
                ($s['status'] === 4 && (!is_int($s['ended_ms']) || $s['reason'] === '' || $s['version'] !== 2))) {
                throw new RuntimeException('raid waiting state');
            }
        } else { gamecenter_raid_rules::validate($s); }
        foreach(['mode','rules_version'] as $key) { if($r[$key] !== $s[$key]) { throw new RuntimeException('raid version mismatch'); } }
        foreach(['status','round_no','version','deadline_ms','updated_ms'] as $key) {
            if((int)$r[$key] !== $s[$key]) { throw new RuntimeException('raid column mismatch'); }
        }
        if(($r['ended_ms'] === null ? null : (int)$r['ended_ms']) !== $s['ended_ms'] ||
            (int)$r['slot0_uid'] !== (int)$r['creator_uid'] ||
            ($s['status'] < 2 && $s['mode'] === 'duo' && $s['status'] === 1 && !(int)$r['slot1_uid'])) {
            throw new RuntimeException('raid member mismatch');
        }
        $n=$s['mode'] === 'solo' ? 1 : 2;
        if(($n === 1 && (int)$r['slot1_uid'] !== 0) ||
            ($s['status'] === 0 && (int)$r['slot1_uid'] !== 0) ||
            ((int)$r['slot1_uid'] > 0 && (int)$r['slot1_uid'] === (int)$r['slot0_uid']) ||
            !in_array($s['reason'],['','defeated','knockout','retreated','round_limit','expired','cancelled'],true)) {
            throw new RuntimeException('raid member state');
        }
        foreach($s['history'] as $index=>$h) {
            self::historyRow($h,$index+1,$n,(int)$s['boss_max_hp'],$n===1?gamecenter_raid_rules::config($s['rules_version'])['solo_potions']:2);
        }
        // The start time is persisted separately so waiting time never counts as battle duration.
        $r['state']=$s; $r['result']=$result;
        if($result !== $this->summary($r)) { throw new RuntimeException('raid result mismatch'); }
        foreach(['id','creator_uid','slot0_uid','slot1_uid','status','round_no','version','deadline_ms','created_ms','started_ms','updated_ms'] as $key) { $r[$key]=(int)$r[$key]; }
        return $r;
    }
    private static function historyRow($h, int $round, int $n, int $bossMax, int $potMax): void {
        if(!is_array($h) || count($h) !== 11 || strlen(self::json($h,512)) > 512 ||
            ($h['round'] ?? null) !== $round || !is_bool($h['exposed'] ?? null) ||
            !is_int($h['boss'] ?? null) || $h['boss'] < 0 || $h['boss'] > $bossMax) {
            throw new RuntimeException('raid history shape');
        }
        foreach(['hp'=>40,'pots'=>$potMax,'damage'=>28,'heals'=>56] as $key=>$max) {
            $values=$h[$key] ?? null;
            if(!is_array($values) || !array_is_list($values) || count($values) !== $n) { throw new RuntimeException('raid history numbers'); }
            foreach($values as $v) { if(!is_int($v) || $v < 0 || $v > $max) { throw new RuntimeException('raid history number'); } }
        }
        foreach(['actions','left'] as $key) {
            if(!isset($h[$key]) || !is_array($h[$key]) || !array_is_list($h[$key]) || count($h[$key]) !== $n) { throw new RuntimeException('raid history members'); }
        }
        foreach($h['left'] as $left) { if(!is_bool($left)) { throw new RuntimeException('raid history departure'); } }
        foreach($h['actions'] as $a) {
            if($a === null) { continue; }
            if(!is_array($a) || count($a) !== 2 || !in_array($a['kind'] ?? null,['attack','guard','heal'],true) ||
                !is_int($a['target'] ?? null) || ($a['kind'] === 'attack' ? $a['target'] !== -1 : ($a['target'] < 0 || $a['target'] >= $n))) {
                throw new RuntimeException('raid history action');
            }
        }
        if(!isset($h['defaults']) || !is_array($h['defaults']) || !array_is_list($h['defaults']) || count($h['defaults']) > $n) { throw new RuntimeException('raid history defaults'); }
        $seen=[];
        foreach($h['defaults'] as $i) {
            if(!is_int($i) || $i < 0 || $i >= $n || isset($seen[$i]) || $h['actions'][$i] !== ['kind'=>'guard','target'=>$i]) { throw new RuntimeException('raid history default'); }
            $seen[$i]=true;
        }
        $p=$h['preview'] ?? null;
        if(!is_array($p) || count($p) !== 4 || ($p['kind'] ?? null) !== ($round-1)%4 ||
            !in_array($p['phase'] ?? null,[1,2],true) || !in_array($p['damage'] ?? null,[0,8,10,24,28],true) ||
            !is_array($p['targets'] ?? null) || !array_is_list($p['targets']) || count($p['targets']) > $n) { throw new RuntimeException('raid history preview'); }
        foreach($p['targets'] as $i) { if(!is_int($i) || $i < 0 || $i >= $n) { throw new RuntimeException('raid history target'); } }
    }
    private function pack(array $r): array {
        $s=$r['state'];
        foreach(['status','round_no','version','deadline_ms','updated_ms','ended_ms'] as $key) { $r[$key]=$s[$key]; }
        $r['result']=$this->summary($r);
        $r['state_json']=self::json($s,16384);
        $r['result_json']=$r['result'] ? self::json($r['result'],4096) : '{}';
        return $r;
    }
    private function lock(string $code = '', int $id = 0): ?array {
        $r=$id ? $this->db->first('SELECT * FROM %t WHERE id=%d FOR UPDATE',['gamecenter_raid_room',$id]) :
            $this->db->first('SELECT * FROM %t WHERE code=%s FOR UPDATE',['gamecenter_raid_room',$code]);
        return $r ? $this->decode($r) : null;
    }
    private function fresh(array $r, int $now): array {
        $s=$r['state'];
        if($s['status'] === self::WAITING && $now >= $s['deadline_ms']) {
            $s['status']=self::CANCELLED; $s['reason']='expired'; $s['ended_ms']=$s['deadline_ms'];
            $s['updated_ms']=$s['deadline_ms']; $s['version']++;
        } elseif($s['status'] === 1) { $s=gamecenter_raid_rules::advance_due($s,$now); }
        if($s !== $r['state']) { $r['state']=$s; $r=$this->pack($r); $this->db->save($r); }
        return $r;
    }
    private function pointer(int $uid): array {
        $this->db->query('INSERT IGNORE INTO %t (uid,room_id) VALUES (%d,0)',['gamecenter_raid_member',$uid]);
        return $this->db->first('SELECT * FROM %t WHERE uid=%d FOR UPDATE',['gamecenter_raid_member',$uid]);
    }
    private function occupied(?array $r, int $uid): bool {
        if(!$r || $r['state']['status'] >= 2) { return false; }
        $seat=$this->seat($r,$uid);
        return $seat >= 0 && !$r['state']['left'][$seat];
    }
    private function receipt(array $r, int $uid, string $rid, array $params): ?array {
        $prior=$this->db->first('SELECT * FROM %t WHERE room_id=%d AND uid=%d AND request_id=%s',
            ['gamecenter_raid_action',$r['id'],$uid,$rid]);
        if(!$prior) { return null; }
        if(!hash_equals($prior['fingerprint'],hash('sha256',self::json($params,256)))) { return $this->error('request_conflict',$r,$uid); }
        return $this->ok($r,$uid,['replayed'=>1,'receipt'=>['action'=>$prior['action'],
            'accepted_round'=>(int)$prior['round_no'],'accepted_version'=>(int)$prior['accepted_version']]]);
    }
    private function accept(array $r, int $uid, string $rid, array $params, int $round, int $now): array {
        $json=self::json($params,256);
        $this->db->query('INSERT INTO %t (room_id,uid,request_id,fingerprint,action,round_no,params,accepted_version,created_ms) VALUES (%d,%d,%s,%s,%s,%d,%s,%d,%d)',
            ['gamecenter_raid_action',$r['id'],$uid,$rid,hash('sha256',$json),$params['action'],$round,$json,$r['version'],$now]);
        return $this->ok($r,$uid,['receipt'=>['action'=>$params['action'],'accepted_round'=>$round,'accepted_version'=>(int)$r['version']]]);
    }
    private static function integer($v, int $min, int $max): ?int {
        if((!is_string($v) && !is_int($v)) || !preg_match('/\A-?(?:0|[1-9][0-9]{0,9})\z/',(string)$v)) { return null; }
        $n=(int)$v; return $n >= $min && $n <= $max ? $n : null;
    }
    /** No uid, seat, damage, HP or rules come from the request. */
    public function request(int $uid, string $name, bool $allowed, array $data): array {
        if($uid < 1) { return $this->error('login'); }
        if(!$allowed) { return $this->error('permission'); }
        if(strlen(serialize($data)) > 4096) { return $this->error('input'); }
        foreach($data as $key=>$v) {
            if(!is_scalar($v) || !in_array($key,['action','mode','room','round','kind','target','expected_version','request_id','formhash','client_version'],true)) {
                return $this->error('input');
            }
        }
        if(($data['client_version'] ?? '') !== self::CLIENT) { return $this->error('client'); }
        $action=(string)($data['action'] ?? '');
        if(!in_array($action,['create','join','current','state','act','retreat','cancel','history'],true)) { return $this->error('input'); }
        $code=strtoupper((string)($data['room'] ?? '')); $rid=(string)($data['request_id'] ?? '');
        if(in_array($action,['join','state','act','retreat','cancel'],true) && !preg_match('/\A[A-F0-9]{12}\z/',$code)) { return $this->error('input'); }
        $writes=in_array($action,['create','join','act','retreat','cancel'],true);
        if($writes && !preg_match('/\A[a-f0-9]{32}\z/',$rid)) { return $this->error('input'); }
        $params=['action'=>$action];
        if($action === 'create') {
            if(!in_array($data['mode'] ?? '',['solo','duo'],true)) { return $this->error('input'); }
            $params['mode']=$data['mode'];
        }
        if($action === 'act') {
            $round=self::integer($data['round'] ?? null,1,16); $target=self::integer($data['target'] ?? null,-1,1);
            if($round === null || $target === null || !in_array($data['kind'] ?? '',['attack','guard','heal'],true)) { return $this->error('input'); }
            $params+=['round'=>$round,'kind'=>$data['kind'],'target'=>$target];
        }
        if($action === 'cancel') {
            $v=self::integer($data['expected_version'] ?? null,1,1000);
            if($v === null) { return $this->error('input'); } $params['expected_version']=$v;
        }
        preg_match('/\A.{0,40}/us',$name,$m); $name=$m[0] ?? ('UID '.$uid);
        try {
            if($action === 'create') { return $this->create($uid,$name,$rid,$params); }
            if($action === 'join') { return $this->join($uid,$name,$code,$rid,$params); }
            if($action === 'history') { return $this->history($uid); }
            return $this->db->transaction(function() use($uid,$action,$code,$rid,$params) {
                if($action === 'current') {
                    $p=$this->db->first('SELECT room_id FROM %t WHERE uid=%d',['gamecenter_raid_member',$uid]);
                    if(empty($p['room_id'])) { return $this->ok(null,$uid); }
                    $r=$this->lock('',(int)$p['room_id']);
                } else { $r=$this->lock($code); }
                if(!$r || $this->seat($r,$uid) < 0) { return $this->error('not_found'); }
                // Read time after acquiring the lock, never at request arrival.
                $now=$this->now(); $r=$this->fresh($r,$now);
                if(in_array($action,['current','state'],true)) { return $this->ok($r,$uid); }
                if($prior=$this->receipt($r,$uid,$rid,$params)) { return $prior; }
                $s=$r['state']; $seat=$this->seat($r,$uid); $round=$s['round_no'];
                if($action === 'cancel') {
                    if($s['status'] !== 0 || $seat !== 0 || $s['version'] !== $params['expected_version']) { return $this->error('conflict',$r,$uid); }
                    $s['status']=4; $s['reason']='cancelled'; $s['ended_ms']=$now; $s['updated_ms']=$now; $s['version']++;
                } else {
                    if($s['status'] !== 1) { return $this->error('ended',$r,$uid); }
                    if($s['left'][$seat] || $s['leaving'][$seat]) { return $this->error('actor',$r,$uid); }
                    try {
                        $s=$action === 'act' ? gamecenter_raid_rules::submit($s,$params['round'],$seat,
                            ['kind'=>$params['kind'],'target'=>$params['target']],$now) : gamecenter_raid_rules::retreat($s,$seat,$now);
                    } catch(InvalidArgumentException $e) { return $this->error($e->getMessage(),$r,$uid); }
                }
                $r['state']=$s; $r=$this->pack($r); $this->db->save($r);
                return $this->accept($r,$uid,$rid,$params,$round,$now);
            });
        } catch(Throwable $e) {
            if(function_exists('runlog')) { runlog('gamecenter_raid','operation failed; code='.(int)$e->getCode()); }
            return $this->error((int)$e->getCode() === 1146 ? 'upgrade' : 'busy') + ['retryable'=>1];
        }
    }
    private function create(int $uid, string $name, string $rid, array $params): array {
        return $this->db->transaction(function() use($uid,$name,$rid,$params) {
            $p=$this->pointer($uid);
            $old=$this->db->first('SELECT * FROM %t WHERE creator_uid=%d AND create_request=%s FOR UPDATE',['gamecenter_raid_room',$uid,$rid]);
            if($old) {
                $old=$this->fresh($this->decode($old),$this->now());
                return $this->receipt($old,$uid,$rid,$params) ?? $this->error('busy');
            }
            if(!empty($p['room_id'])) {
                $old=$this->lock('',(int)$p['room_id']); if($old) { $old=$this->fresh($old,$this->now()); }
                if($this->occupied($old,$uid)) { return $this->error('active',$old,$uid); }
            }
            $now=$this->now();
            $rate=$this->db->first('SELECT COUNT(*) AS n FROM %t WHERE creator_uid=%d AND created_ms>%d',['gamecenter_raid_room',$uid,$now-600000]);
            if((int)$rate['n'] >= 30) { return $this->error('rate'); }
            $s=gamecenter_raid_rules::initial($params['mode'],$now);
            if($params['mode'] === 'duo') { $s['status']=0; $s['deadline_ms']=$now+self::WAIT_MS; }
            $r=$this->pack(['state'=>$s,'created_ms'=>$now,'started_ms'=>$params['mode'] === 'solo' ? $now : 0]);
            $code=strtoupper(bin2hex(random_bytes(6)));
            $this->db->query('INSERT INTO %t (code,creator_uid,creator_name,slot0_uid,create_request,mode,rules_version,status,round_no,version,deadline_ms,state_json,result_json,created_ms,started_ms,updated_ms) VALUES (%s,%d,%s,%d,%s,%s,%s,%d,1,1,%d,%s,%s,%d,%d,%d)',
                ['gamecenter_raid_room',$code,$uid,$name,$uid,$rid,$params['mode'],gamecenter_raid_rules::VERSION,$s['status'],$s['deadline_ms'],$r['state_json'],'{}',$now,$r['started_ms'],$now]);
            $id=(int)DB::insert_id();
            $this->db->query('UPDATE %t SET room_id=%d WHERE uid=%d',['gamecenter_raid_member',$id,$uid]);
            $r=$this->lock('',$id);
            return $this->accept($r,$uid,$rid,$params,$s['status'] === 0 ? 0 : 1,$now);
        });
    }
    private function join(int $uid, string $name, string $code, string $rid, array $params): array {
        return $this->db->transaction(function() use($uid,$name,$code,$rid,$params) {
            $p=$this->pointer($uid); $previous=null;
            if(!empty($p['room_id'])) {
                $previous=$this->lock('',(int)$p['room_id']);
                if($previous) { $previous=$this->fresh($previous,$this->now()); }
            }
            $r=$previous && $previous['code'] === $code ? $previous : $this->lock($code);
            if(!$r) { return $this->error('not_found'); }
            $seat=$this->seat($r,$uid);
            if($seat >= 0) {
                $r=$this->fresh($r,$this->now());
                // Replays acknowledge the old join without changing the newest membership pointer.
                return $this->receipt($r,$uid,$rid,$params) ?? $this->error('full');
            }
            if($this->occupied($previous,$uid)) { return $this->error('active',$previous,$uid); }
            $now=$this->now(); $r=$this->fresh($r,$now);
            if($r['status'] !== 0 || (int)$r['slot1_uid'] !== 0) { return $this->error('full'); }
            $r['slot1_uid']=$uid; $r['slot1_name']=$name; $r['started_ms']=$now;
            $s=gamecenter_raid_rules::initial('duo',$now,$r['state']['rules_version']); $s['version']=$r['state']['version']+1;
            $r['state']=$s; $r=$this->pack($r); $this->db->save($r);
            $this->db->query('UPDATE %t SET room_id=%d WHERE uid=%d',['gamecenter_raid_member',$r['id'],$uid]);
            return $this->accept($r,$uid,$rid,$params,1,$now);
        });
    }
    private function history(int $uid): array {
        $all=[];
        foreach(['slot0_uid','slot1_uid'] as $column) {
            foreach($this->db->rows('SELECT * FROM %t WHERE '.$column.'=%d AND status>=2 ORDER BY updated_ms DESC,id DESC LIMIT 10',['gamecenter_raid_room',$uid]) as $row) {
                $all[(int)$row['id']]=$this->decode($row);
            }
        }
        usort($all,fn($a,$b)=>((int)$b['updated_ms']<=>(int)$a['updated_ms']) ?: ((int)$b['id']<=>(int)$a['id']));
        $rows=[];
        foreach(array_slice($all,0,10) as $r) { $rows[]=['room'=>$r['code'],'updated_ms'=>(int)$r['updated_ms'],'result'=>$r['result']]; }
        return $this->ok(null,$uid,['history'=>$rows]);
    }
    /** Optional cron: bounded catch-up; never delete records or rewrite member pointers. */
    public function sweep(int $limit = 5): int {
        $limit=max(1,min(50,$limit));
        $rows=$this->db->rows('SELECT id FROM %t WHERE status<2 AND deadline_ms<=%d ORDER BY deadline_ms LIMIT '.$limit,['gamecenter_raid_room',$this->now()]);
        foreach($rows as $row) { $this->db->transaction(function() use($row) {
            $r=$this->lock('',(int)$row['id']); if($r) { $this->fresh($r,$this->now()); }
        }); }
        return count($rows);
    }
}

