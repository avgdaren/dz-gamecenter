/* 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。独立、默认关闭的本地 BGM。 */
(() => {
  'use strict';
  class RaidMusic {
    constructor(change=()=>{}) {
      this.on=false; this.active=false; this.interacted=false; this.audio=null;
      this.blocked=false; this.interrupted=false; this.ticket=0; this.change=change;
      try { this.on=window.localStorage.getItem('gcr_bgm')==='1'; } catch (_) { /* Optional preference. */ }
      document.addEventListener('play',event=>{
        if(event.target!==this.audio && !event.target.paused && !event.target.muted && event.target.volume>0) { this.interrupted=true; this.pause(); this.change(); }
      },true);
    }
    otherMedia() { return [...(document.querySelectorAll?.('audio,video')||[])].some(media=>media!==this.audio && !media.paused && !media.muted && media.volume>0); }
    eligible() { return this.on && this.active && this.interacted && !this.interrupted && !document.hidden && !this.otherMedia(); }
    setActive(active) { if(this.active!==active) { this.active=active; this.sync(); } }
    gesture() { this.interacted=true; this.sync(); }
    toggle() {
      this.interacted=true;
      this.on=!this.on; this.blocked=false; this.interrupted=false;
      try { window.localStorage.setItem('gcr_bgm',this.on?'1':'0'); } catch (_) { /* Optional preference. */ }
      this.sync(); this.change();
    }
    pause() { this.ticket++; if(this.audio) this.audio.pause(); }
    sync() {
      if(this.otherMedia()) this.interrupted=true;
      if(!this.eligible()) { this.pause(); this.change(); return; }
      // A single element is reused; repeated syncs never create overlapping music.
      if(this.audio && !this.audio.paused) return;
      const ticket=++this.ticket;
      try {
        if(!this.audio) {
          this.audio=new window.Audio(); this.audio.preload='none'; this.audio.loop=true;
          this.audio.volume=.1; this.audio.src='/assets/battle.mp3';
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
