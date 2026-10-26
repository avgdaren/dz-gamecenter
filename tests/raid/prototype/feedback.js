/* 作者：GPT / Codex。原插件 (C) 2026 Carinoasd；Web Audio 方案参考小蓝扫雷的 Sfx。
 * 只读取已结算快照，绝不写入战斗状态；不加载音频文件或外部依赖。 */
(() => {
  'use strict';
  const notes = {
    attack:[[330,.09,'triangle'],[165,.1,'triangle',.04]],
    hurt:[[180,.12,'triangle']], guard:[[620,.1,'sine'],[930,.12,'sine',.06]],
    heal:[[523,.12,'sine'],[659,.12,'sine',.07],[784,.16,'sine',.14]],
    exposed:[[880,.12,'triangle'],[1320,.17,'sine',.08]],
    phase:[[294,.14,'triangle'],[370,.14,'triangle',.08],[440,.2,'sine',.16]],
    win:[[523,.18,'sine'],[659,.18,'sine',.08],[784,.18,'sine',.16],[1047,.25,'sine',.24]],
    lose:[[330,.16,'triangle'],[247,.18,'triangle',.1],[196,.23,'sine',.2]],
    timeout:[[440,.06,'sine'],[330,.09,'sine',.09]]
  };
  class RaidFeedback {
    constructor() {
      this.on = true; this.ctx = null; this.voices = new Set();
      this.previous = null; this.generation = null; this.suppressNext = false;
      try { this.on = window.localStorage.getItem('gcm_sound') !== '0'; } catch (_) { /* Optional preference. */ }
    }
    unlock() {
      if(!this.on) return false;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return false;
        this.ctx ||= new AC();
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
      try { voice.osc.disconnect(); voice.gain.disconnect(); } catch (_) { /* Hardware may be unavailable. */ }
    }
    pause() { this.suppressNext = true; this.cancel(); }
    play(cues) {
      if(!this.on || !this.ctx || this.ctx.state !== 'running' || document.hidden) return;
      const priority=['phase','exposed','timeout','heal','guard','attack','hurt'];
      const selected = cues.includes('win') ? ['win'] : cues.includes('lose') ? ['lose'] : priority.filter(cue=>cues.includes(cue)).slice(0,4);
      selected.forEach((cue,index) => {
        for(const [frequency,duration,type,delay=0] of notes[cue] || []) {
          if(this.voices.size >= 24) break;
          let voice;
          try {
            const osc=this.ctx.createOscillator(), gain=this.ctx.createGain();
            voice={osc,gain}; this.voices.add(voice);
            const at=this.ctx.currentTime + index*.06 + delay;
            osc.type=type; osc.frequency.setValueAtTime(frequency,at);
            gain.gain.setValueAtTime(.0001,at); gain.gain.linearRampToValueAtTime(.035,at+.008);
            gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
            osc.connect(gain); gain.connect(this.ctx.destination);
            osc.onended=() => this.release(voice);
            osc.start(at); osc.stop(at+duration+.02);
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
      if(bossHit) { events.push({target:'boss',kind:'attack',text:`−${bossHit}`}); cues.push('attack'); parts.push(`首领 −${bossHit}`); }
      row.hp.forEach((hp,i) => {
        const healed=Math.max(0,Math.min(40,before.hp[i]+(row.heals[i]||0))-before.hp[i]);
        const hit=Math.max(0,before.hp[i]+healed-hp);
        if(healed) { events.push({target:i,kind:'heal',text:`+${healed}`}); cues.push('heal'); parts.push(`席位 ${i+1} +${healed}`); }
        if(hit) { events.push({target:i,kind:'hurt',text:`−${hit}`}); cues.push('hurt'); parts.push(`席位 ${i+1} −${hit}`); }
        const guarded=hit>0 && row.actions.some(a=>a?.kind==='guard' && a.target===i);
        if(guarded) { events.push({target:i,kind:'guard',text:'守护生效'}); cues.push('guard'); parts.push(`席位 ${i+1}守护生效`); }
      });
      if(row.defaults.length) { cues.push('timeout'); parts.push(`席位 ${row.defaults.map(i=>i+1).join('、')}超时守护`); }
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
  globalThis.RaidFeedback=RaidFeedback;
})();
