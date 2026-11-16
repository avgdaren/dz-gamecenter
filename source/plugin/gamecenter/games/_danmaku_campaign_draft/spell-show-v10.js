/* (C) 2026 Carinoasd. Difficulty-specific names on the accepted spell presentation: 小典 / Codex. */
(function(root){
 'use strict';var prior=root.DanmakuStageShow,first={easy:prior.phases,normal:['星环 · 双旋交织','星雨 · 引光夹击','星幕 · 迁移星廊'],hard:['星环 · 回旋花冠','星雨 · 悬光回响','星河 · 双岸交织']};
 function difficulty(flow){var s=flow.sim;return s.difficulty||(s.hardMode?'hard':s.rule.indexOf('normal')>=0?'normal':'easy');}
 function names(id,number){return number===1?first[id]:root.Stage02Difficulty.forDifficulty(id).names;}
 root.DanmakuDifficultyPresentation={names:names,difficulty:difficulty,labels:{easy:'Easy',normal:'Normal',hard:'Hard'}};
 root.DanmakuStageShow=Object.assign({},prior,{scene:function(flow,number,reduced,endingAge,breakOrigin){
  var m=prior.scene(flow,number,reduced,endingAge,breakOrigin),id=difficulty(flow);if(id==='easy')return m;
  m.spellNames=names(id,number);m.title=m.spellNames[m.phase];if(m.life){var parts=m.title.split(' · ');m.life.visual=Object.assign({},m.life.visual,{title:m.title,prefix:parts.length>1?parts[0]:'',main:parts[parts.length-1]});}return m;
 }});
}(window));
