/* (C) 2026 Carinoasd. Legal-input one-stage model driver: 小典 / Codex.
 * Chooses keyboard-representable inputs. Never edits simulator state.
 */
'use strict';
const E=require('../../source/plugin/gamecenter/games/_danmaku_proto/engine.js');
const S=require('../../source/plugin/gamecenter/games/_danmaku_proto/stage.js');
function choose(b,options={}){
 const s=b.sim,p=s.player,h=options.horizon||30;
 let focused=options.focus!==false,targetKind=-1,collecting=false;
 let gx=240*64,gy=(options.y||500)*64;
 if(b.stage==='active'){
  const lead=Math.max(0,Math.round((p.y/64-135)/12));gx=E.bossX(Math.max(1,s.tick+1+lead));
  if(options.delays&&s.tick<options.delays[b.phaseIndex])gx+=96*64;
 }else if(b.stage==='prelude'){
  const targets=s.mobs.filter(m=>m.y>32*64&&m.x>24*64&&m.x<456*64&&m.hp>0);
  targets.sort((a,c)=>(c.reward?1:0)-(a.reward?1:0)||c.type-a.type||Math.abs(a.x-p.x)-Math.abs(c.x-p.x)||a.id-c.id);
  if(targets.length){const m=targets[0],lead=Math.max(1,Math.round((p.y-m.y)/(12*64)));gx=S.position(s.rules,m,s.tick-m.born+lead).x;targetKind=m.type;}
  const items=s.drops.filter(d=>!d.attracted&&d.y>240*64&&s.tick>=d.unlock);
  items.sort((a,c)=>(a.x-p.x)**2+(a.y-p.y)**2-((c.x-p.x)**2+(c.y-p.y)**2)||a.id-c.id);
  if(items.length){gx=items[0].x;gy=Math.max(330*64,Math.min(560*64,items[0].y+24*64));collecting=true;}
 }
 gx=Math.max(12*64,Math.min(468*64,gx));
 if(options.focus===undefined)focused=b.stage!=='prelude'||(targetKind>0&&!collecting&&Math.abs(gx-p.x)<32*64);
 const limit=focused?96:256,diagonal=focused?67:181;
 const candidates=[];
 for(const [x,y]of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
  const speed=x&&y?diagonal:limit,dx=x*speed,dy=y*speed;
  const ex=Math.max(12*64,Math.min(468*64,p.x+dx*h)),ey=Math.max(144*64,Math.min(624*64,p.y+dy*h));
  let risk=0;
  const start=Math.max(0,p.invulUntil-s.tick);
  if(start<h)for(const e of s.enemies){
   const vx=e.vx-(ex-p.x)/h,vy=e.vy-(ey-p.y)/h,rx=e.x-p.x,ry=e.y-p.y,a=vx*vx+vy*vy;
   const near=a?Math.max(start,Math.min(h,-(rx*vx+ry*vy)/a)):start;
   const distance=Math.hypot(rx+vx*near,ry+vy*near)/64,radius=e.radius+6;
   if(distance<radius)risk+=(radius-distance+1)*10000*(1-near/(h+1));
   else if(distance<radius+20)risk+=60/(distance-radius+1);
  }
  const xerr=(p.x+dx-gx)/64,yerr=(p.y+dy-gy)/64;
  const cost=risk+Math.max(0,Math.abs(xerr)-10)**2*.28+yerr*yerr*.018+(dx*dx+dy*dy)/65536*.5;
  candidates.push({dx,dy,flags:focused?1:0,cost,risk});
 }
 candidates.sort((a,c)=>a.cost-c.cost);const best=candidates[0];
 if(best.risk>(options.bombRisk||1500)&&p.bombs>0&&s.tick>=p.invulUntil&&(!s.bombMode||s.tick>=s.bombCooldownUntil)&&(b.stage==='prelude'||b.stage==='active'))best.flags|=2;
 if(options.bombTicks&&options.bombTicks.includes(b.tick+1)&&(b.stage==='prelude'||b.stage==='active'))best.flags|=2;
 return{dx:best.dx,dy:best.dy,flags:best.flags};
}
function fromSnapshot(snapshot,rules){
 const v=snapshot.sim,p=v.player;
 const mobs=v.mobs.map(a=>({id:a[0],type:a[1],born:a[2],baseX:a[3],mirror:!!a[4],reward:a[5],x:a[6],y:a[7],hp:a[8]}));
 return{rule:snapshot.rule,tick:snapshot.tick,stage:snapshot.stage,phaseIndex:snapshot.phase,sim:{tick:v.tick,rules,bombMode:!!v.bomb,bombCooldownUntil:v.bomb?v.bomb[1]:0,player:{x:p[0],y:p[1],lives:p[2],bombs:p[3],invulUntil:p[4]},
  enemies:v.enemies.map(a=>({x:a[1],y:a[2],vx:a[3],vy:a[4],radius:a[5]})),mobs,
  drops:v.drops.map(a=>({id:a[0],x:a[1],y:a[2],unlock:a[6],attracted:!!a[7],kind:a[8]||0}))}};
}
function drive(rules,assist,options={}){
 const b=new S.Stage(rules,assist,options.rule),records=[],changes=[];let lastLevel=1,lastStage='prelude';
 while(b.status==='playing'){
  const input=choose(b,options);records.push(input);b.step(input);
  const lv=S.level(b.sim.player.power,rules);
  if(lv!==lastLevel||b.stage!==lastStage){changes.push({tick:b.tick,stage:b.stage,power:b.sim.player.power,level:lv,lives:b.sim.player.lives,bombs:b.sim.player.bombs});lastLevel=lv;lastStage=b.stage;}
 }
 return{battle:b,records,changes};
}
module.exports={choose,drive,fromSnapshot};
