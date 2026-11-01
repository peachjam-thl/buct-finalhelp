(() => {
  'use strict';
  const embedded = JSON.parse(document.getElementById('bank').textContent);
  const S = FinalHelpStudy, B = FinalHelpBank, M = FinalHelpMath;
  const $ = id => document.getElementById(id);
  const create = (tag, text, cls) => {const el = document.createElement(tag); if (text !== undefined) {if(['div','span','p','li','h1','h2','h3','h4','strong','summary'].includes(tag))M.append(el,text);else el.textContent=text;} if (cls) el.className = cls; return el;};
  const labels = {all: '全部', fill: '填空题', boolean: '判断题', choice: '选择题', short: '简答题', calculation: '计算题'};
  let bank=null, state=null, key='', view = {type: 'all', chapter: '', knowledge: '', wrong: false, page: 0};
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
  function applyBank(next){
    save();bank=B.prepare(next);key=`buct-finalhelp:course:${bank.id}`;state=S.fresh(bank);
    try{
      const raw=localStorage.getItem(key)|| (next.fingerprint?localStorage.getItem(`buct-finalhelp:self-study:${next.fingerprint}`):null);
      if(raw){const parsed=JSON.parse(raw);state=S.restore(parsed.version===5?bank:{...bank,fingerprint:next.fingerprint||bank.fingerprint},parsed);}
    }catch{notify('旧进度与本题库不匹配，已保留可用题库；可以手动导入备份进度。');}
    view={type:'all',chapter:'',knowledge:'',wrong:false,page:0};$('onlyWrong').checked=false;
    $('title').replaceChildren();M.append($('title'),bank.title);$('subtitle').replaceChildren();M.append($('subtitle'),bank.subtitle||'先尝试作答，再对照原出题 AI 准备的答案与详细解析。');
    configure();$('practice').hidden=false;render();save();
  }
  function download(value,name,mime='application/json'){
    const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:mime});const url=URL.createObjectURL(blob),a=create('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
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
  $('downloadOffline').addEventListener('click',()=>{
    const clone=document.documentElement.cloneNode(true);
    clone.querySelector('#bank').textContent=JSON.stringify(bank).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    clone.querySelector('#notice').textContent='';clone.querySelector('#usageGuide').open=false;clone.querySelector('#aiRequest').hidden=true;
    clone.querySelector('#questions').replaceChildren();clone.querySelector('#types').replaceChildren();
    clone.querySelector('#completed').textContent=`0/${bank?bank.questions.length:0}`;clone.querySelector('#correct').textContent='0';clone.querySelector('#wrong').textContent='0';
    clone.querySelector('#progress').setAttribute('value','0');clone.querySelector('#sectionTitle').textContent='全部题目';clone.querySelector('#pageInfo').textContent='';clone.querySelector('#pageLabel').textContent='';
    clone.querySelector('#practice').hidden=!bank;
    download('<!doctype html>\n'+clone.outerHTML,`${bank?bank.id.replace(/[^a-z0-9_-]/gi,'_'):'buct-finalhelp'}.practice.html`,'text/html;charset=utf-8');
  });
  $('copyAIRequest').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('aiRequest').value);notify('已复制。请回到 AI 对话上传资料，由 AI 生成专属练习页。');}
    catch{$('aiRequest').hidden=false;$('aiRequest').focus();$('aiRequest').select();notify('使用请求已展开并选中，可复制后发送给 AI。');}
  });
  const result=B.validate(embedded);
  if(result.ok)applyBank(embedded);
  else notify('此练习页的题目或公式尚未准备完整，请让原出题 AI 修正并重新生成页面。'+result.errors.slice(0,3).map(item=>` ${item.path}：${item.message}`).join(''));
})();
