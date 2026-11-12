/* (C) 2026 Carinoasd. Audio lifecycle and rule independence: 小典 / Codex. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'source/plugin/gamecenter/games/_danmaku_proto'),A=require(path.join(base,'audio.js'));
const out=path.join(root,'tmp/danmaku/stage01-audio');fs.mkdirSync(out,{recursive:true});
const entries={},keys=['stage','bossCore','bossDrive','intro','clear','defeat',...Object.keys(A.policy)];
keys.forEach((key,i)=>entries[key]={data:Buffer.from([i]).toString('base64'),loop:key.startsWith('boss'),seconds:key==='stage'?72:key.startsWith('boss')?30:key==='intro'?3:key==='clear'?4:.5});
const bank={entries},flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
function view(extra={}){return{scene:'stage',mode:'running',tick:0,stage:'prelude',phase:-1,battle:true,status:'playing',preludeTicks:4320,introTicks:180,shots:1,hits:0,taken:0,enemy:0,graze:0,bombs:0,kills:0,supply:0,elites:0,power:0,level:1,breaks:0,charges:[],foreground:true,...extra};}
function fakeContext(deferred){
 const c={state:'suspended',currentTime:0,destination:{},sources:[],resolvers:[],defer:deferred,resume(){this.state='running';return Promise.resolve();},suspend(){this.state='suspended';return Promise.resolve();},
 createGain(){return{gain:{value:1,cancelScheduledValues(){},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}},connect(){},disconnect(){}};},
 createAnalyser(){return{fftSize:512,connect(){},getFloatTimeDomainData(a){a.fill(.01);}};},
 decodeAudioData(data){const key=keys[new Uint8Array(data)[0]],result={duration:entries[key].seconds,key};return this.defer?new Promise(resolve=>this.resolvers.push(()=>resolve(result))):Promise.resolve(result);},
 createBufferSource(){const source={loop:false,connect(){},disconnect(){},start(time,offset,duration){this.when=time;this.offset=offset;this.end=duration?time+duration:this.loop?Infinity:time+this.buffer.duration-offset;},stop(time){this.end=Math.min(this.end,time);if(time<=c.currentTime&&!this.ended){this.ended=true;if(this.onended)this.onended();}}};c.sources.push(source);return source;},
 advance(seconds){if(this.state==='running')this.currentTime+=seconds;this.sources.forEach(s=>{if(!s.ended&&s.end<=this.currentTime){s.ended=true;if(s.onended)s.onended();}});}};
 return c;
}
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
(async()=>{
 await test('defaults, malformed stored settings and volume clamps are explicit',()=>{
  assert.equal(A.defaults.sfx,false);assert.equal(A.defaults.music,true);assert.deepEqual(A.settings({music:'yes',sfx:1,musicVolume:99,sfxVolume:NaN}),{music:true,sfx:false,musicVolume:1,sfxVolume:.65,muted:false});
 });
 await test('stage, intro, continuous boss stems and terminal music map to logical time',()=>{
  assert.equal(A.plan(view({tick:720})).offset,12);assert.equal(A.plan(view({tick:4410,stage:'opening',phase:0})).offset,1.5);
  const p=A.plan(view({tick:6300,stage:'active',phase:2}));assert.equal(p.offset,30);assert.equal(p.tracks[1][1],.8);
  assert.equal(A.plan(view({mode:'paused'})),null);assert.equal(A.plan(view({mode:'countdown'})),null);assert.equal(A.plan(view({mode:'over',status:'clear'})).key,'clear');
 });
 await test('sound priority folds simultaneous hits, kills and upgrades',()=>{
  const p=view();assert.deepEqual(A.events(p,view({tick:1,kills:4})),['kill']);assert.deepEqual(A.events(p,view({tick:1,power:5,level:2})),['upgrade']);
  assert.deepEqual(A.events(p,view({tick:1,taken:1,kills:2,power:3})),['hurt']);assert.deepEqual(A.events(p,view({tick:1,bombs:1,kills:4})),['bomb']);
  assert.deepEqual(A.events(p,view({tick:1,status:'clear',breaks:3})),['win']);assert.deepEqual(A.events(p,view({tick:1,status:'dead'})),['hurt','lose']);
  assert.deepEqual(A.events(view({charges:['a','b']}),view({tick:1,charges:['b']})),[]);
 });
 await test('no context or sound is created before a user gesture',()=>{
  let created=0;const m=new A.Manager(bank,{makeContext:()=>{created++;return fakeContext();}});m.update(view({tick:1,shots:4}));assert.equal(created,0);assert.equal(m.inspect().contextState,'not-created');
 });
 await test('music starts at current logical offset after decoding; SFX stay off by default',async()=>{
  const c=fakeContext(),m=new A.Manager(bank,{makeContext:()=>c});m.update(view({tick:600}));await m.gesture();await flush();assert.equal(m.inspect().track,'stage');assert.equal(m.inspect().musicOffsets[0].offset,10);
  m.update(view({tick:601,shots:8,bombs:1}));assert.equal(m.inspect().sfxVoices,0);
 });
 await test('mute and pause stop sources; countdown is quiet and resume seeks without resetting the song',async()=>{
  const c=fakeContext(),m=new A.Manager(bank,{makeContext:()=>c});m.update(view({tick:900}));await m.gesture();m.pause();await flush();assert.equal(c.state,'suspended');assert.equal(m.inspect().musicVoices,0);
  m.update(view({tick:900,mode:'countdown'}));await m.gesture();await flush();assert.equal(m.inspect().musicVoices,0);
  m.update(view({tick:901}));await flush();assert.equal(m.inspect().musicOffsets[0].offset,901/60);
  m.configure({muted:true});await flush();assert.equal(m.inspect().musicVoices,0);assert.equal(c.state,'suspended');
 });
 await test('high frequency sounds are limited and urgent sounds respect a six-voice cap',async()=>{
  const c=fakeContext(),m=new A.Manager(bank,{makeContext:()=>c,settings:{sfx:true}});m.update(view());await m.gesture();
  let played=0;for(let t=0;t<60;t++)if(m.play('shot',t,false,0))played++;assert.equal(played,5);
  for(const key of ['pickup','hit','graze','enemy','kill','charge','supply','upgrade','bomb','hurt'])m.play(key,100,true,0);
  assert.ok(m.inspect().sfxVoices<=6);assert.ok(m.inspect().counts.peakSfx<=6);assert.ok(m.inspect().counts.played.bomb>=1);assert.ok(m.inspect().counts.rateDropped>0);
 });
 await test('stale decode and cancelled preview cannot play after reset',async()=>{
  const c=fakeContext(true),m=new A.Manager(bank,{makeContext:()=>c,settings:{sfx:true}});m.reset(view({mode:'ready'}));const pending=m.preview();m.reset(view({mode:'ready'}));await flush();c.defer=false;c.resolvers.forEach(r=>r());await pending;await flush();
  assert.equal(m.inspect().musicVoices,0);assert.equal(m.inspect().sfxVoices,0);assert.equal(m.inspect().previewing,false);assert.equal(m.inspect().counts.staleDropped,1);
 });
 await test('pressing stop while preview is loading cancels the pending audition',async()=>{
  const c=fakeContext(true),m=new A.Manager(bank,{makeContext:()=>c});m.reset(view({mode:'ready'}));const pending=m.preview();await m.preview();await flush();c.defer=false;c.resolvers.forEach(r=>r());await pending;await flush();assert.equal(m.inspect().previewing,false);assert.equal(m.inspect().musicVoices,0);
 });
 await test('starting gameplay cancels audition voices and switches to the live position',async()=>{
  const c=fakeContext(),m=new A.Manager(bank,{makeContext:()=>c,settings:{sfx:true}});m.reset(view({mode:'ready'}));await m.preview();assert.equal(m.inspect().previewing,true);
  m.update(view({tick:2}));await flush();assert.equal(m.inspect().previewing,false);assert.equal(m.inspect().track,'stage');assert.equal(m.inspect().musicOffsets[0].offset,2/60);assert.equal(m.inspect().sfxVoices,0);
 });
 await test('terminal stingers play once and cannot restart after focus or mute changes',async()=>{
  const c=fakeContext(),m=new A.Manager(bank,{makeContext:()=>c});m.update(view());await m.gesture();m.update(view({tick:100,status:'clear',mode:'over'}));assert.equal(m.inspect().track,'clear');
  c.advance(5);await flush();m.update(view({tick:100,status:'clear',mode:'over'}));await flush();assert.equal(m.inspect().musicVoices,0);
  m.pause();m.update(view({tick:100,status:'clear',mode:'over',foreground:false}));m.configure({muted:true});m.configure({muted:false});m.update(view({tick:100,status:'clear',mode:'over'}));await flush();assert.equal(m.inspect().musicVoices,0);
 });
 await test('unsupported audio fails quietly without changing gameplay data',async()=>{
  const m=new A.Manager(bank,{makeContext:()=>null}),v=view({tick:88}),copy=JSON.stringify(v);m.update(v);assert.equal(await m.gesture(),false);assert.ok(m.inspect().errors.length);assert.equal(JSON.stringify(v),copy);
 });
 await test('chunked base64 yields to other tasks and preserves exact bytes',async()=>{
  const data=Buffer.alloc(100003);for(let i=0;i<data.length;i++)data[i]=i%251;let yielded=false;const timer=setTimeout(()=>{yielded=true;},0);
  const decoded=await A.decodeBytes(data.toString('base64'));clearTimeout(timer);assert.deepEqual(Buffer.from(decoded),data);assert.equal(yielded,true);
 });
 await test('recorded boss music spans appearance and all phases without a synthetic drive stem',()=>{
  const opening=A.plan(view({tick:4320,stage:'opening',phase:0}),true),active=A.plan(view({tick:4500,stage:'active',phase:0}),true);
  assert.equal(opening.key,'boss');assert.equal(opening.offset,0);assert.equal(active.key,'boss');assert.equal(active.offset,3);
  assert.deepEqual(A.plan(view({tick:6300,stage:'active',phase:2}),true).tracks,[['bossCore',1]]);
  assert.equal(A.plan(view({scene:'battle',tick:180,stage:'active',phase:0}),true).offset,3);
  assert.equal(A.plan(view({scene:'flower',battle:false,tick:60,stage:'active',phase:0}),true).offset,1);
 });
 await test('recorded loop seeks and reported offsets honor the crossfade head after repeated laps',async()=>{
  const c=fakeContext(),recorded={entries:{stage:entries.stage,bossCore:{...entries.bossCore,loopStart:1.5,loopEnd:29.5}}},m=new A.Manager(recorded,{makeContext:()=>c,recordedMusic:true});
  m.update(view({tick:4320+31*60,stage:'active',phase:0}));await m.gesture();assert.equal(m.music[0].source.loopStart,1.5);assert.equal(m.music[0].source.loopEnd,29.5);
  assert.equal(m.inspect().musicOffsets[0].offset,3);const starts=m.inspect().counts.musicStarts;
  m.update(view({tick:4320+32*60,stage:'active',phase:2}));assert.equal(m.inspect().counts.musicStarts,starts);assert.equal(m.inspect().musicVoices,1);
  c.advance(29);assert.equal(m.inspect().musicOffsets[0].offset,4);
  m.pause();m.update(view({tick:4320+61*60,stage:'active',phase:2}));await m.gesture();await flush();assert.equal(m.inspect().musicOffsets[0].offset,5);
 });
 await test('recorded BGM switches to retained MIDI stingers without replaying old synthetic BGM',async()=>{
  const c=fakeContext(),recorded={entries:{stage:entries.stage,bossCore:entries.bossCore}},p={streams:[],attach(){},active(){return this.streams.length;},stopAll(){this.streams=[];},start(v){this.streams=[v];},sync(){},offsets(){return this.streams.map(v=>({key:v.key,offset:v.offset,level:1}));},inspect(){return{};}},m=new A.Manager(recorded,{makeContext:()=>c,musicPlayer:p,recordedMusic:true});
  m.update(view({tick:900}));await m.gesture();assert.equal(p.active(),0);assert.equal(m.inspect().musicOffsets[0].key,'stage');
  m.update(view({tick:4320,stage:'opening',phase:0}));assert.equal(p.active(),0);assert.equal(m.inspect().track,'boss');
  c.advance(.2);m.update(view({tick:6000,mode:'over',status:'clear',phase:2}));assert.equal(p.active(),1);assert.equal(p.streams[0].key,'clear');
  c.advance(.2);assert.equal(m.music.length,0);assert.equal(m.inspect().musicVoices,1);assert.equal(m.inspect().musicOffsets[0].key,'clear');m.pause();assert.equal(p.active(),0);
 });
 let unchanged=0;const previous=path.join(root,'../output/danmaku-stage01-art-v1/source/plugin/gamecenter/games/_danmaku_proto');
 if(fs.existsSync(previous))await test('all ten simulation and replay files remain byte-identical to accepted art version',()=>{
  for(const name of ['rules.json','engine.js','engine.php','battle.js','battle.php','stage.js','stage.php','replay.js','battle-replay.js','stage-replay.js']){assert.deepEqual(fs.readFileSync(path.join(base,name)),fs.readFileSync(path.join(previous,name)),name);unchanged++;}
 });
 const report={status:'PASS',checks,unchangedSimulationFiles:unchanged,defaults:A.defaults,maxSfxVoices:6};fs.writeFileSync(path.join(out,'unit-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
