/* (C) 2026 Carinoasd. Local focus binding, replay-independent: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuControls=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var blocked=['KeyW','KeyA','KeyS','KeyD','KeyX'];
  function normalize(code){
    if(code==='ShiftLeft'||code==='ShiftRight'||code==='Shift')return 'Shift';
    if(typeof code!=='string')return null;
    if(/^Key[A-Z]$/.test(code)&&blocked.indexOf(code)<0||/^Digit[0-9]$/.test(code))return code;
    return null;
  }
  function label(code){return code==='Shift'?'Shift':/^Key[A-Z]$/.test(code)?code.slice(3):/^Digit[0-9]$/.test(code)?code.slice(5):'Shift';}
  function matches(eventCode,binding){return binding==='Shift'?(eventCode==='ShiftLeft'||eventCode==='ShiftRight'):eventCode===binding;}
  function fromStored(raw){try{return normalize(JSON.parse(raw).focus)||'Shift';}catch(error){return 'Shift';}}
  return{normalize:normalize,label:label,matches:matches,fromStored:fromStored};
}));
