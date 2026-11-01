/* Import validation, deterministic merging and content identities. No model calls. */
(function(root){
  'use strict';
  const MathText=root.FinalHelpMath||(typeof require==='function'?require('./math.js'):null);
  const kinds=new Set(['choice','fill','boolean','short','calculation']);
  const text=v=>typeof v==='string'&&!!v.trim();
  const texts=v=>Array.isArray(v)&&v.length>0&&v.every(text);
  const canonical=v=>JSON.stringify(stable(v));
  function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
  function hash(value){const s=typeof value==='string'?value:canonical(value);let a=2166136261,b=5381;for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}-${s.length}`;}
  function parse(raw){
    let s=String(raw).replace(/^\uFEFF/,'').trim();
    if(s.length>10000000)throw new Error('题库超过 10 MB，请分批导入。');
    try{return JSON.parse(s);}catch{}
    const blocks=[...s.matchAll(/```(?:json)?\s*\n?([\s\S]*?)```/gi)];
    if(blocks.length===1)s=blocks[0][1].trim();
    try{return JSON.parse(s);}catch{throw new Error('无法读取题库格式。请导入完整 JSON 或单个 JSON 代码块；公式反斜杠在 JSON 中应写成双反斜杠。');}
  }
  function validate(bank){
    const errors=[],warnings=[];
    const issue=(path,message,q)=>errors.push({path,message,...(q?{question_id:q.id||'',prompt:String(q.prompt||'').slice(0,100)}:{})});
    const checkText=(value,path,q)=>{if(!text(value))issue(path,'内容不能为空，须由出题 AI 预先补齐。',q);else {
      if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value))issue(path,'含不可见控制字符，请检查公式反斜杠是否正确转义。',q);
      for(const error of MathText.validate(value))issue(path,error,q);
    }};
    const list=(value,path,q)=>{if(!texts(value))issue(path,'需要至少一项完整文字。',q);else value.forEach((v,i)=>checkText(v,`${path}[${i}]`,q));};
    if(!bank||typeof bank!=='object'||Array.isArray(bank))return {ok:false,errors:[{path:'题库',message:'需要包含来源和题目的完整题库对象。'}],warnings};
    if(bank.version!==2)issue('version','题库版本须为 2。');
    checkText(bank.id,'id');checkText(bank.title,'title');
    const sourceIds=new Set();
    if(!Array.isArray(bank.sources)||!bank.sources.length)issue('sources','缺少可核对的资料来源。');
    else bank.sources.forEach((s,i)=>{
      const path=`sources[${i}]`;if(!s||typeof s!=='object'||Array.isArray(s)){issue(path,'来源格式错误。');return;}
      for(const k of ['id','title','locator','excerpt'])checkText(s[k],`${path}.${k}`);
      if(sourceIds.has(s.id))issue(`${path}.id`,'来源 ID 重复。');if(text(s.id))sourceIds.add(s.id);
    });
    const ids=new Set(),stems=new Map();
    if(!Array.isArray(bank.questions)||bank.questions.length<1||bank.questions.length>5000)issue('questions','题库须包含 1–5000 道题。');
    else bank.questions.forEach((q,i)=>{
      const path=`questions[${i}]`;
      if(!q||typeof q!=='object'||Array.isArray(q)){issue(path,'题目格式错误。');return;}
      for(const k of ['id','chapter','prompt','explanation'])checkText(q[k],`${path}.${k}`,q);
      if(typeof q.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(q.id)||['constructor','prototype'].includes(q.id))issue(`${path}.id`,'ID 须为字母/数字开头，后接字母、数字、下划线或短横线。',q);
      if(ids.has(q.id))issue(`${path}.id`,'题目 ID 重复，无法可靠保存进度。',q);ids.add(q.id);
      if(!kinds.has(q.type))issue(`${path}.type`,'题型须为 choice、fill、boolean、short 或 calculation。',q);
      if(!['基础','进阶','综合'].includes(q.difficulty))issue(`${path}.difficulty`,'难度须为基础、进阶或综合。',q);
      for(const k of ['knowledge','solution_steps','checkpoints','common_mistakes'])list(q[k],`${path}.${k}`,q);
      if(!texts(q.source_ids)||q.source_ids.some(id=>!sourceIds.has(id)))issue(`${path}.source_ids`,'缺少来源或引用了不存在的来源 ID。',q);
      if(['points','score','rubric','keywords'].some(k=>Object.hasOwn(q,k)))issue(path,'本系统不使用分数或关键词评分配置，请移除这些字段。',q);
      if(q.type==='choice'){
        const options=q.options;
        if(!Array.isArray(options)||options.length<2||options.some(o=>!o||!text(o.id)||!text(o.text)))issue(`${path}.options`,'至少需要两个完整选项。',q);
        else {
          const optionIds=options.map(o=>o.id);if(new Set(optionIds).size!==optionIds.length)issue(`${path}.options`,'选项 ID 重复。',q);
          options.forEach((o,j)=>checkText(o.text,`${path}.options[${j}].text`,q));
          if(!texts(q.answer)||new Set(q.answer).size!==q.answer.length||q.answer.some(a=>!optionIds.includes(a)))issue(`${path}.answer`,'正确选项为空、重复或不在选项中。',q);
        }
        if(typeof q.multiple!=='boolean'||(!q.multiple&&Array.isArray(q.answer)&&q.answer.length!==1))issue(`${path}.multiple`,'须明确单选/多选，单选只能有一个正确选项。',q);
      }else if(q.type==='fill'){
        if(!Array.isArray(q.answer)||!q.answer.length||!q.answer.every(texts))issue(`${path}.answer`,'须逐空提供答案和可接受别名，例如 [["答案一"],["答案二"]]。',q);
        else q.answer.forEach((a,j)=>a.forEach((v,k)=>checkText(v,`${path}.answer[${j}][${k}]`,q)));
        if(q.answer_display!==undefined){list(q.answer_display,`${path}.answer_display`,q);if(!Array.isArray(q.answer_display)||q.answer_display.length!==q.answer?.length)issue(`${path}.answer_display`,'展示答案数量须与填空数量一致。',q);}
      }else if(q.type==='boolean'){if(typeof q.answer!=='boolean')issue(`${path}.answer`,'判断题答案必须是真正的 true 或 false。',q);}
      else if(kinds.has(q.type))checkText(q.answer,`${path}.answer`,q);
      const stem=canonical([q.type,String(q.prompt||'').replace(/\s+/g,' ').trim(),q.options||[]]);
      if(stems.has(stem))warnings.push({path,message:`题干及选项与第 ${stems.get(stem)+1} 题重复，请确认是否需要保留。`,question_id:q.id});else stems.set(stem,i);
    });
    return {ok:errors.length===0,errors,warnings};
  }
  function prepare(bank){const clean=JSON.parse(JSON.stringify(bank));delete clean.fingerprint;clean.fingerprint=hash(clean);return clean;}
  function questionFingerprint(bank,q){return hash({question:q,sources:bank.sources.filter(s=>q.source_ids.includes(s.id))});}
  function merge(base,incoming){
    const report=validate(incoming);if(!report.ok)return {bank:null,...report};
    if(!base)return {bank:prepare(incoming),ok:true,errors:[],warnings:report.warnings,added:incoming.questions.length,skipped:0};
    const errors=[],warnings=[...report.warnings];
    if(base.id!==incoming.id)errors.push({path:'id',message:'追加内容的题库 ID 不同，请选择替换题库，或让 AI 使用相同课程 ID。'});
    const combined=JSON.parse(JSON.stringify(base));delete combined.fingerprint;
    const sources=new Map(base.sources.map(s=>[s.id,s]));
    incoming.sources.forEach(s=>{if(sources.has(s.id)){if(canonical(s)!==canonical(sources.get(s.id)))errors.push({path:`来源 ${s.id}`,message:'来源 ID 相同但内容不同，请先核实并统一。'});}else {combined.sources.push(s);sources.set(s.id,s);}});
    const ids=new Map(base.questions.map(q=>[q.id,q]));
    const contents=new Set(base.questions.map(q=>{const copy={...q};delete copy.id;return canonical(copy);}));let added=0,skipped=0;
    const stem=q=>canonical([q.type,q.prompt.replace(/\s+/g,' ').trim(),q.options||[]]);
    const stems=new Map(base.questions.map(q=>[stem(q),q.id]));
    incoming.questions.forEach(q=>{
      const copy={...q};delete copy.id;const content=canonical(copy);
      if(ids.has(q.id)){
        if(canonical(ids.get(q.id))===canonical(q)){skipped++;return;}
        errors.push({path:`题目 ${q.id}`,message:'同一题目 ID 的内容不同。追加不会覆盖旧题；更新题目请导入完整题库并选择替换。'});return;
      }
      if(contents.has(content)){skipped++;return;}
      if(stems.has(stem(q)))warnings.push({path:`题目 ${q.id}`,message:`题干和选项与现有题目 ${stems.get(stem(q))} 重复，但内容不完全一致，请核查是否需要保留。`});
      combined.questions.push(q);ids.set(q.id,q);contents.add(content);added++;
      stems.set(stem(q),q.id);
    });
    if(combined.questions.length>5000)errors.push({path:'questions',message:'合并后超过 5000 题，请拆分课程。'});
    return {ok:errors.length===0,bank:errors.length?null:prepare(combined),errors,warnings,added,skipped};
  }
  function repairPrompt(report){
    const lines=['请修正我提供的 BUCT FinalHelp v2 题库。只返回一个完整 JSON 代码块，不要让我运行代码。','保留原资料事实、题目 ID、章节、知识点和已经正确的内容。仅依据原资料修正，无法确认的答案或出处不要编造。','每题须有固定 answer、explanation、solution_steps、checkpoints、common_mistakes 和有效 source_ids；不得包含分数。','公式使用 \\(…\\) 或 \\[…\\] 包围的 LaTeX；JSON 中反斜杠必须正确转义。填空可接受答案用普通输入形式，漂亮公式可放在逐空 answer_display。','需要修正的问题：'];
    for(const item of report.errors||[])lines.push(`- ${item.path}${item.question_id?`（${item.question_id}）`:''}：${item.message}${item.prompt?` 题干：${item.prompt}`:''}`);
    for(const item of report.warnings||[])lines.push(`- 请核查：${item.path}：${item.message}`);
    return lines.join('\n');
  }
  root.FinalHelpBank={parse,validate,prepare,merge,canonical,hash,questionFingerprint,repairPrompt};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.FinalHelpBank;
})(typeof globalThis!=='undefined'?globalThis:this);
