/* (C) 2026 Carinoasd. Lazy, reusable original-byte audio loading: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('../_danmaku_proto/audio.js'),globalThis);else root.DanmakuAudio=factory(root.DanmakuAudio,root);}(typeof globalThis!=='undefined'?globalThis:this,function(Base,root){
 'use strict';if(Base.assetLoadingVersion===1)return Base;var decoded=new WeakMap(),encoded=new Map(),maxEncodedBytes=24*1024*1024;
 function trim(){var size=0;encoded.forEach(function(row){size+=row.bytes||0;});for(var pair of encoded){if(size<=maxEncodedBytes)break;if(pair[1].bytes){size-=pair[1].bytes;encoded.delete(pair[0]);}}}
 function bytes(entry,fetcher){if(!entry.url)return Base.decodeBytes(entry.data);var url=entry.url,row=encoded.get(url);if(row){encoded.delete(url);encoded.set(url,row);return row.promise;}row={bytes:0};row.promise=Promise.resolve().then(function(){return fetcher(url,{cache:'force-cache',credentials:'same-origin'});}).then(function(response){if(!response.ok)throw Error('Audio HTTP '+response.status);return response.arrayBuffer();}).then(function(data){row.bytes=data.byteLength;trim();return data;}).catch(function(error){encoded.delete(url);throw error;});encoded.set(url,row);return row.promise;}
 function Manager(bank,options){options=options||{};Base.Manager.call(this,bank,options);this.fetcher=options.fetch||function(url,config){return root.fetch(url,config);};this.pending={};this.failed={};this.assetEpoch=0;this.waitingPlan='';this.prefetchTimer=null;this.assetStats={requests:0,cacheHits:0,decodedBytes:0};}
 Manager.prototype=Object.create(Base.Manager.prototype);Manager.prototype.constructor=Manager;
 Manager.prototype.reconcile=function(){var self=this,context=this.context,epoch=this.assetEpoch;if(!context||!this.unlocked||context.state==='closed')return;var wanted=this.wantsContext();
  function current(){return epoch===self.assetEpoch&&context===self.context;}
  if(wanted&&context.state!=='running'&&!this.resuming){this.resuming=true;Promise.resolve(context.resume()).then(function(){if(!current())return;self.resuming=false;if(self.wantsContext())self.sync();else self.reconcile();}).catch(function(){if(current()){self.resuming=false;self.error('声音未能恢复，请再次点击开始或试听。');}});}
  else if(!wanted&&context.state==='running'&&!this.suspending){this.suspending=true;Promise.resolve(context.suspend()).then(function(){if(!current())return;self.suspending=false;if(self.wantsContext())self.reconcile();}).catch(function(){if(current()){self.suspending=false;self.error('声音暂停失败，可使用静音。');}});}
 };
 Manager.prototype.ensure=function(keys){var self=this,context=this.context,epoch=this.assetEpoch;if(!context)return Promise.resolve(false);
  return Promise.all(keys.filter(function(key){return !!self.bank.entries[key];}).map(function(key){
   if(self.buffers[key])return true;if(self.pending[key])return self.pending[key];var entry=self.bank.entries[key],rates=decoded.get(entry),rate=context.sampleRate||48000;
   if(!rates){rates=new Map();decoded.set(entry,rates);}var job=rates.get(rate);
   if(job)self.assetStats.cacheHits++;else{self.assetStats.requests++;job=bytes(entry,self.fetcher).then(function(data){return context.decodeAudioData(data.slice(0));});rates.set(rate,job);job.catch(function(){rates.delete(rate);});}
   var pending=job.then(function(buffer){if(epoch!==self.assetEpoch||context!==self.context)return false;self.buffers[key]=buffer;self.assetStats.decodedBytes+=buffer.length*buffer.numberOfChannels*4;delete self.failed[key];return true;}).catch(function(){if(epoch===self.assetEpoch){self.failed[key]=true;self.error('部分声音未能读取，仍可正常游玩。');}return false;}).finally(function(){if(self.pending[key]===pending)delete self.pending[key];});self.pending[key]=pending;return pending;
  })).then(function(values){return values.every(Boolean);});
 };
 Manager.prototype.prepare=function(keys){return this.ensure(keys);};
 Manager.prototype.initialKeys=function(){var keys=[],s=this.settings,view=this.view||{};
  if(s.music&&!s.muted){var plan=this.previewPending?{tracks:[['stage',1]]}:Base.plan(Object.assign({},view,{mode:'running'}),this.recorded);if(!plan)plan={tracks:[['stage',1]]};keys=plan.tracks.map(function(row){return row[0];});}
  if(s.sfx&&!s.muted)keys=keys.concat(Object.keys(Base.policy));return Array.from(new Set(keys));
 };
 Manager.prototype.scheduleNext=function(){var self=this;if(this.prefetchTimer||this.buffers.bossCore||this.pending.bossCore||!this.settings.music||this.settings.muted||!this.buffers.stage||!this.bank.entries.bossCore||!this.view||this.view.mode!=='running'||this.view.stage!=='prelude'||this.previewing)return;var epoch=this.assetEpoch;this.prefetchTimer=setTimeout(function(){self.prefetchTimer=null;if(epoch===self.assetEpoch&&self.settings.music&&!self.settings.muted&&self.view&&self.view.mode==='running')self.ensure(['bossCore']);},1500);};
 Manager.prototype.gesture=function(options){var self=this;options=options||{};this.unlocked=true;
  try{if(!this.context){this.context=this.makeContext();if(!this.context){this.error('此浏览器暂不支持声音，仍可正常游玩。');return Promise.resolve(false);}this.graph=Base.graph(this.context,this.settings);}
   if(this.midi){this.midi.attach(this.context,this.graph.music);this.midi.onidle=function(){self.reconcile();};}
   var resume=this.context.resume(),epoch=this.assetEpoch;this.failed={};if(options.unlockOnly)return Promise.resolve(resume).then(function(){self.reconcile();return true;});
   this.loading=this.ensure(this.initialKeys());return Promise.all([resume,this.loading]).then(function(){if(epoch!==self.assetEpoch)return false;self.ready=true;if(self.musicKey&&!self.music.length&&!(self.midi&&self.midi.active()))self.musicKey='';self.sync();self.reconcile();self.scheduleNext();return true;}).catch(function(){self.error('声音暂未开启，可再次点击开始或试听。');return false;});
  }catch(error){this.error('声音暂不可用，仍可正常游玩。');return Promise.resolve(false);}
 };
 Manager.prototype.sync=function(){var self=this,view=this.view,plan=this.previewing?{key:'preview',tracks:[['stage',1]]}:Base.plan(view,this.recorded),s=this.settings;if(this.context&&this.unlocked&&Object.keys(this.buffers).length)this.ready=true;
  if(this.context&&this.unlocked&&plan&&s.music&&!s.muted&&(!view||view.foreground!==false)){
   var needed=plan.tracks.map(function(row){return row[0];}).filter(function(key){return self.bank.entries[key]&&!self.buffers[key]&&!self.failed[key];});
   if(needed.length){var stamp=needed.join('|');if(this.waitingPlan!==stamp){this.waitingPlan=stamp;var epoch=this.assetEpoch;this.ensure(needed).then(function(){if(epoch!==self.assetEpoch)return;self.waitingPlan='';self.ready=true;self.sync();});}return;}
  }
  var result=Base.Manager.prototype.sync.call(this);if(this.ready)this.scheduleNext();return result;
 };
 Manager.prototype.configure=function(value){Base.Manager.prototype.configure.call(this,value);var self=this;if(this.context&&this.settings.sfx&&!this.settings.muted){var keys=Object.keys(Base.policy).filter(function(k){return !self.buffers[k]&&!self.pending[k]&&!self.failed[k];});if(keys.length)this.ensure(keys);}};
 Manager.prototype.dispose=function(){this.assetEpoch++;this.pause();if(this.prefetchTimer)clearTimeout(this.prefetchTimer);this.prefetchTimer=null;Object.values(this.bank.entries).forEach(function(entry){decoded.delete(entry);});if(this.context&&this.context.state!=='closed')this.context.close().catch(function(){});this.context=null;this.graph=null;this.buffers={};this.pending={};this.failed={};this.ready=false;this.loading=null;this.waitingPlan='';this.resuming=false;this.suspending=false;this.assetStats.decodedBytes=0;};
 Manager.prototype.inspect=function(){var result=Base.Manager.prototype.inspect.call(this);result.assets={requests:this.assetStats.requests,cacheHits:this.assetStats.cacheHits,decodedBytes:this.assetStats.decodedBytes,pending:Object.keys(this.pending),decodedKeys:Object.keys(this.buffers)};return result;};
 return Object.assign({},Base,{Manager:Manager,assetLoadingVersion:1});
}));
