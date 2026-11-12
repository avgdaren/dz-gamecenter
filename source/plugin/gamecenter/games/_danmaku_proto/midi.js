/* (C) 2026 Carinoasd. Local SMF sequencer and electronic synthesizer: 小典 / Codex.
 * Original patches, no SoundFont, external library or hardware MIDI access.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuMidi=factory();
}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function parse(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length>1048576)throw Error('MIDI大小无效');
    var p=0,events=0,notes=[],tempos=[{tick:0,us:500000}],endTick=0;
    function byte(){if(p>=bytes.length)throw Error('MIDI意外结束');return bytes[p++];}
    function word(){return byte()*256+byte();}
    function long(){return byte()*16777216+byte()*65536+byte()*256+byte();}
    function text(){return String.fromCharCode(byte(),byte(),byte(),byte());}
    function vlq(){var n=0;for(var i=0;i<4;i++){var b=byte();n=n*128+(b&127);if(!(b&128))return n;}throw Error('MIDI时值无效');}
    if(text()!=='MThd')throw Error('缺少MIDI头');var header=long(),format=word(),tracks=word(),ppq=word();
    if(header<6||header>64||format>1||!tracks||tracks>64||!ppq||(ppq&32768))throw Error('MIDI头格式无效');p+=header-6;
    var programs=new Set(),drums=new Set(),channels=new Set(),trackNames=[];
    for(var track=0;track<tracks;track++){
      if(text()!=='MTrk')throw Error('缺少MIDI轨道');var size=long(),stop=p+size,tick=0,running=0,open={};
      if(stop>bytes.length)throw Error('MIDI轨道长度无效');
      var states=Array.from({length:16},function(){return{program:0,volume:105,pan:64,expression:127,brightness:105,bend:8192};});
      while(p<stop){
        if(++events>100000)throw Error('MIDI事件过多');tick+=vlq();endTick=Math.max(endTick,tick);
        var status=byte();if(status<128){p--;status=running;}else if(status<240)running=status;
        if(status===255){
          var type=byte(),length=vlq(),limit=p+length;if(limit>stop)throw Error('MIDI元事件长度无效');
          if(type===81){if(length!==3)throw Error('MIDI速度无效');var us=byte()*65536+byte()*256+byte();if(!us)throw Error('MIDI速度为零');tempos.push({tick:tick,us:us});}
          if(type===3)trackNames.push(String.fromCharCode.apply(null,bytes.slice(p,limit)));
          p=limit;if(type===47){if(length!==0||p!==stop)throw Error('MIDI结束位置无效');break;}continue;
        }
        if(status===240||status===247){p+=vlq();if(p>stop)throw Error('MIDI系统事件无效');continue;}
        if(status<128||status>=240)throw Error('MIDI状态无效');
        var channel=status&15,kind=status>>4,a=byte(),b=(kind===12||kind===13)?0:byte();
        if(a>127||b>127)throw Error('MIDI数据字节无效');var state=states[channel],key=channel+':'+a;
        if(kind===9&&b){
          var note={tick:tick,channel:channel,note:a,velocity:b,program:state.program,pan:state.pan,volume:state.volume,expression:state.expression,brightness:state.brightness,bend:state.bend};
          (open[key]||(open[key]=[])).push(note);channels.add(channel);if(channel===9)drums.add(a);else programs.add(state.program);
        }else if(kind===8||(kind===9&&!b)){
          if(!open[key]||!open[key].length)throw Error('MIDI存在孤立的结束音符');var on=open[key].shift();on.off=tick;if(on.off<=on.tick)throw Error('MIDI音符时值无效');notes.push(on);
        }else if(kind===12)state.program=a;
        else if(kind===11){if(a===7)state.volume=b;if(a===10)state.pan=b;if(a===11)state.expression=b;if(a===74)state.brightness=b;}
        else if(kind===14)state.bend=a+b*128;
      }
      if(p!==stop||Object.keys(open).some(function(key){return open[key].length;}))throw Error('MIDI轨道或音符未结束');
    }
    if(p!==bytes.length)throw Error('MIDI含额外数据');
    tempos.sort(function(a,b){return a.tick-b.tick;});var map=[];
    tempos.forEach(function(t){if(map.length&&map[map.length-1].tick===t.tick)map[map.length-1]=t;else map.push(t);});
    var seconds=0;for(var i=0;i<map.length;i++){if(i)seconds+=(map[i].tick-map[i-1].tick)*map[i-1].us/ppq/1000000;map[i].seconds=seconds;}
    function timing(tick){var v=map[0];for(var i=1;i<map.length&&map[i].tick<=tick;i++)v=map[i];return{seconds:v.seconds+(tick-v.tick)*v.us/ppq/1000000,beat:v.us/1000000};}
    notes.forEach(function(n){var a=timing(n.tick),b=timing(n.off);n.start=a.seconds;n.end=b.seconds;n.duration=b.seconds-a.seconds;n.beat=a.beat;});
    notes.sort(function(a,b){return a.start-b.start||((a.channel===9?0:1)-(b.channel===9?0:1))||a.channel-b.channel||a.note-b.note;});
    return{format:format,ppq:ppq,tracks:tracks,trackNames:trackNames,duration:timing(endTick).seconds,endTick:endTick,tempos:map,notes:notes,programs:Array.from(programs),drums:Array.from(drums),channels:Array.from(channels),events:events};
  }
  function decode(data){var raw=atob(data),bytes=new Uint8Array(raw.length);for(var i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;}
  function Synth(context,offline){
    this.context=context;this.offline=!!offline;this.voices=[];this.max=32;this.played=0;this.peak=0;this.stolen=0;this.dropped=0;this.onidle=null;
    this.noise=context.createBuffer(1,context.sampleRate,context.sampleRate);var data=this.noise.getChannelData(0),seed=81317;
    for(var i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}
    var curve=new Float32Array(1024);for(var j=0;j<curve.length;j++){var x=j*2/(curve.length-1)-1;curve[j]=Math.tanh(x*2.6)/Math.tanh(2.6);}this.driveCurve=curve;
  }
  Synth.prototype.prune=function(time){this.voices=this.voices.filter(function(v){return!v.finished&&v.end>time;});};
  Synth.prototype.stop=function(voice,time){if(voice.finished)return;voice.finished=true;try{voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setValueAtTime(0,time);voice.sources.forEach(function(s){s.stop(time);});}catch(error){};};
  Synth.prototype.stopAll=function(){var self=this,now=this.context.currentTime;this.voices.forEach(function(v){self.stop(v,now);});this.voices=[];};
  Synth.prototype.note=function(note,when,duration,buses){
    var c=this.context,self=this,drum=note.channel===9,program=note.program,priority=drum?(note.note===36?10:note.note===38?8:4):program===39?8:[56,73,81].indexOf(program)>=0?7:program===0?4:3;
    this.prune(this.offline?when:c.currentTime);
    if(this.voices.length>=this.max){var low=this.voices.reduce(function(a,b){return a.priority<b.priority?a:b;});if(low.priority>=priority){this.dropped++;return null;}this.stop(low,Math.max(c.currentTime,when));this.voices=this.voices.filter(function(v){return v!==low;});this.stolen++;}
    var gain=c.createGain(),sources=[],extra=[],velocity=Math.pow(note.velocity/127,1.25)*(note.volume/127)*(note.expression/127),release=drum?.015:program===90||program===48?.10:program===0?.075:.035;
    var length=duration,attack=.003,level=.12,filter=null,destination=drum?buses.drums:buses.melody;
    var pan=c.createStereoPanner();pan.pan.value=(note.pan-64)/64;gain.connect(pan);pan.connect(destination);extra.push(pan);
    function oscillator(type,freq,weight,detune){var o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,when);o.detune.value=detune||0;g.gain.value=weight;o.connect(g);g.connect(filter||gain);sources.push(o);extra.push(g);return o;}
    function noise(highpass,weight){var s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=self.noise;s.loop=true;f.type='highpass';f.frequency.value=highpass;g.gain.value=weight;s.connect(f);f.connect(g);g.connect(gain);sources.push(s);extra.push(f,g);}
    function vibrato(tones,rate,depth){var lfo=c.createOscillator(),amount=c.createGain();lfo.type='sine';lfo.frequency.value=rate;amount.gain.value=depth;lfo.connect(amount);tones.forEach(function(t){amount.connect(t.detune);});sources.push(lfo);extra.push(amount);}
    var frequency=440*Math.pow(2,(note.note-69+(note.bend-8192)/8192*2)/12);
    if(drum){
      if(note.note===36){length=.22;level=.78;var kick=oscillator('sine',155,1,0);kick.frequency.exponentialRampToValueAtTime(46,when+.13);
        buses.melody.gain.cancelScheduledValues(when);buses.melody.gain.setValueAtTime(buses.duck===undefined?.28:buses.duck,when);buses.melody.gain.linearRampToValueAtTime(1,when+note.beat*.58);
      }else if(note.note===38){length=.16;level=.25;noise(1000,.8);oscillator('triangle',185,.2,0);}
      else if(note.note===39){length=.13;level=.20;noise(1500,1);}
      else if(note.note===49){length=.65;level=.18;noise(4500,1);}
      else if(note.note===46){length=.17;level=.12;noise(6500,1);}
      else{length=.055;level=.11;noise(7200,1);}
    }else{
      filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.7;filter.connect(gain);extra.push(filter);
      if(program===39){
        level=.24;var shaper=c.createWaveShaper();shaper.curve=this.driveCurve;shaper.oversample='2x';filter.disconnect();filter.connect(shaper);shaper.connect(gain);extra.push(shaper);
        filter.frequency.setValueAtTime(1300,when);filter.frequency.exponentialRampToValueAtTime(260,when+Math.max(.04,length));oscillator('sawtooth',frequency,.68,0);oscillator('sine',frequency/2,.32,0);
      }else if(program===0){
        level=.22;filter.frequency.setValueAtTime(5200,when);filter.frequency.exponentialRampToValueAtTime(1200,when+Math.max(.08,length));oscillator('sine',frequency,.66,0);oscillator('triangle',frequency,.12,0);oscillator('sine',frequency*2,.15,1);oscillator('sine',frequency*3,.07,-1);
      }else if(program===56){
        level=.25;attack=.012;filter.Q.value=.8;filter.frequency.setValueAtTime(1600,when);filter.frequency.linearRampToValueAtTime(3600,when+.05);var brass=[oscillator('sawtooth',frequency,.68,0),oscillator('square',frequency,.15,-3),oscillator('triangle',frequency,.17,3)];vibrato(brass,5.4,6);
      }else if(program===73){
        level=.26;attack=.009;filter.frequency.value=3500;var air=[oscillator('sine',frequency,.75,0),oscillator('triangle',frequency,.20,2),oscillator('sine',frequency*2,.05,0)];if(length>.3)vibrato(air,4.8,4);
      }else if(program===48){level=.045;attack=.03;filter.frequency.value=2200;oscillator('sawtooth',frequency,.5,-6);oscillator('triangle',frequency,.5,6);}
      else if(program===90){level=.05;attack=.025;filter.frequency.value=1800;oscillator('sawtooth',frequency,.5,-4);oscillator('triangle',frequency,.5,4);}
      else if(program===80){level=.085;filter.frequency.value=3200;oscillator('square',frequency,.72,0);oscillator('sine',frequency,.28,0);}
      else{level=.17;filter.frequency.value=1400+note.brightness*23;oscillator('sawtooth',frequency,.34,-9);oscillator('sawtooth',frequency,.33,0);oscillator('sawtooth',frequency,.33,9);}
    }
    var end=when+Math.max(.025,length)+release,amount=level*velocity;
    gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(amount,when+attack);
    if(drum)gain.gain.exponentialRampToValueAtTime(.0001,end);
    else if(program===0){gain.gain.exponentialRampToValueAtTime(Math.max(.0001,amount*.14),Math.max(when+attack,when+length*.85));gain.gain.linearRampToValueAtTime(0,end);}
    else{gain.gain.setValueAtTime(amount*.82,Math.max(when+attack,when+length*.8));gain.gain.linearRampToValueAtTime(0,end);}
    var voice={sources:sources,gain:gain,end:end,priority:priority,finished:false};
    var remaining=sources.length;sources.forEach(function(s){s.onended=function(){if(--remaining===0){voice.finished=true;self.voices=self.voices.filter(function(v){return v!==voice;});try{gain.disconnect();sources.forEach(function(n){n.disconnect();});extra.forEach(function(n){n.disconnect();});}catch(error){}if(self.onidle)self.onidle();}};s.start(when);s.stop(end+.002);});
    this.voices.push(voice);this.played++;this.peak=Math.max(this.peak,this.voices.length);return voice;
  };
  function Player(bank){this.bank=bank;this.scores={};this.context=null;this.synth=null;this.streams=[];this.key='';this.notesScheduled=0;this.lateSkipped=0;this.finished=false;this.onidle=null;}
  Player.prototype.attach=function(context,destination){
    if(this.context===context)return;this.context=context;this.destination=destination;var self=this;
    Object.keys(this.bank.entries).forEach(function(key){var score=parse(decode(self.bank.entries[key].data));if(Math.abs(score.duration-self.bank.entries[key].seconds)>.001)throw Error('MIDI长度与清单不符');self.scores[key]=score;});
    this.synth=new Synth(context);this.synth.onidle=function(){if(self.onidle)self.onidle();};
  };
  Player.prototype.stopAll=function(){
    if(this.synth)this.synth.stopAll();this.streams.forEach(function(s){s.buses.level.disconnect();s.buses.melody.disconnect();s.buses.drums.disconnect();});this.streams=[];this.key='';
  };
  Player.prototype.buses=function(level){var c=this.context,g=c.createGain(),m=c.createGain(),d=c.createGain();g.gain.value=level*2.2;m.connect(g);d.connect(g);g.connect(this.destination);return{level:g,melody:m,drums:d,duck:this.bank.duck};};
  Player.prototype.start=function(selected,duration){
    this.stopAll();this.key=selected.key;this.finished=false;var self=this,now=this.context.currentTime;
    selected.tracks.forEach(function(row){
      var score=self.scores[row[0]];if(!score)return;var loop=self.bank.entries[row[0]].loop,offset=loop?selected.offset%score.duration:selected.offset;if(offset>=score.duration)return;
      var buses=self.buses(row[1]),stream={key:row[0],score:score,loop:loop,offset:offset,origin:now+.015-offset,cursor:0,cycle:0,buses:buses,level:row[1],until:duration?now+duration:Infinity};
      while(stream.cursor<score.notes.length&&score.notes[stream.cursor].start<offset){var n=score.notes[stream.cursor++];if(row[1]>0&&n.channel!==9&&n.end>offset)self.synth.note(n,now+.015,n.end-offset,buses);}
      self.streams.push(stream);
    });this.pump();
  };
  Player.prototype.pump=function(){
    var self=this,now=this.context.currentTime,horizon=now+.08;
    this.streams.forEach(function(s){
      var count=0;while(s.score.notes.length&&count++<64){
        if(s.cursor>=s.score.notes.length){if(!s.loop)break;s.cursor=0;s.cycle++;}
        var n=s.score.notes[s.cursor],when=s.origin+s.cycle*s.score.duration+n.start;
        if(when>horizon||when>=s.until)break;s.cursor++;
        if(when+n.duration<now-.05){self.lateSkipped++;continue;}
        if(s.level>0){self.synth.note(n,Math.max(now+.002,when),Math.max(.02,n.duration-Math.max(0,now-when)),s.buses);self.notesScheduled++;}
      }
    });
    this.streams=this.streams.filter(function(s){var ended=now>=s.until||(!s.loop&&now>s.origin+s.score.duration+.15);if(ended){s.buses.level.disconnect();s.buses.melody.disconnect();s.buses.drums.disconnect();}return!ended;});
    this.synth.prune(now);if(!this.streams.length)this.finished=true;
  };
  Player.prototype.sync=function(selected,duration){
    if(!this.context)return;if(selected.key!==this.key){this.start(selected,duration);return;}
    var now=this.context.currentTime;selected.tracks.forEach(function(row){var s=this.streams.find(function(v){return v.key===row[0];});if(s&&s.level!==row[1]){s.level=row[1];s.buses.level.gain.setTargetAtTime(row[1]*2.2,now,.10);}},this);this.pump();
  };
  Player.prototype.active=function(){return this.streams.length+(this.synth?this.synth.voices.length:0);};
  Player.prototype.offsets=function(){var now=this.context.currentTime;return this.streams.map(function(s){var time=Math.max(s.offset,now-s.origin);return{key:s.key,offset:s.loop?time%s.score.duration:time,level:s.level};});};
  Player.prototype.inspect=function(){return{format:'SMF1',tracks:this.streams.length,activeNotes:this.synth?this.synth.voices.length:0,peakNotes:this.synth?this.synth.peak:0,notesScheduled:this.notesScheduled,lateSkipped:this.lateSkipped,stolen:this.synth?this.synth.stolen:0,dropped:this.synth?this.synth.dropped:0,parsedFiles:Object.keys(this.scores).length};};
  // Render previews through exactly the same patches as the live sequencer.
  async function render(bank,rows,offset,seconds,rate){
    var context=new OfflineAudioContext(2,Math.round(seconds*rate),rate),master=context.createGain();master.gain.value=.48;master.connect(context.destination);
    var synth=new Synth(context,true),items=[];
    rows.forEach(function(row){var entry=bank.entries[row[0]],score=parse(decode(entry.data)),buses={level:context.createGain(),melody:context.createGain(),drums:context.createGain(),duck:bank.duck};buses.level.gain.value=row[1]*2.2;buses.melody.connect(buses.level);buses.drums.connect(buses.level);buses.level.connect(master);
      for(var cycle=0;cycle<=Math.ceil((offset+seconds)/score.duration);cycle++){
        if(cycle&&!entry.loop)break;score.notes.forEach(function(n){var start=n.start+cycle*score.duration-offset,end=n.end+cycle*score.duration-offset;if(end<=0||start>=seconds)return;items.push({n:n,when:Math.max(0,start),duration:end-Math.max(0,start),buses:buses});});
      }
    });
    items.sort(function(a,b){return a.when-b.when||((a.n.channel===9?0:1)-(b.n.channel===9?0:1));});
    items.forEach(function(v){synth.note(v.n,v.when,v.duration,v.buses);});var buffer=await context.startRendering();return{buffer:buffer,peakNotes:synth.peak,dropped:synth.dropped};
  }
  return{parse:parse,decode:decode,Synth:Synth,Player:Player,render:render};
}));
