#!/usr/bin/env python3
"""作者：GPT / Codex；原插件(C)2026 Carinoasd。1.4.0入口/元数据/单表SQL模型，非真实论坛。"""
import json
import os
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
plugin = root/'source/plugin/gamecenter'
php = os.getenv('PHP_BIN', 'php')
n = 0


def check(ok, label):
    global n
    n += 1
    assert ok, label


def entry(game, op, uid=1, **data):
    p = subprocess.run([php, str(Path(__file__).with_name('entry_worker.php'))],
                       input=json.dumps(dict(game=game, route_op=op, uid=uid,
                                            data=dict(formhash='fixture-formhash', **data))),
                       encoding='utf-8', capture_output=True, check=True)
    check(not p.stderr, 'no PHP warnings')
    return json.loads(p.stdout)


meta = json.loads((plugin/'discuz_plugin_gamecenter.json').read_text(encoding='utf-8'))['Data']['plugin']
check(meta['version'] == '1.4.0', 'plugin version must stay 1.4.0')
tables = meta['datatables'].split(',')
ddl = (root/'docs/sync/gamecenter-1.4.0-tables.sql').read_text(encoding='utf-8')
old = set(re.findall(r'CREATE TABLE `pre_(gamecenter_[a-z_]+)`', ddl))
check(len(old) == 19, 'nineteen old tables from synchronized DDL')
check(len(tables) == len(set(tables)) == 20 and set(tables) == old | {'gamecenter_aquarium_save'}, 'complete export metadata')
uninstall = (plugin/'uninstall.php').read_text(encoding='utf-8')
drop_list = re.search(r'foreach\(\[(.*?)\] as \$t\)', uninstall, re.S)[1]
check(set(re.findall(r"'(gamecenter_[a-z_]+)'", drop_list)) == set(tables), 'complete uninstall table list')
sql = (plugin/'aquarium-install.sql').read_text(encoding='utf-8')
clean = re.sub(r'--[^\n]*', '', sql).strip()
check(len(re.findall(r'CREATE TABLE IF NOT EXISTS', clean, re.I)) == 1 and clean.count(';') == 1, 'one idempotent CREATE')
check(not re.search(r'\b(DROP|ALTER|DELETE|INSERT|UPDATE|TRUNCATE)\b', clean, re.I), 'manual script never touches old data')
program = "define('IN_DISCUZ',true);class DB{static function table($t){return 'pre_'.$t;}}require 'source/plugin/gamecenter/lib/aquarium_schema.php';echo gamecenter_aquarium_schema::sql();"
actual = subprocess.run([php, '-r', program], cwd=root, encoding='utf-8', capture_output=True, check=True)
check(re.sub(r'\s+', ' ', actual.stdout).strip() == re.sub(r'\s+', ' ', clean).strip(), 'manual SQL equals authoritative schema')
source = (plugin/'gamecenter.inc.php').read_text(encoding='utf-8')
ops = set(re.findall(r"'([a-z]+)'", re.search(r"in_array\(\$gc_op, \[(.*?)\]", source)[1]))
check({'start', 'submit', 'room', 'chunk', 'save', 'load', 'delsave', 'raid', 'aquarium'} == ops, 'preserve all old POST operations')
for game in ['gomoku', 'memory', 'minesweeper', 'raid', 'reversi', 'snake', 'tetris']:
    manifest = json.loads((plugin/'games'/game/'game.json').read_text(encoding='utf-8'))
    check((plugin/'games'/game/manifest.get('script', 'game.js')).is_file(), 'old game script '+game)
    check(entry(game, 'load', slot=0)['data'] == '{"fixture":true}', 'old load route '+game)
    check(entry(game, 'save', slot=0, data='{"coins":3}')['ok'] == 1, 'old save route '+game)
    check(entry(game, 'delsave', slot=0)['ok'] == 1, 'old delsave route '+game)
    check(entry(game, 'chunk', token='fixture-token', seq=1, data='fixture')['seq'] == 1, 'old chunk route '+game)
for op in ['save', 'load', 'delsave', 'chunk', 'start', 'submit']:
    check(entry('aquarium', op, slot=0, data='{"coins":999}')['ok'] == 0, 'aquarium cannot bypass via '+op)
check(entry('snake', 'aquarium', action='sync', client_version='aquarium-foundation-1')['ok'] == 0, 'wrong gkey')
print(json.dumps(dict(status='PASS', checks=n, scope='actual PHP routing with DB model, not HTTP/DB/forum')))
