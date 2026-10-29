/* GameCenter Tetris v2.0.0. Rule 2 must stay identical to verify.php. */
(function () {
  'use strict';
  var MIKU_SPRITE_URL=typeof document!=='undefined'&&document.currentScript?new URL('miku-forms.png',document.currentScript.src).href:'';
  var W = 14, H = 24, MAX = 36000, MS = 50;
  var SHAPES = [
    [[0,1],[1,1],[2,1],[3,1]], [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[0,1],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]],
    [[2,0],[0,1],[1,1],[2,1]]
  ];
  var SKINS = [
    {id:'classic',name:'经典深蓝',style:'classic',board:'#0d1729',grid:'#4a6280',arena:'#0d1729',edge:'#1f2d44',pocket:'#162238',pocketEdge:'#35435b',ink:'#bfcee4',muted:'#8fa3c2',frame:'#607996',halo:'#17243a',cover:'rgba(13,23,41,.84)',title:'#f1f5ff',accent:'#2f7ae5',buttonInk:'#ffffff',ghost:'#89a5c8',colors:['#56d7ef','#ffdb71','#b197fc','#6bdfa6','#ff7f97','#77a6ff','#ffb86b']},
    {id:'neon',name:'霓虹街机',style:'neon',board:'#0b0b20',grid:'#343455',arena:'#111027',edge:'#45366e',pocket:'#1c1735',pocketEdge:'#4c3a73',ink:'#e3d8ff',muted:'#b29acb',frame:'#8662ca',halo:'#251d43',cover:'rgba(11,11,32,.80)',title:'#f1eaff',accent:'#9d65f5',buttonInk:'#ffffff',ghost:'#b0a4ed',colors:['#00e6ef','#f3e94e','#bc70ff','#50f5b3','#ff5fa9','#688cff','#ffac58']},
    {id:'lcd',name:'复古液晶',style:'lcd',board:'#b1bda0',grid:'#859573',arena:'#a7b394',edge:'#7a8d65',pocket:'#bac4a9',pocketEdge:'#8d9d79',ink:'#334a32',muted:'#536747',frame:'#526b44',halo:'#8e9f7d',cover:'rgba(177,189,160,.82)',title:'#2e422b',accent:'#536d42',buttonInk:'#f3f7eb',ghost:'#3e5734',colors:['#30492f','#526839','#3b5430','#435f42','#5a6640','#365148','#657045']},
    {id:'candy',name:'糖果浅色',style:'candy',board:'#f7fafc',grid:'#bfd0e0',arena:'#eef4f8',edge:'#cedce8',pocket:'#ffffff',pocketEdge:'#cedce8',ink:'#48627c',muted:'#71869c',frame:'#93aec6',halo:'#dde8f1',cover:'rgba(247,250,252,.84)',title:'#35536e',accent:'#6a8fcd',buttonInk:'#ffffff',ghost:'#708ca6',colors:['#4ebed0','#e6b54d','#a68bd4','#6abc98','#e58b9f','#739fd8','#e59968']},
    {id:'gold',name:'曜石金',style:'gold',board:'#1c1b18',grid:'#59503a',arena:'#22211c',edge:'#625337',pocket:'#2c291f',pocketEdge:'#685b3d',ink:'#e2d5af',muted:'#b2a27b',frame:'#b69a55',halo:'#393224',cover:'rgba(28,27,24,.84)',title:'#f0dfae',accent:'#b39753',buttonInk:'#201c12',ghost:'#d0b775',colors:['#d7bd72','#efda97','#ba9855','#b7ba88','#b49b75','#e2c898','#bb8744']}
  ];
  SKINS = [{"id":"miku","name":"初音未来","style":"miku","board":"#101e2b","grid":"#345b69","arena":"#182b37","edge":"#3c6b73","pocket":"#203746","pocketEdge":"#47747e","ink":"#d7f6ef","muted":"#8fb9c1","frame":"#60d3c9","halo":"#264c56","cover":"rgba(16,30,43,.82)","title":"#abfff0","accent":"#39bdae","buttonInk":"#092d31","ghost":"#98e9db","colors":["#50cdbd","#e899b6","#96c3ed","#32b4af","#d981a8","#80aade","#6bdbcd"],"family":"characters"},{"id":"cats","name":"猫猫咖啡馆","style":"cats","board":"#fff6ef","grid":"#d6c3b6","arena":"#f5e9df","edge":"#d7bdab","pocket":"#fffaf5","pocketEdge":"#ddc6b6","ink":"#795d4e","muted":"#9a7b66","frame":"#b38c71","halo":"#ebd8c9","cover":"rgba(255,246,239,.80)","title":"#684d3e","accent":"#c38770","buttonInk":"#ffffff","ghost":"#9d7c68","colors":["#90bed1","#e5c670","#b6a3d7","#99bfa5","#dba0b2","#9eb7d6","#d8ae87"],"family":"characters"},{"id":"forest","name":"萌兽森林","style":"forest","board":"#edf5e9","grid":"#b9cdb0","arena":"#dfead8","edge":"#abc19e","pocket":"#f3f8ee","pocketEdge":"#c1d2b5","ink":"#4f6d45","muted":"#7a936c","frame":"#87a276","halo":"#cedec2","cover":"rgba(237,245,233,.80)","title":"#416039","accent":"#719261","buttonInk":"#ffffff","ghost":"#6e8c5c","colors":["#a6c5b0","#d1b893","#bda9cf","#b7c8cc","#dda47b","#c1aa87","#d5c676"],"family":"characters"}].concat(SKINS).filter(function(s){return ["neon","gold"].indexOf(s.id)<0;});
  var skin = SKINS[0], COLORS = skin.colors;
  function cells(type, rot) {
    var a = SHAPES[type].map(function (p) { return p.slice(); });
    if (type === 1) return a;
    for (var r = 0; r < rot; r++) a = a.map(function (p) { return [(type === 0 ? 3 : 2) - p[1], p[0]]; });
    return a;
  }
  var SPEED = Object.freeze({initial:800, scoreStep:1000, faster:30, minimum:150});
  function Engine(seed) {
    this.config = SPEED;
    this.seed = seed; this.bag = []; this.queue = []; this.board = [];
    for (var y = 0; y < H; y++) this.board.push(Array(W).fill(0));
    this.tick = 0; this.score = 0; this.lines = 0; this.combo = -1;
    this.hold = -1; this.usedHold = false; this.fall = 0; this.ground = 0; this.over = false;
    this.fill(); this.spawn(this.queue.shift()); this.fill();
  }
  Engine.prototype.fill = function () {
    while (this.queue.length < 4) {
      if (!this.bag.length) {
        this.bag = [0,1,2,3,4,5,6];
        for (var i = 6; i > 0; i--) {
          this.seed = this.seed * 48271 % 2147483647;
          var j = this.seed % (i + 1), t = this.bag[i]; this.bag[i] = this.bag[j]; this.bag[j] = t;
        }
      }
      this.queue.push(this.bag.shift());
    }
  };
  Engine.prototype.level = function () { return 1 + Math.floor(this.score / this.config.scoreStep); };
  Engine.prototype.interval = function () {
    return Math.max(this.config.minimum, this.config.initial - (this.level() - 1) * this.config.faster);
  };
  Engine.prototype.valid = function (x, y, rot) {
    var b = this.board;
    return cells(this.type, rot).every(function (p) {
      var xx = x + p[0], yy = y + p[1];
      return xx >= 0 && xx < W && yy >= 0 && yy < H && !b[yy][xx];
    });
  };
  Engine.prototype.spawn = function (type) {
    this.type = type; this.x = Math.floor((W - 4) / 2); this.y = 0; this.rot = 0; this.fall = 0; this.ground = 0;
    if (!this.valid(this.x, this.y, 0)) this.over = true;
  };
  Engine.prototype.move = function (dx, dy) {
    if (!this.valid(this.x + dx, this.y + dy, this.rot)) return false;
    this.x += dx; this.y += dy; return true;
  };
  Engine.prototype.rotate = function (dir) {
    var r = (this.rot + dir + 4) % 4, kicks = [0,-1,1,-2,2];
    for (var i = 0; i < kicks.length; i++) if (this.valid(this.x + kicks[i], this.y, r)) {
      this.x += kicks[i]; this.rot = r; return;
    }
  };
  Engine.prototype.lock = function () {
    var self = this, level = this.level();
    cells(this.type, this.rot).forEach(function (p) { self.board[self.y + p[1]][self.x + p[0]] = self.type + 1; });
    var remaining = this.board.filter(function (row) { return row.some(function (v) { return !v; }); });
    var n = H - remaining.length;
    while (remaining.length < H) remaining.unshift(Array(W).fill(0));
    this.board = remaining;
    if (n) {
      this.combo++; this.score += [0,100,300,500,800][n] * level + Math.max(0, this.combo) * 50 * level;
      this.lines += n;
    } else this.combo = -1;
    this.usedHold = false; this.spawn(this.queue.shift()); this.fill();
  };
  Engine.prototype.step = function (a) {
    if (this.over) return;
    this.tick++;
    if (a === 'q') { this.over = true; return; }
    if (a === 'l') this.move(-1,0);
    if (a === 'r') this.move(1,0);
    if (a === 'c') this.rotate(1);
    if (a === 'z') this.rotate(-1);
    if (a === 'd' && this.move(0,1)) this.score++;
    if (a === 'h') {
      while (this.move(0,1)) this.score += 2;
      this.lock();
    } else if (a === 'b' && !this.usedHold) {
      var old = this.hold; this.hold = this.type;
      if (old < 0) { this.spawn(this.queue.shift()); this.fill(); } else this.spawn(old);
      this.usedHold = true;
    } else {
      this.fall += MS;
      if (this.fall >= this.interval()) { this.fall -= this.interval(); this.move(0,1); }
      if (!this.valid(this.x, this.y + 1, this.rot)) { this.ground++; if (this.ground >= 10) this.lock(); }
      else this.ground = 0;
    }
    if (this.tick >= MAX) this.over = true;
  };
  // Exporting the pure rules also allows replay and differential tests without a browser.
  if (typeof module !== 'undefined' && module.exports) module.exports = { Engine: Engine, cells: cells, MAX: MAX };
  if (typeof GameCenter === 'undefined') return;

  GameCenter.register('tetris', function (stage, api) {
    var root = document.createElement('div'); root.className = 'gct'; root.tabIndex = 0;
    root.setAttribute('aria-label', '俄罗斯方块游戏，点击后使用方向键操作');
    root.innerHTML = "<div class=\"gct-top gct-hud\"><div class=\"gct-hud-values\"><span>分数<b class=\"gct-score\">0</b></span><span>消行<b class=\"gct-lines\">0</b></span><span>等级<b class=\"gct-level\">1</b></span><span>最佳<b class=\"gct-best\">—</b></span></div><div class=\"gct-tools\"><button type=\"button\" class=\"gct-full gc-btn gc-ghost\" title=\"全屏 / 退出全屏（F）\" aria-pressed=\"false\">全屏</button><button type=\"button\" class=\"gct-pause gc-btn gc-ghost\" disabled>暂停</button></div></div><div class=\"gct-chase\">◎ 14 × 24 棋盘 · 已开启落点投影</div><div class=\"gct-arena\"><div class=\"gct-layout\"><aside class=\"gct-pocket\"><small>暂存 / C</small><canvas class=\"gct-held\" width=\"120\" height=\"60\"></canvas><div class=\"gct-pocket-hint\">每次落块<br>可暂存一次</div></aside><div class=\"gct-board\"><canvas class=\"gct-canvas\" width=\"560\" height=\"960\" aria-label=\"14列24行俄罗斯方块棋盘\"></canvas><div class=\"gct-cover\"><h3>俄罗斯方块</h3><p>方向键移动 / 旋转<br>空格直落，F 全屏</p><button type=\"button\" class=\"gct-start gc-btn\">开始游戏</button></div></div><aside class=\"gct-pocket\"><small>接下来</small><canvas class=\"gct-next\" width=\"120\" height=\"180\"></canvas></aside></div><div class=\"gct-arena-foot\"><span>下落间隔 <b class=\"gct-speed\">800 ms / 格</b></span><div class=\"gct-speed-progress\"><span class=\"gct-next-speed\">每 1000 分提速一次</span><div class=\"gct-speed-track\"><i></i></div></div></div></div><div class=\"gct-message\" role=\"status\" aria-live=\"polite\">拼满整行即可消除，连续消行赢取更高分</div><div class=\"gct-controls\"><button type=\"button\" data-a=\"l\" aria-label=\"向左\">← 左移</button><button type=\"button\" data-a=\"c\">旋转 ↻</button><button type=\"button\" data-a=\"r\" aria-label=\"向右\">右移 →</button><button type=\"button\" data-a=\"b\">暂存</button><button type=\"button\" data-a=\"d\">软降 ↓</button><button type=\"button\" data-a=\"h\">直接落下</button></div><div class=\"gct-bottom\"><span>← → 移动 · ↑ 旋转 · 空格直落 · P 暂停 · F 全屏</span><button type=\"button\" class=\"gct-finish\" disabled>结束本局并结算</button></div>";
    var skinPicker=document.createElement('div');skinPicker.className='gct-skins';skinPicker.setAttribute('role','group');skinPicker.setAttribute('aria-label','棋盘与方块皮肤');
    var skinLabel=document.createElement('span');skinLabel.className='gct-skin-label';skinLabel.textContent='皮肤';skinPicker.appendChild(skinLabel);
    SKINS.forEach(function(s){var b=document.createElement('button');b.type='button';b.dataset.skin=s.id;b.className='gct-skin-choice';b.setAttribute('aria-pressed','false');b.title=s.name;var swatch=document.createElement('span');swatch.className='gct-skin-swatch';swatch.setAttribute('aria-hidden','true');swatch.style.background=s.board;[0,2,4].forEach(function(n){var i=document.createElement('i');i.style.background=s.colors[n];swatch.appendChild(i);});var name=document.createElement('span');name.textContent=s.name;b.append(swatch,name);skinPicker.appendChild(b);});

    var skinButtons=Array.from(skinPicker.querySelectorAll('[data-skin]'));
    skinPicker.replaceChildren();
    var row=document.createElement('div');row.className='gct-skin-group';var label=document.createElement('span');label.className='gct-skin-label';label.textContent='皮肤';row.appendChild(label);
    SKINS.forEach(function(s){var b=skinButtons.find(function(b){return b.dataset.skin===s.id;});if(s.family==='characters'){var sw=b.querySelector('.gct-skin-swatch'),cv=document.createElement('canvas');cv.width=cv.height=96;sw.style.background='transparent';sw.replaceChildren(cv);var iconVariant=s.id==='forest'?4:0;characterTile(cv.getContext('2d'),0,0,96,s.colors[iconVariant],s.style,iconVariant);}row.appendChild(b);});skinPicker.appendChild(row);
    root.querySelector('.gct-arena').before(skinPicker);
    var railPockets=root.querySelectorAll('.gct-pocket');
    var leftRail=document.createElement('aside');leftRail.className='gct-rail gct-rail-left';leftRail.setAttribute('aria-label','暂存与操作');railPockets[0].before(leftRail);leftRail.appendChild(railPockets[0]);
    var controlPanel=document.createElement('div');controlPanel.className='gct-rail-panel';var controlTitle=document.createElement('small');controlTitle.className='gct-rail-title';controlTitle.textContent='操作';controlPanel.append(controlTitle,root.querySelector('.gct-controls'),root.querySelector('.gct-bottom'));leftRail.appendChild(controlPanel);
    var rightRail=document.createElement('aside');rightRail.className='gct-rail gct-rail-right';rightRail.setAttribute('aria-label','预览与下落速度');railPockets[1].before(rightRail);rightRail.append(railPockets[1],root.querySelector('.gct-arena-foot'));
    root.querySelector('.gct-next').height=270;root.querySelector('.gct-held').height=84;
    stage.appendChild(root);
    // Keep the platform APIs and real leaderboard; adapt only this game's page.
    var host=stage.closest('.gc');
    if(host){host.classList.add('gc-tetris-page');var side=host.querySelector('.gc-side'),help=host.querySelector('.gc-main > .gc-box');
      if(side){var guide=document.createElement('section');guide.className='gc-box gct-score-guide';guide.innerHTML='<h4>消行奖励</h4><div><span>单行消除</span><b>100 × 等级</b></div><div><span>双行消除</span><b>300 × 等级</b></div><div><span>三行消除</span><b>500 × 等级</b></div><div><span>四行消除</span><b>800 × 等级</b></div><p>连续消行可获得额外连击分。</p>';side.appendChild(guide);if(help){help.classList.add('gct-help');side.appendChild(help);}}
    }

    var $ = function (s) { return root.querySelector(s); };
    var cv = $('.gct-canvas'), ctx = cv.getContext('2d'), next = $('.gct-next').getContext('2d'), held = $('.gct-held').getContext('2d');
    var cover = $('.gct-cover'), start = $('.gct-start'), pause = $('.gct-pause'), finish = $('.gct-finish'), msg = $('.gct-message');
    var e = null, info = null, active = false, paused = false, busy = false, submitting = false, moves = [], pending = [], timer = 0;
    var keys = {}, repeats = {}, pointerAction = '', pointerTick = 0, pointerFresh = false, lastScore = -1, lastLines = 0;
    $('.gct-best').textContent = api.best == null ? '—' : api.best;
    var skinStorage='gc_tetris_skin_v1';
    function applySkin(id){
      skin=SKINS.find(function(s){return s.id===id;})||SKINS.find(function(s){return s.id==='classic';})||SKINS[0];COLORS=skin.colors;root.dataset.skin=skin.id;
      ['board','arena','edge','pocket','pocketEdge','ink','muted','frame','halo','cover','title','accent','buttonInk'].forEach(function(k){root.style.setProperty('--skin-'+k,skin[k]);});
      skinPicker.querySelectorAll('[data-skin]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.skin===skin.id));});
      try{localStorage.setItem(skinStorage,skin.id);}catch(err){}
      draw();
    }
    skinPicker.addEventListener('click',function(ev){var b=ev.target.closest('[data-skin]');if(!b)return;applySkin(b.dataset.skin);root.focus({preventScroll:true});});
    var savedSkin='classic';try{savedSkin=localStorage.getItem(skinStorage)||'classic';}catch(err){}applySkin(savedSkin);

    var characterCache,mikuPortrait;
    function loadMikuPortrait(){
      if(!mikuPortrait){mikuPortrait=new Image();mikuPortrait.onload=function(){characterCache=Object.create(null);skinPicker.querySelectorAll('.gct-skin-choice[data-skin="miku"] canvas').forEach(function(cv){var c=cv.getContext('2d'),v=Number(cv.dataset.mikuForm||0);c.clearRect(0,0,cv.width,cv.height);characterTile(c,0,0,cv.width,SKINS[0].colors[v],'miku',v);});draw();};mikuPortrait.src=MIKU_SPRITE_URL;}
      return mikuPortrait;
    }
    function disk(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
    function polygon(c,points,fill){c.fillStyle=fill;c.beginPath();points.forEach(function(p,i){if(i)c.lineTo(p[0],p[1]);else c.moveTo(p[0],p[1]);});c.closePath();c.fill();}
    function littleStar(c,x,y,r,fill){var p=[];for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,k=i%2?r*.43:r;p.push([x+Math.cos(a)*k,y+Math.sin(a)*k]);}polygon(c,p,fill);}
    function petEyes(c,y,type,v){
      if(v===3&&type!=='panda'){c.strokeStyle='#483e3b';c.lineWidth=1.6;c.lineCap='round';[16.5,31.5].forEach(function(x){c.beginPath();c.arc(x,y+1,3.2,Math.PI*1.12,Math.PI*1.88);c.stroke();});}
      else{[16.5,31.5].forEach(function(x){disk(c,x,y,2.3,3.1,type==='cat'&&v===0?'#70a66d':'#3d3636');if(type==='cat'&&v===0)disk(c,x,y,.9,2.3,'#283e31');disk(c,x-.6,y-1,.65,.8,'#ffffff');});}
    }
    function petMouth(c,y){polygon(c,[[21.8,y],[26.2,y],[24,y+2.6]],'#805c5c');c.strokeStyle='#7c5b54';c.lineWidth=1.05;c.lineCap='round';c.beginPath();c.moveTo(24,y+2);c.quadraticCurveTo(23, y+6,20.5,y+4);c.moveTo(24,y+2);c.quadraticCurveTo(25,y+6,27.5,y+4);c.stroke();}
    function characterTile(c,x,y,size,color,kind,v){
      c.save();c.translate(x,y);c.scale(size/48,size/48);c.lineJoin='round';
      c.fillStyle='rgba(42,45,55,.13)';tilePath(c,1.7,3,44.6,43.4,10);c.fill();
      c.fillStyle=color;tilePath(c,1.5,1.5,45,44.5,10);c.fill();c.strokeStyle='rgba(255,255,255,.56)';c.lineWidth=1.5;tilePath(c,2.5,2.5,43,42.5,9);c.stroke();
      if(kind==='miku'){
        var portrait=loadMikuPortrait(),form=v%3,atlas=[0,4,5][form];
        var rim=['#378b86','#b97090','#6996bd'][form],pale=['#e9fffa','#fff0f6','#eff8ff'][form];
        c.fillStyle='#0a1a29';tilePath(c,1.5,3,45,44,6);c.fill();
        var bg=c.createLinearGradient(0,2,40,46);bg.addColorStop(0,'#ffffff');bg.addColorStop(.42,pale);bg.addColorStop(1,color);
        c.fillStyle=bg;tilePath(c,2,1.5,44,44,5.5);c.fill();
        c.save();tilePath(c,3.5,3,41,41,4.5);c.clip();
        if(portrait.complete&&portrait.naturalWidth){c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';var sw=portrait.naturalWidth/3,sh=portrait.naturalHeight/3;c.drawImage(portrait,(atlas%3)*sw,Math.floor(atlas/3)*sh,sw,sh,3,2,42,42);}
        // A restrained glass reflection stays above the eyes and hair details.
        var gloss=c.createLinearGradient(0,3,0,16);gloss.addColorStop(0,'rgba(255,255,255,.26)');gloss.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=gloss;c.fillRect(3,3,42,13);
        c.restore();c.strokeStyle=rim;c.lineWidth=1.1;tilePath(c,1.9,1.5,44.2,44.2,5.5);c.stroke();
        c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=.85;tilePath(c,3,2.7,42,41.6,4.6);c.stroke();
        c.fillStyle='rgba(255,255,255,.7)';tilePath(c,7,4.1,13,1,0.5);c.fill();
      }else if(kind==='anime'){
        if(v===0||v===4){disk(c,7,28,5,13,color);disk(c,41,28,5,13,color);disk(c,7,15,3,3,'#fff0d2');disk(c,41,15,3,3,'#fff0d2');}
        c.fillStyle='#ffe5d8';tilePath(c,10,11,28,32,13);c.fill();
        polygon(c,[[7,23],[9,12],[15,6],[28,5],[37,10],[41,22],[36,25],[32,17],[28,23],[23,16],[18,23],[15,18],[12,25]],color);
        c.strokeStyle='rgba(255,255,255,.42)';c.lineWidth=2;c.beginPath();c.moveTo(15,11);c.quadraticCurveTo(25,5,34,13);c.stroke();
        [17,31].forEach(function(ex){disk(c,ex,29,4.6,5.2,'#fffdfc');disk(c,ex+.3,29.5,2.9,4,color);disk(c,ex+.3,30,1.4,3,'#3b3555');disk(c,ex-1,27.8,1.1,1.4,'#ffffff');c.strokeStyle='#5b435e';c.lineWidth=1.55;c.beginPath();c.moveTo(ex-4.5,25.5);c.quadraticCurveTo(ex,23.4,ex+4.4,25.8);c.stroke();});
        disk(c,12.8,34,3,1.3,'#efafbb');disk(c,35.2,34,3,1.3,'#efafbb');c.strokeStyle='#b57583';c.lineWidth=1;c.beginPath();c.moveTo(21.5,37);c.quadraticCurveTo(24,39,26.5,37);c.stroke();
        if(v%3===0)littleStar(c,36,12,4.2,'#fff0ac');else if(v%3===1){polygon(c,[[31,10],[36,13],[31,16]],'#fff2e1');polygon(c,[[41,10],[36,13],[41,16]],'#fff2e1');}else{disk(c,35,12,3,3,'#f8e8ff');disk(c,35,12,1.3,1.3,'#b79bce');}
      }else if(kind==='mecha'){
        polygon(c,[[11,14],[16,7],[32,7],[38,15],[38,34],[30,42],[18,42],[10,34]],'#edf0e8');
        polygon(c,[[11,14],[18,9],[23,15],[24,22],[10,23]],color);polygon(c,[[37,14],[30,9],[25,15],[24,22],[38,23]],color);
        polygon(c,[[11,22],[37,22],[34,33],[14,33]],'#24444f');polygon(c,[[14,25],[22,27],[21,30],[15,29]],'#a9f0dc');polygon(c,[[34,25],[26,27],[27,30],[33,29]],'#a9f0dc');
        polygon(c,[[24,14],[15,4],[18,15],[24,20],[30,15],[33,4]],'#f4d992');polygon(c,[[20,34],[28,34],[26,41],[22,41]],color);disk(c,24,19,2,2,'#d38d8e');c.strokeStyle='#9aadae';c.lineWidth=1;c.beginPath();c.moveTo(18,36);c.lineTo(19,39);c.moveTo(30,36);c.lineTo(29,39);c.stroke();
      }else if(kind==='cats'&&v===1){
        disk(c,24,31,10,8,'#fff3e8');disk(c,13,19,4.2,5.5,'#fff3e8');disk(c,22,15,4.1,5.8,'#fff3e8');disk(c,31,16,4,5.7,'#fff3e8');disk(c,38,22,3.5,4.9,'#fff3e8');disk(c,24,32,5.7,4.3,'#e7acb0');
      }else{
        var species=kind==='forest'?['cat','dog','rabbit','panda','fox','bear','bird'][v]:kind==='shiba'?'dog':'cat';
        var coats=['#f5f7f6','#f2d49d','#e9e0ee','#77716d','#edc18e','#d7e0e2','#e9d3b5'];
        var coat=kind==='shiba'?['#ddaa67','#eee4d0','#c59a77','#dcb06d','#f3ecdc','#ae9b8c','#d09a60'][v]:species==='fox'?'#e9a16a':species==='bear'?'#a8805e':species==='bird'?'#f1d77f':species==='panda'?'#f3f3e9':coats[v];
        if(species==='cat'||species==='fox'){
          polygon(c,[[8,20],[10,5],[23,17]],coat);polygon(c,[[25,17],[38,5],[40,20]],coat);polygon(c,[[11,15],[12,8],[18,16]],'#e8b9bc');polygon(c,[[30,16],[36,8],[37,15]],'#e8b9bc');
        }else if(species==='rabbit'){
          disk(c,16,13,4.5,11,coat);disk(c,31,13,4.5,11,coat);disk(c,16,12,2,7.5,'#e4b4bd');disk(c,31,12,2,7.5,'#e4b4bd');
        }else if(species==='panda'||species==='bear'){
          disk(c,12,13,6,6,species==='panda'?'#48504a':coat);disk(c,36,13,6,6,species==='panda'?'#48504a':coat);
        }else if(species==='dog'){
          polygon(c,[[7,26],[8,8],[20,17]],coat);polygon(c,[[28,17],[40,8],[41,26]],coat);polygon(c,[[10,19],[11,12],[16,18]],'#bd8a5e');polygon(c,[[32,18],[37,12],[38,19]],'#bd8a5e');
        }
        disk(c,24,27,17,15,coat);
        if(species==='dog'){disk(c,24,33,12,7,'#fff4de');polygon(c,[[10,27],[14,24],[16,31]],'#fff4de');polygon(c,[[38,27],[34,24],[32,31]],'#fff4de');}
        if(species==='fox'){polygon(c,[[8,27],[20,29],[24,35],[28,29],[40,27],[33,39],[24,42],[15,39]],'#fff2dd');}
        if(species==='panda'){disk(c,16.5,26,5.3,6,'#505751');disk(c,31.5,26,5.3,6,'#505751');}
        if(species==='bear')disk(c,24,33,8,6,'#e2c4a0');
        if(species==='cat'&&v!==3){c.strokeStyle=v===0?'#b7c5c5':'rgba(127,98,74,.36)';c.lineWidth=1.8;c.beginPath();c.moveTo(21,14);c.lineTo(22,18);c.moveTo(26,14);c.lineTo(25,18);c.stroke();}
        petEyes(c,species==='rabbit'?28:26,species,v);
        if(species==='bird')polygon(c,[[20,31],[28,31],[24,36]],'#c68947');else petMouth(c,31);
        if(species==='cat'){c.strokeStyle='#9d8c80';c.lineWidth=.8;[[9,30,15,31],[9,34,15,33],[33,31,39,30],[33,33,39,34]].forEach(function(p){c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[2],p[3]);c.stroke();});}
        c.globalAlpha=.5;disk(c,11.5,31,2.4,1.2,'#dc9fa2');disk(c,36.5,31,2.4,1.2,'#dc9fa2');c.globalAlpha=1;
      }
      c.restore();
    }
    function cachedCharacter(c,x,y,size,color){if(skin.style==='miku'&&(!mikuPortrait||!mikuPortrait.complete||!mikuPortrait.naturalWidth)){characterTile(c,x,y,size,color,'miku',Math.max(0,COLORS.indexOf(color)));return;}characterCache=characterCache||Object.create(null);var v=Math.max(0,COLORS.indexOf(color)),key=skin.id+':'+v+':'+size;if(!characterCache[key]){var tile=document.createElement('canvas');tile.width=tile.height=size*2;characterTile(tile.getContext('2d'),0,0,size*2,color,skin.style,v);characterCache[key]=tile;}c.drawImage(characterCache[key],x,y,size,size);}
    function drawCharacterWorld(c){
      c.save();c.globalAlpha=.075;c.fillStyle=skin.ink;c.strokeStyle=skin.ink;c.lineWidth=2;
      if(skin.style==='cats'||skin.style==='shiba'){[[68,82],[W*40-64,170],[70,H*40-90]].forEach(function(p){disk(c,p[0],p[1],12,9,skin.ink);[[-15,-13],[-5,-20],[7,-19],[17,-10]].forEach(function(a){disk(c,p[0]+a[0],p[1]+a[1],4.5,6,skin.ink);});});}
      else if(skin.style==='forest'){[[55,75],[W*40-55,125],[W*40-60,H*40-70]].forEach(function(p){c.beginPath();c.moveTo(p[0]-18,p[1]+19);c.quadraticCurveTo(p[0]-18,p[1]-22,p[0]+20,p[1]-18);c.quadraticCurveTo(p[0]+20,p[1]+22,p[0]-18,p[1]+19);c.fill();});}
      else if(skin.style==='miku'){
        c.globalAlpha=.10;c.strokeStyle='#66e9d5';c.fillStyle='#66e9d5';c.lineWidth=3;
        [[62,85],[W*40-85,170],[75,H*40-100]].forEach(function(p){c.beginPath();c.moveTo(p[0],p[1]);c.lineTo(p[0],p[1]-28);c.lineTo(p[0]+22,p[1]-33);c.lineTo(p[0]+22,p[1]-5);c.stroke();disk(c,p[0]-5,p[1]+2,6,4,'#66e9d5');disk(c,p[0]+17,p[1]-3,6,4,'#66e9d5');});
        c.globalAlpha=.06;for(var b=0;b<14;b++)c.fillRect(b*40+13,H*40-28-(b%4)*9,14,20+(b%4)*9);
      }
      else if(skin.style==='anime'){[[70,85,19],[W*40-65,145,12],[65,H*40-70,16]].forEach(function(p){littleStar(c,p[0],p[1],p[2],skin.ink);});}
      else{c.beginPath();c.moveTo(25,80);c.lineTo(65,80);c.lineTo(65,125);c.lineTo(100,125);c.moveTo(W*40-25,H*40-130);c.lineTo(W*40-70,H*40-130);c.lineTo(W*40-70,H*40-80);c.stroke();disk(c,100,125,4,4,skin.ink);}
      c.restore();
    }
    function tilePath(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();}
    function block(c,x,y,size,color,ghost){
      c.save();
      if(ghost){c.fillStyle=color;c.globalAlpha=skin.style==='lcd'?.10:.18;c.fillRect(x+2,y+2,size-4,size-4);c.globalAlpha=skin.style==='candy'?.8:.65;c.strokeStyle=skin.style==='classic'?color:skin.ghost;c.lineWidth=Math.max(1,size*.035);if(skin.style==='lcd')c.setLineDash([size*.1,size*.07]);c.strokeRect(x+2.5,y+2.5,size-5,size-5);c.restore();return;}
      if(skin.family==='characters'){cachedCharacter(c,x,y,size,color);}
      else if(skin.style==='classic'){c.fillStyle=color;c.fillRect(x+1,y+1,size-2,size-2);c.fillStyle='rgba(255,255,255,.22)';c.fillRect(x+3,y+3,size-6,3);}
      else if(skin.style==='neon'){c.fillStyle=color;c.shadowColor=color;c.shadowBlur=size*.25;tilePath(c,x+2,y+2,size-4,size-4,size*.08);c.fill();c.shadowBlur=0;c.fillStyle=skin.board;tilePath(c,x+4.5,y+4.5,size-9,size-9,size*.04);c.fill();c.fillStyle=color;c.globalAlpha=.25;c.fillRect(x+6,y+6,size-12,size-12);c.globalAlpha=1;c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=.8;c.strokeRect(x+2.5,y+2.5,size-5,size-5);}
      else if(skin.style==='lcd'){c.strokeStyle=color;c.lineWidth=Math.max(1,size*.055);c.strokeRect(x+2.5,y+2.5,size-5,size-5);var m=size*.19;c.fillStyle=color;c.fillRect(x+m,y+m,size-m*2,size-m*2);}
      else if(skin.style==='candy'){c.fillStyle='rgba(69,96,124,.13)';tilePath(c,x+1.5,y+3,size-3,size-3,size*.16);c.fill();c.fillStyle=color;tilePath(c,x+1.5,y+1,size-3,size-4,size*.16);c.fill();c.fillStyle='rgba(255,255,255,.34)';tilePath(c,x+4,y+3,size-8,size*.28,size*.08);c.fill();c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=1;tilePath(c,x+2.5,y+2,size-5,size-6,size*.13);c.stroke();}
      else{c.fillStyle=color;c.fillRect(x+1,y+1,size-2,size-2);var b=Math.max(3,size*.14);c.fillStyle='rgba(255,245,203,.38)';c.beginPath();c.moveTo(x+2,y+2);c.lineTo(x+size-2,y+2);c.lineTo(x+size-b,y+b);c.lineTo(x+b,y+b);c.lineTo(x+b,y+size-b);c.lineTo(x+2,y+size-2);c.fill();c.fillStyle='rgba(30,22,8,.35)';c.beginPath();c.moveTo(x+size-2,y+2);c.lineTo(x+size-2,y+size-2);c.lineTo(x+2,y+size-2);c.lineTo(x+b,y+size-b);c.lineTo(x+size-b,y+size-b);c.lineTo(x+size-b,y+b);c.fill();c.strokeStyle='rgba(255,235,174,.3)';c.lineWidth=1;c.strokeRect(x+b+.5,y+b+.5,size-2*b-1,size-2*b-1);}
      c.restore();
    }
    function preview(c, types) {
      c.clearRect(0,0,c.canvas.width,c.canvas.height);
      types.forEach(function (t, i) {
        if (t < 0) return;
        var a = cells(t,0), minx = Math.min.apply(null,a.map(function(p){return p[0];})), maxx = Math.max.apply(null,a.map(function(p){return p[0];}));
        var off = (120 - (maxx-minx+1)*30)/2;
        a.forEach(function(p){block(c,off+(p[0]-minx)*30,i*90+12+p[1]*30,30,COLORS[t]);});
      });
    }
    function draw() {
      ctx.fillStyle = skin.board; ctx.fillRect(0,0,W*40,H*40);if(skin.family==='characters')drawCharacterWorld(ctx);
      var renderedCell = (cv.getBoundingClientRect().width || W * 20) / W;
      ctx.strokeStyle = skin.grid; ctx.lineWidth = Math.max(1, 40 / renderedCell);
      for (var x=0;x<=W;x++) {ctx.beginPath();ctx.moveTo(x*40+.5,0);ctx.lineTo(x*40+.5,H*40);ctx.stroke();}
      for (var y=0;y<=H;y++) {ctx.beginPath();ctx.moveTo(0,y*40+.5);ctx.lineTo(W*40,y*40+.5);ctx.stroke();}
      if(skin.style==='lcd'){ctx.save();ctx.globalAlpha=.35;ctx.lineWidth=1;for(var row=0;row<H;row++)for(var col=0;col<W;col++)ctx.strokeRect(col*40+5.5,row*40+5.5,29,29);ctx.restore();}
      if (!e) { preview(next,[2,0,6]); preview(held,[]); return; }
      e.board.forEach(function(row,y){row.forEach(function(v,x){if(v) block(ctx,x*40,y*40,40,COLORS[v-1]);});});
      if (!e.over) {
        var gy=e.y; while(e.valid(e.x,gy+1,e.rot)) gy++;
        cells(e.type,e.rot).forEach(function(p){block(ctx,(e.x+p[0])*40,(gy+p[1])*40,40,COLORS[e.type],true);});
        cells(e.type,e.rot).forEach(function(p){block(ctx,(e.x+p[0])*40,(e.y+p[1])*40,40,COLORS[e.type]);});
      }
      preview(next,e.queue.slice(0,3)); preview(held,[e.hold]);
      $('.gct-held').style.opacity = e.usedHold ? '.4' : '1';
      if(e.score!==lastScore) {$('.gct-score').textContent=e.score;lastScore=e.score;}
      $('.gct-level').textContent=e.level();$('.gct-lines').textContent=e.lines;
      $('.gct-speed').textContent=e.interval()+' ms / 格';
      $('.gct-speed-track i').style.width=Math.min(100, (e.score % e.config.scoreStep) / e.config.scoreStep * 100)+'%';
      $('.gct-next-speed').textContent=e.interval()<=e.config.minimum?'已达到最快速度':'距下次提速 '+(e.config.scoreStep-e.score%e.config.scoreStep)+' 分';
    }
    function clearInput() { keys={}; repeats={}; pending=[]; pointerAction=''; pointerFresh=false; }
    function overlay(title, text, button) {
      cover.querySelector('h3').textContent=title; cover.querySelector('p').textContent=text; start.textContent=button; cover.hidden=false;
    }
    function setPaused(value) {
      if (!active || submitting) return;
      paused=value; clearInput(); root.classList.toggle('gct-is-paused',value); pause.textContent=value?'继续':'暂停';
      if(value) overlay('休息一下','点击继续，回到本局游戏','继续游戏'); else {cover.hidden=true;root.focus({preventScroll:true});}
    }
    function end() {
      active=false;clearInterval(timer);clearInput();pause.disabled=true;pause.textContent='暂停';finish.disabled=true;submitting=true;start.disabled=true;
      overlay(e.tick>=MAX?'本局时间到':'本局结束','得分 '+e.score+' · 消除 '+e.lines+' 行','正在结算…');
      api.submit(info,{v:2,score:e.score,ticks:e.tick,moves:moves.join(',')},'俄罗斯方块 · 本局结束').then(function(r){
        if(r && r.ok) $('.gct-best').textContent=r.best;
        msg.textContent=r && r.ok?'本局结束，点击再来一局继续挑战':(r && r.guest?'本局结束，点击再来一局继续挑战':'本局成绩未记录，请查看结算提示');
      }).catch(function(){msg.textContent='成绩提交失败，请检查网络后再开新局';}).then(function(){
        submitting=false;start.disabled=false;start.textContent='再来一局';
      });
    }
    function action() {
      if(pending.length) return pending.shift();
      if(pointerAction) {
        var pa=pointerAction, age=pointerTick++;
        if(pointerFresh){pointerFresh=false;return pa;}
        if((pa==='l'||pa==='r'||pa==='d') && age>=4 && age%2===0)return pa;
      }
      var list=['d','l','r'];
      for(var i=0;i<list.length;i++) if(keys[list[i]]) {
        var a=list[i]; repeats[a]=(repeats[a]||0)+1;
        if(repeats[a]>=4 && (a==='d'||repeats[a]%2===0))return a;
      }
      return '';
    }
    function tick() {
      if(!active||paused)return;
      var a=action();if(a)moves.push((e.tick+1)+':'+a);
      e.step(a);
      if(e.lines>lastLines) {msg.textContent='消除 '+(e.lines-lastLines)+' 行'+(e.combo>0?' · 连击 '+(e.combo+1):'')+'！';lastLines=e.lines;}
      draw();if(e.over)end();
    }
    start.addEventListener('click',function(){
      if(paused && active){setPaused(false);return;}
      if(busy||active||submitting)return;
      busy=true;start.disabled=true;start.textContent='准备中…';
      api.start().then(function(r){
        if(!r)return;
        info=r;e=new Engine(r.seed);moves=[];clearInput();lastLines=0;lastScore=-1;paused=false;active=true;cover.hidden=true;
        pause.disabled=false;finish.disabled=false;pause.textContent='暂停';root.classList.remove('gct-is-paused');
        msg.textContent='14 × 24 棋盘 · 分数越高，下落越快';
        root.focus({preventScroll:true});draw();timer=setInterval(tick,MS);
      }).catch(function(){msg.textContent='无法开始，请检查网络后重试';}).then(function(){busy=false;start.disabled=false;start.textContent='开始游戏';});
    });
    pause.addEventListener('click',function(){setPaused(!paused);});
    finish.addEventListener('click',function(){if(active&&!submitting){paused=false;clearInput();pending.push('q');}});
    root.addEventListener('pointerdown',function(ev){
      var b=ev.target.closest('[data-a]');
      if(!b||!active||paused||ev.button!==0)return;
      ev.preventDefault();root.focus({preventScroll:true});keys={};repeats={};pointerAction=b.dataset.a;pointerTick=0;pointerFresh=false;
      if(pending.length<4)pending.push(b.dataset.a);
      if(b.setPointerCapture)b.setPointerCapture(ev.pointerId);
    });
    function releasePointer(){pointerAction='';pointerFresh=false;}
    root.addEventListener('pointerup',releasePointer);root.addEventListener('pointercancel',releasePointer);root.addEventListener('lostpointercapture',releasePointer);
    root.addEventListener('contextmenu',function(ev){if(ev.target.closest('[data-a]'))ev.preventDefault();});
    // Keyboard-generated button clicks (Enter / Space) also work without pointer events.
    root.addEventListener('click',function(ev){var b=ev.target.closest('[data-a]');if(b&&ev.detail===0&&active&&!paused)pending.push(b.dataset.a);});
    var map={ArrowLeft:'l',a:'l',ArrowRight:'r',d:'r',ArrowUp:'c',w:'c',x:'c',z:'z',ArrowDown:'d',s:'d',' ':'h',c:'b',Shift:'b'};
    document.addEventListener('keydown',function(ev){
      if(!ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.repeat && root.contains(document.activeElement) && !ev.target.closest('input,textarea,select,[contenteditable="true"]')) {
        if(ev.key.toLowerCase()==='f') {ev.preventDefault();toggleFull();return;}
        if(ev.key==='Escape' && stage.classList.contains('gct-expanded')) {ev.preventDefault();exitExpanded();return;}
      }
      if(!active||!root.contains(document.activeElement)||ev.ctrlKey||ev.metaKey||ev.altKey)return;
      var target=ev.target;if(target.closest('input,textarea,select,[contenteditable="true"]'))return;
      var k=ev.key.length===1?ev.key.toLowerCase():ev.key;
      if(k==='p'||k==='Escape'){ev.preventDefault();if(!ev.repeat)setPaused(!paused);return;}
      var a=map[k];if(!a||paused)return;
      // Keep standard keyboard activation when a button has focus.
      if(k===' '&&target.tagName==='BUTTON')return;
      ev.preventDefault();if(ev.repeat)return;
      keys[a]=true;repeats[a]=0;if(pending.length<4)pending.push(a);
    });
    document.addEventListener('keyup',function(ev){var k=ev.key.length===1?ev.key.toLowerCase():ev.key;var a=map[k];if(a){delete keys[a];delete repeats[a];}});
    window.addEventListener('blur',function(){setPaused(true);});
    document.addEventListener('visibilitychange',function(){if(document.hidden)setPaused(true);});
    root.addEventListener('focusout',function(ev){if(active&&!root.contains(ev.relatedTarget))setPaused(true);});
    var fullButton = $('.gct-full'), savedOverflow = null;
    function isFull() { return document.fullscreenElement === stage || stage.classList.contains('gct-expanded'); }
    function updateFull() {
      var full = isFull();
      fullButton.textContent = full ? '退出全屏' : '全屏';
      fullButton.setAttribute('aria-pressed', full ? 'true' : 'false');
      fit();
    }
    function exitExpanded() {
      stage.classList.remove('gct-expanded');
      if (savedOverflow !== null) { document.body.style.overflow = savedOverflow; savedOverflow = null; }
      updateFull();root.focus({preventScroll:true});
    }
    function enterExpanded() {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      stage.classList.add('gct-expanded');updateFull();root.focus({preventScroll:true});
    }
    function toggleFull() {
      clearInput();
      if (document.fullscreenElement === stage) {
        document.exitFullscreen().catch(function(){msg.textContent='请按 Esc 退出全屏';});
      } else if (stage.classList.contains('gct-expanded')) exitExpanded();
      else if (stage.requestFullscreen) {
        try { var p = stage.requestFullscreen();if(p && p.catch)p.catch(enterExpanded); }
        catch(err) { enterExpanded(); }
      } else enterExpanded();
    }
    fullButton.addEventListener('click',toggleFull);
    document.addEventListener('fullscreenchange',function(){updateFull();root.focus({preventScroll:true});});
    function fit() {
      // Size the 14x24 board from its actual layout space, keeping square cells.
      var layout = $('.gct-layout'), style = getComputedStyle(layout);
      var pockets = layout.querySelectorAll('.gct-pocket');
      var sideWidth = 0;
      for (var i=0;i<pockets.length;i++) sideWidth += pockets[i].getBoundingClientRect().width;
      var gap = parseFloat(style.columnGap || style.gap) || 0;
      var widthBudget = Math.max(80, layout.clientWidth - sideWidth - gap * 2 - 2);
      var full = isFull();
      var heightBudget = full ? Math.max(180, window.innerHeight - 280 - skinPicker.offsetHeight - 12) : Math.max(460, Math.min(680, window.innerHeight - 390)) * H / 20;
      var width = Math.floor(Math.min(widthBudget, heightBudget * W / H, full ? W * 48 : W * 36));
      root.style.setProperty('--board-width', width + 'px');
      draw();
    }
    window.addEventListener('resize', fit);fit();
    draw();
  });
})();
