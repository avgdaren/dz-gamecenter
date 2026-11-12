"""(C) 2026 Carinoasd. Compact UI-v1 offline delivery: 小典 / Codex.

Keeps the complete current runtime, standalone entry and change record without
copying the same historical production trees into another expanded directory.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile
import package_preview

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'source/plugin/gamecenter/games/_danmaku_proto'
OUTPUT = ROOT.parent / 'output'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=OUTPUT / 'danmaku-stage01-ui-v1.zip')
    parser.add_argument('--html', type=Path, default=OUTPUT / 'danmaku-stage01-ui-v1-offline.html')
    args = parser.parse_args()
    assert args.output.resolve().is_relative_to(OUTPUT.resolve())
    assert not args.output.exists(), 'Refusing to overwrite an existing delivery'
    html = args.html.read_text(encoding='utf-8')
    assert html == package_preview.standalone_html(package_preview.bundled_rules()), 'Standalone is stale'
    baseline = OUTPUT / 'danmaku-stage01-happyshrimp-v1/source/plugin/gamecenter/games/_danmaku_proto'
    changed = [p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob('*')
               if p.is_file() and p.read_bytes() != (baseline / p.relative_to(SOURCE)).read_bytes()]
    assert set(changed) == {'index.html', 'style.css', 'ui.js'}, changed
    entries = {'START.html': args.html.read_bytes()}
    for p in sorted(SOURCE.rglob('*')):
        if p.is_file():
            assert p.suffix in {'.js', '.html', '.css', '.json', '.png', '.php', '.md'}
            entries[p.relative_to(ROOT).as_posix()] = p.read_bytes()
    record = 'docs/danmaku/STAGE-01-UI-v1.md'
    entries[record] = (ROOT / record).read_bytes()
    entries['README.md'] = '''# 天使弹幕祭 · 第一关 UI v1

双击 START.html 即可离线试玩。新版界面待观感反馈，第一版只有一关。

桌面为战场＋飞行状态／少女正面图；窄屏上置资源条，练习／声音／提示按需展开。
查看设置会自动暂停，继续后倒计时恢复。结算可查看计分明细、再次挑战、保存回放。

音乐沿用 avg达人使用HappyShrimp与提示词工程完成的两首成品；音效默认关闭。
原型 (C) 2026 Carinoasd；界面设计、实现与验证：小典 / Codex。本地私用，不公开发布。

source/plugin/gamecenter/games/_danmaku_proto/ 包含完整当前运行源码和素材，可直接打开其index.html。
docs/danmaku/STAGE-01-UI-v1.md 是本轮改动、验证与未验项记录。
本包不重复历史素材草稿、音乐生成源包、旧制作文档及测试脚本；它们保留在原工作区和上一版完整包。
所有文件的SHA256见 DELIVERY-MANIFEST.json。没有浏览器配置、日志、用户回放或凭据。
'''.encode('utf-8')
    manifest = {name: {'bytes': len(data), 'sha256': sha(data)} for name, data in entries.items()}
    entries['DELIVERY-MANIFEST.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    with zipfile.ZipFile(args.output) as archive:
        assert archive.testzip() is None
        for name, data in entries.items():
            assert archive.read(name) == data
        assert archive.read('START.html') == args.html.read_bytes()
    report = {'status': 'PASS', 'files': len(entries), 'zipBytes': args.output.stat().st_size,
              'htmlBytes': args.html.stat().st_size, 'runtimeFilesChanged': changed,
              'standaloneMatchesCurrentSource': True, 'zipAllBytesMatch': True,
              'simulationAudioAndArtworkUnchanged': True, 'noExpandedDuplicateDelivery': True,
              'zipSha256': sha(args.output.read_bytes()), 'standaloneSha256': sha(args.html.read_bytes())}
    target = ROOT / 'tmp/danmaku/stage01-ui-v1/delivery-checks.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
