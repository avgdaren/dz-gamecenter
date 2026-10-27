<?php
/** 作者：GPT / Codex；(C) 2026 Carinoasd 原插件署名保留。离线规则验收。 */
declare(strict_types=1);
if(PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require dirname(__DIR__,2).'/source/plugin/gamecenter/lib/raid_rules.php';
use gamecenter_raid_rules as R;
$checks = 0;
function check(bool $yes, string $name): void {
    global $checks;
    if(!$yes) { throw new RuntimeException($name); }
    $checks++;
}
function reject(callable $fn, string $code): void {
    try { $fn(); } catch(InvalidArgumentException $e) { check($e->getMessage() === $code, 'reject '.$code); return; }
    throw new RuntimeException('accepted '.$code);
}
function action(string $code, int $target=-1): array {
    return ['kind'=>['A'=>'attack','G'=>'guard','H'=>'heal'][$code], 'target'=>$target];
}
function round_actions(array $s, array $row, int $at=1): array {
    $round = $s['round_no'];
    foreach($row as $i=>$a) {
        if($a[0] !== '-') { $s = R::submit($s, $round, $i, action($a[0], $a[1]), $at); }
    }
    return $s;
}
// Synthetic rule-edge state, never accepted from a browser or used as a production import.
function edge(int $round, array $hp, int $boss, array $pots, bool $exposed=false): array {
    $s = R::initial(count($hp) === 1 ? 'solo' : 'duo', 0);
    $s['hp']=$hp; $s['boss']=$boss; $s['pots']=$pots; $s['round_no']=$round;
    $s['history']=array_fill(0,$round-1,[]); $s['exposed']=$exposed; $s['preview']=R::preview($s);
    return $s;
}
if(($argv[1] ?? '') === '--batch') {
    $out=[];
    foreach(json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR) as $case) {
        $s=R::initial($case['mode'],0); $trace=[]; $invalid=false;
        foreach($case['route'] as $row) {
            $preview=$s['preview'];
            try { $next=round_actions($s,$row); }
            catch(InvalidArgumentException $e) { $invalid=true; break; }
            $s=$next; $last=$s['history'][count($s['history'])-1];
            $trace[]=['preview'=>$preview,'hp'=>$s['hp'],'boss'=>$s['boss'],'pots'=>$s['pots'],'exposed'=>$last['exposed']];
            if($s['status'] !== R::ACTIVE) { break; }
        }
        $out[]=['invalid'=>$invalid,'trace'=>$trace];
    }
    echo json_encode($out,JSON_THROW_ON_ERROR); exit;
}
$fixture=json_decode(file_get_contents(dirname(__DIR__,2).'/docs/raid/P1-REFERENCE.json'),true,512,JSON_THROW_ON_ERROR);
check($fixture['rules']['version'] === R::VERSION,'version fixture');
$rounds=0;
foreach($fixture['cases'] as $name=>$case) {
    $s=R::initial($case['mode'],0);
    foreach(['hp','boss','pots','exposed'] as $field) { check($s[$field] === $case['initial'][$field],$name.' initial '.$field); }
    foreach($case['expected']['trace'] as $row) {
        check($s['preview'] === $row['preview'],$name.' preview '.$row['round']);
        $s=round_actions($s,$row['actions']); R::validate($s);
        $last=$s['history'][count($s['history'])-1];
        foreach(['hp','boss','pots','exposed'] as $field) { check($last[$field] === $row[$field],$name.' '.$field.' '.$row['round']); }
        $rounds++;
    }
    check($s['status'] === R::WON,$name.' win');
    check(count($s['history']) === $case['expected']['rounds'],$name.' length');
}
$s=R::initial('solo',0);
reject(fn()=>R::initial('ai',0),'mode');
reject(fn()=>R::submit($s,1,0,action('H',0),1),'heal');
reject(fn()=>R::submit($s,1,1,action('A'),1),'actor');
reject(fn()=>R::submit($s,1,0,action('G',1),1),'target');
reject(fn()=>R::submit($s,1,0,action('A',0),1),'target');
reject(fn()=>R::submit($s,0,0,action('A'),1),'round');
reject(fn()=>R::submit($s,1,0,['kind'=>'heal','target'=>'0'],1),'action');
reject(fn()=>R::submit($s,1,0,['kind'=>'attack','target'=>-1,'damage'=>999],1),'action');
check(R::submit($s,1,0,action('A'),25000)['round_no']===2,'25 seconds is still inside 30-second turn');
reject(fn()=>R::submit($s,1,0,action('A'),30000),'due');
$bad=$s;$bad['rules_version']='future';reject(fn()=>R::advance_due($bad,1),'rules_version');
$bad=$s;$bad['boss_max_hp']=1;reject(fn()=>R::advance_due($bad,1),'state');
$bad=$s;$bad['preview']['damage']=999;reject(fn()=>R::advance_due($bad,1),'state');
$bad=$s;$bad['pots'][0]=4;reject(fn()=>R::advance_due($bad,1),'state');
$no=edge(1,[10],120,[0]);reject(fn()=>R::submit($no,1,0,action('H',0),1),'heal');
$s=R::submit(R::initial('duo',0),1,0,action('A'),1);
check($s['round_no']===1 && $s['boss']===130,'first intent does not resolve');
reject(fn()=>R::submit($s,1,0,action('G',0),2),'locked');
$s=R::submit($s,1,1,action('A'),2);
check($s['round_no']===2 && $s['boss']===110 && count($s['history'])===1,'both intents accepted same round');
check($s['deadline_ms']===30002,'early completion deadline');
$s=R::submit(R::initial('duo',0),1,0,action('A'),29999);
$s=R::advance_due($s,30000);
check($s['boss']===120 && $s['hp']===[32,40] && $s['history'][0]['defaults']===[1],'missing only defaults, confirmed action retained');
check($s['deadline_ms']===60000,'timeout preserves deadline');
$once=$s;check(R::advance_due($s,30000)===$once,'timeout idempotent');
reject(fn()=>R::submit($s,1,1,action('A'),30000),'round');
$late=R::advance_due(R::initial('duo',0),90000);
check($late['round_no']===4 && count($late['history'])===3 && $late['deadline_ms']===120000,'three missed rounds');
check($late['exposed'] && $late['pots']===[2,2],'default guard may expose, never heals');
$end=R::advance_due(R::initial('solo',0),999999);
check($end['status']===R::LOST && $end['reason']==='round_limit' && $end['ended_ms']===480000,'offline bounded to original 480s');
check(count($end['history'])===16 && $end['boss']===120,'offline cannot win');
check(strlen(json_encode($end,JSON_THROW_ON_ERROR))<=16384,'state within future TEXT byte budget');
foreach($end['history'] as $summary) { check(strlen(json_encode($summary,JSON_THROW_ON_ERROR))<=512,'summary byte budget'); }
check(R::advance_due($end,2000000)===$end,'terminal stable');
reject(fn()=>R::submit($end,16,0,action('A'),1000000),'ended');
$s=edge(3,[30,30],130,[2,2]);
$s=round_actions($s,[['G',0],['G',0]]);
check($s['hp']===[25,30] && $s['exposed'],'guard does not stack');
$s=round_actions($s,[['A',-1],['A',-1]]);
check($s['boss']===90 && !$s['exposed'],'two exposed attacks, one round only');
$s=edge(2,[10,25],100,[2,2]);
$s=round_actions($s,[['H',0],['H',0]]);
check($s['hp']===[32,17] && $s['pots']===[1,1],'simultaneous healing caps and both consume');
$s=round_actions(edge(1,[40],61,[3]),[['A',-1]]);
check($s['hp']===[32] && $s['preview']['phase']===2,'announced phase stays, next changes');
$s=edge(3,[1],10,[0]);$s=round_actions($s,[['A',-1]]);
check($s['status']===R::WON && $s['hp']===[1],'last hit before lethal boss attack');
$s=edge(3,[0,40],65,[0,2]);
check($s['preview']['targets']===[1] && $s['preview']['phase']===2 && $s['boss_max_hp']===130,'knockout redirect keeps duo');
reject(fn()=>R::submit($s,3,0,action('A'),1),'actor');
reject(fn()=>R::submit($s,3,1,action('H',0),1),'target');
$s=R::submit($s,3,1,action('G',1),1);
check($s['round_no']===4 && $s['hp']===[0,34],'downed player not awaited or revived');
$s=R::retreat(R::initial('solo',0),0,1);
check($s['status']===R::LOST && $s['reason']==='retreated','solo retreat');
$s=R::retreat(R::initial('duo',0),0,1);
check($s['leaving'][0] && !$s['left'][0] && $s['intents'][0]===action('G',0),'duo departure queued and guarded');
$s=R::submit($s,1,1,action('A'),2);
check($s['left']===[true,false] && $s['boss_max_hp']===130 && $s['preview']['targets']===[1],'round-end departure keeps mode');
reject(fn()=>R::submit($s,2,0,action('A'),3),'actor');
$s=R::retreat(R::initial('duo',0),0,1);$s=R::retreat($s,1,2);
check($s['status']===R::LOST && $s['reason']==='retreated','everyone leaves');
$s=edge(1,[20,20],20,[2,2]);
$s=R::submit($s,1,0,action('A'),1);
$s=R::retreat($s,0,2);
$s=R::submit($s,1,1,action('A'),3);
check($s['status']===R::WON && $s['hp']===[20,20] && $s['left']===[false,false],'last hit stops before boss and deferred departure');
reject(fn()=>R::initial('solo',PHP_INT_MAX),'mode');
reject(fn()=>R::advance_due(R::initial('solo',100),99),'clock');
// Arrival order cannot change the chosen set of actions.
foreach([[['A',-1],['G',0]],[['H',1],['H',0]],[['G',0],['A',-1]]] as $row) {
    $s=edge(3,[12,16],80,[2,2]);
    $a=round_actions($s,$row,2);
    $b=R::submit($s,3,1,action($row[1][0],$row[1][1]),2);
    $b=R::submit($b,3,0,action($row[0][0],$row[0][1]),2);
    check($a===$b,'arrival-independent outcome');
}
echo json_encode(['status'=>'PASS','checks'=>$checks,'fixture_cases'=>count($fixture['cases']),'fixture_rounds'=>$rounds],JSON_PRETTY_PRINT).PHP_EOL;

