/* (C) 2026 Carinoasd. Engraved spell plaques on the original transition: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./spell-change-v4.js'),require('./notice-frames-v7.js'));else root.DanmakuStageShow=factory(root.DanmakuStageShow,root.DanmakuNoticeFrames);
}(typeof globalThis!=='undefined'?globalThis:this,function(common,frames){
 'use strict';var portraits={};
 function effects(c,m,reduced){frames.beginFrame(c,m);if(!m.spellChange)return common.effects(c,m,reduced);
  // Preserve the established release ribbons and the exact four-beat clock.
  if(!reduced&&m.release>0){var p=m.theme===1?(m.phase===1?'#f3bdcf':'#efdaa5'):(m.phase===1?'#a8ddf2':'#cdbcec'),r=m.release;c.save();c.strokeStyle=p;c.globalAlpha=r*.58;c.lineWidth=1.5;
   [-1,1].forEach(function(side){for(var i=0;i<3;i++){var x=m.origin[0],y=m.origin[1]+20+i*10;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+side*50,y-38,x+side*(100+r*28),y+35,x+side*(140+r*32),y-6+i*7);c.stroke();}});c.restore();
  }
  frames.boss(c,m,portraits,reduced);return true;
 }
 return Object.assign({},common,{effects:effects,setPortraits:function(images){portraits=images;common.setPortraits(images);},spellChangeVersion:7});
}));
