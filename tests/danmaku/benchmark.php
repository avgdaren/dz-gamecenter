<?php
/* (C) 2026 Carinoasd. Synthetic engine-budget probe, never a legal game: 小典 / Codex. */
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
define('DANMAKU_P0_LOCAL',true);
require __DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/engine.php';
class DanmakuPressureSim extends DanmakuP0Sim {
    public function pattern(): void {}
}
$rules=json_decode(file_get_contents(__DIR__.'/../../source/plugin/gamecenter/games/_danmaku_proto/rules.json'),true,512,JSON_THROW_ON_ERROR);
$rules['clock']['singlePatternTicks']=13200;
function pressure(array $rules): void {
    $sim=new DanmakuPressureSim($rules,'flower',false);
    // Artificial stationary near-graze particles, renewed after every step.
    // No legal public replay can select this scene or these lifespan overrides.
    for ($i=0;$i<360;$i++) $sim->enemies[]=['id'=>$i+1,'x'=>$sim->player['x']+14*64,
        'y'=>$sim->player['y']+($i%9-4)*64,'px'=>0,'py'=>0,'vx'=>0,'vy'=>0,'radius'=>5,'born'=>1,'grazed'=>false];
    for ($t=0;$t<13200;$t++) {
        foreach ($sim->enemies as &$e) { $e['born']=$sim->tick+1; $e['grazed']=false; }
        unset($e);
        $sim->step(['dx'=>0,'dy'=>0,'flags'=>0]);
        if (count($sim->enemies)!==360) throw new RuntimeException('压力夹具未维持 360 颗弹');
    }
}
$warmup=isset($argv[1])?(int)$argv[1]:5;
$samples=isset($argv[2])?(int)$argv[2]:50;
if($warmup<0||$warmup>5||$samples<1||$samples>50)throw new RuntimeException('样本数量无效');
for($i=0;$i<$warmup;$i++)pressure($rules);
$times=[];
for($i=0;$i<$samples;$i++) { $start=hrtime(true);pressure($rules);$times[]=(hrtime(true)-$start)/1e6; }
sort($times);
echo json_encode(['fixture'=>'NONLEGAL_SYNTHETIC_360_NEAR_GRAZE_13200_TICKS','samples'=>$samples,'warmup'=>$warmup,
    'p50_ms'=>$times[(int)ceil($samples*.5)-1],'p95_ms'=>$times[(int)ceil($samples*.95)-1],
    'max_ms'=>max($times),'peak_memory_bytes'=>memory_get_peak_usage(true),'php'=>PHP_VERSION,
    'opcache_cli'=>ini_get('opcache.enable_cli'),'target_ms'=>500,'status'=>$times[(int)ceil($samples*.95)-1]<=500?'PASS':'OVER_BUDGET'],JSON_PRETTY_PRINT);
