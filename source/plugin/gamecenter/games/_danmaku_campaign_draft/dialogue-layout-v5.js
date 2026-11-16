/* (C) 2026 Carinoasd. Balanced final dialogue pages: 小典 / Codex. */
(function(root,factory){
 'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./story-data-v1.js'));else root.DanmakuStory=factory(root.DanmakuStory);
}(typeof globalThis!=='undefined'?globalThis:this,function(story){
 'use strict';
 var closing='，。！？；：、”’）》」…',opening='“‘（《「';
 function layout(text,measure,width){
  var original=story.layout(text,measure,width);
  if(original.length<2||original[original.length-1].join('').length>=8)return original;
  // Reflow only the last two pages. Even line count keeps a full second page,
  // and the cost balances reading effort without changing a single character.
  var prefix=original.slice(0,-2),tail=Array.from(original.slice(-2).flat().join('')),n=tail.length;
  var count=4,target=measure(tail.join(''))/count,memo={};
  function solve(start,remaining){
   if(!remaining)return start===n?{cost:0,lines:[]}:null;
   var key=start+':'+remaining;if(Object.prototype.hasOwnProperty.call(memo,key))return memo[key];
   var best=null;
   for(var end=start+1;end<=n-(remaining-1);end++){
    var line=tail.slice(start,end).join(''),size=measure(line);if(size>width)break;
    if(end<n&&(closing.indexOf(tail[end])>=0||opening.indexOf(tail[end-1])>=0))continue;
    var next=solve(end,remaining-1);if(!next)continue;
    var cost=next.cost+Math.pow(size-target,2)+(end-start<3?width*width:0);
    if(!best||cost<best.cost)best={cost:cost,lines:[line].concat(next.lines)};
   }
   memo[key]=best;return best;
  }
  var result=solve(0,count);return result?prefix.concat([result.lines.slice(0,2),result.lines.slice(2)]):original;
 }
 return Object.assign({},story,{layout:layout});
}));
