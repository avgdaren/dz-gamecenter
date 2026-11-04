<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。水族馆存档跨配置迁移：切点结算、显式 ID 映射、逐行事务、断点续跑。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';
require_once __DIR__.'/aquarium_configs.php';
require_once __DIR__.'/aquarium_stock.php';
require_once __DIR__.'/aquarium_state.php';

final class gamecenter_aquarium_migrate {
    const MAX_REASON = 120;
    private $db;
    private array $source;
    private array $target;

    public function __construct($store, ?array $source=null, ?array $target=null) {
        $this->db = $store;
        $this->source = $source ?? gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::FOUNDATION);
        $this->target = $target ?? gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT);
        if($this->source['version'] === $this->target['version']) { throw new DomainException('same-version'); }
    }

    public function sourceVersion(): string { return $this->source['version']; }
    public function targetVersion(): string { return $this->target['version']; }

    /** 固定切点必须是正整数且不晚于调用方的可信时钟；不能由坏行抬高。 */
    public function cutoff(int $now, ?int $explicit = null): int {
        $cutoff = $explicit ?? $now;
        if(!gamecenter_aquarium_rules::number($now,1) || !gamecenter_aquarium_rules::number($cutoff,1,$now)) {
            throw new DomainException('cutoff');
        }
        return $cutoff;
    }

    public function total(): int {
        $row = $this->db->first('SELECT COUNT(*) AS c FROM %t', ['gamecenter_aquarium_save']);
        return (int)($row['c'] ?? 0);
    }

    public function distribution(): array {
        $out = [];
        foreach($this->db->rows('SELECT config_version AS v, COUNT(*) AS c FROM %t GROUP BY config_version', ['gamecenter_aquarium_save']) as $r) {
            $out[(string)$r['v']] = (int)$r['c'];
        }
        return $out;
    }

    /**
     * 纯计算：把一行旧档换算成目标版本。不写库，失败抛 DomainException。
     * 返回 ['state'=>..., 'version'=>新行版本, 'updated_ms'=>..., 'catches'=>捕获次数]。
     */
    public function convert(array $row, int $cutoff): array {
        $s = gamecenter_aquarium_state::decode($row);
        $s = gamecenter_aquarium_state::validate($s, $this->source);
        if($s['last_settled_ms'] > $cutoff) { throw new DomainException('anchor-after-cutoff'); }

        $r = gamecenter_aquarium_rules::settle($s, $cutoff, $this->source);
        $next = $r['save'];
        // 同 ID 版本（v1 -> v2）不重映射；跨命名版本才走 id_map
        if(!$this->sameIds()) { $next = $this->remap($next); }

        $oldPeriod = (int)$this->source['periods_ms'][$next['rod_level']];
        $newPeriod = (int)$this->target['periods_ms'][$next['rod_level']];
        if($oldPeriod !== $newPeriod) {
            $next['progress_ms'] = intdiv((int)$next['progress_ms'] * $newPeriod, $oldPeriod);
        }
        $next['config_version'] = $this->target['version'];
        $next['pool_hash'] = $this->target['pool_hash'];
        $next['config_hash'] = $this->target['config_hash'];
        // foundation 没有商店字段：完成显式 ID 映射后再建立目标默认布局。
        if(!isset($this->source['fish_capacities']) && isset($this->target['fish_capacities'])) {
            $next = gamecenter_aquarium_shop::defaults($next, $this->target);
        }
        gamecenter_aquarium_state::validate($next, $this->target);

        return ['state'=>$next, 'version'=>(int)$row['version'] + 1, 'updated_ms'=>$next['last_settled_ms'], 'catches'=>count($r['catches'])];
    }

    /** 源与目标是否共用同一套水域/鱼 ID（v1 -> v2 是；foundation -> v1 不是） */
    public function sameIds(): bool {
        $a = $this->source['waters'] ?? [];
        $b = $this->target['waters'] ?? [];
        $ka = []; foreach($a as $w=>$cfg) { foreach($cfg['fish'] as $fid=>$f) { $ka[$fid] = $w; } }
        $kb = []; foreach($b as $w=>$cfg) { foreach($cfg['fish'] as $fid=>$f) { $kb[$fid] = $w; } }
        foreach($ka as $fid=>$w) { if(!isset($kb[$fid]) || $kb[$fid] !== $w) { return false; } }
        return true;
    }

    private function remap(array $s): array {
        $map = gamecenter_aquarium_configs::id_map();
        $waters = $map['waters']; $fish = $map['fish'];

        if(!isset($waters[$s['current_water']])) { throw new DomainException('state-water'); }
        $s['current_water'] = $waters[$s['current_water']];

        $unlocked = [];
        foreach($s['unlocked_waters'] as $w) {
            if(!isset($waters[$w])) { throw new DomainException('state-water'); }
            $unlocked[] = $waters[$w];
        }
        sort($unlocked, SORT_STRING);
        $s['unlocked_waters'] = $unlocked;

        $nnc = [];
        foreach($s['no_new_count'] as $w=>$n) {
            if(!isset($waters[$w])) { throw new DomainException('state-water'); }
            $nnc[$waters[$w]] = $n;
        }
        ksort($nnc, SORT_STRING);
        $s['no_new_count'] = $nnc;

        $owned = [];
        foreach($s['fish'] as $fid=>$m) {
            if(!isset($fish[$fid])) { throw new DomainException('state-fish'); }
            $owned[$fish[$fid]] = $m;
        }
        ksort($owned, SORT_STRING);
        $s['fish'] = $owned;

        if(isset($s['recent_summary']['new_fish_ids']) && is_array($s['recent_summary']['new_fish_ids'])) {
            $ids = [];
            foreach($s['recent_summary']['new_fish_ids'] as $fid) {
                if(isset($fish[$fid], $owned[$fish[$fid]])) { $ids[] = $fish[$fid]; }
            }
            $s['recent_summary']['new_fish_ids'] = $ids;
        }
        return $s;
    }

    /** 处理一行（自带事务与行锁）。返回 ['status'=>migrated|skipped|failed, 'reason'=>..]。 */
    public function migrateOne(int $uid, int $cutoff, bool $apply): array {
        if(!$apply) {
            $row = $this->db->first('SELECT * FROM %t WHERE uid=%d', ['gamecenter_aquarium_save', $uid]);
            if(!$row) { return ['status'=>'failed', 'reason'=>'missing-row']; }
            return $this->classify($row, $cutoff);
        }
        return $this->db->transaction(function() use ($uid, $cutoff) {
            $row = $this->db->lock($uid);
            if(!$row) { return ['status'=>'failed', 'reason'=>'missing-row']; }
            $verdict = $this->classify($row, $cutoff);
            if($verdict['status'] !== 'migrated') { return $verdict; }
            $this->db->save_versioned([
                'uid'=>$uid, 'save_version'=>1, 'config_version'=>$verdict['state']['config_version'],
                'state_json'=>json_encode($verdict['state'], JSON_THROW_ON_ERROR),
                'version'=>$verdict['version'], 'updated_ms'=>$verdict['updated_ms'],
            ]);
            return ['status'=>'migrated', 'catches'=>$verdict['catches']];
        });
    }

    /** 只判断，不写库。返回 status/ reason（迁移时附新状态）。 */
    public function classify(array $row, int $cutoff): array {
        try {
            $s = gamecenter_aquarium_state::decode($row);
            if($row['config_version'] === $this->target['version']) {
                gamecenter_aquarium_state::validate($s, $this->target);
                return ['status'=>'skipped'];
            }
            if($row['config_version'] !== $this->source['version']) { return ['status'=>'failed','reason'=>'unknown-version']; }
            return ['status'=>'migrated'] + $this->convert($row, $cutoff);
        } catch(Throwable $e) { return ['status'=>'failed', 'reason'=>$e->getMessage()]; }
    }

    /** 按 UID 游标跑一批，返回下一游标与统计。 */
    public function runBatch(int $cursor, int $limit, int $cutoff, bool $apply, array &$stats): int {
        $rows = $this->db->rows('SELECT uid FROM %t WHERE uid>%d ORDER BY uid ASC LIMIT %d',
            ['gamecenter_aquarium_save', $cursor, $limit]);
        foreach($rows as $r) {
            $uid = (int)$r['uid'];
            try {
                $res = $this->migrateOne($uid, $cutoff, $apply);
            } catch(Throwable $e) {
                $res = ['status'=>'failed', 'reason'=>substr($e->getMessage(), 0, self::MAX_REASON)];
            }
            $stats[$res['status']] = ($stats[$res['status']] ?? 0) + 1;
            if($res['status'] === 'failed') { $stats['failures'][] = ['uid'=>$uid, 'reason'=>$res['reason']]; }
            $cursor = $uid;
        }
        return $cursor;
    }

    /** 全量核对：只允许目标版本、且每行能通过目标规则校验。 */
    public function verify(): array {
        $out = ['total'=>0, 'target'=>0, 'other'=>[], 'broken'=>[]];
        foreach($this->db->rows('SELECT * FROM %t ORDER BY uid ASC', ['gamecenter_aquarium_save']) as $row) {
            $out['total']++;
            $uid = (int)$row['uid'];
            if((string)$row['config_version'] !== $this->target['version']) {
                $out['other'][(string)$row['config_version']] = ($out['other'][(string)$row['config_version']] ?? 0) + 1;
                continue;
            }
            try {
                $s = gamecenter_aquarium_state::decode($row);
                gamecenter_aquarium_state::validate($s, $this->target);
                $out['target']++;
            } catch(Throwable $e) {
                $out['broken'][] = ['uid'=>$uid, 'reason'=>substr($e->getMessage(), 0, self::MAX_REASON)];
            }
        }
        return $out;
    }

    /** 导出备份（只含存档行，不含任何凭据）。 */
    public function backup(): array {
        return $this->db->rows('SELECT * FROM %t ORDER BY uid ASC', ['gamecenter_aquarium_save']);
    }

    /** 从备份还原（整表覆盖；仅用于回退演练，需显式调用）。 */
    public function restore(array $rows): int {
        $n = 0;
        foreach($rows as $row) {
            $this->db->transaction(function() use ($row, &$n) {
                $this->db->query('REPLACE INTO %t (uid,save_version,config_version,state_json,version,updated_ms) VALUES (%d,%d,%s,%s,%d,%d)',
                    ['gamecenter_aquarium_save', (int)$row['uid'], (int)$row['save_version'], (string)$row['config_version'],
                     (string)$row['state_json'], (int)$row['version'], (int)$row['updated_ms']]);
                $n++;
            });
        }
        return $n;
    }


    /**
     * 纯计算版池切换（控制器在事务内调用）：
     * 源配置结算到 now → 只改配置标识 → 目标配置校验。
     * 不做 ID 映射（调用方须先确认 sameIds）。
     */
    public static function switchPool(array $s, array $cOld, array $cNew, int $now): array {
        if(($s['config_version'] ?? '') === $cNew['version']) {
            gamecenter_aquarium_state::validate($s, $cNew);
            return ['save'=>$s,'catches'=>[],'changed'=>false];
        }
        gamecenter_aquarium_state::validate($s, $cOld);
        if(($s['config_version'] ?? '') !== $cOld['version']) { throw new DomainException('migrate-source'); }
        if(($s['pool_hash'] ?? '') !== $cOld['pool_hash'] || ($s['config_hash'] ?? '') !== $cOld['config_hash']) { throw new DomainException('migrate-hash'); }
        if($now < (int)$s['last_settled_ms']) { throw new DomainException('clock-back'); }

        $r = gamecenter_aquarium_rules::settle($s, $now, $cOld);
        $next = $r['save'];
        $next['config_version'] = $cNew['version'];
        $next['pool_hash'] = $cNew['pool_hash'];
        $next['config_hash'] = $cNew['config_hash'];
        gamecenter_aquarium_state::validate($next, $cNew);
        return ['save'=>$next,'catches'=>$r['catches'],'changed'=>true];
    }
}
