/* (C) 2026 Carinoasd. Stage-design schedule/geometry audit: 小典 / Codex. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const data=JSON.parse(fs.readFileSync(path.join(root,'docs/danmaku/STAGE-01-DESIGN-v1.json'),'utf8'));
const model=require(path.join(root,'docs/danmaku/stage01-model-v1.js')).create(data);
assert.equal(data.meta.status,'design_proposal_not_game_rules');
assert.equal(data.segments[0].start,0);
data.segments.forEach((s,i)=>{
 assert.ok(s.end>s.start);
 if(i)assert.equal(s.start,data.segments[i-1].end,'Timeline gap or overlap');
});
assert.equal(data.segments.at(-1).end,data.timing.bossActiveSeconds);
assert.equal(data.timing.preludeSeconds+data.timing.bossIntroSeconds,data.timing.bossActiveSeconds);
assert.equal(new Set(model.mobs.map(m=>m.id)).size,model.mobs.length);
assert.equal(model.mobs.length,40,'Draft promises 32 formation enemies, 6 shooters and 2 elites');
model.mobs.forEach(m=>{
 assert.ok(m.start<data.timing.preludeSeconds);
 assert.ok(m.start+data.types[m.type].lifeSeconds<=65,'Enemy persists into final collection window');
});
model.emissions.forEach(e=>{
 assert.ok(e.start-e.warningStart>=data.budgets.firstWarningSeconds-1e-9,'Insufficient warning');
 assert.ok(e.age<data.types[e.type].lifeSeconds,'Enemy fires after leaving');
 assert.ok(e.start<62,'Cleanup interval generates a new attack');
 assert.ok(e.start+e.ttl<=68,'Projectile may persist into final collection window');
});
let mobPeak=0,bulletPeak=0,lifetimeOnlyBulletBound=0,mobPeakAt=0,bulletPeakAt=0;
for(let tick=0;tick<=data.timing.bossActiveSeconds*data.timing.hz;tick++){
 const t=tick/data.timing.hz,s=model.sample(t);
 if(s.mobs.length>mobPeak){mobPeak=s.mobs.length;mobPeakAt=t;}
 if(s.bullets.length>bulletPeak){bulletPeak=s.bullets.length;bulletPeakAt=t;}
 const noCullCount=model.emissions.reduce((n,e)=>n+(t>=e.start&&t<e.start+e.ttl?e.offsets.length:0),0);
 lifetimeOnlyBulletBound=Math.max(lifetimeOnlyBulletBound,noCullCount);
 for(const m of s.mobs){
  assert.ok(Number.isFinite(m.x)&&Number.isFinite(m.y));
  assert.ok(m.y+data.types[m.type].visible[1]/2<240,'Enemy body crosses out of upper activity area');
 }
 for(const b of s.bullets)assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.y));
 if(t>=68)assert.equal(s.mobs.length+s.bullets.length,0);
}
assert.ok(mobPeak<=data.budgets.mobLiveCeiling);
assert.ok(lifetimeOnlyBulletBound<=data.budgets.preludeBulletLiveCeiling);
assert.equal(model.sample(0).segment.id,'arrival');
assert.equal(model.sample(72).segment.id,'boss-intro');
assert.equal(model.sample(75).segment.id,'boss-active');
const oldRules=JSON.parse(fs.readFileSync(path.join(root,'source/plugin/gamecenter/games/_danmaku_proto/rules.json'),'utf8'));
const maxTicks=data.timing.preludeSeconds*data.timing.hz+oldRules.clock.introTicks+
 3*oldRules.clock.phaseMaxTicks+2*oldRules.clock.transitionTicks;
const inputBytes=maxTicks*oldRules.replay.recordBytes,base64Bytes=4*Math.ceil(inputBytes/3);
const report={status:'PASS',scope:'design_schedule_and_geometry_only',sampleHz:data.timing.hz,
 mobs:model.mobs.length,volleys:model.emissions.length,bulletsBorn:model.emissions.reduce((n,e)=>n+e.offsets.length,0),
 mobPeak,mobPeakAt,bulletPeakAtReferencePlayer:bulletPeak,bulletPeakAt,lifetimeOnlyBulletBound,
 rewardTargets:model.mobs.filter(m=>m.reward).length,
 draftHintUnits:model.mobs.filter(m=>m.reward).reduce((n,m)=>n+(m.type==='guardian'?data.rewards.guardianHintUnits:data.rewards.normalHintUnits),0),
 allEntitiesAndBulletsAbsentFromSeconds:68,
 futureFullGame:{maxTicks,seconds:maxTicks/data.timing.hz,inputBytes,base64Bytes,
  needsNewReplayLimits:inputBytes>oldRules.limits.maxInputBytes||base64Bytes>oldRules.limits.maxBase64InputBytes},
 gameplayImplemented:false,gameCollisionVerified:false,actualDifficultyVerified:false,phpPerformanceRemeasured:false};
const out=path.join(root,'tmp/danmaku/stage01');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'design-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
