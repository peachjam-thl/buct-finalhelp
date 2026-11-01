(() => {
  'use strict';
  const bank = JSON.parse(document.getElementById('bank').textContent), S = FinalHelpStudy;
  const $ = id => document.getElementById(id);
  const create = (tag, text, cls) => {const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el;};
  const labels = {all: '全部', fill: '填空题', boolean: '判断题', choice: '选择题', short: '简答题', calculation: '计算题'};
  const key = `buct-finalhelp:self-study:${bank.fingerprint}`;
  let state = S.fresh(bank), view = {type: 'all', chapter: '', knowledge: '', wrong: false, page: 0};
  const pageSize = 6;
  function notify(message) {$('notice').textContent = message;}
  function save() {try {localStorage.setItem(key, JSON.stringify(state));} catch {notify('浏览器无法保存进度，请在关闭前导出。');}}
  try {const saved = localStorage.getItem(key); if (saved) state = S.restore(bank, JSON.parse(saved));} catch {notify('无法恢复上次进度，本次从空白记录开始。');}
  $('title').textContent = bank.title; $('subtitle').textContent = bank.subtitle || '先尝试作答，再对照原出题 AI 准备的答案与详细解析。';
  function stats() {
    const s = S.stats(state); $('completed').textContent = `${s.viewed}/${bank.questions.length}`;
    $('correct').textContent = s.mastered; $('wrong').textContent = s.review;
    $('progress').max = bank.questions.length; $('progress').value = s.viewed;
  }
  function options(id, title, values) {
    const all = create('option', title); all.value = ''; $(id).replaceChildren(all);
    values.forEach(v => {const o = create('option', v); o.value = v; $(id).append(o);});
  }
  options('chapter', '全部章节', [...new Set(bank.questions.map(q => q.chapter))]);
  options('knowledge', '全部知识点', [...new Set(bank.questions.flatMap(q => q.knowledge))]);
  Object.entries(labels).forEach(([type, label]) => {
    const count = type === 'all' ? bank.questions.length : bank.questions.filter(q => q.type === type).length;
    if (!count) return;
    const button = create('button', `${label} ${count}`); button.dataset.type = type;
    button.addEventListener('click', () => {view.type = type; view.page = 0; render();}); $('types').append(button);
  });
  function list(box, heading, values, ordered = false) {
    box.append(create('h4', heading)); const ul = create(ordered ? 'ol' : 'ul'); values.forEach(value => ul.append(create('li', value))); box.append(ul);
  }
  function explanation(q, article) {
    article.querySelector('.result')?.remove(); if (!state.revealed[q.id]) return;
    const box = create('div', undefined, 'result reference'); box.setAttribute('aria-live', 'polite');
    box.append(create('strong', '参考答案'), create('p', S.reference(q)));
    list(box, '解题步骤', q.solution_steps, true);
    box.append(create('h4', '详细解析'), create('p', q.explanation));
    list(box, '自查要点', q.checkpoints); list(box, '易错点', q.common_mistakes);
    const sources = create('details'); sources.append(create('summary', '查看资料依据'));
    q.source_ids.forEach(id => {const s = bank.sources.find(s => s.id === id); sources.append(create('p', `${s.title} · ${s.locator}\n${s.excerpt}`));}); box.append(sources);
    const actions = create('div', undefined, 'self-actions');
    for (const [value, text] of [['mastered', '我已掌握'], ['review', '加入错题']]) {
      const button = create('button', text); button.type = 'button'; button.setAttribute('aria-pressed', String(state.marks[q.id] === value));
      button.addEventListener('click', () => {S.mark(state, q.id, value); save(); stats(); explanation(q, article);}); actions.append(button);
    }
    box.append(actions, create('p', '答案与解析由出题 AI 在生成题库时准备；掌握情况由你自评。', 'reference-note'));
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
    const button = create('button', state.revealed[q.id] ? '收起解析' : '查看答案与解析', 'submit'); button.type = 'submit';
    controls.addEventListener('input', () => {
      const answer = read(); if (S.validDraft(q, answer)) state.drafts[q.id] = answer;
      delete state.revealed[q.id]; delete state.marks[q.id]; button.textContent = '查看答案与解析'; explanation(q, article); stats(); save();
    });
    form.append(controls, button); article.append(form); explanation(q, article);
    form.addEventListener('submit', event => {
      event.preventDefault(); const answer = read(); if (S.validDraft(q, answer)) state.drafts[q.id] = answer;
      if (state.revealed[q.id]) {delete state.revealed[q.id]; button.textContent = '查看答案与解析';}
      else {state.revealed[q.id] = true; state.viewed[q.id] = true; button.textContent = '收起解析';}
      explanation(q, article); stats(); save();
    });
    return article;
  }
  function render() {
    const filtered = bank.questions.filter(q => (view.type === 'all' || q.type === view.type) && (!view.chapter || q.chapter === view.chapter) && (!view.knowledge || q.knowledge.includes(view.knowledge)) && (!view.wrong || state.history.includes(q.id)));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); view.page = Math.min(view.page, pages - 1);
    for (const button of $('types').children) button.setAttribute('aria-pressed', String(button.dataset.type === view.type));
    $('sectionTitle').textContent = `${view.wrong ? '错题重练 · ' : ''}${view.type === 'all' ? '全部题目' : labels[view.type]}`;
    $('pageInfo').textContent = `${filtered.length} 题 · 第 ${view.page + 1}/${pages} 页`; $('pageLabel').textContent = `${view.page + 1} / ${pages}`;
    $('prev').disabled = view.page === 0; $('next').disabled = view.page >= pages - 1;
    $('questions').replaceChildren(...filtered.slice(view.page * pageSize, (view.page + 1) * pageSize).map(q => card(q, bank.questions.indexOf(q))));
    if (!filtered.length) $('questions').append(create('p', view.wrong ? '没有符合筛选条件的错题，可在查看解析后自行加入。' : '没有符合条件的题目，请调整筛选。', 'empty'));
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
    const a = create('a'); a.href = url; a.download = `${bank.id.replace(/[^a-z0-9_-]/gi, '_')}.answers.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify('已导出学习进度和自评记录。');
  });
  $('import').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0]; if (!file) return;
    try {if (file.size > 10000000) throw new Error('文件过大。'); const imported = S.restore(bank, JSON.parse(await file.text())); if (!confirm('导入会替换当前题库进度，继续吗？')) return; state = imported; save(); render(); notify('学习进度已恢复。');}
    catch (error) {notify(`导入失败：${error.message}`);} finally {$('importFile').value = '';}
  });
  render();
})();
