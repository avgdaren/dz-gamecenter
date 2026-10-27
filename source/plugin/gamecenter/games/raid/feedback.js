/* 作者：GPT / Codex。原插件 (C) 2026 Carinoasd；Web Audio 方案参考小蓝扫雷的 Sfx。
 * 只读取已结算快照，绝不写入战斗状态；不加载音频文件或外部依赖。 */
(() => {
  'use strict';
  // [source, fromHz, toHz, seconds, offset, gain, filter, cutoff, distortion, echo]
  // Each complete cue ends within .30 s, including its one short echo tail.
  const notes = {
    swing:[['sawtooth',380,120,.04,0,.10,'lowpass',1800,true],['noise',0,0,.03,0,.25,'bandpass',1200,false,{delay:.06,gain:.15}]],
    attack:[['sine',78,62,.09,0,.13],['noise',0,0,.025,0,.08,'highpass',2000]],
    attackHeavy:[['sine',62,48,.09,0,.184],['noise',0,0,.025,0,.11,'highpass',2000]],
    hurt:[['triangle',180,75,.12,0,.12,'lowpass',1300,true],['noise',0,0,.04,0,.09,'lowpass',1800]],
    hurtHeavy:[['sine',55,38,.16,.01,.18],['noise',0,0,.11,.01,.10,'lowpass',850]],
    guard:[['square',1750,700,.13,0,.025,'highpass',700,true],['noise',0,0,.065,0,.025,'highpass',4500],['sine',2700,1500,.14,.025,.025]],
    heal:[['triangle',500,1100,.17,0,.04],['sine',800,1500,.12,.04,.022]],
    exposed:[['triangle',500,1400,.12,0,.05,null,0,false,true]],
    phase:[['sawtooth',170,35,.18,0,.05,'lowpass',1000,true,true],['noise',0,0,.1,0,.025,'lowpass',900]],
    win:[['square',440,440,.075,0,.025,'lowpass',2200],['square',660,660,.075,.065,.025,'lowpass',2600],['triangle',880,1100,.09,.13,.035]],
    lose:[['triangle',330,300,.075,0,.035],['square',220,180,.075,.065,.025,'lowpass',1200],['sine',110,50,.1,.13,.055]],
    timeout:[['square',660,660,.055,0,.02,'lowpass',1800],['square',440,360,.07,.075,.02,'lowpass',1500]]
  };
  class RaidFeedback {
    constructor() {
      this.on = true; this.ctx = null; this.master = null; this.noise = null; this.voices = new Set();
      this.previous = null; this.generation = null; this.suppressNext = false;
      try { this.on = window.localStorage.getItem('gcm_sound') !== '0'; } catch (_) { /* Optional preference. */ }
    }
    unlock() {
      if(!this.on) return false;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return false;
        if(!this.ctx) {
          this.ctx = new AC();
          const limiter=this.ctx.createDynamicsCompressor(), master=this.ctx.createGain();
          limiter.threshold.value=-18; limiter.knee.value=12; limiter.ratio.value=6;
          limiter.attack.value=.003; limiter.release.value=.15;
          master.gain.value=.4; limiter.connect(master); master.connect(this.ctx.destination); this.master=limiter;
          this.noise=this.ctx.createBuffer(1,Math.ceil(this.ctx.sampleRate*.3),this.ctx.sampleRate);
          const data=this.noise.getChannelData(0); let seed=20261027;
          for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
          this.curve=new Float32Array(512);
          for(let i=0;i<512;i++) this.curve[i]=Math.tanh((i/511*2-1)*2.8)*.8;
        }
        if(this.ctx.state === 'suspended') Promise.resolve(this.ctx.resume()).catch(() => {});
        return true;
      } catch (_) { return false; }
    }
    toggle() {
      this.on = !this.on;
      try { window.localStorage.setItem('gcm_sound', this.on ? '1' : '0'); } catch (_) { /* Optional preference. */ }
      if(this.on) this.unlock(); else this.cancel();
      return this.on;
    }
    cancel() {
      for(const voice of [...this.voices]) {
        try { voice.osc.stop(); } catch (_) { /* May already have ended. */ }
        this.release(voice);
      }
    }
    release(voice) {
      this.voices.delete(voice);
      for(const node of voice.nodes) try { node.disconnect(); } catch (_) { /* Hardware may be unavailable. */ }
    }
    pause() { this.suppressNext = true; this.cancel(); }
    play(cues) {
      if(!this.on || !this.ctx || !this.master || this.ctx.state !== 'running' || document.hidden) return;
      // Impacts must survive busy rounds and the final hit. Stagger the counter-hit slightly.
      const impacts=['swing','attackHeavy','attack','hurtHeavy','hurt'].filter(cue=>cues.includes(cue));
      const accents=cues.includes('win')?['win']:cues.includes('lose')?['lose']:['guard','phase','exposed','heal','timeout'].filter(cue=>cues.includes(cue));
      const selected=[...impacts,...accents].slice(0,4);
      selected.forEach(cue => {
        for(const [type,from,to,duration,delay=0,volume=.03,filter,cutoff,distort,echo] of notes[cue] || []) {
          if(this.voices.size >= 24) break;
          let voice;
          try {
            const osc=type==='noise'?this.ctx.createBufferSource():this.ctx.createOscillator(), gain=this.ctx.createGain();
            voice={osc,gain,nodes:[osc,gain]}; this.voices.add(voice);
            const at=this.ctx.currentTime + delay + ((cue==='hurt' || cue==='hurtHeavy') && (impacts.includes('attack') || impacts.includes('attackHeavy')) ? .025 : 0);
            if(type==='noise') osc.buffer=this.noise;
            else {osc.type=type;osc.frequency.setValueAtTime(from,at);osc.frequency.exponentialRampToValueAtTime(to,at+duration);}
            let output=osc;
            if(filter){const f=this.ctx.createBiquadFilter();f.type=filter;f.frequency.value=cutoff;f.Q.value=.7;output.connect(f);output=f;voice.nodes.push(f);}
            if(distort){const shaper=this.ctx.createWaveShaper();shaper.curve=this.curve;shaper.oversample='2x';output.connect(shaper);output=shaper;voice.nodes.push(shaper);}
            output.connect(gain);gain.connect(this.master);
            if(echo){const d=this.ctx.createDelay(.1),wet=this.ctx.createGain();d.delayTime.value=echo.delay||.035;wet.gain.value=echo.gain||.18;gain.connect(d);d.connect(wet);wet.connect(this.master);voice.nodes.push(d,wet);}
            gain.gain.setValueAtTime(.0001,at); gain.gain.linearRampToValueAtTime(volume,at+.004);
            gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
            osc.onended=() => this.release(voice);
            osc.start(at); osc.stop(at+duration+(echo ? (echo.delay||.035)+.005 : .01));
          } catch (_) { if(voice) this.release(voice); }
        }
      });
    }
    /** Exactly one newly settled round may animate. First load, refresh and catch-up are silent. */
    observe(snapshot,generation) {
      const before=this.previous, oldGeneration=this.generation, suppressed=this.suppressNext || document.hidden;
      this.previous=snapshot; this.generation=generation; this.suppressNext=false;
      const empty={events:[],cues:[],summary:''};
      if(!snapshot || !before || oldGeneration !== generation) { this.cancel(); return empty; }
      const delta=snapshot.history.length-before.history.length;
      const terminal=before.status===1 && snapshot.status!==1;
      if(suppressed || delta>1) {
        return {...empty,summary:delta>0 ? `已同步 ${delta} 轮结算，详见战斗记录。` : ''};
      }
      if(delta===0) return terminal ? {events:[{target:'boss',kind:snapshot.status===2?'win':'lose',text:snapshot.status===2?'讨伐成功':'挑战结束'}],
        cues:[snapshot.status===2?'win':'lose'],summary:snapshot.status===2?'讨伐成功。':'挑战结束，请查看结果。'} : empty;
      if(delta!==1) return empty;
      const row=snapshot.history[snapshot.history.length-1];
      if(row.round!==before.round_no) return empty;
      const events=[], cues=[], parts=[];
      const bossHit=Math.max(0,before.boss-row.boss);
      if(bossHit) { events.push({target:'boss',kind:'attack',text:`−${bossHit}`,amount:bossHit}); cues.push(bossHit>=21?'attackHeavy':'attack'); parts.push(`首领 −${bossHit}`); }
      row.hp.forEach((hp,i) => {
        const healed=Math.max(0,Math.min(40,before.hp[i]+(row.heals[i]||0))-before.hp[i]);
        const hit=Math.max(0,before.hp[i]+healed-hp);
        if(healed) { events.push({target:i,kind:'heal',text:`+${healed}`}); cues.push('heal'); parts.push(`${i===snapshot.seat?'你':'队友'} +${healed}`); }
        if(hit) { events.push({target:i,kind:'hurt',text:`−${hit}`,amount:hit}); cues.push(row.preview.kind===2?'hurtHeavy':'hurt'); parts.push(`${i===snapshot.seat?'你':'队友'} −${hit}`); }
        const guarded=hit>0 && row.actions.some(a=>a?.kind==='guard' && a.target===i);
        if(guarded) { events.push({target:i,kind:'guard',text:'守护生效'}); cues.push('guard'); parts.push(`${i===snapshot.seat?'你':'队友'} 守护生效`); }
      });
      if(row.defaults.length) { cues.push('timeout'); parts.push(`${row.defaults.map(i=>i===snapshot.seat?'你':'队友').join('、')} 超时守护`); }
      if(snapshot.status===1 && snapshot.exposed) { events.push({target:'boss',kind:'exposed',text:'破绽出现'}); cues.push('exposed'); parts.push('下轮破绽'); }
      if(snapshot.status===1 && before.preview.phase!==snapshot.preview.phase) { events.push({target:'boss',kind:'phase',text:'第二阶段'}); cues.push('phase'); parts.push('进入第二阶段'); }
      if(terminal) { const cue=snapshot.status===2?'win':'lose'; events.push({target:'boss',kind:cue,text:cue==='win'?'讨伐成功':'挑战结束'}); cues.push(cue); parts.push(cue==='win'?'讨伐成功':'挑战结束'); }
      return {events:events.slice(0,8),cues:[...new Set(cues)],summary:`第 ${row.round} 轮：${parts.join('；') || '本轮回气，无生命变化'}。`};
    }
    /** Missed confirmations are evidence, not a network-presence detector. */
    static idleSlots(snapshot) {
      if(!snapshot || snapshot.status!==1 || snapshot.mode!=='duo') return [];
      return snapshot.hp.flatMap((hp,actor) => {
        if(hp<=0 || snapshot.left[actor] || snapshot.intents[actor]) return [];
        let count=0;
        for(let j=snapshot.history.length-1;j>=0;j--) {
          if(!snapshot.history[j].defaults.includes(actor)) break;
          count++;
        }
        return count>=2 ? [{actor,count}] : [];
      });
    }
  }
  /** Transparent face reactions; strictly presentation-only, one fixed 200ms window. */
  class RaidFaceLayer {
    constructor({art,layer,assetBase,reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}) {
      Object.assign(this,{art,layer,assetBase,reduced,now,setTimer,clearTimer});
      this.cache=new Map();this.phase=1;this.room='';this.level=0;this.until=0;this.timer=null;
      layer.addEventListener('error',()=>{const entry=this.cache.get(`${this.phase}:${this.level}`);if(entry && this.layer.src===entry.url)entry.ready=false;this.reset();});
    }
    reset() {if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;this.level=0;this.until=0;this.art.classList.remove('show-face');}
    update(phase,room,active=true) {
      phase=phase===2?2:1;
      if(this.phase!==phase || this.room!==room){this.reset();this.phase=phase;this.room=room;}
      if(active && !this.reduced())this.prepare(phase);
    }
    prepare(phase) {
      for(let level=1;level<=3;level++) {
        const key=`${phase}:${level}`;if(this.cache.has(key))continue;
        const image=document.createElement('img'),url=new URL(`assets/boss-face-p${phase}-hit${level}.webp`,this.assetBase).href;
        const entry={image,url,ready:false};this.cache.set(key,entry);image.decoding='async';
        image.addEventListener('load',()=>{entry.ready=true;});
        image.addEventListener('error',()=>{entry.ready=false;});image.src=url;
      }
    }
    show(damage) {
      if(this.reduced() || !Number.isFinite(damage) || damage<=0){this.reset();return false;}
      const time=this.now();if(time>=this.until){this.reset();this.until=time+200;}
      this.level=Math.max(this.level,damage>=21?3:damage>=11?2:1);
      const entry=this.cache.get(`${this.phase}:${this.level}`);
      if(this.timer===null)this.timer=this.setTimer(()=>this.reset(),Math.max(0,this.until-time));
      if(!entry?.ready){this.art.classList.remove('show-face');return false;}
      this.layer.src=entry.url;this.art.classList.add('show-face');return true;
    }
  }
  globalThis.RaidFaceLayer=RaidFaceLayer;
  globalThis.RaidFeedback=RaidFeedback;
})();

