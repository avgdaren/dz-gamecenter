/** 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。表现层去重、数值与音频生命周期测试。 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL(process.argv[2] === 'forum' ? '../../source/plugin/gamecenter/games/raid/feedback.js' : './prototype/feedback.js',import.meta.url),'utf8');
let checks=0;
function check(yes,name){assert.ok(yes,name);checks++;}
function setup({muted=false,unsupported=false,blocked=false}={}) {
  const values=new Map(muted?[['gcm_sound','0']]:[]), nodes=[], contexts=[], processors=[];
  const doc={hidden:false};
  const param=()=>({value:0,values:[],setValueAtTime(v,t){this.values.push([v,t]);},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
  const processor=type=>{const p={type,disconnects:0,connect(){},disconnect(){this.disconnects++;}};processors.push(p);return p;};
  const sourceNode=()=>{const n={disconnects:0,stops:[],type:'',frequency:param(),connect(){},disconnect(){this.disconnects++;},start(){},stop(at){this.stops.push(at);}};nodes.push(n);return n;};
  class AC {
    constructor(){this.state=blocked?'suspended':'running';this.currentTime=0;this.sampleRate=44100;this.destination={};contexts.push(this);}
    resume(){return blocked?Promise.reject(new Error('autoplay denied')):Promise.resolve();}
    createOscillator(){return sourceNode();}
    createBufferSource(){const n=sourceNode();n.buffer=null;return n;}
    createGain(){return {...processor('gain'),gain:param()};}
    createDynamicsCompressor(){return {...processor('limiter'),threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()};}
    createBuffer(_,length){return {getChannelData:()=>new Float32Array(length)};}
    createBiquadFilter(){return {...processor('filter'),frequency:param(),Q:param()};}
    createWaveShaper(){return processor('shaper');}
    createDelay(){return {...processor('delay'),delayTime:param()};}
  }
  const context={window:{localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},AudioContext:unsupported?undefined:AC},document:doc};
  vm.runInNewContext(source,context);
  return {fx:new context.RaidFeedback(),Class:context.RaidFeedback,doc,values,nodes,contexts,processors};
}
const state=(overrides={})=>({mode:'solo',status:1,round_no:1,boss:120,hp:[40],pots:[3],left:[false],intents:[null],exposed:false,history:[],preview:{kind:0,phase:1,targets:[0],damage:8},...overrides});
function after(before,{heals=[0],hp=[32],boss=110,defaults=[],actions=[{kind:'attack',target:-1}],exposed=false,status=1,phase=1}={}){
  const row={round:before.round_no,hp,boss,pots:before.pots,heals,defaults,actions,exposed,left:before.left,preview:before.preview};
  return {...before,status,round_no:status===1?before.round_no+1:before.round_no,boss,hp,exposed,
    history:[...before.history,row],preview:{kind:before.round_no%4,phase,targets:[0],damage:8}};
}
{
  const {fx,values,nodes,contexts,doc,processors}=setup();
  check(fx.on,'default sound preference matches existing games');
  fx.play(['attack']);check(nodes.length===0 && contexts.length===0,'no audio context before user gesture unlock');
  check(fx.unlock() && contexts.length===1,'gesture initializes audio');
  fx.play(['attack','hurt','guard','heal','phase']);check(nodes.length>0 && fx.voices.size<=24,'cues scheduled within voice limit');
  check(processors.some(p=>p.type==='shaper')&&processors.some(p=>p.type==='filter')&&nodes.some(p=>p.buffer),'aggressive cues include distortion, filtering and noise');
  check(processors.some(p=>p.type==='limiter')&&processors.some(p=>p.type==='delay'),'peak limiting and short phase echo exist');
  check(nodes.every(p=>p.stops[0]<=.3),'complete layered cues are at most 300ms');
  for(let i=0;i<100;i++)fx.play(['win']);check(fx.voices.size<=24,'repeated playback cannot allocate unbounded voices');
  const voice=[...fx.voices][0];voice.osc.onended();check(!fx.voices.has(voice) && voice.osc.disconnects>0,'ended voices disconnect and release');
  fx.toggle();check(values.get('gcm_sound')==='0' && fx.voices.size===0,'mute persists and stops scheduled voices');
  const old=nodes.length;fx.play(['win']);check(nodes.length===old,'muted output allocates nothing');
  fx.toggle();check(values.get('gcm_sound')==='1','enable preference persists');
  doc.hidden=true;fx.play(['hurt']);check(nodes.length===old,'hidden page produces no audio');doc.hidden=false;
  fx.play(['attack']);fx.pause();check(fx.voices.size===0,'background transition cancels voices');
}
{
  const {fx,contexts}=setup({muted:true});fx.unlock();check(contexts.length===0,'muted load does not request AudioContext');
  check(!setup({unsupported:true}).fx.unlock(),'unsupported audio is harmless');
  const blocked=setup({blocked:true});blocked.fx.unlock();blocked.fx.play(['attack']);
  await Promise.resolve();check(blocked.nodes.length===0,'rejected autoplay does not affect game or schedule audio');
}
for(const cue of ['swing','attack','attackHeavy','hurt','hurtHeavy','guard','heal','exposed','phase','win','lose','timeout']) {
  const {fx,nodes}=setup();fx.unlock();fx.play([cue]);
  check(nodes.length>0 && nodes.every(n=>n.stops[0]<=.3),cue+' complete cue within 300ms');
  if(cue==='win'||cue==='lose') check(nodes.length===3,cue+' short three-note motif');
}
{
  const {fx}=setup();fx.unlock();check([...fx.curve].every(x=>Number.isFinite(x)&&Math.abs(x)<=.801),'distortion curve stays bounded');
}
{
  const {fx}=setup();const initial=state();fx.observe(initial,1);
  const next=after(initial);const frozen=JSON.stringify([initial,next]);
  const batch=fx.observe(next,1);
  check(batch.events.some(e=>e.target==='boss'&&e.text==='−10'),'boss loss shown');
  check(batch.events.some(e=>e.target===0&&e.text==='−8'),'actual player loss shown');
  check(batch.cues.includes('attack')&&batch.cues.includes('hurt'),'attack and hurt distinguished');
  check(JSON.stringify([initial,next])===frozen,'feedback never mutates snapshots');
  check(fx.observe(next,1).events.length===0 && fx.observe(next,1).cues.length===0,'duplicate response or GET never replays');
  check(setup().fx.observe(next,1).events.length===0,'refresh baseline does not replay historical round');
  check(fx.observe({...next},2).events.length===0,'new battle does not replay previous generation');
}
{
  const {fx}=setup();const initial=state({hp:[10]});fx.observe(initial,1);
  const batch=fx.observe(after(initial,{boss:120,hp:[30],heals:[28],actions:[{kind:'heal',target:0}]}),1);
  check(batch.events.some(e=>e.text==='+28')&&batch.events.some(e=>e.text==='−8'),'heal and damage remain separate rather than net +20');
  const cap=setup().fx;const high=state({hp:[30]});cap.observe(high,1);
  const capped=cap.observe(after(high,{boss:120,hp:[32],heals:[56],actions:[{kind:'heal',target:0}]}),1);
  check(capped.events.some(e=>e.text==='+10')&&!capped.events.some(e=>e.text==='+56'),'healing float uses effective heal after cap');
}
{
  const {fx}=setup();const s=state({round_no:3,hp:[40],boss:70,preview:{kind:2,phase:1,targets:[0],damage:24}});fx.observe(s,1);
  const batch=fx.observe(after(s,{boss:70,hp:[35],actions:[{kind:'guard',target:0}],exposed:true}),1);
  check(batch.cues.includes('guard')&&batch.cues.includes('exposed'),'guard and next-round weakness cues');
  check(batch.events.some(e=>e.text==='守护生效')&&batch.events.some(e=>e.text==='破绽出现'),'guard and weakness visible');
  const phase=setup().fx;const a=state({boss:61});phase.observe(a,1);
  check(phase.observe(after(a,{boss:51,phase:2}),1).cues.includes('phase'),'phase transition cue');
}
{
  const {fx}=setup();const s=state();fx.observe(s,1);
  const two=after(after(s,{defaults:[0],boss:120,hp:[38],actions:[{kind:'guard',target:0}]}),{defaults:[0],boss:120,hp:[36],actions:[{kind:'guard',target:0}]});
  const batch=fx.observe(two,1);
  check(batch.events.length===0&&batch.cues.length===0&&batch.summary.includes('2 轮'),'multi-round catchup is summarized without replay storm');
  check(fx.observe(after(two),1).events.length>0,'new live round works after catch-up');
  const resumed=setup();resumed.fx.observe(s,1);resumed.fx.pause();
  check(resumed.fx.observe(after(s),1).events.length===0,'return from hidden baseline suppresses even one missed round');
  const timed=setup().fx;timed.observe(s,1);check(timed.observe(after(s,{defaults:[0],boss:120,hp:[38],actions:[{kind:'guard',target:0}]}),1).cues.includes('timeout'),'one live timeout cue');
}
{
  const {fx}=setup();const s=state({boss:10});fx.observe(s,1);
  check(fx.observe(after(s,{boss:0,hp:[40],status:2}),1).cues.includes('win'),'victory cue');
  const other=setup().fx;other.observe(s,1);
  check(other.observe({...s,status:3},1).cues.includes('lose'),'immediate retreat terminal cue without a settled round');
  check(other.observe({...s,status:3},1).cues.length===0,'terminal repeated response remains silent');
}
{
  const {Class}=setup();const duo=state({mode:'duo',hp:[40,40],left:[false,false],intents:[null,null],history:[{defaults:[1]},{defaults:[1]}]});
  check(Class.idleSlots(duo)[0]?.count===2,'two consecutive timeouts detected');
  check(Class.idleSlots({...duo,intents:[null,{kind:'attack',target:-1}]}).length===0,'current confirmed intent clears reminder before round resolves');
  check(Class.idleSlots({...duo,history:[...duo.history,{defaults:[]}]}).length===0,'confirmed round resets count');
  check(Class.idleSlots({...duo,hp:[40,0]}).length===0,'downed seat not called idle');
  check(Class.idleSlots({...duo,left:[false,true]}).length===0,'departed seat not called idle');
  check(Class.idleSlots({...duo,status:3}).length===0,'no idle warning at terminal');
  check(Class.idleSlots({...duo,mode:'solo'}).length===0,'no teammate idle warning in solo');
}

// Busy rounds and terminal rounds retain both impact cues.
{
  const {fx,nodes}=setup();fx.unlock();
  fx.play(['phase','exposed','timeout','heal','guard','attack','hurt']);
  check(nodes.some(n=>n.frequency.values.some(([hz])=>hz===78)) && nodes.some(n=>n.frequency.values.some(([hz])=>hz===180)),'busy round retains outgoing and incoming impact');
  check(nodes.every(n=>n.stops[0]<=.3),'staggered impacts finish within 300ms');
  fx.cancel();const previous=nodes.length;
  fx.play(['attack','hurt','win']);
  check([78,180,440].every(hz=>nodes.slice(previous).some(n=>n.frequency.values.some(([value])=>value===hz))),'final hit and counter-hit coexist with victory motif');
  fx.toggle();check(fx.voices.size===0,'mute cancels all staggered and terminal voices');
}

console.log(JSON.stringify({status:'PASS',checks,audio:'mock AudioContext; no claim about actual listening or browser autoplay'}));
