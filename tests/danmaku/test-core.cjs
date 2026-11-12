/* (C) 2026 Carinoasd. P0 independent boundaries and cross-language checks: 小典 / Codex. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const game = path.join(root, 'source/plugin/gamecenter/games/_danmaku_proto');
const rules = JSON.parse(fs.readFileSync(path.join(game, 'rules.json'), 'utf8'));
const engine = require(path.join(game, 'engine.js'));
const replay = require(path.join(game, 'replay.js'));
const php = process.env.DANMAKU_PHP || 'E:\\dzx5-env\\php\\php.exe';
const zero = () => ({ dx: 0, dy: 0, flags: 0 });
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
function advance(sim, n) { for (let i=0;i<n;i++) sim.step(zero()); }
function enemy(sim, dx, dy, vx=0, vy=0) {
  return { id: sim.nextEnemy++, x: sim.player.x+dx*64, y: sim.player.y+dy*64,
    px:sim.player.x+dx*64, py:sim.player.y+dy*64, vx, vy, radius:5, born:1, grazed:false };
}
check('shared vectors and motion do not exceed the integer speed circle', () => {
  assert.equal(rules.directionVectors.length,512);
  for (const [x,y] of rules.directionVectors) assert.ok(x*x+y*y<=1024**2);
  assert.deepEqual([0,128,256,384].map(i=>rules.directionVectors[i]),[[1024,0],[0,1024],[-1024,0],[0,-1024]]);
  assert.ok(2*181**2<=256**2); assert.ok(2*67**2<=96**2);
});
check('swept collision catches crossing, tangent and relative motion', () => {
  assert.ok(engine.sweptHit(-20,0,20,0,3));
  assert.ok(engine.sweptHit(-20,3,20,3,3));
  assert.ok(!engine.sweptHit(-20,4,20,4,3));
  assert.ok(engine.sweptHit(2,0,2,0,3));
  assert.ok(!engine.sweptHit(4,0,4,0,3));
  assert.ok(!engine.sweptHit(10,1,20,1,3));
});
check('boss phase and extrema follow the exact triangle path', () => {
  assert.deepEqual([1,121,361,481].map(engine.bossX),[240*64,304*64,176*64,240*64]);
});
check('normal and slow speed limits reject illegal diagonals', () => {
  engine.validateInput({dx:181,dy:181,flags:0},rules);
  engine.validateInput({dx:67,dy:67,flags:1},rules);
  assert.throws(()=>engine.validateInput({dx:256,dy:256,flags:0},rules));
  assert.throws(()=>engine.validateInput({dx:97,dy:0,flags:1},rules));
  assert.throws(()=>engine.validateInput({dx:0,dy:0,flags:4},rules));
});
check('player cannot leave the play bounds', () => {
  const sim=new engine.Sim(rules,'flower',false);
  for(let i=0;i<90;i++)sim.step({dx:256,dy:0,flags:0});
  assert.equal(sim.player.x,468*64);
});
check('flower first birth is tick 60, exactly 27 moving projectiles', () => {
  const sim=new engine.Sim(rules,'flower',false);advance(sim,59);assert.equal(sim.enemies.length,0);
  sim.step(zero());assert.equal(sim.stats.enemySpawned,27);assert.equal(sim.enemies.length,27);
  assert.ok(sim.enemies.every(e=>e.x!==e.px||e.y!==e.py));
});
check('aim locks before the player moves and holds all three salvos', () => {
  const sim=new engine.Sim(rules,'aim',false);advance(sim,60);const angle=sim.aimAngle;
  for(let i=0;i<30;i++)sim.step({dx:256,dy:0,flags:0});
  assert.equal(sim.aimAngle,angle);assert.equal(sim.stats.enemySpawned,5);
  const central=sim.enemies[2], vector=rules.directionVectors[angle];
  assert.equal(central.vx,Math.trunc(160*vector[0]/1024));
  advance(sim,36);assert.equal(sim.stats.enemySpawned,15);assert.equal(sim.aimAngle,angle);
});
check('wave uses the specified omitted columns and three row offsets', () => {
  const sim=new engine.Sim(rules,'wave',false);advance(sim,359);assert.equal(sim.enemies.length,0);
  sim.step(zero());assert.deepEqual(sim.enemies.map(e=>e.x/64),[12,66,228,282,336,390,444]);
  assert.ok(sim.enemies.every(e=>e.y===112*64+128));advance(sim,36);assert.equal(sim.stats.enemySpawned,21);
});
check('multiple same-step hits take exactly one life and clear nearby bullets', () => {
  const sim=new engine.Sim(rules,'aim',false);sim.enemies=[enemy(sim,0,0),enemy(sim,0,0),enemy(sim,20,0)];
  sim.step(zero());assert.equal(sim.player.lives,2);assert.equal(sim.stats.hitsTaken,1);
  assert.equal(sim.player.invulUntil,121);assert.equal(sim.enemies.length,0);assert.equal(sim.stats.graze,0);
});
check('hit immunity includes t through t+119, not t+120', () => {
  const sim=new engine.Sim(rules,'aim',false);sim.enemies=[enemy(sim,0,0)];sim.step(zero());advance(sim,118);
  sim.enemies=[enemy(sim,0,0)];sim.step(zero());assert.equal(sim.player.lives,2);
  sim.step(zero());assert.equal(sim.player.lives,1);assert.equal(sim.stats.graze,0);
});
check('bomb clears before collision and does not shorten existing immunity', () => {
  const sim=new engine.Sim(rules,'aim',false);sim.enemies=[enemy(sim,0,0)];sim.step({dx:0,dy:0,flags:2});
  assert.equal(sim.player.lives,3);assert.equal(sim.player.bombs,1);assert.equal(sim.player.invulUntil,91);
  sim.player.invulUntil=200;sim.step({dx:0,dy:0,flags:2});assert.equal(sim.player.invulUntil,200);
  sim.enemies=[enemy(sim,0,0)];sim.player.invulUntil=0;sim.step({dx:0,dy:0,flags:2});
  assert.equal(sim.player.lives,2);assert.equal(sim.player.bombs,0);
});
check('one projectile can graze only once and immunity suppresses graze', () => {
  const sim=new engine.Sim(rules,'aim',false);sim.enemies=[enemy(sim,15,0)];sim.step(zero());sim.step(zero());
  assert.equal(sim.stats.graze,1);sim.enemies=[enemy(sim,15,0)];sim.player.invulUntil=50;sim.step(zero());assert.equal(sim.stats.graze,1);
});
check('last life loses before same-step outgoing damage', () => {
  const sim=new engine.Sim(rules,'aim',false);sim.player.lives=1;sim.enemies=[enemy(sim,0,0)];
  sim.shots=[{id:sim.nextShot++,x:240*64,y:88*64+768,px:240*64,py:88*64+768,born:1}];
  sim.step(zero());assert.equal(sim.status,'dead');assert.equal(sim.stats.damage,0);assert.throws(()=>sim.step(zero()));
});
check('the last lifetime step collides, expiry happens afterwards', () => {
  const sim=new engine.Sim(rules,'aim',false);sim.tick=479;const e=enemy(sim,0,0);e.born=1;sim.enemies=[e];
  sim.step(zero());assert.equal(sim.player.lives,2);assert.equal(sim.enemies.length,0);
});
check('assist changes only initial resources and enemy speed', () => {
  const a=new engine.Sim(rules,'flower',true),b=new engine.Sim(rules,'flower',false);advance(a,60);advance(b,60);
  assert.equal(a.player.lives,5);assert.equal(a.player.bombs,3);assert.equal(a.enemies.length,b.enemies.length);
  const v=rules.directionVectors[(0-16+512)%512];assert.equal(a.enemies[0].vx,Math.trunc(72*v[0]/1024));
});
const samples=[];
for(const scene of engine.scenes)for(const assist of [false,true]){
  const sim=new engine.Sim(rules,scene,assist),records=[];
  while(sim.status==='playing'){const value=zero();records.push(value);sim.step(value);}
  const payload=replay.encode(records,rules,scene,assist);
  check('terminal roundtrip '+scene+' assist='+assist,()=>assert.deepEqual(replay.run(payload,rules,false).snapshot,sim.snapshot()));
  samples.push(payload);
}
let seed=771103;
function random(n){seed=seed*48271%2147483647;return seed%n;}
const cases=samples.map(payload=>({payload,partial:false}));
const directions=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
for(let i=0;i<200;i++){
  const scene=engine.scenes[i%3],assist=Boolean(i%2),sim=new engine.Sim(rules,scene,assist),records=[];
  let current=zero();
  while(sim.status==='playing'){
    if(sim.tick%12===0){const d=directions[random(9)],slow=Boolean(random(2));const speed=d[0]&&d[1]?(slow?67:181):(slow?96:256);current={dx:d[0]*speed,dy:d[1]*speed,flags:slow?1:0};}
    const value={...current,flags:current.flags|(random(700)===0?2:0)};records.push(value);sim.step(value);
  }
  cases.push({payload:replay.encode(records,rules,scene,assist),partial:false});
}
const valid=samples[0],bad=[];
function invalid(name,patch){bad.push({name,payload:{...valid,...patch}});}
invalid('wrong version',{rule:'other'});invalid('not prototype',{prototype:false});invalid('unknown scene',{scene:'phase3'});
invalid('assist is not bool',{assist:1});invalid('zero ticks',{ticks:0});invalid('overlong ticks',{ticks:2701});
invalid('ticks string',{ticks:'2700'});invalid('malformed base64',{input:valid.input+'\n'});invalid('short body',{input:valid.input.slice(4)});
invalid('client supplied state',{state:{lives:999,bombs:999}});
const raw=Buffer.from(valid.input,'base64');raw.writeInt16LE(257,0);invalid('speed hack',{input:raw.toString('base64')});
raw.writeInt16LE(0,0);raw[4]=4;invalid('reserved flag',{input:raw.toString('base64')});
const early=replay.encode([zero()],rules,'flower',false);bad.push({name:'nonterminal',payload:early});
check('noncanonical Base64 padding bits are rejected by the decoder',()=>assert.throws(()=>replay.decode({...early,input:'AAAAAAB='},rules)));
for(const item of bad){check('reject '+item.name,()=>assert.throws(()=>replay.run(item.payload,rules,false)));cases.push({payload:item.payload,partial:false});}
console.log('Running PHP comparisons for '+cases.length+' cases…');
const response=spawnSync(php,[path.join(__dirname,'cli.php')],{input:JSON.stringify({action:'batch',cases}),encoding:'utf8',maxBuffer:100*1024*1024,timeout:120000});
if(response.error)throw response.error;
assert.equal(response.status,0,response.stderr||response.stdout.slice(0,500));
const phpResult=JSON.parse(response.stdout);assert.equal(phpResult.ok,1);assert.equal(phpResult.results.length,cases.length);
for(let i=0;i<cases.length;i++){
  const item=phpResult.results[i];
  if(i<206){assert.equal(item.ok,1,'PHP rejected case '+i+': '+item.reason);assert.deepEqual(item.data,replay.run(cases[i].payload,rules,false),'PHP drift case '+i);}
  else assert.equal(item.ok,0,'PHP accepted illegal case '+bad[i-206].name);
}
const out=path.join(root,'tmp/danmaku');fs.mkdirSync(out,{recursive:true});
for(const payload of samples)fs.writeFileSync(path.join(out,`sample-${payload.scene}-${payload.assist?'assist':'normal'}.json`),JSON.stringify(payload));
const report={status:'PASS',unitChecks:checks,normalTerminalSamples:6,randomTerminalDifferentialCases:200,illegalRejectedByBoth:bad.length,traceIntervalTicks:60,node:process.version,phpExecutable:php,prototypeOnly:true};
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
