<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。C1/C2内容候选；不由HTTP入口加载，不替换foundation档。 */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }
require_once __DIR__.'/aquarium_rules.php';
final class gamecenter_aquarium_content {
    const FILE_HASH='754fa33008f6dd95406bd7b5710c04e0a58702a679dea63909d86c11fe9a4a09';
    private static ?array $data=null;
    private static function load(): array {
        if(self::$data!==null) { return self::$data; }
        $raw=file_get_contents(__DIR__.'/../games/aquarium/data/content-v1-candidate.json');
        if(!is_string($raw) || strlen($raw)>131072 || !hash_equals(self::FILE_HASH,hash('sha256',$raw))) { throw new DomainException('content'); }
        $d=json_decode($raw,true,64,JSON_THROW_ON_ERROR);
        if(($d['status']??null)!=='candidate-not-active') { throw new DomainException('content'); }
        $c=gamecenter_aquarium_rules::prepare($d['config']);
        if($c['version']!=='aquarium-content-candidate-v1' || $c['cap_ms']!==86400000 || count($d['fish'])!==12 || count($d['decor'])!==24
            || $c['fish_capacities']!==[4,8,12] || $c['fish_capacity_costs']!==[0,800,3000] || $c['initial_fish_capacity']!==4) { throw new DomainException('content'); }
        $all=[];
        foreach($c['waters'] as $wid=>$w) {
            if(count($w['fish'])!==6 || array_sum(array_column($w['fish'],'weight'))!==100 || !isset($d['waters'][$wid])) { throw new DomainException('content'); }
            foreach($w['fish'] as $fid=>$f) { $all[$fid]=$wid; }
        }
        if(array_diff_key($all,$d['fish']) || array_diff_key($d['fish'],$all) || array_diff_key($c['decor'],$d['decor']) || array_diff_key($d['decor'],$c['decor'])) { throw new DomainException('content'); }
        foreach(['fish','decor'] as $kind) {
            $indices=[];$categories=[];
            foreach($d[$kind] as $id=>$m) {
                if(!gamecenter_aquarium_rules::id($id) || !is_string($m['name']??null) || strlen($m['name'])>100 || $m['name']===''
                    || !is_string($m['description']??null) || strlen($m['description'])>500 || !gamecenter_aquarium_rules::number($m['index']??null,1,count($d[$kind]))) { throw new DomainException('content'); }
                $indices[]=$m['index'];
                if($kind==='fish') {
                    if($m['water']!==$all[$id] || !in_array($m['rarity'],['常见','少见','稀有','珍奇'],true)) { throw new DomainException('content'); }
                } else {
                    $e=$c['decor'][$id];$g=$e['requires'];
                    if(!in_array($m['category'],['plant','scape','building','trinket'],true) || !is_array($m['themes']) || !$m['themes']
                        || array_diff($m['themes'],['nature','coral','moon','ruin']) || !gamecenter_aquarium_rules::number($e['cost'],1,1000000)
                        || !gamecenter_aquarium_rules::number($g['pond_count'],0,6) || !gamecenter_aquarium_rules::number($g['total_fish'],0,12)
                        || !in_array($g['water_unlocked'],['','bay'],true) || !is_array($e['layers']) || !$e['layers']
                        || array_diff($e['layers'],['front','back']) || count($e['layers'])!==count(array_unique($e['layers']))) { throw new DomainException('content'); }
                    $categories[$m['category']]=($categories[$m['category']]??0)+1;
                }
            }
            sort($indices,SORT_NUMERIC);
            if($indices!==range(1,count($d[$kind])) || ($kind==='decor' && (count($categories)!==4 || array_unique(array_values($categories))!==[6]))) { throw new DomainException('content'); }
        }
        $d['config']=$c;self::$data=$d;return $d;
    }
    public static function rules_config(): array { return self::load()['config']; }
    /** 无私有随机信息；价格/权重只从同一规则配置投影，图鉴按显式index排序。 */
    public static function catalog(): array {
        $d=self::load();$c=$d['config'];$fish=[];$decor=[];
        foreach($d['fish'] as $id=>$m) { $fish[]=array_merge(['id'=>$id],$m,$c['waters'][$m['water']]['fish'][$id]); }
        foreach($d['decor'] as $id=>$m) { $decor[]=array_merge(['id'=>$id],$m,$c['decor'][$id]); }
        usort($fish,static fn($a,$b)=>$a['index']<=>$b['index']);usort($decor,static fn($a,$b)=>$a['index']<=>$b['index']);
        return ['version'=>$c['version'],'status'=>'candidate-not-active','fish'=>$fish,'decor'=>$decor,'water_names'=>$d['waters'],
            'cap_ms'=>$c['cap_ms'],'fish_capacities'=>$c['fish_capacities'],'fish_capacity_costs'=>$c['fish_capacity_costs']];
    }
    /** C2只读图鉴；不进行结算，不从客户端鱼列表构建状态。调用方须先完成鉴权和读档。 */
    public static function book(array $s): array {
        gamecenter_aquarium_rules::validate($s,self::rules_config());$out=[];
        foreach(self::catalog()['fish'] as $f) { $owned=$s['fish'][$f['id']]??null;$f['discovered']=$owned!==null;$f['discovered_at']=$owned['discovered_at']??null;$f['catch_count']=$owned['catch_count']??0;$out[]=$f; }
        return $out;
    }
    /** 购买条件提示，不是购买/拥有权实现；C3必须另加事务、version与已拥有校验。 */
    public static function decor_conditions(array $s,string $id): array {
        $c=self::rules_config();gamecenter_aquarium_rules::validate($s,$c);
        if(!isset($c['decor'][$id])) { throw new DomainException('decor'); }
        $e=$c['decor'][$id];$g=$e['requires'];$missing=[
            'coins'=>max(0,$e['cost']-$s['coins']),
            'pond_fish'=>max(0,$g['pond_count']-count(array_intersect_key($s['fish'],$c['waters']['pond']['fish']))),
            'total_fish'=>max(0,$g['total_fish']-count($s['fish'])),
            'water_id'=>$g['water_unlocked']!=='' && !in_array($g['water_unlocked'],$s['unlocked_waters'],true) ? $g['water_unlocked'] : ''];
        return ['eligible'=>$missing['coins']===0 && $missing['pond_fish']===0 && $missing['total_fish']===0 && $missing['water_id']==='','missing'=>$missing];
    }
}
