/** 作者：GPT / Codex。离线状态测试用 DOM 子集，不模拟浏览器布局。 */
const decode = text => text.replace(/&(?:amp|lt|gt|quot|#39);/g, c => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[c]));
class Element {
  constructor(tag) { this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.listeners={};this.parentElement=null;this.disabled=false;this._text=''; }
  setAttribute(name,value) {this.attrs[name]=String(value);}
  getAttribute(name) {return this.attrs[name]??null;}
  get className(){return this.attrs.class||'';}
  set className(value){this.attrs.class=value;}
  get classList(){const self=this;return {contains:n=>self.className.split(' ').includes(n),toggle(n,on){const a=new Set(self.className.split(' ').filter(Boolean));const add=on??!a.has(n);if(add)a.add(n);else a.delete(n);self.className=[...a].join(' ');}};}
  get dataset(){const self=this;return new Proxy({}, {get:(_,key)=>self.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()))??undefined,set:(_,key,value)=>{self.setAttribute('data-'+key,value);return true;}});}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(value){this._text=String(value);this.children=[];}
  get firstElementChild(){return this.children[0]||null;}
  appendChild(child){child.remove();child.parentElement=this;this.children.push(child);return child;}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}}
  set innerHTML(html){
    this.children=[];this._text='';const stack=[this];
    for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){
      if(token.startsWith('</')){stack.pop();continue;}
      if(token.startsWith('<')){
        const match=/^<([\w-]+)/.exec(token);if(!match)continue;
        const el=new Element(match[1]);
        for(const m of token.slice(match[0].length).matchAll(/([\w-]+)(?:="([^"]*)"|='([^']*)')?/g)){
          el.setAttribute(m[1],decode(m[2]??m[3]??''));
          if(m[1]==='disabled')el.disabled=true;
        }
        el.hidden=el.getAttribute('hidden')!==null;el.style={};stack.at(-1).appendChild(el);
        if(!token.endsWith('/>')&&!['INPUT','BR','IMG','LINK','META'].includes(el.tagName))stack.push(el);
      }else stack.at(-1)._text+=decode(token);
    }
  }
  matches(selector){
    const tag=/^[\w-]+/.exec(selector);if(tag&&this.tagName!==tag[0].toUpperCase())return false;
    const id=/#([\w-]+)/.exec(selector);if(id&&this.getAttribute('id')!==id[1])return false;
    for(const m of selector.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(m[1]))return false;
    for(const m of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g))if(m[2]===undefined?this.getAttribute(m[1])===null:this.getAttribute(m[1])!==m[2])return false;
    return true;
  }
  querySelectorAll(selector){
    const parts=selector.trim().split(/\s+/),out=[];
    const visit=el=>{for(const child of el.children){let yes=child.matches(parts.at(-1));let ancestor=child.parentElement;
      for(let n=parts.length-2;n>=0&&yes;n--){while(ancestor&&!ancestor.matches(parts[n]))ancestor=ancestor.parentElement;if(!ancestor)yes=false;else ancestor=ancestor.parentElement;}
      if(yes)out.push(child);visit(child);}};visit(this);return out;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let el=this;el;el=el.parentElement)if(el.matches(selector))return el;return null;}
  contains(other){for(let el=other;el;el=el.parentElement)if(el===this)return true;return false;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  click(){if(this.disabled)return;const event={type:'click',target:this,preventDefault(){}};for(let el=this;el;el=el.parentElement)el.dispatchEvent(event);}
  focus(){}
}

export { Element };
