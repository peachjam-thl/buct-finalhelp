/* Rich text is ordinary text plus delimited TeX, never arbitrary HTML. */
(function(root){
  'use strict';
  const engine=()=>root.katex || (typeof require==='function' ? require('./vendor/katex/katex.min.js') : null);
  const options=display=>({displayMode:display,throwOnError:true,trust:false,strict:'ignore',maxExpand:500,maxSize:20,macros:{},output:'htmlAndMathml'});
  function upgradeLegacy(text){
    if (/\\\(|\\\[|\$\$/.test(text)) return text;
    return text.replace(/([A-Za-z])\s*=\s*∫₀\^∞\s*e\^\(([-+\dA-Za-z. ]+)\)\s*d([A-Za-z])\s*=\s*(\d+)\/(\d+)/g,
      (_,name,exponent,variable,a,b)=>`\\[${name}=\\int_{0}^{\\infty} e^{${exponent}}\\,\\mathrm{d}${variable}=\\frac{${a}}{${b}}\\]`);
  }
  function split(text){
    const input=upgradeLegacy(String(text??'')), tokens=[], issues=[];
    const starts=['\\[','\\(','$$','$'], closes={'\\[':'\\]','\\(':'\\)','$$':'$$','$':'$'};
    const escaped=i=>{let n=0;for(let j=i-1;j>=0&&input[j]==='\\';j--)n++;return n%2===1;};
    let cursor=0,plain=0;
    while(cursor<input.length){
      let open=starts.find(s=>input.startsWith(s,cursor)&&!escaped(cursor));
      if(!open){cursor++;continue;}
      if(open==='$' && /\s/.test(input[cursor+1]||'')){cursor++;continue;}
      const close=closes[open];let end=cursor+open.length;
      while(end<input.length && !(input.startsWith(close,end)&&!escaped(end)))end++;
      if(end>=input.length){if(open!=='$')issues.push(`公式缺少结束符 ${close}`);cursor+=open.length;continue;}
      if(cursor>plain)tokens.push({type:'text',value:input.slice(plain,cursor)});
      const value=input.slice(cursor+open.length,end);
      if(!value.trim())issues.push('公式内容为空');
      tokens.push({type:'math',value,display:open==='\\['||open==='$$'});
      cursor=end+close.length;plain=cursor;
    }
    if(plain<input.length)tokens.push({type:'text',value:input.slice(plain)});
    return {tokens,issues};
  }
  function validate(text){
    const parsed=split(text), errors=[...parsed.issues];
    for(const token of parsed.tokens)if(token.type==='math'){
      try{engine().renderToString(token.value,options(token.display));}
      catch(error){errors.push(`公式无法排版：${String(error.message).slice(0,200)}`);}
    }
    return errors;
  }
  function append(element,text){
    for(const token of split(text).tokens){
      if(token.type==='text'){element.append(document.createTextNode(token.value));continue;}
      const span=document.createElement('span');span.className=token.display?'math-block':'math-inline';
      try{engine().render(token.value,span,options(token.display));}
      catch(error){span.className+=' math-error';span.textContent=token.value;span.title=String(error.message);}
      element.append(span);
    }
    return element;
  }
  root.FinalHelpMath={split,validate,append,upgradeLegacy,options};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.FinalHelpMath;
})(typeof globalThis!=='undefined'?globalThis:this);
