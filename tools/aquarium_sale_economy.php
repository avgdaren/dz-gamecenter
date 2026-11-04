<?php
/**
 * 作者：GPT / Codex（小典）；原插件 (C) 2026 Carinoasd。
 * Reproducible, synthetic, in-memory economy study. No DB, network or runtime writes.
 * Usage: php tools/aquarium_sale_economy.php --out=/absolute/result.json [--root=/repo] [--seeds=16]
 * This does not enable selling. Only the explicitly requested JSON file is written.
 */
if(PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI only'); }

function econ_assert(bool $condition, string $reason): void {
    if(!$condition) { throw new RuntimeException('Invariant failed: '.$reason); }
}
function econ_stats(array $values): array {
    sort($values, SORT_NUMERIC); $n=count($values);
    econ_assert($n>0,'empty samples');
    $q=static fn(float $p) => $values[max(0,(int)ceil($n*$p)-1)];
    return ['n'=>$n,'min'=>$values[0],'p10'=>$q(.10),'p50'=>$q(.50),'p90'=>$q(.90),
        'max'=>$values[$n-1],'mean'=>round(array_sum($values)/$n,6)];
}
function econ_check(array $s, array $c): void {
    gamecenter_aquarium_rules::validate($s,$c);
    gamecenter_aquarium_shop::validateState($s,$c);
    foreach($s['fish'] as $f) {
        econ_assert($f['catch_count']===$f['owned_count']+$f['sold_count'],'stock conservation');
    }
}
function econ_sell_all(array $s, array $c, array $meta, int $now): array {
    $before=$s['coins']; $quantity=0; $transactions=0;
    foreach($s['fish'] as $fid=>$f) {
        if(isset($c['waters'][$meta[$fid]['water']]['fish'][$fid]['lifetime_cap'])) {
            [$unchanged,$error]=gamecenter_aquarium_shop::sell($s,$fid,1,$c,$now);
            econ_assert($error==='condition' && $unchanged===$s,'limited sale must reject without mutation');
            continue;
        }
        $qty=gamecenter_aquarium_shop::sellable($s,$fid);
        $shown=count(array_filter($s['layout']['fish'],static fn($x) => $x===$fid));
        econ_assert($qty===max(0,$f['owned_count']-max(4,$shown)),'retain max(4,shown)');
        while($qty>0) {
            // The service accepts 1..9999 per request, even when a month-end pile is larger.
            $chunk=min(9999,$qty); $previous=$s;
            [$s,$error]=gamecenter_aquarium_shop::sell($s,$fid,$chunk,$c,$now);
            econ_assert($error==='','synthetic ordinary sale rejected: '.$fid.'/'.$error);
            econ_assert($s['coins']-$previous['coins']===$chunk*gamecenter_aquarium_shop::sellPrice($meta[$fid]['rarity']),'sale price');
            econ_assert($s['fish'][$fid]['catch_count']===$previous['fish'][$fid]['catch_count'],'sale changed lifetime catches');
            $qty-=$chunk; $quantity+=$chunk; $transactions++;
        }
    }
    econ_check($s,$c);
    return ['save'=>$s,'income'=>$s['coins']-$before,'quantity'=>$quantity,'transactions'=>$transactions];
}
function econ_start(int $sample, string $water, int $rod, array $c, int $start): array {
    $seed=substr(hash('sha256','aquarium-next-economy-v1:'.$sample),0,32);
    $s=gamecenter_aquarium_rules::initial(10001+$sample,$seed,$start,$c);
    $s['rod_level']=$rod;
    $s['unlocked_waters']=array_keys($c['waters']);
    $s['current_water']=$water;
    $s=gamecenter_aquarium_shop::defaults($s,$c);
    econ_check($s,$c); return $s;
}

try {
    $options=getopt('', ['root:','out:','seeds:','help']);
    if(isset($options['help'])) {
        echo "Usage: php tools/aquarium_sale_economy.php --out=/absolute/result.json [--root=/repo] [--seeds=16]\n";
        exit(0);
    }
    if(!isset($options['out']) || !is_string($options['out']) || $options['out']==='') {
        throw new InvalidArgumentException('--out is required (explicit output file)');
    }
    $out=$options['out'];
    if(!preg_match('~^(?:[A-Za-z]:[\\\\/]|/)~',$out)) { throw new InvalidArgumentException('--out must be absolute'); }
    if(!is_dir(dirname($out))) { throw new InvalidArgumentException('--out parent directory must exist'); }
    $rawSeeds=$options['seeds'] ?? '16';
    if(!is_string($rawSeeds) || !ctype_digit($rawSeeds) || (int)$rawSeeds<16 || (int)$rawSeeds>128) {
        throw new InvalidArgumentException('--seeds must be an integer from 16 to 128');
    }
    $seeds=(int)$rawSeeds; $root=realpath($options['root'] ?? dirname(__DIR__));
    if($root===false) { throw new InvalidArgumentException('repository root not found'); }
    $lib=$root.'/source/plugin/gamecenter/lib';
    $data=$root.'/source/plugin/gamecenter/games/aquarium/data';
    $expected=[
        'content-v1-candidate.json'=>'754fa33008f6dd95406bd7b5710c04e0a58702a679dea63909d86c11fe9a4a09',
        'content-v2-candidate.json'=>'c9423868b665127d6bc63da2373d442bd79d4f4e9dbe9b96157718725035040b',
    ];
    foreach($expected as $file=>$sha) {
        econ_assert(is_file($data.'/'.$file) && hash_equals($sha,hash_file('sha256',$data.'/'.$file)),'frozen file hash: '.$file);
    }
    define('IN_DISCUZ',true);
    require_once $lib.'/aquarium_content.php';
    require_once $lib.'/aquarium_shop.php';
    econ_assert(!gamecenter_aquarium_configs::sellHardOff(),'SELL_HARD_OFF exists; no switch is modified or bypassed');
    $c=gamecenter_aquarium_content::rules_config_v2();
    $catalog=gamecenter_aquarium_content::catalog_v2();
    $meta=array_column($catalog['fish'],null,'id');
    $prices=['常见'=>1,'少见'=>2,'稀有'=>5,'珍奇'=>10];
    foreach($prices as $rarity=>$price) { econ_assert(gamecenter_aquarium_shop::sellPrice($rarity)===$price,'frozen sale price'); }
    econ_assert($c['cap_ms']===86400000 && count($c['periods_ms'])===5,'cap and rod levels');
    $start=1700000000000; $dayMs=86400000; $checkpoints=[1,7,30];
    $buckets=[]; $offlineBuckets=[]; $comparisons=0; $dailyComparisons=0;
    foreach($c['waters'] as $water=>$pool) {
        foreach($c['periods_ms'] as $rod=>$period) {
            foreach(range(0,$seeds-1) as $sample) {
                $initial=econ_start($sample,$water,$rod,$c,$start);
                $stock=$initial; $daily=$initial; $dailySales=0; $catchIncome=0; $firstDay=null;
                for($day=1;$day<=30;$day++) {
                    $now=$start+$day*$dayMs;
                    $stockResult=gamecenter_aquarium_rules::settle($stock,$now,$c);
                    $dailyResult=gamecenter_aquarium_rules::settle($daily,$now,$c);
                    econ_assert($stockResult['catches']===$dailyResult['catches'],'selling changes random catch stream');
                    econ_assert($stockResult['effective_ms']===$dayMs && $stockResult['discarded_ms']===0,'daily visit must preserve 24h');
                    $catchIncome+=$stockResult['save']['coins']-$stock['coins'];
                    $stock=$stockResult['save'];
                    $sale=econ_sell_all($dailyResult['save'],$c,$meta,$now);
                    $daily=$sale['save']; $dailySales+=$sale['income'];
                    econ_assert($stock['coins']-$initial['coins']===$catchIncome,'capture income excludes initial grant');
                    econ_assert($daily['coins']-$stock['coins']===$dailySales,'extra sale income accounting');
                    econ_assert($stock['catch_seq']===intdiv($day*$dayMs,$period),'carry remainder across days');
                    econ_check($stock,$c); $dailyComparisons++;
                    if($day===1) { $firstDay=['income'=>$catchIncome,'sale'=>$dailySales,'catches'=>$stockResult['catches']]; }
                    if(!in_array($day,$checkpoints,true)) { continue; }
                    $cashout=econ_sell_all($stock,$c,$meta,$now);
                    econ_assert($cashout['income']===$dailySales,'daily vs end-only sale income');
                    econ_assert($cashout['save']['fish']===$daily['fish'] && $cashout['save']['coins']===$daily['coins'],'daily vs end-only inventory/coins');
                    $comparisons++; $key=$water.':'.$rod.':'.$day;
                    $buckets[$key]['water']=$water; $buckets[$key]['rod_level_internal']=$rod; $buckets[$key]['days']=$day;
                    $values=['capture_income'=>$catchIncome,'extra_sale_income'=>$dailySales,
                        'stockpile_cashout_value'=>$cashout['income'],'combined_income'=>$catchIncome+$dailySales,
                        'daily_minus_end_sale_income'=>$dailySales-$cashout['income'],
                        'captures'=>$stock['catch_seq'],'end_cashout_transactions'=>$cashout['transactions']];
                    foreach($values as $metric=>$value) { $buckets[$key]['samples'][$metric][]=$value; }
                }
                $offline=gamecenter_aquarium_rules::settle($initial,$start+30*$dayMs,$c);
                econ_assert($offline['effective_ms']===$dayMs && $offline['discarded_ms']===29*$dayMs,'30-day absence is capped at one day');
                econ_assert($offline['catches']===$firstDay['catches'],'absence vs first-day capture stream');
                $offSale=econ_sell_all($offline['save'],$c,$meta,$start+30*$dayMs);
                $offIncome=$offline['save']['coins']-$initial['coins'];
                econ_assert($offIncome===$firstDay['income'] && $offSale['income']===$firstDay['sale'],'absence vs first-day cash');
                $key=$water.':'.$rod;
                $offlineBuckets[$key]['water']=$water; $offlineBuckets[$key]['rod_level_internal']=$rod;
                foreach(['capture_income'=>$offIncome,'extra_sale_income'=>$offSale['income'],'combined_income'=>$offIncome+$offSale['income']] as $metric=>$value) {
                    $offlineBuckets[$key]['samples'][$metric][]=$value;
                }
            }
            fwrite(STDERR,"Completed {$water} internal rod {$rod}: {$seeds} seeds x 30 daily visits\n");
        }
    }
    $rows=[]; foreach($buckets as $row) { $row['metrics']=array_map('econ_stats',$row['samples']); unset($row['samples']); $rows[]=$row; }
    $offlineRows=[]; foreach($offlineBuckets as $row) { $row['metrics']=array_map('econ_stats',$row['samples']); unset($row['samples']); $offlineRows[]=$row; }

    // Independent steady-state arithmetic: full book, all limited species exhausted, no pity.
    // This uses weights directly, not the empirical HMAC samples above.
    $theory=[]; $affordability=[];
    foreach($c['waters'] as $water=>$w) {
        $weight=0; $base=0; $sales=0; $ordinary=[];
        foreach($w['fish'] as $fid=>$f) {
            if(isset($f['lifetime_cap'])) { continue; }
            $weight+=$f['weight']; $base+=$f['weight']*$f['coins'];
            $sales+=$f['weight']*$prices[$meta[$fid]['rarity']]; $ordinary[]=$fid;
        }
        econ_assert(count($ordinary)===6,'ordinary species count per water');
        $basePer=$base/$weight; $salePer=$sales/$weight;
        econ_assert(abs($basePer-(['pond'=>2.64,'bay'=>5.06][$water]))<1e-12,'independent capture mean');
        econ_assert(abs($salePer-1.72)<1e-12,'independent sale mean');
        foreach($c['periods_ms'] as $rod=>$period) {
            $catches=$dayMs/$period; $captureDaily=$basePer*$catches; $saleDaily=$salePer*$catches;
            $theory[]=['water'=>$water,'rod_level_internal'=>$rod,'period_ms'=>$period,
                'ordinary_species'=>$ordinary,'ordinary_weight_sum'=>$weight,
                'capture_per_catch'=>$basePer,'sale_per_catch'=>$salePer,
                'long_run_catches_per_24h'=>$catches,'capture_per_24h'=>$captureDaily,
                'sale_extra_per_24h'=>$saleDaily,'combined_per_24h'=>$captureDaily+$saleDaily,
                'sale_uplift_percent'=>100*$salePer/$basePer];
            foreach([800,1200,1400,2400,3600,6000,9400,15000,20000] as $cost) {
                $affordability[]=['water'=>$water,'rod_level_internal'=>$rod,'illustrative_cost'=>$cost,
                    'steady_24h_visits_capture_only'=>$cost/$captureDaily,
                    'steady_24h_visits_with_sale'=>$cost/($captureDaily+$saleDaily)];
            }
        }
    }

    // Exercise display reserve separately; the daily comparison above fixes empty display slots.
    $displayChecks=[];
    foreach($prices as $rarity=>$price) {
        $fid=null; foreach($meta as $id=>$m) { if($m['rarity']===$rarity && !isset($c['waters'][$m['water']]['fish'][$id]['lifetime_cap'])) { $fid=$id; break; } }
        econ_assert($fid!==null,'example for each rarity');
        $s=econ_start(0,$meta[$fid]['water'],4,$c,$start);
        $s['fish'][$fid]=['discovered_at'=>$start,'catch_count'=>20,'owned_count'=>20,'sold_count'=>0];
        $s['fish_capacity']=12; $s['layout']['fish']=array_fill(0,12,$fid); econ_check($s,$c);
        econ_assert(gamecenter_aquarium_shop::sellable($s,$fid)===8,'12 displayed reserve');
        [$rejected,$error]=gamecenter_aquarium_shop::sell($s,$fid,9,$c,$start);
        econ_assert($error==='condition' && $rejected===$s,'cannot sell a displayed fish');
        [$sold,$error]=gamecenter_aquarium_shop::sell($s,$fid,8,$c,$start);
        econ_assert($error==='' && $sold['fish'][$fid]['owned_count']===12 && $sold['coins']-$s['coins']===8*$price,'12 displayed exact sell');
        econ_check($sold,$c);
        $displayChecks[]=['rarity'=>$rarity,'price'=>$price,'owned_before'=>20,'shown'=>12,
            'sellable'=>8,'cashout_deferred_vs_keep4'=>8*$price];
    }
    $ruleHashes=[];
    foreach(['aquarium_rules.php','aquarium_shop.php','aquarium_stock.php','aquarium_content.php','aquarium_configs.php'] as $file) { $ruleHashes[$file]=hash_file('sha256',$lib.'/'.$file); }
    $result=[
        'study'=>'aquarium-next-economy-v1','author'=>'GPT / Codex (小典)',
        'baseline_reference'=>'74fab2426f38b068aa91c8a95be121ea43d812b2',
        'provenance'=>['config_version'=>$c['version'],'config_hash'=>$c['config_hash'],'pool_hash'=>$c['pool_hash'],
            'frozen_content_sha256'=>$expected,'rule_sha256'=>$ruleHashes,'php_version'=>PHP_VERSION],
        'model'=>[
            'synthetic_only'=>true,'runtime_sale_enabled_by_tool'=>false,'player_data_accessed'=>false,
            'seed_count'=>$seeds,'seed_formula'=>"first 32 hex characters of SHA256('aquarium-next-economy-v1:' + zero-based sample index)",
            'uid_formula'=>'10001 + zero-based sample index','start_ms'=>$start,
            'quantiles'=>'nearest-rank: sorted[ceil(p*n)-1]; 16 seeds are a small sensitivity sample, not player estimates',
            'waters'=>array_keys($c['waters']),'rod_levels_internal'=>array_keys($c['periods_ms']),
            'rod_note'=>'Internal 0..4 only; UI labels may differ. Higher rod shortens catch period; it does not multiply per-fish coins.',
            'fixed_capability_note'=>'Water access and rod level are set on synthetic valid states without paying unlock/upgrade costs. This is NOT a new-player progression simulation.',
            'initial_inventory'=>'Actual initial grant (one pond_blue); income excludes all initial coins. Each scenario fixes one water and an empty 4-slot display.',
            'daily_visits_days'=>$checkpoints,'single_absence_days'=>30,'effective_absence_days'=>1,
            'sale_prices'=>$prices,'retention'=>'owned_count - max(4, displayed_count), clamped at zero; limited species excluded',
            'stockpile_note'=>'Cashout value is the alternative end-only sale total, not an additional income on top of daily sales. No pre-existing real-player stockpile is assumed.',
            'comparison_scope'=>'Daily vs end-only equality holds for unchanged prices/display reserve and no spending or purchases affecting catches; receipt timestamps/counts need not match.',
            'excluded'=>['real accounts','database','network','runtime flag writes','new fish or invented config','upgrade/unlock spending','shop buying gates','future paid background implementation','inflation or player behavior forecasts'],
        ],
        'checks'=>['passed'=>true,'daily_catch_stream_comparisons'=>$dailyComparisons,
            'daily_vs_checkpoint_cashout_comparisons'=>$comparisons,'single_absence_comparisons'=>count($offlineRows)*$seeds,
            'stock_conservation'=>true,'limited_sale_rejected'=>true,'limited_lifetime_caps_validated'=>true,
            'prices_and_frozen_config_hashes'=>true,'display_reserve_cases'=>$displayChecks,
            'independent_steady_per_catch'=>['pond_capture'=>2.64,'bay_capture'=>5.06,'sale_both'=>1.72]],
        'daily_visit_scenarios'=>$rows,'single_30_day_absence_scenarios'=>$offlineRows,
        'steady_state_theory'=>$theory,'illustrative_affordability'=>$affordability,
        'affordability_note'=>'Illustrative coin costs only, not approved prices. Constant mature capability, full book, limited caps exhausted, each 24h visited, zero other spending; excludes unlock conditions and starting savings.',
    ];
    $json=json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR)."\n";
    econ_assert(file_put_contents($out,$json)===strlen($json),'write complete output');
    echo "PASS: {$dailyComparisons} daily stream checks; {$comparisons} checkpoint sale equivalence checks; output: {$out}\n";
} catch(Throwable $error) {
    fwrite(STDERR,"ERROR: ".$error->getMessage()."\n"); exit(1);
}
