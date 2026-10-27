/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。音乐偏好、手势与隐藏生命周期测试。 */
import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const forum=process.argv[2] === 'forum';
const code=fs.readFileSync(new URL(forum ? '../../source/plugin/gamecenter/games/raid/music.js' : './prototype/music.js',import.meta.url),'utf8');
let checks=0;const check=(yes,name)=>{assert.ok(yes,name);checks++;};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function setup(saved=false){
  let time=0,nextFrame=0;const frames=new Map();
  const storage=new Map(saved?[['gcr_bgm','1']]:[]), audios=[],listeners={},others=[];let reject=false;
  class Audio {constructor(){this.paused=true;this.plays=0;this.pauses=0;audios.push(this);}play(){this.plays++;if(reject)return Promise.reject(new Error('blocked'));this.paused=false;return Promise.resolve();}pause(){this.pauses++;this.paused=true;}}
  const document={hidden:false,addEventListener:(type,fn)=>listeners[type]=fn,querySelectorAll:()=>others};
  const context={Date:class extends Date{static now(){return time;}},requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),window:{Audio,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}},document};
  vm.runInNewContext(code,context);return {music:new context.RaidMusic(),storage,audios,document,listeners,others,block:v=>reject=v,frames,at(ms){time=ms;const pending=[...frames];frames.clear();for(const [,fn]of pending)fn(ms);}};
}
{
  const {music,audios,storage,document,listeners,others}=setup();
  music.setActive(true);check(!music.on&&audios.length===0,'default-off creates no media element or fetch');
  music.toggle();await flush();check(audios.length===1&&!audios[0].paused&&storage.get('gcr_bgm')==='1','explicit gesture enables music');
  check(audios[0].src===(forum ? 'source/plugin/gamecenter/games/raid/assets/battle.mp3' : '/assets/battle.mp3')&&audios[0].loop&&audios[0].volume===(forum ? .28 : .1)&&audios[0].preload==='none','local low-volume loop only');
  for(let i=0;i<10;i++)music.gesture();await flush();check(audios.length===1&&audios[0].plays===1,'reuse one playing element, no overlap');
  listeners.play({target:{paused:false,muted:true,volume:1}});check(!audios[0].paused,'muted page media does not interrupt BGM');
  document.hidden=true;music.sync();check(audios[0].paused,'hidden pauses music');
  document.hidden=false;music.sync();await flush();check(!audios[0].paused,'return resumes only previously activated music');
  const other={paused:false,muted:false,volume:1};others.push(other);listeners.play({target:other});
  check(audios[0].paused&&music.interrupted,'other page media interrupts music');
  music.gesture();await flush();check(audios[0].paused,'game click does not fight other media');
  music.toggle();music.toggle();await flush();check(audios[0].paused,'explicit toggle still respects audible other media');
  other.paused=true;music.toggle();music.toggle();await flush();check(!audios[0].paused,'explicit re-enable after other media stops works');
  music.setActive(false);check(audios[0].paused,'terminal battle stops loop');
  music.toggle();check(storage.get('gcr_bgm')==='0','music preference can be off independently');
}
{
  const {music,audios}=setup(true);music.setActive(true);await flush();check(audios.length===0,'restored preference never autoplays before first gesture');
  music.gesture();await flush();check(audios.length===1,'restored preference starts after interaction');
}
{
  const {music,audios,block}=setup();music.setActive(true);block(true);music.toggle();await flush();
  check(music.blocked&&music.on,'autoplay refusal exposed without throwing');
  music.toggle();check(!music.on&&!music.blocked,'failed play can still be disabled');
  block(false);music.toggle();await flush();check(!music.blocked&&!audios[0].paused,'enable after refusal can retry');
  music.pause();check(audios[0].paused,'pagehide can stop music');
}
if(forum) {
  const {music,audios,document,block}=setup();
  music.setActive(true,2);check(audios.length===0,'muted phase selection creates no audio');
  music.toggle();await flush();
  check(audios[0].src.endsWith('battle-phase2.mp3')&&audios[0].volume===.28,'phase two uses same base gain and second track');
  const audio=audios[0],count=audio.plays;
  for(let i=0;i<10;i++)music.setActive(true,2);
  check(audio.plays===count&&audios.length===1,'same phase polling does not restart');
  music.setPhase(1);await flush();
  check(audio.src.endsWith('/battle.mp3')&&audio.currentTime===0&&audios.length===1,'switch reuses one element and resets position');
  document.hidden=true;music.setPhase(2);await flush();
  check(audio.paused&&audio.src.endsWith('battle-phase2.mp3'),'hidden switch stores phase without playback');
  document.hidden=false;music.sync();await flush();check(!audio.paused,'visible resumes selected phase');
  music.toggle();music.setPhase(1);await flush();check(audio.paused&&!music.on,'phase switch cannot unmute');
  music.setPhase(2);music.toggle();await flush();check(audio.src.endsWith('battle-phase2.mp3')&&!audio.paused,'re-enable respects phase');
  music.setActive(false,2);check(audio.paused,'terminal phase two stops');
  music.setActive(true,1);await flush();check(audio.src.endsWith('/battle.mp3')&&!audio.paused,'new battle restores first track');
  block(true);music.setPhase(2);await flush();check(music.blocked&&music.on,'second-track refusal is reported');
  music.toggle();check(audio.paused&&!music.on,'mute stops failed phase playback');
}
if(forum) {
 const e=setup(),{music,audios,frames}=e;
 check(!music.duck()&&audios.length===0,'duck never creates or starts muted music');
 music.setActive(true);music.toggle();await flush();const audio=audios[0],plays=audio.plays;
 check(music.duck()&&frames.size===1,'impact schedules exactly one volume animation');
 e.at(20);check(Math.abs(audio.volume-.28*.62)<1e-9,'duck reaches -4.15dB in 20ms');
 e.at(150);check(Math.abs(audio.volume-.28*.62)<1e-9,'duck holds through 150ms');
 e.at(275);check(Math.abs(audio.volume-.28*.81)<1e-9,'duck recovers halfway by 275ms');
 e.at(400);check(audio.volume===.28&&frames.size===0,'base gain restored by 400ms and timer released');
 music.duck();e.at(420);music.duck();check(frames.size===1&&Math.abs(audio.volume-.28*.62)<1e-9,'overlapping impacts coalesce without a jump');
 e.at(820);check(audio.volume===.28&&frames.size===0&&audio.plays===plays,'duck never restarts track or changes preference');
 music.duck();music.setPhase(2);await flush();check(audio.volume===.28&&frames.size===0,'phase switch clears old-track duck');
 music.duck();music.cancelDuck();check(audio.volume===.28&&frames.size===0&&!audio.paused,'SFX mute can restore music without pausing it');
 music.duck();music.toggle();check(audio.paused&&audio.volume===.28&&frames.size===0,'BGM off cancels volume animation and playback');
 check(!music.duck()&&frames.size===0,'duck cannot unmute disabled music');
 music.toggle();await flush();music.duck();e.document.hidden=true;music.sync();check(audio.paused&&audio.volume===.28&&frames.size===0,'page hiding clears duck');
 e.document.hidden=false;music.sync();await flush();music.duck();music.setActive(false);check(audio.paused&&frames.size===0,'terminal stops duck and music');
}
console.log(JSON.stringify({status:'PASS',checks,audio:'mock HTMLAudio; loop seam and listening need real browser'}));
