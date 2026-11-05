/* 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。独立、默认关闭的本地 BGM。 */
(() => {
  'use strict';
  // Audio assets share one loudness target; keep player/track gains in one place.
  const MIX={baseGain:.28,trackGain:{1:1,2:1}};
  class RaidMusic {
    constructor(change=()=>{},src='source/plugin/gamecenter/games/raid/assets/battle.mp3',phase2src='source/plugin/gamecenter/games/raid/assets/battle-phase2.mp3',{now=()=>Date.now(),requestFrame=fn=>globalThis.requestAnimationFrame(fn),cancelFrame=id=>globalThis.cancelAnimationFrame(id)}={}) {
      Object.assign(this,{now,requestFrame,cancelFrame});this.duckStart=null;this.duckFrom=1;this.duckFrame=null;
      this.sources={1:src,2:phase2src}; this.phase=1;
      this.src=src; this.on=false; this.active=false; this.interacted=false; this.audio=null;
      this.blocked=false; this.interrupted=false; this.ticket=0; this.change=change;
      try { this.on=window.localStorage.getItem('gcr_bgm')==='1'; } catch (_) { /* Optional preference. */ }
      document.addEventListener('play',event=>{
        if(event.target!==this.audio && !event.target.paused && !event.target.muted && event.target.volume>0) { this.interrupted=true; this.pause(); this.change(); }
      },true);
    }
    otherMedia() { return [...(document.querySelectorAll?.('audio,video')||[])].some(media=>media!==this.audio && !media.paused && !media.muted && media.volume>0); }
    eligible() { return this.on && this.active && this.interacted && !this.interrupted && !document.hidden && !this.otherMedia(); }
    setActive(active,phase=this.phase) {
      const next=phase===2?2:1, changed=this.phase!==next, wasActive=this.active;
      this.active=!!active;
      if(changed) {
        this.phase=next; this.src=this.sources[next]; this.pause(); this.blocked=false;
        if(this.audio) {this.audio.src=this.src; this.audio.currentTime=0; this.audio.volume=this.volume();}
      }
      if(changed || wasActive!==this.active) this.sync();
    }
    duckGain() {
      if(this.duckStart===null)return 1;
      const elapsed=this.now()-this.duckStart;
      if(elapsed<20)return this.duckFrom+(.62-this.duckFrom)*Math.max(0,elapsed)/20;
      if(elapsed<150)return .62;
      return .62+.38*Math.min(1,(elapsed-150)/250);
    }
    volume() { return Math.min(1,MIX.baseGain*MIX.trackGain[this.phase])*this.duckGain(); }
    cancelDuck() {
      if(this.duckFrame!==null)this.cancelFrame(this.duckFrame);
      this.duckFrame=null;this.duckStart=null;this.duckFrom=1;
      if(this.audio)this.audio.volume=this.volume();
    }
    duck() {
      if(!this.eligible() || !this.audio || this.audio.paused)return false;
      const from=this.duckGain();this.cancelDuck();this.duckFrom=from;this.duckStart=this.now();
      const tick=()=>{
        this.duckFrame=null;
        if(!this.eligible() || this.audio.paused || this.now()-this.duckStart>=400){this.cancelDuck();return;}
        this.audio.volume=this.volume();this.duckFrame=this.requestFrame(tick);
      };
      tick();return true;
    }
    setPhase(phase) { this.setActive(this.active,phase); }
    gesture() { this.interacted=true; this.sync(); }
    toggle() {
      this.interacted=true;
      this.on=!this.on; this.blocked=false; this.interrupted=false;
      try { window.localStorage.setItem('gcr_bgm',this.on?'1':'0'); } catch (_) { /* Optional preference. */ }
      this.sync(); this.change();
    }
    pause() { this.ticket++; this.cancelDuck(); if(this.audio) this.audio.pause(); }
    sync() {
      if(this.otherMedia()) this.interrupted=true;
      if(!this.eligible()) { this.pause(); this.change(); return; }
      // A single element is reused; repeated syncs never create overlapping music.
      if(this.audio && !this.audio.paused) return;
      const ticket=++this.ticket;
      try {
        if(!this.audio) {
          this.audio=new window.Audio(); this.audio.preload='none'; this.audio.loop=true;
          this.audio.volume=this.volume(); this.audio.src=this.src;
        }
        Promise.resolve(this.audio.play()).then(()=>{
          if(ticket!==this.ticket) { if(!this.eligible()) this.audio.pause(); return; }
          this.blocked=false; this.change();
        }).catch(()=>{ if(ticket===this.ticket) {this.blocked=true;this.change();} });
      } catch (_) { this.blocked=true; this.change(); }
    }
  }
  globalThis.RaidMusic=RaidMusic;
})();
