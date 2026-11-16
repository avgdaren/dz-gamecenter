"""Create an offline, renamed OFL title subset; no runtime dependency. 小典 / Codex."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[2]
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,default=Path('C:/Windows/Fonts/NotoSerifSC-VF.ttf'))
    parser.add_argument('--tools',type=Path)
    args=parser.parse_args()
    if args.tools:sys.path.insert(0,str(args.tools.resolve()))
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    out=ROOT/'docs/danmaku/fonts/spell-serif-v7';out.mkdir(parents=True,exist_ok=True)
    license_path=out/'OFL.txt';assert license_path.is_file(),'Keep the complete upstream OFL.txt beside the subset'
    title_data=json.loads(subprocess.check_output(['node','-e',"const a=require('./source/plugin/gamecenter/games/_danmaku_proto/stage-show.js'),b=require('./source/plugin/gamecenter/games/_danmaku_stage02_draft/refined-easy-entry-v6.js');process.stdout.write(JSON.stringify(a.phases.concat(b.names)));"],cwd=ROOT,text=True,encoding='utf-8'))
    text=''.join(title_data)+'星环观测者司风天使铃羽星穹回廊风铃花庭第一二三式宣告0123456789 ·'
    font=TTFont(args.source)
    origin={str(i):font['name'].getDebugName(i) for i in [0,1,2,13,14]}
    assert 'SIL Open Font License' in origin['13']
    options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*'];options.recalc_timestamp=False
    cut=subset.Subsetter(options=options);cut.populate(text=text);cut.subset(font)
    instantiateVariableFont(font,{'wght':500},inplace=True,optimize=True)
    for key,value in {1:'Danmaku Spell Serif',2:'Medium',3:'DanmakuSpellSerif-v7-500',4:'Danmaku Spell Serif Medium',6:'DanmakuSpellSerif-Medium',16:'Danmaku Spell Serif',17:'Medium'}.items():
        font['name'].removeNames(nameID=key)
        font['name'].setName(value,key,3,1,0x409)
    if 'DSIG' in font:del font['DSIG']
    font.flavor='woff2';target=out/'danmaku-spell-serif-500.woff2';font.save(target)
    check=TTFont(target);assert set(map(ord,text))<=set(check.getBestCmap())
    sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
    record={'source':str(args.source),'sourceSha256':sha(args.source),'sourceMetadata':origin,'upstream':'https://github.com/notofonts/noto-cjk','licenseUrl':'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/LICENSE','licenseFile':'OFL.txt','licenseSha256':sha(license_path),'derivativeFamily':'Danmaku Spell Serif','weight':500,'characters':''.join(sorted(set(text))),'titleData':title_data,'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target)}
    (out/'source-audit.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':'PASS','bytes':record['bytes'],'characters':len(set(text)),'sha256':record['sha256']}))

if __name__=='__main__':main()
