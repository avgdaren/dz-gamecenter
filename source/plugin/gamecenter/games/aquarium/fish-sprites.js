/* Author: GPT / Codex, 2026-10-30. Original plugin (C) 2026 Carinoasd.
 * One complete sprite frame per fish. Mount into the artwork-only wrapper.
 * External movement/rotation/flipping stays on its parent, never a second tail.
 */
(function (root) {
  'use strict';
  var players=new Set(), cache=new Map(), raf=0;
  var media=typeof root.matchMedia==='function'?root.matchMedia('(prefers-reduced-motion: reduce)'):null;
  function reduced(){return !!(media && media.matches);}
  function active(){return !document.hidden && !reduced() && Array.from(players).some(function(p){return p.loaded&&!p.paused&&!p.disposed;});}
  function stop(){if(raf){root.cancelAnimationFrame(raf);raf=0;}}
  function start(){if(!raf && active())raf=root.requestAnimationFrame(tick);}
  function tick(now){
    raf=0;
    if(!active())return;
    players.forEach(function(p){if(p.loaded&&!p.paused&&!p.disposed){p.drawFrame(Math.floor((now+p.phase)/p.cycleMs*p.frames)%p.frames);}});
    start();
  }
  function image(url){
    if(!cache.has(url)){
      var pending=new Promise(function(resolve,reject){
        var img=new Image();img.onload=function(){resolve(img);};
        img.onerror=function(){reject(new Error('Fish sheet failed to load'));};img.src=url;
      });
      cache.set(url,pending);
      // A failed load may be retried later; it is not cached forever.
      pending.catch(function(){if(cache.get(url)===pending)cache.delete(url);});
    }
    return cache.get(url);
  }
  function replace(host,node){while(host.firstChild)host.removeChild(host.firstChild);host.appendChild(node);}

  function mount(host, options){
    options=options||{};
    if(!host || !host.appendChild || typeof options.sheetUrl!=='string')throw new TypeError('Missing fish host or sheet');
    var size=options.size||256, columns=options.columns||4, frames=options.frames||12;
    var cycle=options.cycleMs||800;
    if(!Number.isInteger(size)||size<1||!Number.isInteger(columns)||columns<1||
       !Number.isInteger(frames)||frames<1||!Number.isFinite(cycle)||cycle<=0)throw new RangeError('Invalid fish sprite geometry');
    if(host.__aqFishSprite)host.__aqFishSprite.dispose();
    var canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
    var fallback=null, sheet=null;
    canvas.width=size;canvas.height=size;canvas.style.width='100%';canvas.style.height='auto';canvas.style.display='block';
    canvas.setAttribute('aria-hidden','true');canvas.className='aq-fish-sprite';
    if(!ctx)throw new Error('Canvas 2D unavailable');
    replace(host,canvas); // Removes the previous full-body/duplicate-tail artwork.
    var player={loaded:false,paused:!!options.paused,disposed:false,frame:-1,frames:frames,
      cycleMs:cycle,phase:Number.isFinite(options.phaseMs)?options.phaseMs:Math.random()*cycle,
      drawFrame:function(index){
        if(!sheet||player.disposed)return;
        if(!Number.isFinite(index))throw new RangeError('Invalid frame index');
        index=((Math.floor(index)%frames)+frames)%frames;
        if(index===player.frame)return;
        ctx.clearRect(0,0,size,size);
        ctx.drawImage(sheet,(index%columns)*size,Math.floor(index/columns)*size,size,size,0,0,size,size);
        player.frame=index;
      },
      setPaused:function(value){player.paused=!!value;if(active())start();else stop();},
      dispose:function(){
        if(player.disposed)return;player.disposed=true;players.delete(player);
        if(host.__aqFishSprite===player){delete host.__aqFishSprite;if(canvas.parentNode===host)host.removeChild(canvas);if(fallback&&fallback.parentNode===host)host.removeChild(fallback);}
        if(!active())stop();
      }
    };
    host.__aqFishSprite=player;players.add(player);
    player.ready=image(options.sheetUrl).then(function(img){
      if(player.disposed)return player;
      if(img.naturalWidth!==columns*size||img.naturalHeight<Math.ceil(frames/columns)*size)throw new Error('Fish sheet dimensions mismatch');
      sheet=img;player.loaded=true;player.drawFrame(0);start();return player;
    }).catch(function(error){
      if(player.disposed)return player;
      if(options.fallbackUrl){
        fallback=document.createElement('img');fallback.alt='';fallback.src=options.fallbackUrl;
        fallback.style.width='100%';fallback.style.height='auto';fallback.style.display='block';
        replace(host,fallback);
      }
      if(typeof options.onError==='function')options.onError(error);
      // Loading failure is a rendering fallback, not a save/economy failure.
      return player;
    });
    return player;
  }
  document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else start();});
  function motionChanged(){
    if(reduced()){stop();players.forEach(function(p){p.drawFrame(0);});}else start();
  }
  if(media){if(media.addEventListener)media.addEventListener('change',motionChanged);else if(media.addListener)media.addListener(motionChanged);}
  root.AquariumFishSprites={mount:mount,clearCache:function(){if(players.size)throw new Error('Dispose fish before clearing cache');cache.clear();}};
}(typeof window!=='undefined'?window:globalThis));
