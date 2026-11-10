/* (C) 2026 Carinoasd. Offline replay test driver: 小典 / Codex.
 * Chooses legal inputs only; never changes actor state, HP, resources or the clock.
 * A generated winning route is model evidence, not a human difficulty assessment.
 */
'use strict';
const path=require('node:path');
const root=path.resolve(__dirname,'../../source/plugin/gamecenter/games/_danmaku_proto');
const engine=require(path.join(root,'engine.js'));
const {Battle}=require(path.join(root,'battle.js'));
function choose(b,options={}){
  const s=b.sim,p=s.player,h=options.horizon||30;
  const gy=(options.y||500)*64;
  const lead=Math.max(0,Math.round((p.y/64-135)/12));
  let gx=b.stage==='active'?engine.bossX(Math.max(1,s.tick+1+lead)):240*64;
  if(b.stage==='active'&&options.delays&&s.tick<options.delays[b.phaseIndex])gx+=96*64;
  function toward(x,y,limit){const len=Math.hypot(x,y);if(len>limit){x*=limit/len;y*=limit/len;}return{dx:Math.trunc(x),dy:Math.trunc(y),flags:0};}
  const direct=toward(gx-p.x,gy-p.y,256);
  if(b.stage!=='active')return direct;
  const candidates=[direct];
  for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const speed=dx&&dy?181:256;candidates.push({dx:dx*speed,dy:dy*speed,flags:0});
  }
  let best=null;
  for(const input of candidates){
    const ex=Math.max(12*64,Math.min(468*64,p.x+input.dx*h));
    const ey=Math.max(144*64,Math.min(624*64,p.y+input.dy*h));
    let risk=0;
    const start=Math.max(0,p.invulUntil-s.tick);
    if(start<h)for(const e of s.enemies){
      const vx=e.vx-(ex-p.x)/h,vy=e.vy-(ey-p.y)/h;
      const rx=e.x-p.x,ry=e.y-p.y,a=vx*vx+vy*vy;
      const near=a?Math.max(start,Math.min(h,-(rx*vx+ry*vy)/a)):start;
      const distance=Math.hypot(rx+vx*near,ry+vy*near)/64;
      const radius=e.radius+3+(options.margin||3);
      if(distance<radius)risk+=(radius-distance+1)*10000*(1-near/(h+1));
      else if(distance<radius+20)risk+=60/(distance-radius+1);
    }
    const xerr=(p.x+input.dx-gx)/64,yerr=(p.y+input.dy-gy)/64;
    const cost=risk+Math.max(0,Math.abs(xerr)-12)**2*.3+yerr*yerr*.008+(input.dx*input.dx+input.dy*input.dy)/65536*.5;
    if(best===null||cost<best.cost)best={...input,cost,risk};
  }
  if(best.risk>(options.bombRisk||1500)&&p.bombs>0&&s.tick>=p.invulUntil)best.flags|=2;
  return{dx:best.dx,dy:best.dy,flags:best.flags};
}
function drive(rules,assist,options={}){
  const b=new Battle(rules,assist),records=[];
  while(b.status==='playing'){
    const input=choose(b,options);records.push(input);b.step(input);
  }
  return{battle:b,records};
}
module.exports={choose,drive};
