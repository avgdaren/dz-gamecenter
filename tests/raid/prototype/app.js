/* 作者：GPT / Codex；原插件 (C) 2026 Carinoasd。PHP 权威结算，原生 JS 显示与输入。 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const names = ['月刃', '星潮', '蚀月重击', '回气'];
  const bossName = '蚀月魔女 · 幽月';
  const messages = {mode:'模式无效。', token:'页面凭证失效，请刷新。', actor:'这个席位已不能行动。',
    target:'目标已经失效，请重新选择。', heal:'恢复次数已用完，或目标仍是满血。', round:'本轮已结算，请根据新预告行动。',
    locked:'该席位已经确认，不能修改。', due:'已到截止时间，请同步。', generation:'已经开启新局，请查看最新状态。',
    ended:'本局已经结束。', request_conflict:'请求内容冲突，请刷新。', input:'输入无效。', internal:'样稿服务异常。'};
  let state = null, generation = 0, token = '', offset = 0, busy = false, pending = null;
  let signature = '', selectionRound = '', choices = {}, lastSuccess = null;
  const feedback = new globalThis.RaidFeedback();
  const music = new globalThis.RaidMusic(musicButton);
  const effectTimers = new Set(), effectNodes = new Set(), effectHosts = new Set();
  const make = (tag, cls, text) => { const el = document.createElement(tag); if(cls) el.className = cls; if(text !== undefined) el.textContent = text; return el; };
  const slot = i => `席位 ${i + 1}`;
  const active = i => state && state.hp[i] > 0 && !state.left[i];
  function actionText(a, actor) {
    if(!a) return '无行动';
    return a.kind === 'attack' ? '攻击' : `${a.kind === 'guard' ? '守护' : '恢复'}${a.target === actor ? '自己' : slot(a.target)}`;
  }
  function notice(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
  function connection(text, error = false) { $('connection').textContent = text; $('connection').className = error ? 'connection error' : 'connection'; }
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
      const host = event.target === 'boss' ? document.querySelector('.boss-info') : document.querySelector(`[data-actor="${event.target}"]`);
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
    const replay = data.code === 'replayed' ? '重试已确认：' : '';
    if(data.receipt && data.receipt.generation !== data.generation) return '上次操作已确认；当前显示另一局，请查看当前预告。';
    const ended = s?.status !== 1;
    const progress = ended ? (s?.status === 2 ? '本局已结束，讨伐成功。' : '本局已结束，请查看结果。') : `第 ${s.round_no} 轮开始，请看新预告。`;
    if(request.op === 'start') return replay + (ended ? progress : s.round_no === 1 ? '第 1 轮开始：先看预告再选行动。' : `该局已开始；${progress}`);
    if(request.op === 'act') {
      const confirmed = `${slot(request.actor)}已确认：${actionText(request, request.actor)}（第 ${request.round} 轮）。`;
      if(ended) return replay + confirmed + progress;
      if(s.round_no > request.round) return replay + confirmed + `第 ${request.round} 轮已结算；${progress}`;
      const waiting = s.hp.map((hp,i) => hp > 0 && !s.left[i] && !s.intents[i] ? slot(i) : null).filter(Boolean);
      return replay + confirmed + (waiting.length ? `等待${waiting.join('、')}确认。` : '等待结算。');
    }
    if(request.op === 'advance') return replay + (request.ms === 30000 ? '已跳到本轮截止。' : '已模拟离线至本局回合上限，并按原截止时间追算。') + progress;
    if(request.op === 'retreat') return replay + (ended ? `${slot(request.actor)}撤退操作已确认。${progress}` :
      s.left[request.actor] ? `${slot(request.actor)}已离场，队友继续挑战。` : `${slot(request.actor)}已确认撤退，将在本轮结束后离场。`);
    return replay + '操作已完成。';
  }
  function savePending() {
    try { if(pending) sessionStorage.setItem('raid-p1-pending', JSON.stringify(pending)); else sessionStorage.removeItem('raid-p1-pending'); } catch (_) { /* Private browsing can disable storage; in-memory retry still works. */ }
  }
  function controls() {
    const blocked = busy || !!pending || !token;
    for(const id of ['solo', 'duo']) $(id).disabled = blocked;
    $('sync').disabled = busy || (!!pending && !!token);
    $('retry').disabled = busy || !token;
    $('retry-box').hidden = !pending || busy;
    for(const id of ['advance', 'offline']) $(id).disabled = blocked || !state || state.status !== 1;
    document.querySelectorAll('[data-actor]').forEach(el => {
      const i = Number(el.dataset.actor);
      const locked = !active(i) || state.status !== 1 || !!state.intents[i];
      el.querySelectorAll('button,select').forEach(control => {
        control.disabled = blocked || locked || control.dataset.invalid === 'true';
      });
      const retreat = el.querySelector('.retreat');
      retreat.disabled = blocked || state.status !== 1 || state.left[i] || state.leaving[i];
      const confirm = el.querySelector('.confirm');
      confirm.disabled = blocked || locked || !choices[i] || confirm.dataset.invalid === 'true';
    });
  }
  function clock() {
    if(!state) return;
    const seconds = Math.max(0, Math.ceil((state.deadline_ms - (Date.now() + offset)) / 1000));
    $('timer').textContent = state.status === 1 ? `${seconds} 秒` : '已结束';
  }
  function apply(data) {
    if(!data || typeof data.ok !== 'boolean' || typeof data.token !== 'string') throw new Error('invalid_response');
    const batch=feedback.observe(data.snapshot,data.generation);
    token = data.token; generation = data.generation; offset = data.server_ms - Date.now();
    state = data.snapshot;
    music.setActive(state?.status===1);
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
  async function exchange(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api', payload ? {method:'POST', credentials:'same-origin', signal:controller.signal,
        headers:{'Content-Type':'application/json'}, body:JSON.stringify({...payload, token})}
        : {cache:'no-store', credentials:'same-origin', signal:controller.signal});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function sync() {
    if(busy || (pending && token)) return;
    const firstConnection = !token, previous = signature;
    busy = true; controls();
    try {
      const data = await exchange(); apply(data); connection('已连接本机样稿 · 状态已同步。');
      if(firstConnection) notice(state ? '已恢复本局，请查看当前预告与已确认行动。' : '选择一种模式开始挑战。');
      else if(lastSuccess && previous !== signature) {
        if(lastSuccess.generation === data.generation) notice(successNotice(lastSuccess.request, data));
        else { lastSuccess = null; notice('已切换到另一局，请查看当前预告与已确认行动。'); }
      }
    } catch (_) {
      connection('连接失败，可点击“同步状态”重试。', true);
      if(firstConnection) notice('连接失败，可点击“同步状态”重试。', true);
    }
    finally { busy = false; controls(); }
  }
  async function send(args, retry = false) {
    if(busy || (!retry && pending) || !token) return;
    feedback.unlock(); // Called in the original click gesture, before the HTTP await.
    music.gesture();
    if(!retry) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      pending = {...args, generation, request_id:Array.from(bytes, n => n.toString(16).padStart(2,'0')).join('')};
      savePending();
    }
    busy = true; controls(); notice('正在确认…'); connection('正在提交操作…');
    try {
      const request = pending;
      const data = await exchange(request);
      apply(data);
      pending = null; savePending();
      lastSuccess = data.ok ? {request, generation:data.generation} : null;
      connection('已连接本机样稿。');
      notice(data.ok ? successNotice(request, data) : (messages[data.code] || '操作未被接受，请查看最新状态。'), !data.ok);
    } catch (_) { connection('连接中断，请重试上次操作。', true); notice('连接中断，操作结果尚未确认。请重试上次操作。', true); }
    finally { busy = false; controls(); }
  }
  function renderPlayers() {
    const oldFocus = document.activeElement?.dataset.focus;
    $('players').replaceChildren();
    state.hp.forEach((hp, i) => {
      const card = make('article', 'player'); card.dataset.actor = i;
      const header = make('div', 'player-head'); header.append(make('span', 'avatar', i === 0 ? 'Ⅰ' : 'Ⅱ'));
      const label = make('div'); label.append(make('h3', '', slot(i)), make('small', '', `${hp} / 40 生命 · 恢复余 ${state.pots[i]} 次`)); header.append(label); card.append(header);
      const bar = make('progress'); bar.max = 40; bar.value = hp; bar.setAttribute('aria-label',`${slot(i)}生命`); card.append(bar);
      const locked = state.intents[i];
      let status = state.left[i] ? '已离场，不能返回本局。' : hp === 0 ? '已倒地，队友仍可继续。' :
        locked ? `已确认：${actionText(locked, i)}${state.leaving[i] ? ' · 本轮结束后离场' : ''}` : '选择行动后再确认，确认即锁定。';
      if(state.status !== 1) status = state.left[i] ? '已离场' : hp > 0 ? '本局结束 · 生还' : '本局结束 · 倒地';
      card.append(make('p', 'intent', status));
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
      confirm.addEventListener('click', () => { if(choices[i]) send({op:'act', actor:i, round:state.round_no, ...choices[i]}); }); card.append(confirm);
      const leave = make('button', 'retreat quiet', '撤退');
      leave.addEventListener('click', () => { if(window.confirm(state.mode === 'solo' ? '撤退将结束本局并记为失败，确定吗？' : '本回合结束后离场，队友将继续挑战。确定撤退吗？')) send({op:'retreat', actor:i}); }); card.append(leave);
      $('players').append(card);
    });
    if(oldFocus) document.querySelector(`[data-focus="${oldFocus}"]`)?.focus({preventScroll:true});
  }
  function render() {
    $('empty').hidden = !!state; $('battle').hidden = !state;
    if(!state) return;
    if(!state.history.length) $('round-feedback').textContent='尚无已结算回合。';
    const idle=globalThis.RaidFeedback.idleSlots(state);
    $('idle-hint').hidden=!idle.length;
    $('idle-hint').textContent=idle.length ? idle.map(({actor,count})=>`${slot(actor)}连续 ${count} 轮未确认`).join('；')+'，已按默认守护结算。这不代表已离线；可以继续等待，或由自己的席位撤退（本轮结束后离场）。不会自动转为单人。' : '';
    const p = state.preview;
    $('phase').textContent = `第 ${p.phase === 1 ? '一' : '二'} 阶段`;
    $('round').textContent = `回合 ${state.round_no} / ${state.round_limit??16}`;
    $('mode').textContent = state.mode === 'solo' ? '单人挑战' : '双人 · 月蚀加护 +10';
    $('boss-hp').textContent = `${state.boss} / ${state.boss_max_hp} 生命`;
    $('boss-bar').max = state.boss_max_hp; $('boss-bar').value = state.boss;
    $('preview-name').textContent = `幽月 · ${names[p.kind]}`;
    $('preview-text').textContent = p.kind === 3 ? '幽月正在回气，本轮不会攻击。' :
      `幽月将攻击${p.targets.map(slot).join('、')}：${p.damage} 伤害；守护后为 ${Math.ceil(p.damage/5)}。`;
    $('weakness').textContent = state.status !== 1 ? '' : state.exposed && p.kind === 3 ? '破绽！本轮攻击造成 20 伤害。' : p.kind === 2 ? '成功守护重击并存活，下轮将出现破绽。' : '';
    document.querySelector('.arena').className=state.status===1 && state.exposed && p.kind===3?'arena has-weakness':'arena';
    $('boss-line').textContent = state.status === 2 ? '这一次，算你们赢。下次可没这么轻松。' :
      state.status === 3 ? '别急着认输。记住这轮月光，再来一次。' :
      p.phase === 1 ? '你选择一人面对魔女，还是和伙伴一起挑战魔女？' :
      state.mode === 'solo' ? '你惹怒我了！' : '你们这群蝼蚁！';
    $('result').hidden = state.status === 1;
    if(state.status !== 1) {
      const reasons = {defeated:`${bossName}已被击败。`, knockout:'所有留队成员倒地。', round_limit:`${state.round_limit??16} 回合已用尽，幽月仍然存活。`, retreated:'已无成员继续挑战。'};
      $('result-title').textContent = state.status === 2 ? '讨伐成功' : '挑战结束';
      const alive = state.hp.filter((v,i) => v > 0 && !state.left[i]).length;
      $('result-text').textContent = `${reasons[state.reason] || ''} 共 ${state.history.length} 回合，生还 ${alive} 人。可以查看记录，再挑战一次。`;
    }
    renderPlayers();
    $('log-count').textContent = `${state.history.length} 轮`;
    $('logs').replaceChildren();
    [...state.history].reverse().forEach(row => {
      const li = make('li');
      li.append(make('strong','',`第 ${row.round} 轮 · 幽月 · ${names[row.preview.kind]} · 阶段 ${row.preview.phase}`));
      li.append(make('p','',row.actions.map((a,i) => `${slot(i)}：${actionText(a,i)}${row.defaults.includes(i) ? '（超时默认）' : ''}`).join('；')));
      li.append(make('p','',`幽月 ${row.boss} 生命 · ${row.hp.map((v,i) => `${slot(i)} ${v} 生命 / 恢复余 ${row.pots[i]}`).join('；')}${row.exposed ? ' · 下轮破绽' : ''}`));
      $('logs').append(li);
    });
  }
  for(const mode of ['solo','duo']) $(mode).addEventListener('click', () => {
    if(!state || state.status !== 1 || window.confirm('当前战斗尚未结束，确定重开吗？本样稿不会保存上一局。')) send({op:'start', mode});
  });
  $('sync').addEventListener('click',sync);
  $('sound').addEventListener('click',() => { feedback.toggle(); soundButton(); });
  $('bgm').addEventListener('click',() => music.toggle());
  soundButton();
  musicButton();
  $('retry').addEventListener('click',() => send(null,true));
  $('advance').addEventListener('click',() => send({op:'advance',ms:30000}));
  $('offline').addEventListener('click',() => { if(window.confirm('模拟离线至本局回合上限，会自动追算直到本局结束。确定吗？')) send({op:'advance',ms:(state?.round_limit??16)*30000}); });
  $('theme').addEventListener('click',() => { const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; document.documentElement.dataset.theme = dark ? 'light' : 'dark'; });
  document.addEventListener('visibilitychange',() => { feedback.pause(); clearEffects(); music.sync(); if(!document.hidden) sync(); });
  window.addEventListener('pagehide',() => { feedback.pause(); clearEffects(); music.pause(); });
  setInterval(() => { if(!document.hidden) sync(); },2000);
  setInterval(clock,250);
  (async () => {
    await sync();
    try { const saved = JSON.parse(sessionStorage.getItem('raid-p1-pending')); if(saved && typeof saved.request_id === 'string') { pending = saved; notice('有一项结果未确认，请重试上次操作。',true); controls(); } } catch (_) { /* Ignore unavailable storage or malformed local data. */ }
  })();
})();

