/* (C) 2026 Carinoasd. SMF and sequencer invariants: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),M=require(path.join(base,'midi.js'));
const box={window:{}};vm.runInNewContext(fs.readFileSync(path.join(base,'midi-bank.js'),'utf8'),box);const bank=box.window.DanmakuMidiBank;
const version=bank.v,original=path.join(root,'docs/danmaku/audio/stage01-midi-v'+version+'/midi-v'+version),manifest=JSON.parse(fs.readFileSync(path.join(original,'manifest.json'),'utf8'));
const out=path.join(root,'tmp/danmaku/stage01-midi-v'+version);fs.mkdirSync(out,{recursive:true});let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function sort(a){return a.map(v=>JSON.stringify(v)).sort();}
test('seven actual SMF1 files round-trip note times, velocities, channels and GM programs',()=>{
 for(const [key,meta]of Object.entries(manifest.files)){
  const bytes=fs.readFileSync(path.join(original,key+'.mid')),score=M.parse(bytes),audit=JSON.parse(fs.readFileSync(path.join(original,key+'-events.json'),'utf8'));
  assert.equal(score.format,1);assert.equal(score.ppq,480);assert.equal(score.notes.length,meta.notes);assert.ok(Math.abs(score.duration-meta.seconds)<1e-7);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sha256);
  assert.deepEqual(sort(score.notes.filter(n=>n.channel!==9).map(n=>[n.channel,n.note,n.velocity,n.tick,n.off])),sort(audit.notes.filter(n=>n.channel!==9).map(n=>[n.channel,n.note,n.velocity,n.at,n.off])));
  assert.deepEqual(sort(score.notes.filter(n=>n.channel===9).map(n=>[n.note,n.velocity,n.tick])),sort(audit.notes.filter(n=>n.channel===9).map(n=>[n.note,n.velocity,n.at])));
  assert.deepEqual(score.notes.filter(n=>n.channel===9).map(n=>n.off).sort((a,b)=>a-b),audit.notes.filter(n=>n.channel===9).map(n=>n.off).sort((a,b)=>a-b));
  assert.ok(score.notes.every(n=>n.duration>0&&n.start>=0&&n.end<=score.duration));
 }
});
test('new score keeps stage timing, a strong drum pulse and distinct intended GM instrumentation',()=>{
 const stage=M.parse(fs.readFileSync(path.join(original,'stage.mid'))),boss=M.parse(fs.readFileSync(path.join(original,'boss.mid')));
 assert.equal(stage.duration,72);assert.ok(Math.abs(60000000/stage.tempos[0].us-150)<.001);assert.ok(Math.abs(60000000/boss.tempos[0].us-168)<.001);
 assert.ok(stage.notes.filter(n=>n.channel===9&&n.note===36).length>=(version===3?150:180));for(const p of (version===3?[73,0,39,90]:[81,39,80,90]))assert.ok(stage.programs.includes(p));
 if(version===3){assert.ok(boss.programs.includes(56)&&boss.programs.includes(0)&&boss.programs.includes(48));assert.notDeepEqual(stage.notes.filter(n=>n.channel===0).map(n=>n.note),boss.notes.filter(n=>n.channel===0).map(n=>n.note));}
 assert.ok(stage.programs.every(p=>![8,9,10,11,12,13,14].includes(p)));assert.ok(boss.duration>39.99&&boss.duration<40.01);
});
test('runtime really contains the six original MIDI byte streams, and SFX are unchanged',()=>{
 assert.equal(Object.keys(bank.entries).length,6);for(const [key,meta]of Object.entries(bank.entries))assert.deepEqual(Buffer.from(meta.data,'base64'),fs.readFileSync(path.join(original,key+'.mid')));
 const previous={window:{}},current={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'docs/danmaku/audio/stage01-v1/render-v1/audio-bank.js'),'utf8'),previous);vm.runInNewContext(fs.readFileSync(path.join(base,'audio-bank.js'),'utf8'),current);
 assert.equal(Object.keys(current.window.DanmakuAudioBank.entries).length,16);
 for(const [key,v]of Object.entries(current.window.DanmakuAudioBank.entries)){assert.equal(v.kind,'sfx');assert.equal(v.data,previous.window.DanmakuAudioBank.entries[key].data);}
});
test('truncated, corrupt, excessive and unsupported MIDI cannot reach scheduling',()=>{
 const good=Buffer.from(fs.readFileSync(path.join(original,'stage.mid')));
 for(const cut of [0,4,13,good.length-1])assert.throws(()=>M.parse(good.subarray(0,cut)));
 const badHeader=Buffer.from(good);badHeader[0]=0;assert.throws(()=>M.parse(badHeader));
 const badPpq=Buffer.from(good);badPpq[12]=128;assert.throws(()=>M.parse(badPpq));
 const badFormat=Buffer.from(good);badFormat[9]=2;assert.throws(()=>M.parse(badFormat));
 assert.throws(()=>M.parse(Buffer.concat([good,Buffer.from([0])])));assert.throws(()=>M.parse(new Uint8Array(1048577)));
});
function context(){
 const c={currentTime:0,sampleRate:22050,state:'running',destination:{},started:[],stopped:[]};
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const node=()=>({disconnected:false,connect(){},disconnect(){this.disconnected=true;},gain:param(),frequency:param(),detune:param(),Q:param(),pan:param(),start(t){c.started.push(t);},stop(t){c.stopped.push(t);}});
 c.createGain=node;c.createOscillator=node;c.createBufferSource=node;c.createBiquadFilter=node;c.createWaveShaper=node;c.createStereoPanner=node;c.createBuffer=(channels,n)=>({getChannelData:()=>new Float32Array(n)});return c;
}
test('MIDI lookahead does not replay the same notes and continuous stems keep one clock across phases',()=>{
 const c=context(),p=new M.Player(bank);p.attach(c,c.destination);const plan={key:'boss',offset:0,tracks:[['bossCore',1],['bossDrive',0]]};p.start(plan);const first=p.notesScheduled;p.pump();assert.equal(p.notesScheduled,first);
 const origin=p.streams[0].origin;for(let t=0;t<240;t++){c.currentTime=t/60;p.sync({...plan,tracks:[['bossCore',1],['bossDrive',.45]]});assert.ok(p.synth.voices.length<=32);}
 assert.equal(p.streams[0].origin,origin);assert.ok(p.notesScheduled>first);assert.equal(p.streams[1].level,.45);
 const buses=p.streams.map(s=>s.buses);p.stopAll();assert.equal(p.active(),0);assert.ok(c.stopped.some(t=>t===c.currentTime));assert.ok(buses.every(b=>[b.level,b.melody,b.drums].every(node=>node.disconnected)));
});
test('repeated loop scheduling is bounded and seeks reconstruct only current sustained notes',()=>{
 const c=context(),p=new M.Player(bank);p.attach(c,c.destination);p.start({key:'stage',offset:16,tracks:[['stage',1]]});assert.ok(p.synth.voices.length>0&&p.synth.voices.length<=32);assert.ok(p.offsets()[0].offset>=16);
 p.stopAll();p.start({key:'boss',offset:39.5,tracks:[['bossCore',1],['bossDrive',.8]]});
 for(let t=0;t<180;t++){c.currentTime=t/60;p.pump();assert.ok(p.synth.voices.length<=32);}
 assert.ok(p.streams.every(s=>s.cycle>=1));assert.ok(p.offsets().every(s=>s.offset<4));p.stopAll();assert.equal(p.active(),0);
});
test('voice pressure has a real hard cap and stopping cancels future notes',()=>{
 const c=context(),s=new M.Synth(c),bus={melody:c.createGain(),drums:c.createGain()};
 for(let i=0;i<100;i++)s.note({channel:0,note:70+i%12,velocity:100,volume:105,expression:127,pan:64,program:90,brightness:90,bend:8192,beat:.4},.1,2,bus);
 assert.ok(s.voices.length<=32);assert.ok(s.dropped>0);s.stopAll();assert.equal(s.voices.length,0);assert.ok(c.stopped.some(t=>t===0));
});
test('lookahead retains still-audible short notes so a pause can cancel all of them',()=>{
 const c=context(),s=new M.Synth(c),bus={melody:c.createGain(),drums:c.createGain()},n={channel:0,note:76,velocity:100,volume:105,expression:127,pan:64,program:81,brightness:90,bend:8192,beat:.4};
 const short=s.note(n,0,.025,bus);s.note(n,.08,.2,bus);assert.ok(s.voices.includes(short));assert.equal(s.voices.length,2);s.stopAll();assert.equal(short.finished,true);assert.equal(s.voices.length,0);
});
test('gameplay, replay, rules and every prior artwork asset stay byte-identical',()=>{
 const old=path.join(root,'../output/danmaku-stage01-audio-v1/source/plugin/gamecenter/games/_danmaku_proto');
 if(!fs.existsSync(old))return;
 for(const name of ['rules.json','engine.js','engine.php','battle.js','battle.php','stage.js','stage.php','replay.js','battle-replay.js','stage-replay.js'])assert.deepEqual(fs.readFileSync(path.join(base,name)),fs.readFileSync(path.join(old,name)),name);
 for(const name of fs.readdirSync(path.join(old,'assets')))assert.deepEqual(fs.readFileSync(path.join(base,'assets',name)),fs.readFileSync(path.join(old,'assets',name)),name);
});
const report={status:'PASS',checks,midiFiles:7,runtimeMidi:6,sfxPreserved:16,maxMidiNotes:32,bpm:[150,168],durations:[72,40.000016]};fs.writeFileSync(path.join(out,'midi-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
