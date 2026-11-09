<?php
/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。CLI服务层模型：flock文件事务不是InnoDB验收。 */
if(PHP_SAPI!=='cli') { http_response_code(404); exit; }
define('IN_DISCUZ',true);
require __DIR__.'/../../source/plugin/gamecenter/lib/aquarium.php';
final class aquarium_file_test_store {
    private string $file; private array $rows=[]; private string $fault;
    public function __construct(string $file,string $fault) { $this->file=$file; $this->fault=$fault; }
    public function transaction(callable $work) {
        $h=fopen($this->file,'c+');if(!$h || !flock($h,LOCK_EX))throw new RuntimeException('test lock');
        try {
            $text=stream_get_contents($h);$this->rows=$text ? json_decode($text,true,32,JSON_THROW_ON_ERROR) : [];
            $r=$work();if($this->fault==='before')throw new RuntimeException('injected before commit');
            rewind($h);ftruncate($h,0);fwrite($h,json_encode($this->rows,JSON_THROW_ON_ERROR));fflush($h);
            if($this->fault==='after')throw new RuntimeException('injected lost response');
            return $r;
        } finally {flock($h,LOCK_UN);fclose($h);}
    }
    public function lock(int $uid): array {return $this->rows[$uid]??[];}
    public function insert(array $r): void {if(isset($this->rows[$r['uid']]))throw new RuntimeException('duplicate',1062);$this->rows[$r['uid']]=$r;}
    public function save(array $r): void {$this->rows[$r['uid']]=$r;}
}
$x=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
$store=new aquarium_file_test_store($argv[1],$x['fault']??'');
$svc=new gamecenter_aquarium($store,fn()=>$x['now']);
$r=$svc->request($x['uid'],$x['allowed']??true,$x['data']);
echo json_encode($r,JSON_THROW_ON_ERROR)."\n";
