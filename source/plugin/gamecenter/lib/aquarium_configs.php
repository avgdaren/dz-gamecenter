<?php
/** 作者：小蓝（DSH）· 原插件 (C) 2026 Carinoasd。配置版本登记、激活开关与显式 ID 映射。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_config.php';
require_once __DIR__.'/aquarium_content.php';

final class gamecenter_aquarium_configs {
    const FOUNDATION='aquarium-foundation-v1';
    const CONTENT='aquarium-content-candidate-v1';

    /**
     * 当前对外服务的配置版本。
     * A 阶段保持 foundation；正式内容上线时改成 CONTENT，必须与建档/迁移脚本同一批部署。
     */
    public static function active_version(): string {
        $f=__DIR__.'/../games/aquarium/data/ACTIVE_CONFIG';
        if(is_file($f)) {
            $v=trim((string)@file_get_contents($f));
            if(in_array($v,self::versions(),true)) { return $v; }
        }
        return self::FOUNDATION;
    }

    public static function for_version(string $v): array {
        if($v===self::FOUNDATION) { return gamecenter_aquarium_config::load(); }
        if($v===self::CONTENT) { return gamecenter_aquarium_content::rules_config(); }
        throw new DomainException('config');
    }

    public static function active(): array { return self::for_version(self::active_version()); }

    public static function versions(): array { return [self::FOUNDATION, self::CONTENT]; }

    /** 维护开关：存在 games/aquarium/data/MAINTENANCE 文件即对玩家返回维护态。 */
    public static function maintenance_file(): string { return __DIR__.'/../games/aquarium/data/MAINTENANCE'; }
    public static function maintenance(): bool { return is_file(self::maintenance_file()); }

    /**
     * 显式 ID 映射：foundation 的占位 ID → 正式内容 ID。
     * 两侧的水域费用/条件、鱼的权重与金币必须完全一致，否则直接拒绝迁移——
     * 迁移只换名字，不改任何产出。
     */
    public static function id_map(): array {
        static $map = null;
        if($map !== null) { return $map; }
        $src = self::for_version(self::FOUNDATION);
        $dst = self::for_version(self::CONTENT);
        $waters = ['test_pond'=>'pond', 'test_bay'=>'bay'];
        $fish = [
            'test_pond_a'=>'pond_blue',   'test_pond_b'=>'pond_orange_tail',
            'test_pond_c'=>'pond_leaf',   'test_pond_d'=>'pond_peach',
            'test_pond_e'=>'pond_glass_moon', 'test_pond_f'=>'pond_feather',
            'test_bay_a'=>'bay_silver',   'test_bay_b'=>'bay_coral',
            'test_bay_c'=>'bay_lantern',  'test_bay_d'=>'bay_ribbon',
            'test_bay_e'=>'bay_star_ray','test_bay_f'=>'bay_aurora',
        ];
        foreach($waters as $a=>$b) {
            if(!isset($src['waters'][$a], $dst['waters'][$b])) { throw new DomainException('map'); }
            $wa = $src['waters'][$a]; $wb = $dst['waters'][$b];
            if(count($wa['fish']) !== count($wb['fish'])) { throw new DomainException('map'); }
            if($wa['cost'] !== $wb['cost'] || $wa['requires_count'] !== $wb['requires_count']) { throw new DomainException('map'); }
        }
        $srcFish = []; $dstFish = [];
        foreach($src['waters'] as $w) { foreach($w['fish'] as $id=>$f) { $srcFish[$id]=$f; } }
        foreach($dst['waters'] as $w) { foreach($w['fish'] as $id=>$f) { $dstFish[$id]=$f; } }
        if(count($srcFish) !== count($fish) || count($dstFish) !== count($fish)) { throw new DomainException('map'); }
        foreach($fish as $a=>$b) {
            if(!isset($srcFish[$a], $dstFish[$b])) { throw new DomainException('map'); }
            if($srcFish[$a]['weight'] !== $dstFish[$b]['weight']) { throw new DomainException('map'); }
            if($srcFish[$a]['coins'] !== $dstFish[$b]['coins']) { throw new DomainException('map'); }
        }
        $map = ['waters'=>$waters, 'fish'=>$fish];
        return $map;
    }
}
