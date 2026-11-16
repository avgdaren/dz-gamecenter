/* (C) 2026 Carinoasd. Dialogue: avg达人; implementation: 小典 / Codex. */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.DanmakuStory=factory();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';var cast={player:{name:'小天使',side:'left'},observer:{name:'星环观测者',side:'right'},lingyu:{name:'铃羽',side:'right'}};
 var scenes=[
  {id:'s1-open',stage:1,title:'星穹回廊 · 关卡开场',note:'进入错位的星路，星轨闪烁不定。',actors:['player'],lines:[
   ['player','星路真的全乱了……但前辈一定是从这里离开的。'],
   ['player','什么‘堕天’、什么偷走晨星，我才不信。明明昨天还在纠正我的飞行姿势，怎么可能连一句话都不留就叛逃呢……']
  ]},
  {id:'s1-before',stage:1,title:'星穹回廊 · 战前对话',note:'星环观测者降下，展开封锁法阵。',actors:['player','observer'],lines:[
   ['observer','止步。前方星轨已经坍缩，通道全面封锁，见习天使立刻退回圣堂。'],
   ['player','请让我过去！我要去找前辈，她肯定是遇到了什么苦衷才带走晨星的！'],
   ['observer','苦衷改变不了星路断裂的事实。没有晨星锚定，再往前走，乱流会把你的翅膀撕碎。'],
   ['player','前辈教过我穿过乱流的办法，而且第一次施法也是她握着我的手完成的……不管前面是什么，我都要亲口去问她！'],
   ['observer','执迷不悟。既然说是她教你的，那就拿出真本事——连我的星环封锁都穿不过去，你根本活不到见她！']
  ]},
  {id:'s1-after',stage:1,title:'星穹回廊 · 战后对话',note:'观测者收起星环，让开道路。',actors:['player','observer'],lines:[
   ['observer','……身手勉强及格。法阵解开了，顺着残留的星尘往风铃花庭走吧。'],
   ['player','谢谢您！我就知道您也是相信前辈的——'],
   ['observer','别误会，我只是确认你有自保的能力。但在你过去之前，回答我一个问题。'],
   ['observer','如果她真如通缉令所说，是清醒着做出了背叛天界的选择……你找到她之后，打算怎么办？'],
   ['player','怎、怎么办……？那怎么可能……我只是想找到她……'],
   ['observer','去吧。趁还没追上她，路上好好想清楚。']
  ]},
  {id:'s2-open',stage:2,title:'风铃花庭 · 关卡开场',note:'花瓣被逆乱的狂风卷起，风铃声杂乱急促。',actors:['player'],lines:[
   ['player','连花庭的风都失去方向了……祭典明明是大家准备了那么久才盼来的。'],
   ['player','刚才观测者大人的话，到底是什么意思呢……不管啦，先找铃羽大人问问路，她和前辈关系那么好，一定知道些什么！']
  ]},
  {id:'s2-before',stage:2,title:'风铃花庭 · 战前对话',note:'铃羽顶着乱风落下，神情疲惫又火大。',actors:['player','lingyu'],lines:[
   ['lingyu','别过来！这片风障刚压下去，再往前一步，半个花庭的祭典花苗全得卷进虚空里！'],
   ['player','铃羽大人！我是来找前辈的，她一定不会丢下不管，您知道她去哪了吗？'],
   ['lingyu','……哈？你还敢跟我提她？看看这鬼天气！晨星一拔，四方风脉全疯了，我整整一夜没合眼，翅膀都快扇断了！'],
   ['player','对、对不起……可是前辈肯定不是故意的，她平时那么温柔——'],
   ['lingyu','温柔？她温柔，所以烂摊子全该我们替她背吗！你这小家伙眼睛里除了她，看不见别人被折腾成什么样了是不是？'],
   ['lingyu','正好我憋了一肚子火没处撒——接招！不把你脑袋里的美梦吹醒，你休想从我的花庭过去！']
  ]},
  {id:'s2-after',stage:2,title:'风铃花庭 · 战后对话',note:'狂风稍歇，铃羽喘着气收起铃杖。',originalStageDirection:'狂风稍歇，铃羽喘着气收起羽扇。',actors:['player','lingyu'],lines:[
   ['lingyu','啧……真不愧是那家伙手把手带出来的，躲乱流的习惯简直一个模子刻出来的。'],
   ['player','铃羽大人，花苗那边……我先帮您一起用术式固定住吧。刚才只顾着问前辈的事，对不起。'],
   ['lingyu','……算你还有点良心。不用了，主风脉已经稳住了。'],
   ['lingyu','听着，她不是临时起意。祭典前一天，她特意来找我讨过一枚‘止风种’——那是用来彻底抹除气息、藏匿活物或禁物的东西。'],
   ['player','祭典前一天就……？怎么会，她那天明明还笑着摸了摸我的头……'],
   ['lingyu','她穿过花庭往‘云渊断层’去了。那家伙心里装的事太重，为了护住她想护的东西，连我们这些朋友都能一声不吭地推开。'],
   ['lingyu','找到她之后，先替我狠狠骂她一顿……还有，别让她再做蠢事了。']
  ]}
 ];
 function get(id){var scene=scenes.find(function(s){return s.id===id;});if(!scene)throw Error('未知剧情段落');return scene;}
 function layout(text,measure,width){
  if(typeof text!=='string'||typeof measure!=='function'||!Number.isFinite(width)||width<=0)throw Error('对白排版参数无效');
  var lines=[],line='',closing='，。！？；：、”’）》」…',opening='“‘（《「';
  Array.from(text).forEach(function(ch){if(line&&measure(line+ch)>width){var carry='';if(closing.indexOf(ch)>=0||opening.indexOf(line.slice(-1))>=0){carry=Array.from(line).pop();line=line.slice(0,-carry.length);}if(line)lines.push(line);line=carry;}line+=ch;});
  if(line)lines.push(line);var pages=[];for(var i=0;i<lines.length;i+=2)pages.push(lines.slice(i,i+2));return pages.length?pages:[['']];
 }
 return{cast:cast,scenes:scenes,get:get,layout:layout,version:'story-user-20261115'};
}));
