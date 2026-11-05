<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。A阶段占位配置，仅管理员诊断；不是正式鱼种/价格。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';
final class gamecenter_aquarium_config {
    public static function load(): array {
        $c=['version'=>'aquarium-foundation-v1','cap_ms'=>86400000,'periods_ms'=>[120000,108000,96000,84000,72000],
            'rod_costs'=>[0,120,260,600,900],'initial_coins'=>120,'initial_water'=>'test_pond','initial_fish'=>'test_pond_a','waters'=>[]];
        foreach(['test_pond','test_bay'] as $wid) {
            $c['waters'][$wid]=['cost'=>$wid==='test_pond'?0:2000,'requires_water'=>$wid==='test_pond'?'':'test_pond','requires_count'=>$wid==='test_pond'?0:4,'fish'=>[]];
            foreach([34,28,18,12,6,2] as $i=>$weight) {
                $coins=$wid==='test_pond'?[2,2,3,3,5,10]:[4,4,5,6,10,18];
                $c['waters'][$wid]['fish'][$wid.'_'.chr(97+$i)]=['weight'=>$weight,'coins'=>$coins[$i]];
            }
        }
        // 冻结值由 tests/aquarium/reference.py 独立生成；禁止运行时自行“更新期望”。
        $c['pool_hash']='7074d0b59138b217ff3732194bf32347949f5f44ec599fb7750dae3e27099f1b';
        $c['config_hash']='574ace1012d013d3d659e49b2b4c5ee3d38752d5238206feb7e0996fd03a1a1e';
        return gamecenter_aquarium_rules::prepare($c);
    }
}
