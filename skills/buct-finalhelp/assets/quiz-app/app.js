(() => {
  'use strict';
  const embedded = JSON.parse(document.getElementById('bank').textContent), demo = JSON.parse(document.getElementById('demoBank').textContent);
  const S = FinalHelpStudy, B = FinalHelpBank, M = FinalHelpMath;
  const $ = id => document.getElementById(id);
  const create = (tag, text, cls) => {const el = document.createElement(tag); if (text !== undefined) {if(['div','span','p','li','h1','h2','h3','h4','strong','summary'].includes(tag))M.append(el,text);else el.textContent=text;} if (cls) el.className = cls; return el;};
  const labels = {all: '全部', fill: '填空题', boolean: '判断题', choice: '选择题', short: '简答题', calculation: '计算题'};
  let bank=null, state=null, key='', view = {type: 'all', chapter: '', knowledge: '', wrong: false, page: 0};
  let lastReport=null, importing=false, didImport=false;
  const pageSize = 6;
  function notify(message) {$('notice').textContent = message;}
  function save() {if(!state)return;try {localStorage.setItem(key, JSON.stringify(state));} catch {notify('浏览器无法保存进度，请在关闭前导出。');}}
  function stats() {
    const s = S.stats(state); $('completed').textContent = `${s.viewed}/${bank.questions.length}`;
    $('correct').textContent = s.mastered; $('wrong').textContent = s.review;
    $('progress').max = bank.questions.length; $('progress').value = s.viewed;
  }
  function options(id, title, values) {
    const all = create('option', title); all.value = ''; $(id).replaceChildren(all);
    values.forEach(v => {const o = create('option', v); o.value = v; $(id).append(o);});
  }
  function configure(){
    options('chapter', '全部章节', [...new Set(bank.questions.map(q => q.chapter))]);
    options('knowledge', '全部知识点', [...new Set(bank.questions.flatMap(q => q.knowledge))]);
    $('types').replaceChildren();
    Object.entries(labels).forEach(([type, label]) => {
    const count = type === 'all' ? bank.questions.length : bank.questions.filter(q => q.type === type).length;
    if (!count) return;
    const button = create('button', `${label} ${count}`); button.dataset.type = type;
    button.addEventListener('click', () => {view.type = type; view.page = 0; render();}); $('types').append(button);
    });
  }
  async function applyBank(next,message,persist=true){
    save();bank=B.prepare(next);key=`buct-finalhelp:course:${bank.id}`;state=S.fresh(bank);
    try{
      const raw=localStorage.getItem(key)|| (next.fingerprint?localStorage.getItem(`buct-finalhelp:self-study:${next.fingerprint}`):null);
      if(raw){const parsed=JSON.parse(raw);state=S.restore(parsed.version===5?bank:{...bank,fingerprint:next.fingerprint||bank.fingerprint},parsed);}
    }catch{notify('旧进度与本题库不匹配，已保留可用题库；可以手动导入备份进度。');}
    view={type:'all',chapter:'',knowledge:'',wrong:false,page:0};$('onlyWrong').checked=false;
    $('title').replaceChildren();M.append($('title'),bank.title);$('subtitle').replaceChildren();M.append($('subtitle'),bank.subtitle||'先尝试作答，再对照原出题 AI 准备的答案与详细解析。');
    configure();$('practice').hidden=false;$('exportBank').disabled=false;render();save();
    $('libraryStatus').textContent=message||`已加载 ${bank.questions.length} 道题，题目和答案都已准备好。`;
    if(persist&&!(await FinalHelpStorage.put(bank)))notify('题库可正常使用，但浏览器未能自动保存。请导出题库和学习进度备份。');
  }
  function report(result){
    lastReport=result;$('importReport').hidden=false;$('issueList').replaceChildren();
    $('reportTitle').textContent=result.errors.length?`发现 ${result.errors.length} 个问题，当前题库未被修改`:`检查通过${result.warnings.length?`，有 ${result.warnings.length} 条提醒`:''}`;
    [...result.errors,...result.warnings].slice(0,12).forEach(item=>{const li=create('li');li.textContent=`${item.path}：${item.message}${item.question_id?`（${item.question_id}）`:''}`;$('issueList').append(li);});
    if(result.errors.length+result.warnings.length>12)$('issueList').append(create('li','其余问题见完整修正说明。'));
    $('copyRepair').hidden=$('downloadRepair').hidden=!result.errors.length&&!result.warnings.length;
    $('repairText').hidden=true;
  }
  function download(value,name,mime='application/json'){
    const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:mime});const url=URL.createObjectURL(blob),a=create('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importDocuments(documents){
    if(importing)return;importing=true;didImport=true;$('importPaste').disabled=$('chooseBank').disabled=$('loadDemo').disabled=true;
    $('libraryStatus').textContent='正在检查题库、答案和公式…';
    try{
      let staged=$('importMode').value==='append'?bank:null,added=0,skipped=0;const errors=[],warnings=[];
      for(const document of documents){
        let data;try{data=B.parse(document.text);}catch(error){errors.push({path:document.name,message:error.message});continue;}
        const result=B.merge(staged,data);
        errors.push(...result.errors.map(e=>({...e,path:`${document.name} · ${e.path}`})));warnings.push(...result.warnings.map(e=>({...e,path:`${document.name} · ${e.path}`})));
        if(result.ok){staged=result.bank;added+=result.added;skipped+=result.skipped;}
      }
      if(errors.length||!staged){report({errors:errors.length?errors:[{path:'题库',message:'没有可导入内容。'}],warnings});$('importPanel').open=true;$('libraryStatus').textContent='请修正问题后重新导入，已有题库和进度未改变。';return;}
      await applyBank(staged,`已导入 ${added} 道题${skipped?`，跳过 ${skipped} 道完全重复题`:''}。当前共 ${staged.questions.length} 道，未修改题目的进度已保留。`);
      report({errors:[],warnings});$('importPanel').open=warnings.length>0;$('bankPaste').value='';
    }catch(error){report({errors:[{path:'导入',message:String(error.message)}],warnings:[]});$('importPanel').open=true;}
    finally{importing=false;$('importPaste').disabled=$('chooseBank').disabled=false;$('loadDemo').disabled=!demo;}
  }
  async function importFiles(files){
    const documents=[];for(const file of files){if(file.size>10000000){report({errors:[{path:file.name,message:'超过 10 MB，请分批导入。'}],warnings:[]});$('importPanel').open=true;return;}documents.push({name:file.name,text:await file.text()});}
    if(documents.length)await importDocuments(documents);
  }
  function list(box, heading, values, ordered = false) {
    box.append(create('h4', heading)); const ul = create(ordered ? 'ol' : 'ul'); values.forEach(value => ul.append(create('li', value))); box.append(ul);
  }
  function explanation(q, article) {
    article.querySelector('.result')?.remove(); if (!state.revealed[q.id]) return;
    const judgment = state.judgments[q.id];
    const box = create('div', undefined, `result reference${judgment ? judgment.correct ? ' good' : ' bad' : ''}`); box.setAttribute('aria-live', 'polite');
    if (judgment) {
      box.append(create('strong', judgment.correct ? '回答正确' : '答案有误，已自动加入错题'));
      if (judgment.details.length) box.append(create('p', judgment.details.map(d => `第 ${d.blank} 空：${d.correct ? '✓ 正确' : '✗ 与预设答案不一致'}`).join('\n')));
    }
    box.append(create('strong', '参考答案'), create('p', S.reference(q)));
    list(box, '解题步骤', q.solution_steps, true);
    box.append(create('h4', '详细解析'), create('p', q.explanation));
    list(box, '自查要点', q.checkpoints); list(box, '易错点', q.common_mistakes);
    const sources = create('details'); sources.append(create('summary', '查看资料依据'));
    q.source_ids.forEach(id => {const s = bank.sources.find(s => s.id === id); sources.append(create('p', `${s.title} · ${s.locator}\n${s.excerpt}`));}); box.append(sources);
    if (!S.objective(q)) {
      const actions = create('div', undefined, 'self-actions');
      for (const [value, text] of [['mastered', '我已掌握'], ['review', '加入错题']]) {
        const button = create('button', text); button.type = 'button'; button.setAttribute('aria-pressed', String(state.marks[q.id] === value));
        button.addEventListener('click', () => {S.mark(state, q.id, value); save(); stats(); explanation(q, article);}); actions.append(button);
      }
      box.append(actions);
    }
    box.append(create('p', S.objective(q) ? '按原出题 AI 预设的答案本地核对，不显示分数；填空以给定答案及别名为准。' : '答案与解析由出题 AI 在生成题库时准备；本题由你自行对照。', 'reference-note'));
    article.append(box);
  }
  function card(q, index) {
    const article = create('article', undefined, 'question'); article.dataset.question = q.id;
    article.append(create('div', `${q.chapter} · 第 ${index + 1} 题 · ${labels[q.type]} · ${q.difficulty}`, 'meta'));
    const heading = create('h3', q.prompt, 'prompt'); heading.id = `prompt-${q.id}`; article.append(heading, create('div', q.knowledge.join(' / '), 'meta'));
    const form = create('form', undefined, 'answer-row'); form.setAttribute('aria-labelledby', heading.id);
    const controls = create('div', undefined, ['choice','boolean'].includes(q.type) ? 'options' : 'answer-fields');
    const draft = state.drafts[q.id]; let read;
    if (q.type === 'choice' || q.type === 'boolean') {
      const choices = q.type === 'choice' ? q.options : [{id: true, text: '正确'}, {id: false, text: '错误'}];
      const inputs = choices.map(o => {
        const label = create('label', undefined, 'option'), input = create('input');
        input.type = q.type === 'choice' && q.multiple ? 'checkbox' : 'radio'; input.name = q.id;
        input.checked = q.type === 'choice' ? (draft || []).includes(o.id) : draft === o.id;
        label.append(input, create('span', q.type === 'choice' ? `${o.id}. ${o.text}` : o.text)); controls.append(label); return {input, value: o.id};
      });
      read = () => q.type === 'choice' ? inputs.filter(x => x.input.checked).map(x => x.value) : inputs.find(x => x.input.checked)?.value;
    } else if (q.type === 'fill') {
      const fields = create('div', undefined, 'blank-fields');
      const inputs = q.answer.map((_, i) => {const input = create('input'); input.placeholder = `第 ${i + 1} 空`; input.setAttribute('aria-label', `第 ${index + 1} 题第 ${i + 1} 空`); input.value = draft?.[i] || ''; input.maxLength = 20000; fields.append(input); return input;});
      controls.append(fields); read = () => inputs.map(input => input.value);
    } else {
      const input = create('textarea'); input.placeholder = q.type === 'calculation' ? '先写出公式、计算步骤和单位，再查看固定答案与解法' : '先写下你的理解，再对照参考答案与自查要点';
      input.setAttribute('aria-label', `第 ${index + 1} 题答案`); input.maxLength = 20000; input.value = draft || ''; controls.append(input); read = () => input.value;
    }
    const label = () => state.revealed[q.id] ? '收起解析' : S.objective(q) ? '核对答案与解析' : '查看答案与解析';
    const button = create('button', label(), 'submit'); button.type = 'submit';
    button.disabled = !state.revealed[q.id] && S.objective(q) && !S.ready(q, read());
    controls.addEventListener('input', () => {
      S.edit(state, q, read()); button.textContent = label(); button.disabled = S.objective(q) && !S.ready(q, read()); explanation(q, article); stats(); save();
    });
    form.append(controls, button); article.append(form); explanation(q, article);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (state.revealed[q.id]) delete state.revealed[q.id];
      else if (!S.submit(state, q, read())) return;
      button.textContent = label(); button.disabled = !state.revealed[q.id] && S.objective(q) && !S.ready(q, read()); explanation(q, article); stats(); save();
    });
    return article;
  }
  function render() {
    if(!bank||!state)return;
    const filtered = bank.questions.filter(q => (view.type === 'all' || q.type === view.type) && (!view.chapter || q.chapter === view.chapter) && (!view.knowledge || q.knowledge.includes(view.knowledge)) && (!view.wrong || state.history.includes(q.id)));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); view.page = Math.min(view.page, pages - 1);
    for (const button of $('types').children) button.setAttribute('aria-pressed', String(button.dataset.type === view.type));
    $('sectionTitle').textContent = `${view.wrong ? '错题重练 · ' : ''}${view.type === 'all' ? '全部题目' : labels[view.type]}`;
    $('pageInfo').textContent = `${filtered.length} 题 · 第 ${view.page + 1}/${pages} 页`; $('pageLabel').textContent = `${view.page + 1} / ${pages}`;
    $('prev').disabled = view.page === 0; $('next').disabled = view.page >= pages - 1;
    $('questions').replaceChildren(...filtered.slice(view.page * pageSize, (view.page + 1) * pageSize).map(q => card(q, bank.questions.indexOf(q))));
    if (!filtered.length) $('questions').append(create('p', view.wrong ? '没有符合条件的错题。选择、填空和判断题答错会自动加入。' : '没有符合条件的题目，请调整筛选。', 'empty'));
    stats();
  }
  ['chapter', 'knowledge'].forEach(id => $(id).addEventListener('change', () => {view[id] = $(id).value; view.page = 0; render();}));
  $('onlyWrong').addEventListener('change', () => {view.wrong = $('onlyWrong').checked; view.page = 0; render();});
  $('prev').addEventListener('click', () => {view.page--; render();}); $('next').addEventListener('click', () => {view.page++; render();});
  $('retry').addEventListener('click', () => {
    if (!state.history.length) return notify('还没有加入错题的题目。');
    S.retry(state); view = {type: 'all', chapter: '', knowledge: '', wrong: true, page: 0}; $('chapter').value = ''; $('knowledge').value = ''; $('onlyWrong').checked = true;
    save(); render(); notify('已隐藏错题答案并清空本轮草稿，可以重新练习。固定答案与解析仍已备好。');
  });
  $('export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
    const a = create('a'); a.href = url; a.download = `${bank.id.replace(/[^a-z0-9_-]/gi, '_')}.answers.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('已导出学习进度、核对结果和自评记录。');
  });
  $('import').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0]; if (!file) return;
    try {if (file.size > 10000000) throw new Error('文件过大。'); const imported = S.restore(bank, JSON.parse(await file.text())); if (!confirm('导入会替换当前题库进度，继续吗？')) return; state = imported; save(); render(); notify('学习进度已恢复。');}
    catch (error) {notify(`导入失败：${error.message}`);} finally {$('importFile').value = '';}
  });
  $('chooseBank').addEventListener('click',event=>{event.stopPropagation();$('bankFile').click();});
  $('dropZone').addEventListener('click',event=>{if(event.target.id!=='chooseBank')$('bankFile').click();});
  $('dropZone').addEventListener('keydown',event=>{if(event.target===$('dropZone')&&['Enter',' '].includes(event.key)){event.preventDefault();$('bankFile').click();}});
  $('bankFile').addEventListener('change',async()=>{await importFiles([...$('bankFile').files]);$('bankFile').value='';});
  for(const name of ['dragenter','dragover'])$('dropZone').addEventListener(name,event=>{event.preventDefault();$('dropZone').classList.add('drag-over');});
  $('dropZone').addEventListener('dragleave',()=>$('dropZone').classList.remove('drag-over'));
  $('dropZone').addEventListener('drop',async event=>{event.preventDefault();$('dropZone').classList.remove('drag-over');await importFiles([...event.dataTransfer.files]);});
  $('importPaste').addEventListener('click',()=>importDocuments([{name:'粘贴内容',text:$('bankPaste').value}]));
  $('loadDemo').disabled=!demo;
  $('loadDemo').addEventListener('click',()=>{if(!demo)return;$('importMode').value='replace';importDocuments([{name:'原创演示题库',text:JSON.stringify(demo)}]);});
  $('exportBank').addEventListener('click',()=>{if(!bank)return;const output={...bank};delete output.fingerprint;download(output,`${bank.id.replace(/[^a-z0-9_-]/gi,'_')}.bank.json`);});
  $('downloadOffline').addEventListener('click',()=>{
    const clone=document.documentElement.cloneNode(true);
    clone.querySelector('#bank').textContent=JSON.stringify(bank).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    clone.querySelector('#bankPaste').textContent='';clone.querySelector('#repairText').textContent='';clone.querySelector('#importReport').hidden=true;
    clone.querySelector('#issueList').replaceChildren();clone.querySelector('#notice').textContent='';clone.querySelector('#libraryStatus').textContent='';
    clone.querySelector('#questions').replaceChildren();clone.querySelector('#types').replaceChildren();
    clone.querySelector('#completed').textContent=`0/${bank?bank.questions.length:0}`;clone.querySelector('#correct').textContent='0';clone.querySelector('#wrong').textContent='0';
    clone.querySelector('#progress').setAttribute('value','0');clone.querySelector('#sectionTitle').textContent='全部题目';clone.querySelector('#pageInfo').textContent='';clone.querySelector('#pageLabel').textContent='';
    clone.querySelector('#practice').hidden=!bank;
    download('<!doctype html>\n'+clone.outerHTML,`${bank?bank.id.replace(/[^a-z0-9_-]/gi,'_'):'buct-finalhelp'}.practice.html`,'text/html;charset=utf-8');
  });
  $('copyRepair').addEventListener('click',async()=>{
    if(!lastReport)return;const message=B.repairPrompt(lastReport);
    try{await navigator.clipboard.writeText(message);$('libraryStatus').textContent='已复制修正说明，请发给原出题 AI，并让它返回修正后的完整题库。';}
    catch{$('repairText').hidden=false;$('repairText').value=message;$('repairText').focus();$('repairText').select();$('libraryStatus').textContent='浏览器未允许自动复制，修正说明已选中，可手动复制或下载。';}
  });
  $('downloadRepair').addEventListener('click',()=>{if(lastReport)download(B.repairPrompt(lastReport),'题库修正说明.txt','text/plain;charset=utf-8');});
  (async()=>{
    let initial=embedded;
    if(!initial){initial=await FinalHelpStorage.get();if(didImport)return;}
    if(initial){const result=B.validate(initial);if(result.ok){await applyBank(initial);$('importPanel').open=false;}else{report(result);$('libraryStatus').textContent='已保存的题库需要修正，也可导入新的题库。';}}
  })();
})();
