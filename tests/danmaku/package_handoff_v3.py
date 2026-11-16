"""(C) 2026 Carinoasd. Rebuild the accepted v11 entirely from checkout files: 小典 / Codex."""
from pathlib import Path
import argparse,base64,hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[2];HANDOFF=ROOT/'docs/danmaku/handoff-v3'
def text(path):return path.read_text(encoding='utf-8-sig')
def sha(data):return hashlib.sha256(data).hexdigest()
def resolve(ref):
    if isinstance(ref,dict):
        if set(ref)=={'$json'}:return json.loads(text(ROOT/ref['$json']))
        if set(ref)=={'$base64'}:return base64.b64encode((ROOT/ref['$base64']).read_bytes()).decode()
        if set(ref)=={'$uri','$mime'}:return 'data:'+ref['$mime']+';base64,'+base64.b64encode((ROOT/ref['$uri']).read_bytes()).decode()
        return {key:resolve(value) for key,value in ref.items()}
    if isinstance(ref,list):return [resolve(value) for value in ref]
    return ref
def main():
    p=argparse.ArgumentParser();p.add_argument('--output-dir',type=Path,default=ROOT/'tmp/danmaku/handoff-v3/rebuilt');args=p.parse_args()
    manifest=json.loads(text(HANDOFF/'RUNTIME-MANIFEST.json'))
    for name,row in manifest['files'].items():
        path=(ROOT/name).resolve();assert path.is_relative_to(ROOT.resolve()) and path.is_file(),name
        payload=text(path).encode('utf-8') if row['encoding']=='utf8-lf' else path.read_bytes()
        assert sha(payload)==row['sha256'],name
    recipe=json.loads(text(HANDOFF/'runtime.json'));descriptor=resolve(json.loads(text(HANDOFF/'data-template.json')))
    runtime=''.join(text(ROOT/part['path']).replace('</script','<\\/script') if 'path' in part else part['literal'] for part in recipe['runtime'])
    compact=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':'))
    replacements={'/* __RUNTIME__ */':runtime,'/* __CAMPAIGN_DATA__ */':'window.CampaignData='+compact(descriptor['data'])+';window.Stage02RefinedData=CampaignData.garden;CampaignData.projectileAtlas='+compact(descriptor['projectileAtlas'])+';',
                  '/* __LAZY_AUDIO__ */':text(ROOT/recipe['lazyAudio']),'/* __CAMPAIGN_PATCH__ */':text(ROOT/recipe['patch']),'/* __APP__ */':text(ROOT/recipe['app']),
                  '__FONT_V11__':base64.b64encode((ROOT/recipe['font']).read_bytes()).decode()}
    html=text(HANDOFF/'template.html')
    for key,value in replacements.items():assert html.count(key)==1,key;html=html.replace(key,value)
    payload=html.encode('utf-8');assert sha(payload)==manifest['acceptedHtml']['sha256'],'Rebuilt HTML is not the accepted v11'
    scripts=re.findall(r'<script>(.*?)</script>',html,re.S)
    subprocess.run(['node','-e','const vm=require("node:vm"),fs=require("node:fs");JSON.parse(fs.readFileSync(0,"utf8")).forEach(s=>new vm.Script(s));'],input=json.dumps(scripts),text=True,capture_output=True,check=True)
    args.output_dir.mkdir(parents=True,exist_ok=True);target=args.output_dir/manifest['acceptedHtml']['file'];target.write_bytes(payload)
    print(json.dumps({'status':'PASS','filesVerified':len(manifest['files']),'bytes':len(payload),'sha256':sha(payload),'file':str(target)},ensure_ascii=False))
if __name__=='__main__':main()
