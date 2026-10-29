<?php
/** Tetris rule 2. Deterministic seven-bag replay; scores are computed here. */
if(!defined('IN_DISCUZ')) { exit('Access Denied'); }

class gamecenter_verify_tetris {
    const RULE = 2;
    const MAXTICKS = 36000;
    private $seed, $bag = [], $queue = [], $board = [];
    private $tick = 0, $score = 0, $lines = 0, $combo = -1;
    private $hold = -1, $usedHold = false, $fall = 0, $ground = 0, $over = false;
    private $type, $x, $y, $rot;

    private static function cells($type, $rot) {
        $shapes = [
            [[0,1],[1,1],[2,1],[3,1]], [[1,0],[2,0],[1,1],[2,1]],
            [[1,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[0,1],[1,1]],
            [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]],
            [[2,0],[0,1],[1,1],[2,1]]
        ];
        $a = $shapes[$type];
        if($type === 1) { return $a; }
        for($r = 0; $r < $rot; $r++) {
            foreach($a as &$p) { $p = [($type === 0 ? 3 : 2) - $p[1], $p[0]]; }
            unset($p);
        }
        return $a;
    }

    private function __construct($seed) {
        $this->seed = (int)$seed;
        $this->board = array_fill(0, 24, array_fill(0, 14, 0));
        $this->fill(); $this->spawn(array_shift($this->queue)); $this->fill();
    }

    private function fill() {
        while(count($this->queue) < 4) {
            if(!$this->bag) {
                $this->bag = [0,1,2,3,4,5,6];
                for($i = 6; $i > 0; $i--) {
                    $this->seed = ($this->seed * 48271) % 2147483647;
                    $j = $this->seed % ($i + 1);
                    $t = $this->bag[$i]; $this->bag[$i] = $this->bag[$j]; $this->bag[$j] = $t;
                }
            }
            $this->queue[] = array_shift($this->bag);
        }
    }

    private function level() { return 1 + intdiv($this->score, 1000); }

    private function interval() { return max(150, 800 - ($this->level() - 1) * 30); }

    private function valid($x, $y, $rot) {
        foreach(self::cells($this->type, $rot) as $p) {
            $xx = $x + $p[0]; $yy = $y + $p[1];
            if($xx < 0 || $xx >= 14 || $yy < 0 || $yy >= 24 || $this->board[$yy][$xx]) { return false; }
        }
        return true;
    }

    private function spawn($type) {
        $this->type = $type; $this->x = 5; $this->y = 0; $this->rot = 0;
        $this->fall = 0; $this->ground = 0;
        if(!$this->valid($this->x, $this->y, 0)) { $this->over = true; }
    }

    private function move($dx, $dy) {
        if(!$this->valid($this->x + $dx, $this->y + $dy, $this->rot)) { return false; }
        $this->x += $dx; $this->y += $dy; return true;
    }

    private function rotate($dir) {
        $r = ($this->rot + $dir + 4) % 4;
        foreach([0,-1,1,-2,2] as $kick) {
            if($this->valid($this->x + $kick, $this->y, $r)) {
                $this->x += $kick; $this->rot = $r; return;
            }
        }
    }

    private function lock() {
        $level = $this->level();
        foreach(self::cells($this->type, $this->rot) as $p) {
            $this->board[$this->y + $p[1]][$this->x + $p[0]] = $this->type + 1;
        }
        $remaining = [];
        foreach($this->board as $row) { if(in_array(0, $row, true)) { $remaining[] = $row; } }
        $n = 24 - count($remaining);
        while(count($remaining) < 24) { array_unshift($remaining, array_fill(0, 14, 0)); }
        $this->board = $remaining;
        if($n) {
            $this->combo++;
            $points = [0,100,300,500,800];
            $this->score += $points[$n] * $level + max(0, $this->combo) * 50 * $level;
            $this->lines += $n;
        } else { $this->combo = -1; }
        $this->usedHold = false; $this->spawn(array_shift($this->queue)); $this->fill();
    }

    private function step($a) {
        if($this->over) { return; }
        $this->tick++;
        if($a === 'q') { $this->over = true; return; }
        if($a === 'l') { $this->move(-1,0); }
        if($a === 'r') { $this->move(1,0); }
        if($a === 'c') { $this->rotate(1); }
        if($a === 'z') { $this->rotate(-1); }
        if($a === 'd' && $this->move(0,1)) { $this->score++; }
        if($a === 'h') {
            while($this->move(0,1)) { $this->score += 2; }
            $this->lock();
        } elseif($a === 'b' && !$this->usedHold) {
            $old = $this->hold; $this->hold = $this->type;
            if($old < 0) { $this->spawn(array_shift($this->queue)); $this->fill(); }
            else { $this->spawn($old); }
            $this->usedHold = true;
        } else {
            $this->fall += 50;
            if($this->fall >= $this->interval()) {
                $this->fall -= $this->interval(); $this->move(0,1);
            }
            if(!$this->valid($this->x, $this->y + 1, $this->rot)) {
                $this->ground++;
                if($this->ground >= 10) { $this->lock(); }
            } else { $this->ground = 0; }
        }
        if($this->tick >= self::MAXTICKS) { $this->over = true; }
    }

    public static function verify($seed, array $data) {
        // Bound and validate scalar fields before parsing or replaying untrusted input.
        foreach(['v','score','ticks','moves'] as $key) {
            if(!array_key_exists($key, $data) || (!is_string($data[$key]) && !is_int($data[$key]))) {
                return ['ok' => 0, 'reason' => '成绩数据格式错误'];
            }
        }
        if((string)$data['v'] !== (string)self::RULE) { return ['ok'=>0, 'reason'=>'游戏已更新，请刷新后重试']; }
        if(!preg_match('/^[0-9]{1,5}$/D', (string)$data['ticks']) || !preg_match('/^[0-9]{1,10}$/D', (string)$data['score'])) {
            return ['ok'=>0, 'reason'=>'成绩数据超出范围'];
        }
        $ticks = (int)$data['ticks']; $claim = (int)$data['score']; $raw = (string)$data['moves'];
        if($ticks < 1 || $ticks > self::MAXTICKS || strlen($raw) > 330000 || $seed < 1 || $seed > 2147483646) {
            return ['ok'=>0, 'reason'=>'回放数据超出范围'];
        }
        $moves = []; $prev = 0;
        foreach($raw === '' ? [] : explode(',', $raw) as $part) {
            if(!preg_match('/^([1-9][0-9]{0,4}):([lrczdhbq])$/D', $part, $m)) {
                return ['ok'=>0, 'reason'=>'操作记录格式错误'];
            }
            $t = (int)$m[1];
            if($t <= $prev || $t > $ticks) { return ['ok'=>0, 'reason'=>'操作记录顺序错误']; }
            $moves[$t] = $m[2]; $prev = $t;
        }
        $g = new self($seed);
        for($t = 1; $t <= $ticks; $t++) {
            $g->step($moves[$t] ?? '');
            if($g->over && $t !== $ticks) { return ['ok'=>0, 'reason'=>'游戏结束后仍有操作']; }
        }
        if(!$g->over || $g->tick !== $ticks || $g->score !== $claim) {
            return ['ok'=>0, 'reason'=>'回放结果与成绩不符'];
        }
        return ['ok'=>1, 'score'=>$g->score, 'minms'=>$ticks * 50];
    }
}
