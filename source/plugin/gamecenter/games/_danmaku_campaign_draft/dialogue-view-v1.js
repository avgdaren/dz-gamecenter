/* (C) 2026 Carinoasd. Speaker portraits and measured two-line pages: 小典 / Codex. */
(function(root){
 'use strict';
 function View(data){this.data=data;this.session=null;this.key='';this.page=0;this.pages=[];this.width=0;this.$=function(id){return document.getElementById(id);};this.measure=document.createElement('canvas').getContext('2d');}
 View.prototype.render=function(session,visible,preview){
  var $=this.$,d=session.dialogue;this.$('story-layer').hidden=!d||!visible;$('field-hud').hidden=!!d&&visible;if(!d||!visible)return;
  var scene=root.DanmakuStory.get(d.id),line=scene.lines[d.line],speaker=root.DanmakuStory.cast[line[0]],box=$('story-text'),style=getComputedStyle(box),width=box.clientWidth;
  if(this.session!==session){this.session=session;this.key='';this.page=0;}
  var key=d.id+':'+d.line;if(this.key!==key){this.key=key;this.page=0;this.width=0;}
  if(width!==this.width){this.width=width;this.measure.font=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;this.pages=root.DanmakuStory.layout(line[1],function(text){return this.measure.measureText(text).width;}.bind(this),Math.max(80,width-1));this.page=Math.min(this.page,this.pages.length-1);}
  var sources={player:this.data.firstAssets.title,observer:this.data.firstAssets.portrait,lingyu:this.data.garden.assets.portrait};
  ['left','right'].forEach(function(side){var actor=scene.actors.find(function(id){return root.DanmakuStory.cast[id].side===side;}),image=$('story-'+side);image.hidden=!actor;if(!actor)return;
   if(image.dataset.actor!==actor){image.src=sources[actor];image.dataset.actor=actor;image.alt=root.DanmakuStory.cast[actor].name;}
   image.classList.toggle('speaking',actor===line[0]);image.setAttribute('aria-hidden',String(actor!==line[0]));
  });
  $('story-layer').dataset.speaker=line[0];$('story-title').textContent=(preview?'剧情回看 · ':'')+scene.title;$('story-note').textContent=scene.note;$('story-speaker').textContent=speaker.name;
  box.replaceChildren();this.pages[this.page].forEach(function(text){var span=document.createElement('span');span.textContent=text;box.appendChild(span);});
  $('story-progress').textContent=(d.line+1)+' / '+scene.lines.length+(this.pages.length>1?' · '+(this.page+1)+' / '+this.pages.length+'页':'');
  $('story-next').textContent=this.page+1<this.pages.length?'继续读':'继续';
 };
 View.prototype.move=function(session,skip){if(!session.dialogue)return false;if(skip){session.skipStory();this.key='';return true;}
  if(this.page+1<this.pages.length){this.page++;return true;}session.nextStory();this.key='';return true;
 };
 View.prototype.inspect=function(){return{key:this.key,page:this.page,pages:this.pages.map(function(p){return p.slice();}),width:this.width,visible:!this.$('story-layer').hidden,speaker:this.$('story-layer').dataset.speaker||null};};
 root.DanmakuDialogueView=View;
}(window));
