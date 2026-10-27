/* 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。PHP 权威结算，原生 JS 显示与输入。 */
(() => {
  'use strict';
  GameCenter.register('raid', (stage, api) => {
  const root=document.createElement('div'); root.className='gcr';
  root.innerHTML=`<div class="gcr-main">

<p class="notice">独自挑战蚀月魔女，或与伙伴组队一起迎战她</p>
<section class="toolbar" aria-label="挑战模式"><button data-gcr="solo" class="primary">独自挑战 · 高难</button><button data-gcr="duo">邀请好友 · 合作</button></section><section class="audio-settings" aria-label="声音设置"><button data-gcr="sound" class="quiet" aria-pressed="true">音效 开</button><button data-gcr="bgm" class="quiet" aria-pressed="false">BGM 关</button></section><form class="join-form"><label>房间号或邀请链接<input data-gcr="join-code" maxlength="512" autocomplete="off" spellcheck="false"></label><button data-gcr="join" type="submit">加入并开战</button></form><section data-gcr="room-panel" hidden><p data-gcr="room-note"></p><label class="room-code">房间号<input data-gcr="room-code" readonly aria-label="房间号"></label><button data-gcr="copy-code">复制房间号</button><p class="invite-help" data-gcr="invite-help">把房间号或邀请链接发给好友。等待中不计入战斗用时。</p><input data-gcr="invite" type="hidden"><button data-gcr="copy">复制邀请链接</button><button data-gcr="reopen" class="primary" hidden>重新建房</button><button data-gcr="cancel">取消等待</button><button data-gcr="current">返回当前讨伐</button></section>
<div data-gcr="message" role="status" aria-live="polite">选择一种模式开始挑战。</div>
<p data-gcr="connection" class="connection" aria-live="off">正在连接论坛…</p>
<div data-gcr="retry-box" hidden><p>上一次操作的结果尚未确认。重试会沿用同一请求，不会重复扣恢复次数。</p><button data-gcr="retry">重试上次操作</button></div>
<div data-gcr="empty" class="empty"><span>☾</span><h2>蚀月魔女 · 幽月，正在等待挑战者</h2><p>每轮先看预告，再选择攻击、守护或恢复。重击后抓住破绽，是胜负的关键。</p></div>
<div data-gcr="battle" hidden>
<p class="turn-help">每轮有 30 秒选择行动；你和队友都确认后立即结算。没选时会自动守护自己。</p>
<p data-gcr="idle-hint" class="idle-hint" role="status" hidden></p>
<section class="arena" aria-label="首领与回合预告">
<div class="boss-art"><img class="boss-base" src="source/plugin/gamecenter/games/raid/assets/boss.webp" alt="蚀月魔女 · 幽月"><img class="boss-phase-layer" data-gcr="phase-art" alt="" aria-hidden="true"></div>
<div class="boss-info"><div class="boss-title"><p class="eyebrow" data-gcr="phase"></p><span data-gcr="round"></span></div><h2>蚀月魔女 · 幽月</h2><div class="health-row"><span data-gcr="boss-hp"></span><span data-gcr="mode"></span></div><div class="boss-health"><progress data-gcr="boss-bar" max="130" value="130" aria-label="幽月生命"></progress><span data-gcr="boss-effects" class="boss-effects" aria-hidden="true"></span></div><p data-gcr="phase-banner" class="phase-banner" role="status" hidden>月蚀加深，幽月进入第二阶段。</p>
<div class="forecast"><div class="forecast-title"><h3 data-gcr="preview-name"></h3><span data-gcr="timer" role="timer"></span></div><p data-gcr="preview-text"></p><p data-gcr="weakness"></p></div>
<p class="boss-line" data-gcr="boss-line">你选择一人面对魔女，还是和伙伴一起挑战魔女？</p></div>
</section>
<p data-gcr="round-feedback" class="round-feedback" role="status" aria-live="polite">尚无已结算回合。</p>
<section data-gcr="result" class="result" hidden aria-live="polite"><h2 data-gcr="result-title"></h2><p data-gcr="result-text"></p></section>
<section data-gcr="players" class="players" aria-label="玩家行动"></section>

<section class="journal"><h3>战斗记录 <span data-gcr="log-count"></span></h3><ol data-gcr="logs" reversed></ol></section>
</div>
<details class="rules"><summary>第一次挑战？展开规则</summary><div><p>每人生命 40。攻击造成 10 伤害；恢复为自己或队友治疗 28，最多回到 40。单人可恢复 3 次，双人各 2 次。</p><p>守护可以保护自己或队友：对目标本轮的伤害降至五分之一并向上取整，不叠加。守护队友时，你自己不会同时受保护。</p><p>首领依次使用月刃、全体星潮、重击、回气。成功守护重击并存活，下一轮回气时攻击造成 20 伤害。半血后的预告更强。</p><p>每轮确认后不能修改；你和仍在战斗的队友都确认即结算，否则等待 30 秒。玩家先于首领行动，第 16 轮结束时首领仍存活则失败。双人有人倒地后，另一人可以继续，但不会降低首领数值。</p><p>尝试自己找出打法；失败后可从记录中查看原因，再挑战一次。</p></div></details>
<details class="recent"><summary>最近十次讨伐</summary><ul data-gcr="recent-list"></ul><button data-gcr="history-refresh">刷新记录</button></details><footer>BGM：nene — Boss Battle #9 [Metal] / Boss Battle 10 [Metal]（二阶段），CC0，本地版本。</footer>
</div>`; stage.append(root);
  const uid=Number(api.uid)||0, storageKey='gcr-pending-'+uid;
  let failures=0, pollTimer=null, blocked=false, historyRoom=null;
  const assetBase=new URL('source/plugin/gamecenter/games/raid/',new URL(stage.dataset.url,location.href));
  const $ = id => root.querySelector('[data-gcr="'+id+'"]');
  const names = ['月刃', '星潮', '蚀月重击', '回气'];
  const bossName = '蚀月魔女 · 幽月';
  const messages = {mode:'模式无效。', token:'页面凭证失效，请刷新。', actor:'这个席位已不能行动。',
    target:'目标已经失效，请重新选择。', heal:'恢复次数已用完，或目标仍是满血。', round:'本轮已结算，请根据新预告行动。',
    locked:'该席位已经确认，不能修改。', due:'本轮时间已到，正在更新。', generation:'已经开启新局，请查看最新状态。',
    ended:'本局已经结束。', request_conflict:'请求内容冲突，请刷新。', input:'输入无效。', internal:'暂时无法连接，请稍后重试。'};
  let state = null, generation = 0, token = '', offset = 0, busy = false, pending = null;
  let signature = '', selectionRound = '', choices = {}, lastSuccess = null;
  const feedback = new globalThis.RaidFeedback();
  const music = new globalThis.RaidMusic(musicButton,new URL('assets/battle.mp3?v=0.1.3',assetBase).href,new URL('assets/battle-phase2.mp3?v=0.1.3',assetBase).href);
  const effectTimers = new Set(), effectNodes = new Set(), effectHosts = new Set();
  const make = (tag, cls, text) => { const el = document.createElement(tag); if(cls) el.className = cls; if(text !== undefined) el.textContent = text; return el; };
  const slot = i => i === state?.seat ? '你' : '队友';
  const phaseArt=$('phase-art'); let phaseArtRequested=false;
  phaseArt.addEventListener('load',()=>root.querySelector('.boss-art').classList.add('phase-art-ready'));
  phaseArt.addEventListener('error',()=>root.querySelector('.boss-art').classList.remove('phase-art-ready'));
  const active = i => state && state.hp[i] > 0 && !state.left[i];
  function actionText(a, actor) {
    if(!a) return '无行动';
    return a.kind === 'attack' ? '攻击' : `${a.kind === 'guard' ? '守护' : '恢复'}${a.target === actor ? '自己' : slot(a.target)}`;
  }
  function notice(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
  function connection(text, error = false) { $('connection').textContent = error ? text : ''; $('connection').hidden = !error; $('connection').className = error ? 'connection error' : 'connection'; }
  function clearEffects() {
    for(const timer of effectTimers) clearTimeout(timer);
    effectTimers.clear();
    for(const node of effectNodes) node.remove();
    effectNodes.clear();
    for(const host of effectHosts) host.classList.remove('fx-attack','fx-hurt','fx-guard','fx-heal','fx-exposed','fx-phase','fx-win','fx-lose');
    effectHosts.clear();
  }
  function present(batch) {
    if(batch.summary) $('round-feedback').textContent = batch.summary;
    if(!batch.events.length || document.hidden) return;
    clearEffects(); feedback.play(batch.cues);
    // Reduced motion keeps the textual summary, life bars and static weakness cue.
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const positions = new Map();
    for(const event of batch.events) {
      const host = event.target === 'boss' ? $('boss-effects') : root.querySelector(`[data-actor="${event.target}"]`);
      if(!host) continue;
      const position=positions.get(host)||0; if(position>=3) continue;
      positions.set(host,position+1);
      const node=make('span',`fx-float fx-float-${event.kind} fx-position-${position}`,event.text);
      node.setAttribute('aria-hidden','true'); host.append(node); effectNodes.add(node);
      host.classList.add(`fx-${event.kind}`); effectHosts.add(host);
    }
    const timer=setTimeout(() => { effectTimers.delete(timer); clearEffects(); },1000);
    effectTimers.add(timer);
  }
  function soundButton() { $('sound').textContent=feedback.on?'音效 开':'音效 关'; $('sound').setAttribute('aria-pressed',String(feedback.on)); }
  function musicButton() {
    $('bgm').textContent=music.blocked?'BGM 未播放':music.interrupted && music.on?'BGM 已暂停':music.on?'BGM 开':'BGM 关';
    $('bgm').setAttribute('aria-pressed',String(music.on));
  }
  function successNotice(request, data) {
    const s = data.snapshot;
    const replay = data.replayed ? '重试已确认：' : '';

    const ended = s?.status !== 1;
    const progress = ended ? (s?.status === 2 ? '本局已结束，讨伐成功。' : '本局已结束，请查看结果。') : `第 ${s.round_no} 轮开始，请看新预告。`;
    if(request.op === 'create' || request.op === 'join') return replay + (s.status === 0 ? '邀请房间已创建，等待好友加入。' : ended ? progress : s.round_no === 1 ? '第 1 轮开始：先看预告再选行动。' : `该局已开始；${progress}`);
    if(request.op === 'act') {
      const confirmed = `${slot(request.actor)} 已确认：${actionText(request, request.actor)}（第 ${request.round} 轮）。`;
      if(ended) return replay + confirmed + progress;
      if(s.round_no > request.round) return replay + confirmed + `第 ${request.round} 轮已结算；${progress}`;
      const waiting = s.hp.map((hp,i) => hp > 0 && !s.left[i] && !s.intents[i] ? slot(i) : null).filter(Boolean);
      return replay + confirmed + (waiting.length ? `等待${waiting.join('、')}确认。` : '等待结算。');
    }
    if(request.op === 'cancel') return replay+'等待房间已取消。';
    if(request.op === 'retreat') return replay + (ended ? `${slot(request.actor)}撤退操作已确认。${progress}` :
      s.left[request.actor] ? `${slot(request.actor)}已离场，队友继续挑战。` : `${slot(request.actor)} 已确认撤退，将在本轮结束后离场。`);
    return replay + '操作已完成。';
  }
  function savePending() {
    try { if(pending) sessionStorage.setItem(storageKey, JSON.stringify(pending)); else sessionStorage.removeItem(storageKey); } catch (_) { /* Private browsing can disable storage; in-memory retry still works. */ }
  }
  function controls() {
    const disabled=busy || !!pending || !uid || blocked;
    const occupied=state && state.status < 2 && state.seat >= 0 && !state.left[state.seat];
    for(const id of ['solo','duo']) $(id).disabled=disabled;
    $('join').disabled=disabled || occupied;
    $('current').disabled=busy || !uid;
    $('retry').disabled=busy || !pending || !uid || blocked;
    $('retry-box').hidden=!pending;
    $('cancel').hidden=!state || state.status!==0 || state.seat!==0;
    $('cancel').disabled=disabled;
    $('history-refresh').disabled=disabled; $('reopen').disabled=disabled || occupied;
    root.querySelectorAll('[data-actor]').forEach(el=>{
      const i=Number(el.dataset.actor);
      const locked=!state || i!==state.seat || !active(i) || state.status!==1 || state.leaving[i] || !!state.intents[i];
      el.querySelectorAll('button,select').forEach(control=>{control.disabled=disabled || locked || control.dataset.invalid==='true';});
      const retreat=el.querySelector('.retreat');
      if(retreat) retreat.disabled=disabled || state.status!==1 || state.left[i] || state.leaving[i];
      const confirm=el.querySelector('.confirm');
      if(confirm) confirm.disabled=disabled || locked || !choices[i] || confirm.dataset.invalid==='true';
    });
  }
  function clock() {
    if(!state) return;
    const seconds = Math.max(0, Math.ceil((state.deadline_ms - (Date.now() + offset)) / 1000));
    $('timer').textContent = state.status === 1 ? `${seconds} 秒` : '已结束';
    if(state.status===0) $('room-note').textContent=`等待好友加入 · 还剩 ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }
  function apply(data) {
    if(!data || ![0,1].includes(data.ok) || !Number.isFinite(data.server_ms)) throw new Error('invalid_response');
    if(!data.ok && data.snapshot===null) return;
    if(data.snapshot && (!Array.isArray(data.snapshot.hp) || typeof data.snapshot.room!=='string')) throw new Error('invalid_snapshot');
    const batch=feedback.observe(data.snapshot,data.snapshot?.room || 'empty');
    token='forum'; generation=data.snapshot?.room || ''; offset=data.server_ms-Date.now();
    state=data.snapshot;
    music.setActive(state?.status===1,state?.preview?.phase===2?2:1);
    const next = state ? `${generation}:${state.version}` : 'empty';
    if(next !== signature) {
      clearEffects();
      signature = next;
      const roundKey = state ? `${generation}:${state.round_no}` : '';
      if(roundKey !== selectionRound) { choices = {}; selectionRound = roundKey; }
      render();
    }
    present(batch);
    clock(); controls();
  }
  function schedule() {
    clearTimeout(pollTimer);
    if(document.hidden || !uid || blocked || historyRoom || (state && state.status>=2)) return;
    const delay=Math.min(15000,2000*2**Math.min(failures,3))+Math.floor(Math.random()*251);
    pollTimer=setTimeout(sync,delay);
  }
  async function exchange(payload={op:'current'}) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),10000);
    const {op,actor,next_mode,...args}=payload; // Seat is derived exclusively from the authenticated UID.
    const body=new FormData();
    for(const [k,v] of Object.entries({...args,action:op,client_version:'raid-client-1',formhash:stage.dataset.formhash})) body.append(k,String(v));
    try {
      const url=new URL(stage.dataset.url,location.href); url.searchParams.set('game','raid'); url.searchParams.set('op','raid'); url.searchParams.set('inajax','1');
      const response=await fetch(url,{method:'POST',body,credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(!response.ok) throw new Error('HTTP '+response.status);
      const data=await response.json();
      if(![0,1].includes(data.ok)) throw new Error('invalid_response');
      return data;
    } finally {clearTimeout(timer);}
  }
  async function sync() {
    if(busy || document.hidden || !uid || blocked) return;
    const first=!token; busy=true; clearTimeout(pollTimer); controls();
    try {
      const data=await exchange(historyRoom?{op:'state',room:historyRoom}:{op:'current'});
      if(data.ok) {apply(data);failures=0;connection('已连接论坛 · 状态已同步。');if(first) notice(state?'已恢复讨伐，请查看预告及已确认行动。':'选择一种模式开始挑战。');}
      else {if(data.snapshot)apply(data);if(['login','permission','client'].includes(data.code))blocked=true;connection(data.msg||'无法同步。',true);}
    } catch (_) {failures++;connection('连接中断，保留上次状态；正在重试。',true);}
    finally {busy=false;controls();schedule();}
  }
  async function send(args,retry=false) {
    if(busy || (!retry && pending) || !uid || blocked || document.hidden) return;
    feedback.unlock();music.gesture();clearTimeout(pollTimer);
    if(!retry) {const bytes=crypto.getRandomValues(new Uint8Array(16));pending={...args,request_id:Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('')};savePending();}
    busy=true;controls();notice('正在确认…');
    let nextMode=null;
    try {
      const request=pending,data=await exchange(request);
      if(data.retryable) throw new Error('retryable');
      if(data.snapshot || data.ok) apply(data);
      pending=null;savePending();failures=0;
      if(['login','permission','client'].includes(data.code)) blocked=true;
      notice(data.ok?successNotice(request,data):(data.msg||messages[data.code]||'操作未被接受。'),!data.ok);
      connection('已连接论坛。');
      if(data.replayed) historyRoom=null;
      if(request.op==='cancel' && ['solo','duo'].includes(request.next_mode) && data.ok && state?.room===request.room && state.status===4) nextMode=request.next_mode;
    } catch (_) {failures++;connection('操作结果尚未确认，请重试同一操作。',true);notice('正在自动更新；重试同一操作不会重复扣次数。',true);}
    finally {busy=false;controls();schedule();}
    if(nextMode) return send({op:'create',mode:nextMode});
  }
  function renderPlayers() {
    const oldFocus = document.activeElement?.dataset.focus;
    $('players').replaceChildren();
    state.hp.forEach((hp, i) => {
      const card = make('article', 'player'); card.dataset.actor = i;
      const header = make('div', 'player-head'); const avatar=make('span','avatar',i===0?'Ⅰ':'Ⅱ');
      if(state.players[i]?.avatar) {const img=make('img');img.alt='';img.src=state.players[i].avatar;img.addEventListener('error',()=>img.remove(),{once:true});avatar.append(img);}
      header.append(avatar);
      const label = make('div'); label.append(make('h3', '', slot(i)), make('small', '', `${hp} / 40 生命 · 恢复余 ${state.pots[i]} 次`)); header.append(label); card.append(header);
      const bar = make('progress'); bar.max = 40; bar.value = hp; bar.setAttribute('aria-label',`${slot(i)}生命`); card.append(bar);
      const locked = state.intents[i];
      let status = state.left[i] ? '已离场，不能返回本局。' : hp === 0 ? '已倒地，队友仍可继续。' :
        locked ? `已确认：${actionText(locked, i)}${state.leaving[i] ? ' · 本轮结束后离场' : ''}` : '还没选。选择行动并确认后就不能改。';
      if(state.status !== 1) status = state.left[i] ? '已离场' : hp > 0 ? '本局结束 · 生还' : '本局结束 · 倒地';
      card.append(make('p', 'intent', status));
      if(i!==state.seat) {$('players').append(card);return;}
      const row = make('div', 'choices'); row.setAttribute('role','group'); row.setAttribute('aria-label',`${slot(i)}行动`);
      for(const [kind, text, detail] of [['attack','攻击',state.exposed && state.preview.kind === 3 ? '造成 20 伤害' : '造成 10 伤害'], ['guard','守护','减伤至 1/5'], ['heal','恢复','治疗 28 生命']]) {
        const btn = make('button', '', text); btn.append(make('small', '', detail)); btn.dataset.kind = kind; btn.dataset.focus = `${i}-${kind}`;
        btn.setAttribute('aria-pressed', String((choices[i]?.kind || locked?.kind) === kind));
        btn.dataset.invalid = String(kind === 'heal' && (state.pots[i] === 0 || !state.hp.some((v,j) => active(j) && v < 40)));
        btn.addEventListener('click', () => {
          const target = kind === 'attack' ? -1 : kind === 'heal' ? state.hp.findIndex((v,j) => active(j) && v < 40) : i;
          choices[i] = {kind, target}; renderPlayers(); controls();
        }); row.append(btn);
      }
      card.append(row);
      const choice = locked || choices[i];
      const targetRow = make('label', 'target-row'); targetRow.append(make('span', '', '行动目标'));
      const select = make('select'); select.setAttribute('aria-label',`${slot(i)}行动目标`); select.dataset.focus = `${i}-target`;
      if(!choice || choice.kind === 'attack') { const option = make('option', '', bossName); option.value = -1; select.append(option); select.dataset.invalid = 'true'; }
      else {
        state.hp.forEach((v,j) => { if(!active(j)) return; const option = make('option','',j === i ? '自己' : slot(j)); option.value = j;
          option.disabled = choice.kind === 'heal' && v === 40; select.append(option); });
        select.value = String(choice.target);
        select.addEventListener('change', () => { choices[i].target = Number(select.value); renderPlayers(); controls(); });
      }
      targetRow.append(select); card.append(targetRow);
      if(choice?.kind === 'heal') {
        const target = choice.target;
        const duplicate = state.intents.some((a,j) => j !== i && a?.kind === 'heal' && a.target === target);
        card.append(make('small', '', duplicate ? '队友也在恢复此目标：两人都会消耗次数，溢出不保留。' : '恢复次数在结算时扣除；治疗不超过 40 生命。'));
      }
      const confirm = make('button', 'confirm primary', choice ? `确认${actionText(choice, i)}` : '先选择行动'); confirm.dataset.focus = `${i}-confirm`;
      const invalid = choice?.kind === 'heal' && (!active(choice.target) || state.hp[choice.target] === 40 || state.pots[i] === 0);
      confirm.dataset.invalid = String(!!invalid);
      confirm.addEventListener('click', () => { if(choices[i]) send({op:'act', room:state.room, actor:i, round:state.round_no, ...choices[i]}); }); card.append(confirm);
      const leave = make('button', 'retreat quiet', '撤退');
      leave.addEventListener('click', () => { if(window.confirm(state.mode === 'solo' ? '撤退将结束本局并记为失败，确定吗？' : '本回合结束后离场，队友将继续挑战。确定撤退吗？')) send({op:'retreat', room:state.room, actor:i}); }); card.append(leave);
      $('players').append(card);
    });
    if(oldFocus) root.querySelector(`[data-focus="${oldFocus}"]`)?.focus({preventScroll:true});
  }
  function render() {
    $('empty').hidden=!!state; $('battle').hidden=!state || state.status===0 || state.status===4;
    $('room-panel').hidden=!state;
    if(state) {const url=new URL(stage.dataset.url,location.href);url.searchParams.set('mod','play');url.searchParams.set('game','raid');url.searchParams.set('room',state.room);$('invite').value=url.href; $('invite').type='hidden';
      $('copy').hidden=state.status!==0; $('copy-code').hidden=state.status!==0; $('room-code').value=state.room; $('room-code').parentElement.hidden=state.status!==0; $('invite-help').hidden=state.status!==0; $('reopen').hidden=state.status!==4; $('current').hidden=!historyRoom;
      $('room-note').textContent=state.status===4?(state.reason==='expired'?'邀请已过期，重新建房':'等待房间已取消。'):`房间 ${state.room}`;}
    if(state && (state.status===0 || state.status===4)) return;
    if(!state) return;
    if(!state.history.length) $('round-feedback').textContent='尚无已结算回合。';
    const idle=globalThis.RaidFeedback.idleSlots(state);
    $('idle-hint').hidden=!idle.length;
    $('idle-hint').textContent=idle.length ? idle.map(({actor,count})=>`${slot(actor)} 连续 ${count} 轮没选`).join('；')+'，已自动守护自己。可以继续等待队友，也可以撤退（本轮结束后离场）。' : '';
    root.querySelector('.turn-help').textContent=state.mode==='solo'?'每轮有 30 秒选择行动，确认后立即结算。没选时会自动守护自己。':'每轮有 30 秒选择行动；你和队友都确认后立即结算。没选时会自动守护自己。';
    if(!phaseArtRequested && state.preview?.phase===2) {phaseArtRequested=true; phaseArt.src=new URL('assets/boss-phase2.webp',assetBase).href;}
    const p = state.preview;
    $('phase').textContent = `第 ${p.phase === 1 ? '一' : '二'} 阶段`;
    $('round').textContent = `回合 ${state.round_no} / 16`;
    $('mode').textContent = state.mode === 'solo' ? '单人挑战' : '双人 · 月蚀加护 +10';
    $('boss-hp').textContent = `${state.boss} / ${state.boss_max_hp} 生命`;
    $('boss-bar').max = state.boss_max_hp; $('boss-bar').value = state.boss;
    $('preview-name').textContent = `幽月 · ${names[p.kind]}`;
    $('preview-text').textContent = p.kind === 3 ? '幽月正在回气，本轮不会攻击。' :
      `幽月将攻击${p.targets.map(slot).join('、')}：${p.damage} 伤害；守护后为 ${Math.ceil(p.damage/5)}。`;
    $('weakness').textContent = state.status !== 1 ? '' : state.exposed && p.kind === 3 ? '破绽！本轮攻击造成 20 伤害。' : p.kind === 2 ? '成功守护重击并存活，下轮将出现破绽。' : '';
    root.querySelector('.arena').className='arena'+(state.status===1 && state.exposed && p.kind===3?' has-weakness':'')+(p.phase===2?' phase-two':'');
    $('phase-banner').hidden=p.phase!==2;
    $('boss-line').textContent = state.status === 2 ? (state.mode === 'solo' ? '这一次，算你赢了。' : '这一次，算你们赢了。') :
      state.status === 3 ? '胜败乃兵家常事，少侠请重新来过' :
      state.exposed && p.kind === 3 ? '竟然看穿了我的破绽……' :
      p.phase === 1 ? (state.mode === 'solo' ? '凡人……你确定要独自挑战我吗？' : '人数对于我来说，并没有区别') :
      state.mode === 'solo' ? '你惹怒我了！' : '你们这群蝼蚁！';
    $('result').hidden = state.status === 1;
    if(state.status !== 1) {
      const reasons = {defeated:`${bossName}已被击败。`, knockout:'所有留队成员倒地。', round_limit:'16 回合已用尽，幽月仍然存活。', retreated:'已无成员继续挑战。'};
      $('result-title').textContent = state.status === 2 ? '讨伐成功' : '挑战结束';
      const alive = state.hp.filter((v,i) => v > 0 && !state.left[i]).length;
      $('result-text').textContent = `${reasons[state.reason] || ''} 共 ${state.history.length} 回合，生还 ${alive} 人。可以查看记录，再挑战一次。`;
    }
    renderPlayers();
    $('log-count').textContent = `${state.history.length} 轮`;
    $('logs').replaceChildren();
    [...state.history].reverse().forEach((row,index) => {
      const li = make('li');
      const previousBoss=index+1<state.history.length ? state.history[state.history.length-index-2].boss : state.boss_max_hp;
      li.append(make('strong','',`第 ${row.round} 轮 · ${names[row.preview.kind]} · 幽月 −${Math.max(0,previousBoss-row.boss)}`));
      li.append(make('p','',row.actions.map((a,i) => `${slot(i)} → ${actionText(a,i)}${row.defaults.includes(i) ? '（超时）' : ''}`).join(' ｜ ')+(row.exposed?' ｜ 破绽出现':'')));
      $('logs').append(li);
    });
  }
  function startMode(mode) {
    if(busy || pending || !uid || blocked || document.hidden) return;
    const occupied=state && state.status<2 && state.seat>=0 && !state.left[state.seat];
    if(occupied) {
      if(state.status===0 && state.seat===0 && state.players.length===1) {
        historyRoom=null;
        // Local continuation is persisted with the cancel receipt but never sent as API input.
        return send({op:'cancel',room:state.room,expected_version:state.version,next_mode:mode});
      }
      if(window.confirm('你有一场进行中的讨伐，返回当前讨伐？')) {historyRoom=null;return sync();}
      return;
    }
    historyRoom=null;return send({op:'create',mode});
  }
  for(const mode of ['solo','duo']) $(mode).addEventListener('click',()=>startMode(mode));
  root.querySelector('.join-form').addEventListener('submit',event=>{
    event.preventDefault();let room=$('join-code').value.trim();
    try {if(/^https?:/i.test(room))room=new URL(room).searchParams.get('room')||'';}catch(_){}
    room=room.toUpperCase();if(!/^[A-F0-9]{12}$/.test(room)){notice('请输入正确的 12 位房间号。',true);return;}
    historyRoom=null;send({op:'join',room});
  });
  $('reopen').addEventListener('click',()=>startMode('duo'));
  $('current').addEventListener('click',()=>{historyRoom=null;sync();});
  $('cancel').addEventListener('click',()=>{if(state?.status===0)send({op:'cancel',room:state.room,expected_version:state.version});});
  async function copyInvite(id,label) {
    try { await navigator.clipboard.writeText($(id).value); notice(label+'已复制。'); }
    catch (_) {
      // Clipboard can be unavailable over HTTP. Show selectable text only as a fallback.
      const field=$(id); field.type='text'; field.hidden=false; field.focus(); field.select();
      notice('请复制已选中的'+label+'。');
    }
  }
  $('copy').addEventListener('click',()=>copyInvite('invite','邀请链接'));
  $('copy-code').addEventListener('click',()=>copyInvite('room-code','房间号'));
  $('sound').addEventListener('click',()=>{feedback.toggle();soundButton();});
  $('bgm').addEventListener('click',()=>music.toggle());soundButton();musicButton();
  $('retry').addEventListener('click',()=>send(null,true));
  $('history-refresh').addEventListener('click',async()=>{
    if(busy||pending||blocked)return;busy=true;clearTimeout(pollTimer);controls();
    try {const data=await exchange({op:'history'});if(!data.ok){notice(data.msg,true);return;}$('recent-list').replaceChildren();
      for(const row of data.history){const li=make('li'),btn=make('button','quiet',`${row.result.mode==='solo'?'单人':'双人'} · ${row.result.status===2?'胜利':row.result.status===4?'取消/过期':'失败'} · ${row.result.rounds} 回合`);
        btn.addEventListener('click',()=>{historyRoom=row.room;sync();});li.append(btn);$('recent-list').append(li);}
      if(!data.history.length)$('recent-list').append(make('li','','还没有已结束的讨伐。'));
    }catch(_){notice('读取记录失败，请稍后重试。',true);}finally{busy=false;controls();schedule();}
  });
  document.addEventListener('visibilitychange',()=>{clearTimeout(pollTimer);feedback.pause();clearEffects();music.sync();if(!document.hidden)sync();});
  window.addEventListener('pagehide',()=>{clearTimeout(pollTimer);feedback.pause();clearEffects();music.pause();});
  setInterval(()=>{if(!document.hidden)clock();},250);
  try {const saved=JSON.parse(sessionStorage.getItem(storageKey));if(saved && /^[a-f0-9]{32}$/.test(saved.request_id)){pending=saved;notice('有一项结果未确认，请重试上次操作。',true);}}catch(_){}
  try {$('join-code').value=new URL(location.href).searchParams.get('room')||'';}catch(_){}
  render();controls();if(uid)sync();else notice('登录论坛后即可挑战；下方规则可以直接阅读。');
  });
})();

