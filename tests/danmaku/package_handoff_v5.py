"""(C) 2026 Carinoasd. Rebuild v14 using only checked-in sources: 小典 / Codex."""
from pathlib import Path
import argparse,hashlib,json,subprocess,sys
ROOT=Path(__file__).resolve().parents[2];H=ROOT/'docs/danmaku/handoff-v5'
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/handoff-v5/rebuilt');args=parser.parse_args();manifest=json.loads((H/'RUNTIME-MANIFEST.json').read_text(encoding='utf-8-sig'))
 for name,row in manifest['files'].items():
  path=(ROOT/name).resolve();assert path.is_relative_to(ROOT.resolve()) and path.is_file(),name;payload=path.read_text(encoding='utf-8-sig').encode('utf-8') if row['encoding']=='utf8-lf' else path.read_bytes();assert hashlib.sha256(payload).hexdigest()==row['sha256'],name
 base=ROOT/'tmp/danmaku/handoff-v5/base';subprocess.run([sys.executable,str(ROOT/'tests/danmaku/package_handoff_v4.py'),'--output-dir',str(base)],check=True,capture_output=True)
 subprocess.run([sys.executable,str(ROOT/'tests/danmaku/package_campaign_v14.py'),'--baseline',str(base/'danmaku-campaign-v13-offline.html'),'--output-dir',str(args.output_dir)],check=True,capture_output=True)
 target=args.output_dir/manifest['handoffHtml']['file'];digest=hashlib.sha256(target.read_bytes()).hexdigest();assert digest==manifest['handoffHtml']['sha256'];print(json.dumps({'status':'PASS','dependencies':len(manifest['files']),'bytes':target.stat().st_size,'sha256':digest}))
if __name__=='__main__':main()
