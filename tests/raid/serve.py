#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。启动仅回环可用的 P1 样稿。"""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile

parser = argparse.ArgumentParser(description='P1 本机模拟；不要部署到线上论坛')
parser.add_argument('--php', default=os.environ.get('PHP_BIN', 'php'))
parser.add_argument('--port', type=int, default=8093)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
if not 1024 <= args.port <= 65535:
    parser.error('port must be 1024..65535')
with tempfile.TemporaryDirectory(prefix='raid-p1-sessions-') as sessions:
    command = [args.php, '-n', '-d', f'session.save_path={sessions}', '-S', f'127.0.0.1:{args.port}',
               str(root / 'tests/raid/prototype/router.php')]
    print(f'本机样稿：http://127.0.0.1:{args.port}  （Ctrl+C 退出，临时状态随之清理）', flush=True)
    try:
        child = subprocess.Popen(command, cwd=root)
        child.wait()
    except KeyboardInterrupt:
        child.terminate()
        child.wait()
