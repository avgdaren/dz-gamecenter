<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。仅回环地址的合成玩家浏览器夹具；无 Discuz 引导、无数据库。 */
if(PHP_SAPI !== 'cli-server' || getenv('GC_AQUARIUM_FIXTURE') !== '1'
    || !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1','::1'], true)) { http_response_code(404); exit; }
$root = dirname(__DIR__, 2);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if(str_starts_with($path, '/source/plugin/gamecenter/games/aquarium/') && !str_ends_with($path, '.php')) { return false; }
if(!in_array($path, ['/', '/stage', '/api', '/health'], true)) { http_response_code(404); exit; }
if($path === '/health') { header('Content-Type: application/json'); echo '{"fixture":true,"database":false,"uid":6060}'; exit; }

if($path === '/api') {
    header('Content-Type: application/json; charset=utf-8');
    if($_SERVER['REQUEST_METHOD'] !== 'POST' || ($_POST['formhash'] ?? '') !== 'synthetic-fixture') { http_response_code(403); echo '{"ok":0}'; exit; }
    define('IN_DISCUZ', true);
    require $root.'/source/plugin/gamecenter/lib/aquarium.php';
    final class BrowserFixtureStore {
        public array $row;
        public function __construct(array $row) { $this->row = $row; }
        public function transaction(callable $work) {
            $before = $this->row;
            try { return $work(); } catch(Throwable $e) { $this->row = $before; throw $e; }
        }
        public function lock(int $uid): array { return $this->row; }
        public function save(array $row): void { $this->row = $row; }
        public function save_versioned(array $row): void { $this->save($row); }
        public function insert(array $row): void { $this->save($row); }
    }
    $c = gamecenter_aquarium_configs::for_version(gamecenter_aquarium_configs::CONTENT_V2);
    $dir = $root.'/tmp/issue60';
    if(!is_dir($dir)) { mkdir($dir, 0775, true); }
    $handle = fopen($dir.'/browser-state.json', 'c+');
    flock($handle, LOCK_EX);
    $raw = stream_get_contents($handle);
    if($raw === '') {
        $now = (int)(microtime(true)*1000);
        $s = gamecenter_aquarium_shop::defaults(gamecenter_aquarium_rules::initial(6060, str_repeat('ab',16), $now, $c), $c);
        $s['coins'] = 50000; $s['rod_level'] = 3; $s['unlocked_waters'] = ['bay','pond'];
        foreach($c['waters'] as $w) { foreach($w['fish'] as $fid=>$f) {
            $n = isset($f['lifetime_cap']) ? 3 : 20;
            $s['fish'][$fid] = ['discovered_at'=>$now,'catch_count'=>$n,'owned_count'=>$n,'sold_count'=>0];
        } }
        ksort($s['fish'], SORT_STRING);
        $s['fish_capacity'] = 12;
        $s['layout']['fish'] = ['pond_curl_seahorse','pond_bell_jelly','bay_gummy_octopus','bay_moon_mermaid',
            'pond_blue','pond_orange_tail','pond_leaf','pond_feather','pond_curl_seahorse','pond_bell_jelly','bay_gummy_octopus','bay_moon_mermaid'];
        foreach($c['decor'] as $id=>$v) { $s['decor_owned'][$id] = $now; }
        ksort($s['decor_owned'], SORT_STRING);
        $seen = [];
        foreach(['back','front'] as $layer) {
            $s['layout']['decor'][$layer] = [];
            foreach($c['decor'] as $id=>$d) {
                if(in_array($layer,$d['layers'],true) && !isset($seen[$id]) && count($s['layout']['decor'][$layer]) < 3) {
                    $s['layout']['decor'][$layer][] = $id; $seen[$id] = true;
                }
            }
        }
        gamecenter_aquarium_rules::validate($s,$c);
        gamecenter_aquarium_shop::validateState($s,$c);
        $row = ['uid'=>6060,'save_version'=>1,'config_version'=>$c['version'],'state_json'=>json_encode($s), 'version'=>1,'updated_ms'=>$now];
    } else { $row = json_decode($raw,true,32,JSON_THROW_ON_ERROR); }
    $store = new BrowserFixtureStore($row);
    $service = new gamecenter_aquarium($store, null, $c);
    $result = $service->request(6060,true,$_POST,false);
    rewind($handle); ftruncate($handle,0); fwrite($handle,json_encode($store->row)); fflush($handle);
    flock($handle,LOCK_UN); fclose($handle);
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit;
}
$width = ($_GET['width'] ?? '') === '360' ? 360 : 880;
header('Content-Type: text/html; charset=utf-8');
if($path === '/') {
?><!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Issue 60 · 独立浏览器验收夹具</title>
<style>body{font:14px sans-serif;background:#dce9f0;color:#17394d;margin:16px}iframe{border:0;background:white;display:block;margin-top:12px}pre{white-space:pre-wrap;font:12px monospace}</style>
<p>Issue #60 · 合成玩家 6060 · 实际 game.js/PHP 服务 + 文件 store · 非 Discuz 页面，无数据库</p>
<a href="/?width=880">880px</a> · <a href="/?width=360">360px</a>
<button onclick="document.querySelector('iframe').contentWindow.postMessage('feed-one',location.origin)">单粒测试</button>
<button onclick="document.querySelector('iframe').contentWindow.postMessage('feed-ten',location.origin)">十连点测试</button>
<small>测试按钮向真实鱼缸监听器发送合成点击事件。</small>
<iframe title="水族馆独立测试画面" src="/stage" width="<?=$width?>" height="1150"></iframe>
<pre id="qa">等待渲染</pre><script>addEventListener('message',e=>{if(e.origin===location.origin)document.getElementById('qa').textContent=JSON.stringify(e.data,null,2)});</script></html><?php exit;
}
?><!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/source/plugin/gamecenter/games/aquarium/style.css"><style>body{margin:0}#stage{width:100%}</style>
<div id="stage" data-url="/api?fixture=1" data-formhash="synthetic-fixture"></div>
<script>
// Observe real DOM, canvas draws, requests and audio calls; leave game code and playback unchanged.
const qa={errors:[],requests:[],audio:[],frames:{},pelletsAdded:0,eaten:0,maxPellets:0};
addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||!['feed-one','feed-ten'].includes(e.data))return;const tank=document.querySelector('.aq-tank');if(!tank)return;const box=tank.getBoundingClientRect(),before=qa.pelletsAdded;const n=e.data==='feed-one'?1:10;qa.lastTrigger={type:e.data,before,at:Math.round(performance.now()),requestsBefore:qa.requests.length};for(let i=0;i<n;i++)tank.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:box.left+box.width*.5,clientY:box.top+box.height*.15}));qa.lastTrigger.immediatePellets=document.querySelectorAll('.aq-food:not(.eaten)').length;});
addEventListener('error',e=>qa.errors.push(e.message||'resource error'));
addEventListener('unhandledrejection',e=>qa.errors.push(String(e.reason)));
const fetchNative=window.fetch;window.fetch=function(url,options){if(options?.body instanceof FormData)qa.requests.push(options.body.get('action'));return fetchNative.apply(this,arguments)};
const playNative=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const r={src:this.src.split('/').slice(-3).join('/'),loop:this.loop,rate:this.playbackRate,at:Math.round(performance.now()),started:false};qa.audio.push(r);const p=playNative.apply(this,arguments);p?.then(()=>r.started=true,()=>r.rejected=true);return p;};
const drawNative=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(image,sx,sy){if(this.canvas.classList.contains('aq-fish-sprite')){const id=(image.src||'').split('/').pop().split('?')[0];qa.frames[id]??=[];const key=sx+':'+sy;if(!qa.frames[id].includes(key))qa.frames[id].push(key);}return drawNative.apply(this,arguments)};
const eaten=new WeakSet();new MutationObserver(records=>{for(const r of records){for(const n of r.addedNodes){if(n.nodeType===1&&n.classList.contains('aq-food'))qa.pelletsAdded++;}if(r.type==='attributes'&&r.target.classList.contains('eaten')&&!eaten.has(r.target)){eaten.add(r.target);qa.eaten++;}}qa.maxPellets=Math.max(qa.maxPellets,document.querySelectorAll('.aq-food:not(.eaten)').length);}).observe(document.getElementById('stage'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
setInterval(()=>parent.postMessage({...qa,canvasCount:document.querySelectorAll('canvas.aq-fish-sprite').length,pellets:document.querySelectorAll('.aq-food:not(.eaten)').length,innerWidth,scrollWidth:document.documentElement.scrollWidth},location.origin),500);
window.GameCenter={register:(name,fn)=>fn(document.getElementById('stage'),{uid:6060})};
</script><script src="/source/plugin/gamecenter/games/aquarium/game.js?v=issue60"></script></html>
