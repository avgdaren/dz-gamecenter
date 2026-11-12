/* (C) 2026 Carinoasd. Original score playback and cosmetic audio: 小典 / Codex.
 * Reads gameplay events; never changes simulation, inputs, clocks or scoring.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.DanmakuAudio=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var DEFAULTS={music:true,sfx:false,musicVolume:.55,sfxVolume:.65,muted:false};
  var POLICY={shot:[12,.075,1],hit:[9,.09,1],enemy:[12,.055,0],graze:[12,.07,1],pickup:[4,.14,2],
    upgrade:[18,.19,4],hurt:[12,.2,6],bomb:[30,.2,6],kill:[6,.12,2],elite:[12,.19,4],charge:[24,.1,3],
    supply:[8,.18,4],phase:[30,.2,5],menu:[3,.1,2],win:[60,.18,6],lose:[60,.18,6]};
  function settings(value){
    value=value||{};var result={};
    Object.keys(DEFAULTS).forEach(function(key){var v=value[key],d=DEFAULTS[key];result[key]=typeof d==='boolean'?(typeof v==='boolean'?v:d):(typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(1,v)):d);});
    return result;
  }
  function plan(view,recorded){
    if(!view||['running','over'].indexOf(view.mode)<0)return null;
    if(view.status==='clear'||view.status==='complete')return{key:'clear',offset:0,tracks:[['clear',1]],phase:view.phase};
    if(view.status==='dead'||view.status==='timeout')return{key:'defeat',offset:0,tracks:[['defeat',1]],phase:view.phase};
    if(view.mode!=='running')return null;
    if(view.scene==='stage'&&view.stage==='prelude')return{key:'stage',offset:view.tick/60,tracks:[['stage',1]],phase:-1};
    // A finished stereo mix has no separate drive stem. It begins with the
    // boss appearance and keeps one clock through opening and all three phases.
    if(recorded)return{key:'boss',offset:Math.max(0,view.tick-(view.scene==='stage'?view.preludeTicks:0))/60,
      tracks:[['bossCore',view.stage==='transition'?.72:1]],phase:Math.max(0,view.phase)};
    if(view.stage==='opening')return{key:'intro',offset:Math.max(0,view.tick-(view.scene==='stage'?view.preludeTicks:0))/60,tracks:[['intro',1]],phase:0};
    var offset=Math.max(0,view.tick-((view.scene==='stage'?view.preludeTicks:0)+(view.battle?view.introTicks:0)))/60;
    var drive=[0,.45,.8][Math.max(0,Math.min(2,view.phase))];
    return{key:'boss',offset:offset,tracks:[['bossCore',view.stage==='transition'?.72:1],['bossDrive',view.stage==='transition'?drive*.65:drive]],phase:view.phase};
  }
  function events(previous,view){
    if(!previous||view.tick<=previous.tick)return[];
    var terminal=view.status!==previous.status;
    if(terminal&&(view.status==='clear'||view.status==='complete'))return['win'];
    if(terminal&&view.status==='dead')return['hurt','lose'];
    if(terminal&&view.status==='timeout')return['lose'];
    if(view.taken>previous.taken)return['hurt'];
    if(view.bombs>previous.bombs)return['bomb'];
    if(view.breaks>previous.breaks)return['phase'];
    var result=[];
    if(view.supply>previous.supply)result.push('supply');
    if(view.level>previous.level)result.push('upgrade');
    else if(view.power>previous.power)result.push('pickup');
    if(view.elites>previous.elites)result.push('elite');
    else if(view.kills>previous.kills)result.push('kill');
    if(view.charges.some(function(token){return previous.charges.indexOf(token)<0;}))result.push('charge');
    if(view.shots>previous.shots)result.push('shot');
    if(view.hits>previous.hits)result.push('hit');
    if(view.enemy>previous.enemy)result.push('enemy');
    if(view.graze>previous.graze)result.push('graze');
    return result;
  }
  function graph(context,value){
    var music=context.createGain(),sfx=context.createGain(),master=context.createGain(),meter=context.createAnalyser();
    master.gain.value=.48;music.gain.value=value.musicVolume;sfx.gain.value=value.sfxVolume;
    meter.fftSize=512;music.connect(master);sfx.connect(master);master.connect(meter);meter.connect(context.destination);
    return{music:music,sfx:sfx,master:master,meter:meter};
  }
  async function decodeBytes(data){
    // Base64 conversion is JS work. Small aligned chunks let gameplay render
    // between tasks, including the first cold start with a long music file.
    var padding=data.endsWith('==')?2:data.endsWith('=')?1:0,bytes=new Uint8Array(data.length/4*3-padding),offset=0;
    for(var start=0;start<data.length;start+=32768){
      var binary=atob(data.slice(start,start+32768));
      for(var i=0;i<binary.length;i++)bytes[offset++]=binary.charCodeAt(i);
      if(data.length>32768)await new Promise(function(resolve){setTimeout(resolve,0);});
    }
    return bytes.buffer;
  }
  function Manager(bank,options){
    options=options||{};this.bank=bank;this.recorded=!!options.recordedMusic;this.midi=options.musicPlayer||null;this.settings=settings(options.settings);this.makeContext=options.makeContext||function(){var C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;};
    this.context=null;this.graph=null;this.buffers={};this.loading=null;this.ready=false;this.unlocked=false;this.errors=[];
    this.view=null;this.previous=null;this.music=[];this.voices=[];this.musicKey='';this.musicPhase=-9;this.previewing=false;this.previewUntil=0;
    this.lastSfx={};this.generation=0;this.previewPending=false;this.terminalStarted=false;this.resuming=false;this.suspending=false;this.lastError='';this.meterData=new Float32Array(512);
    this.counts={seen:{},played:{},rateDropped:0,voiceDropped:0,staleDropped:0,musicStarts:0,peakSfx:0};this.history=[];
  }
  Manager.prototype.error=function(message){this.lastError=message;if(this.errors.indexOf(message)<0)this.errors.push(message);this.errors=this.errors.slice(-8);};
  Manager.prototype.wantsContext=function(){
    var s=this.settings;if(s.muted||(!s.music&&!s.sfx)||(this.view&&this.view.foreground===false))return false;
    return this.previewing||!!(this.view&&(['running','countdown'].indexOf(this.view.mode)>=0||(this.view.mode==='over'&&(this.music.length||this.voices.length||(this.midi&&this.midi.active())))));
  };
  Manager.prototype.reconcile=function(){
    var context=this.context,self=this;if(!context||!this.unlocked||context.state==='closed')return;
    var wanted=this.wantsContext();
    if(wanted&&context.state!=='running'&&!this.resuming){
      this.resuming=true;
      Promise.resolve(context.resume()).then(function(){self.resuming=false;if(self.wantsContext())self.sync();else self.reconcile();}).catch(function(){self.resuming=false;self.error('声音未能恢复，请再次点击开始或试听。');});
    }else if(!wanted&&context.state==='running'&&!this.suspending){
      this.suspending=true;
      Promise.resolve(context.suspend()).then(function(){self.suspending=false;if(self.wantsContext())self.reconcile();}).catch(function(){self.suspending=false;self.error('声音暂停失败，可使用静音。');});
    }
  };
  Manager.prototype.gesture=function(){
    var self=this;this.unlocked=true;
    try{
      if(!this.context){this.context=this.makeContext();if(!this.context){this.error('此浏览器暂不支持声音，仍可正常游玩。');return Promise.resolve(false);}this.graph=graph(this.context,this.settings);}
      if(this.midi){this.midi.attach(this.context,this.graph.music);this.midi.onidle=function(){self.reconcile();};}
      // resume() is invoked synchronously inside the actual click/tap handler.
      var resume=this.context.resume();
      if(!this.loading){
        this.loading=(async function(){
          // Decode one resource at a time so concurrent conversions cannot
          // combine into another long main-thread task.
          var names=Object.keys(self.bank.entries).sort(function(a,b){return self.bank.entries[a].data.length-self.bank.entries[b].data.length;});
          for(var i=0;i<names.length;i++){
            var key=names[i];
            try{self.buffers[key]=await self.context.decodeAudioData(await decodeBytes(self.bank.entries[key].data));}
            catch(error){self.error('部分声音未能读取，仍可正常游玩。');}
          }
          self.ready=true;self.sync();return true;
        }());
      }
      return Promise.all([resume,this.loading]).then(function(){self.sync();self.reconcile();return true;}).catch(function(){self.error('声音暂未开启，可再次点击开始或试听。');return false;});
    }catch(error){this.error('声音暂不可用，仍可正常游玩。');return Promise.resolve(false);}
  };
  Manager.prototype.stopVoice=function(voice,fade){
    if(!voice||voice.stopped)return;voice.stopped=true;
    var now=this.context.currentTime;fade=fade===undefined?.015:fade;
    try{voice.gain.gain.cancelScheduledValues(now);voice.gain.gain.setValueAtTime(voice.gain.gain.value,now);voice.gain.gain.linearRampToValueAtTime(0,now+fade);voice.source.stop(now+fade);}catch(error){}
    this.music=this.music.filter(function(v){return v!==voice;});this.voices=this.voices.filter(function(v){return v!==voice;});
  };
  Manager.prototype.stopAll=function(){
    if(this.midi)this.midi.stopAll();
    var self=this;this.music.concat(this.voices).forEach(function(v){self.stopVoice(v,0);});this.music=[];this.voices=[];this.musicKey='';this.musicPhase=-9;
  };
  Manager.prototype.reset=function(view){this.generation++;this.previewing=false;this.previewPending=false;this.terminalStarted=false;this.stopAll();this.previous=view||null;this.view=view||null;this.lastSfx={};this.reconcile();};
  Manager.prototype.pause=function(){this.generation++;this.previewing=false;this.previewPending=false;this.stopAll();if(this.view)this.view=Object.assign({},this.view,{mode:'paused'});this.reconcile();};
  Manager.prototype.configure=function(value){
    this.settings=settings(Object.assign({},this.settings,value));var s=this.settings,self=this;
    if(this.graph){var now=this.context.currentTime;this.graph.music.gain.setTargetAtTime(s.musicVolume,now,.02);this.graph.sfx.gain.setTargetAtTime(s.sfxVolume,now,.02);this.graph.master.gain.setTargetAtTime(s.muted?0:.48,now,.01);}
    if(s.muted||(!s.music&&!s.sfx)){this.generation++;this.stopAll();this.previewing=false;this.previewPending=false;}
    else{
      if(!s.music){if(this.midi)this.midi.stopAll();this.music.slice().forEach(function(v){self.stopVoice(v);});this.musicKey='';}
      if(!s.sfx)this.voices.slice().forEach(function(v){self.stopVoice(v);});
    }
    this.sync();this.reconcile();
  };
  Manager.prototype.voice=function(key,destination,level,offset,loop,delay,duration,priority){
    var buffer=this.buffers[key];if(!buffer)return null;
    var entry=this.bank.entries[key]||{},loopStart=Math.max(0,entry.loopStart||0),loopEnd=Math.min(buffer.duration,entry.loopEnd||buffer.duration);
    var context=this.context,self=this,source=context.createBufferSource(),gain=context.createGain(),now=context.currentTime,when=now+(delay||0);
    var start=Math.max(0,offset||0);if(loop)start=loopOffset(start,loopStart,loopEnd);else if(start>=buffer.duration)return null;
    source.buffer=buffer;source.loop=!!loop;if(loop){source.loopStart=loopStart;source.loopEnd=loopEnd;}
    source.connect(gain);gain.connect(destination);gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(level,when+.012);
    var voice={key:key,source:source,gain:gain,offset:start,started:when,level:level,priority:priority||0,stopped:false};
    source.onended=function(){self.music=self.music.filter(function(v){return v!==voice;});self.voices=self.voices.filter(function(v){return v!==voice;});try{source.disconnect();gain.disconnect();}catch(error){}self.reconcile();};
    if(duration)source.start(when,start,loop?duration:Math.min(duration,buffer.duration-start));else source.start(when,start);
    return voice;
  };
  Manager.prototype.play=function(key,tick,audition,delay){
    var s=this.settings,policy=POLICY[key];if(!policy||!this.ready||!this.context||this.context.state!=='running'||s.muted||!s.sfx)return false;
    if(!audition&&tick-(this.lastSfx[key]===undefined?-99999:this.lastSfx[key])<policy[0]){this.counts.rateDropped++;return false;}
    var wait=delay||0;
    if(this.voices.length>=6){
      var lowest=this.voices.reduce(function(a,b){return a.priority<b.priority?a:b;});
      if(lowest.priority>=policy[2]){this.counts.voiceDropped++;return false;}
      this.stopVoice(lowest,.008);wait=Math.max(wait,.008);
    }
    var voice=this.voice(key,this.graph.sfx,policy[1],0,false,wait,0,policy[2]);if(!voice)return false;
    this.voices.push(voice);if(!audition)this.lastSfx[key]=tick;
    this.counts.played[key]=(this.counts.played[key]||0)+1;this.counts.peakSfx=Math.max(this.counts.peakSfx,this.voices.length);return true;
  };
  Manager.prototype.sync=function(){
    if(!this.context||!this.ready)return;
    var value=this.settings,self=this;
    if(this.previewing&&this.context.currentTime>=this.previewUntil){this.previewing=false;this.stopAll();}
    var selected=this.previewing?{key:'preview',offset:16,tracks:[['stage',1]],phase:-1}:plan(this.view,this.recorded);
    if(!value.music||value.muted||(this.view&&this.view.foreground===false))selected=null;
    if(selected&&(selected.key==='clear'||selected.key==='defeat')&&this.terminalStarted&&this.musicKey!==selected.key)selected=null;
    if(!selected){if(this.midi&&this.midi.active())this.midi.stopAll();if(this.music.length){this.music.slice().forEach(function(v){self.stopVoice(v);});}this.musicKey='';this.reconcile();return;}
    if(this.context.state!=='running'){this.reconcile();return;}
    if(this.midi&&selected.tracks.every(function(row){return !self.bank.entries[row[0]];})){
      this.music.slice().forEach(function(v){self.stopVoice(v,.10);});
      if(selected.key!==this.musicKey){
        this.musicKey=selected.key;this.musicPhase=selected.phase;if(selected.key==='clear'||selected.key==='defeat')this.terminalStarted=true;
        this.midi.start(selected,this.previewing?6:0);this.counts.musicStarts++;
        this.history.push({tick:this.view?this.view.tick:0,key:selected.key,phase:selected.phase,offset:selected.offset});this.history=this.history.slice(-32);
      }else{
        this.midi.sync(selected,this.previewing?6:0);
        if(this.musicPhase!==selected.phase){this.musicPhase=selected.phase;this.history.push({tick:this.view.tick,key:selected.key,phase:selected.phase,offset:selected.offset});this.history=this.history.slice(-32);}
      }
      this.reconcile();return;
    }
    if(this.midi&&this.midi.active())this.midi.stopAll();
    if(selected.key!==this.musicKey){
      this.music.slice().forEach(function(v){self.stopVoice(v,.10);});
      this.musicKey=selected.key;this.musicPhase=selected.phase;
      if(selected.key==='clear'||selected.key==='defeat')this.terminalStarted=true;
      selected.tracks.forEach(function(row){var entry=self.bank.entries[row[0]],voice=self.voice(row[0],self.graph.music,row[1],selected.offset,entry.loop,0,self.previewing?6:0);if(voice)self.music.push(voice);});
      this.counts.musicStarts++;this.history.push({tick:this.view?this.view.tick:0,key:selected.key,phase:selected.phase,offset:selected.offset});this.history=this.history.slice(-32);
    }else{
      selected.tracks.forEach(function(row){var voice=self.music.find(function(v){return v.key===row[0];});if(voice&&voice.level!==row[1]){voice.level=row[1];voice.gain.gain.setTargetAtTime(row[1],self.context.currentTime,.12);}});
      if(this.musicPhase!==selected.phase){this.musicPhase=selected.phase;this.history.push({tick:this.view.tick,key:selected.key,phase:selected.phase,offset:selected.offset});this.history=this.history.slice(-32);}
    }
    this.reconcile();
  };
  Manager.prototype.update=function(view){
    if(view.foreground===false)view=Object.assign({},view,{mode:'paused'});
    if((this.previewing||this.previewPending)&&['running','countdown'].indexOf(view.mode)>=0){this.generation++;this.previewing=false;this.previewPending=false;this.stopAll();}
    var previous=this.previous;this.view=view;
    var audible=view.mode==='running'||view.mode==='over';
    if(!audible&&!this.previewing){if(this.music.length||this.voices.length||(this.midi&&this.midi.active()))this.stopAll();}
    if(audible&&previous&&view.tick>previous.tick){
      var self=this;events(previous,view).forEach(function(key){self.counts.seen[key]=(self.counts.seen[key]||0)+1;self.play(key,view.tick,false,0);});
    }
    this.previous=view;this.sync();
  };
  Manager.prototype.preview=function(){
    if(this.view&&['running','countdown'].indexOf(this.view.mode)>=0)return Promise.resolve(false);
    if(this.previewing||this.previewPending){this.generation++;this.previewing=false;this.previewPending=false;this.stopAll();this.reconcile();return Promise.resolve(false);}
    if(this.settings.muted||(!this.settings.music&&!this.settings.sfx))return Promise.resolve(false);
    var self=this,ticket=++this.generation;this.stopAll();this.previewPending=true;
    return this.gesture().then(function(){
      if(ticket!==self.generation||!self.ready||self.settings.muted){self.counts.staleDropped++;return false;}
      self.previewPending=false;self.previewing=true;self.previewUntil=self.context.currentTime+6;self.reconcile();
      return Promise.resolve(self.context.resume()).then(function(){
        if(ticket!==self.generation||!self.previewing)return false;
        self.sync();self.play('pickup',0,true,.35);self.play('upgrade',0,true,1.15);self.play('bomb',0,true,2.45);return true;
      });
    });
  };
  Manager.prototype.menu=function(){if(this.view&&this.view.mode==='running')this.play('menu',this.view.tick,false,0);};
  Manager.prototype.inspect=function(){
    var context=this.context,rms=0;
    if(context&&context.state==='running'&&(this.music.length||this.voices.length||(this.midi&&this.midi.active()))){this.graph.meter.getFloatTimeDomainData(this.meterData);for(var i=0;i<this.meterData.length;i++)rms+=this.meterData[i]*this.meterData[i];rms=Math.sqrt(rms/this.meterData.length);}
    return{settings:Object.assign({},this.settings),unlocked:this.unlocked,ready:this.ready,decoded:Object.keys(this.buffers).length,contextState:context?context.state:'not-created',
      previewing:this.previewing,previewPending:this.previewPending,track:this.musicKey,musicFormat:this.recorded?'recorded-happyshrimp':'legacy',musicVoices:(this.midi?this.midi.streams.length:0)+this.music.length,sfxVoices:this.voices.length,rms:rms,midi:this.midi?this.midi.inspect():null,
      musicOffsets:(this.midi&&context?this.midi.offsets():[]).concat(this.music.map(function(v){var elapsed=Math.max(0,context.currentTime-v.started);return{key:v.key,offset:v.source.loop?loopOffset(v.offset+elapsed,v.source.loopStart||0,v.source.loopEnd||v.source.buffer.duration):v.offset+elapsed,level:v.level};})),
      counts:JSON.parse(JSON.stringify(this.counts)),history:this.history.map(function(v){return Object.assign({},v);}),errors:this.errors.slice()};
  };
  function loopOffset(offset,start,end){return offset<end?offset:start+(offset-end)%(end-start);}
  return{Manager:Manager,defaults:DEFAULTS,settings:settings,plan:plan,events:events,graph:graph,policy:POLICY,decodeBytes:decodeBytes,loopOffset:loopOffset};
}));
