(() => {
  'use strict';
  const bank = JSON.parse(document.getElementById('bank').textContent);
  const runtime = window.FINALHELP_RUNTIME || {ai: false};
  const labels = {all: '全部', fill: '填空题', boolean: '判断题', choice: '选择题', short: '简答题', calculation: '计算题'};
  const byId = new Map(bank.questions.map(q => [q.id, q]));
  const key = `buct-finalhelp:${bank.fingerprint}`;
  const $ = id => document.getElementById(id);
  const create = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const fresh = () => ({version: 1, fingerprint: bank.fingerprint, drafts: {}, results: {}, history: []});
  let state = fresh();
  let view = {type: 'all', chapter: '', knowledge: '', wrong: false, page: 0};
  let generation = 0;
  const size = 6;
  function validDraft(q, answer) {
    if (q.type === 'choice') return Array.isArray(answer) && answer.every(a => q.options.some(o => o.id === a));
    if (q.type === 'boolean') return typeof answer === 'boolean';
    if (q.type === 'fill') return Array.isArray(answer) && answer.length === q.answer.length && answer.every(a => typeof a === 'string' && a.length <= 10000);
    if (q.type === 'short') return typeof answer === 'string' && answer.length <= 20000;
    return answer && typeof answer === 'object' && ['value', 'unit', ...(q.rubric ? ['steps'] : [])].every(f => typeof answer[f] === 'string' && answer[f].length <= 20000);
  }
  function parseState(raw) {
    if (!raw || raw.version !== 1 || raw.fingerprint !== bank.fingerprint) throw new Error('题库版本不同，无法混用学习记录。');
    const clean = fresh();
    for (const q of bank.questions) {
      const draft = raw.drafts?.[q.id];
      if (!validDraft(q, draft)) continue;
      clean.drafts[q.id] = draft;
      const r = raw.results?.[q.id];
      if (!r || r.answerKey !== JSON.stringify(draft)) continue;
      if (r.method === 'local' || r.method === 'rule-preliminary') {
        clean.results[q.id] = {...FinalHelpGrading.grade(q, draft), answerKey: r.answerKey};
      } else if (r.method === 'ai' && r.provisional === false && r.max === q.points && Number.isFinite(r.score) && r.score >= 0 && r.score <= q.points && typeof r.feedback === 'string' && r.feedback.length <= 20000) {
        clean.results[q.id] = {method: 'ai', provisional: false, max: q.points, score: r.score, feedback: r.feedback, answerKey: r.answerKey};
      }
    }
    clean.history = [...new Set((Array.isArray(raw.history) ? raw.history : []).filter(id => byId.has(id)))];
    return clean;
  }
  function notify(message) { $('notice').textContent = message; }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { notify('浏览器无法保存学习记录。请在关闭页面前导出进度。'); }
  }
  try {
    const saved = localStorage.getItem(key);
    if (saved) state = parseState(JSON.parse(saved));
  } catch { notify('无法读取上次进度，本次从空白记录开始。可尝试导入已导出的进度。'); }
  $('title').textContent = bank.title;
  $('subtitle').textContent = bank.subtitle || '按知识点练习，让每一道错题都有可核对的答案。';
  $('mode').textContent = runtime.ai ? 'AI 语义批改已启用 · 主观题提交后发送当前回答及题目资料给 AI 服务' : '本地即时批改 · 简答与步骤题为规则初评，可导出后交给 AI 复核';
  function stats() {
    const results = Object.values(state.results);
    $('completed').textContent = `${results.length}/${bank.questions.length}`;
    $('correct').textContent = results.filter(r => !r.provisional && r.score === r.max).length;
    $('wrong').textContent = state.history.length;
    $('progress').max = bank.questions.length;
    $('progress').value = results.length;
  }
  function selectOptions(id, title, values) {
    $(id).replaceChildren();
    const all = create('option', title); all.value = ''; $(id).append(all);
    values.forEach(value => {const option = create('option', value); option.value = value; $(id).append(option);});
  }
  selectOptions('chapter', '全部章节', [...new Set(bank.questions.map(q => q.chapter))]);
  selectOptions('knowledge', '全部知识点', [...new Set(bank.questions.flatMap(q => q.knowledge))]);
  Object.entries(labels).forEach(([type, label]) => {
    const count = type === 'all' ? bank.questions.length : bank.questions.filter(q => q.type === type).length;
    if (!count) return;
    const button = create('button', `${label} ${count}`);
    button.dataset.type = type;
    button.addEventListener('click', () => {view.type = type; view.page = 0; render();});
    $('types').append(button);
  });
  function reference(q) {
    if (q.type === 'choice') return q.answer.map(id => `${id}. ${q.options.find(o => o.id === id).text}`).join('；');
    if (q.type === 'fill') return q.answer.map((a, i) => `第 ${i + 1} 空：${a.join(' / ')}`).join('；');
    if (q.type === 'boolean') return q.answer ? '正确' : '错误';
    if (q.type === 'calculation') return `${q.answer.value} ${q.answer.unit}${q.reference_answer ? '\n' + q.reference_answer : ''}`;
    return q.answer;
  }
  function feedback(q, r) {
    const kind = r.provisional ? 'provisional' : r.score === r.max ? 'good' : 'bad';
    const box = create('div', undefined, `result ${kind}`);
    box.setAttribute('aria-live', 'polite');
    box.append(create('strong', `${r.provisional ? '规则初评 · 待语义复核' : r.method === 'ai' ? 'AI 批改' : r.score === r.max ? '回答正确' : '本次有错漏'}　${r.score} / ${r.max} 分`));
    if (r.provisional) box.append(create('p', '此分数只反映关键词匹配，无法识别否定、矛盾或所有等价表述，不计入当前答对与历史错题。'));
    if (r.feedback) box.append(create('p', r.feedback));
    if (r.details?.length) {
      const list = create('ul');
      r.details.forEach(d => list.append(create('li', `${d.ok ? '✓' : '○'} ${d.label}${d.points ? `（${d.points} 分）` : ''}`)));
      box.append(list);
    }
    if (r.numeric) box.append(create('p', `数值核对：${r.numeric.ok ? '结果及单位匹配。' : '结果或单位不匹配。'} ${r.numeric.note}`));
    box.append(create('p', `参考答案：${reference(q)}`));
    box.append(create('p', `解析：${q.explanation}`));
    const details = create('details'); details.append(create('summary', '查看资料依据'));
    q.source_ids.forEach(id => {
      const source = bank.sources.find(s => s.id === id);
      details.append(create('p', `${source.title} · ${source.locator}\n${source.excerpt}`));
    });
    box.append(details);
    return box;
  }
  function card(q, index) {
    const item = create('article', undefined, 'question');
    item.dataset.question = q.id;
    item.append(create('div', `${q.chapter} · 第 ${index + 1} 题 · ${labels[q.type]} · ${q.difficulty} · ${q.points} 分`, 'meta'));
    const prompt = create('h3', q.prompt, 'prompt');
    prompt.id = `prompt-${q.id}`; item.append(prompt);
    item.append(create('div', q.knowledge.join(' / '), 'meta'));
    const form = create('form', undefined, 'answer-row'); form.setAttribute('aria-labelledby', prompt.id);
    const controls = create('div', undefined, q.type === 'choice' || q.type === 'boolean' ? 'options' : 'answer-fields');
    const draft = state.drafts[q.id];
    let read;
    if (q.type === 'choice' || q.type === 'boolean') {
      const options = q.type === 'choice' ? q.options : [{id: true, text: '正确'}, {id: false, text: '错误'}];
      const inputs = options.map(o => {
        const label = create('label', undefined, 'option'); const input = create('input');
        input.type = q.type === 'choice' && q.multiple ? 'checkbox' : 'radio';
        input.name = q.id;
        input.checked = q.type === 'choice' ? (draft || []).includes(o.id) : draft === o.id;
        label.append(input, create('span', q.type === 'choice' ? `${o.id}. ${o.text}` : o.text));
        controls.append(label); return {input, value: o.id};
      });
      read = () => q.type === 'choice' ? inputs.filter(x => x.input.checked).map(x => x.value) : inputs.find(x => x.input.checked)?.value;
    } else if (q.type === 'fill') {
      const blanks = create('div', undefined, 'blank-fields');
      const inputs = q.answer.map((_, i) => {
        const input = create('input'); input.type = 'text'; input.placeholder = `第 ${i + 1} 空`;
        input.setAttribute('aria-label', `第 ${index + 1} 题第 ${i + 1} 空`);
        input.value = draft?.[i] || ''; input.maxLength = 10000; blanks.append(input); return input;
      });
      controls.append(blanks); read = () => inputs.map(input => input.value);
    } else if (q.type === 'short') {
      const input = create('textarea'); input.placeholder = '分点填写你的理解，等价表述可提交 AI 复核';
      input.setAttribute('aria-label', `第 ${index + 1} 题答案`); input.value = draft || ''; input.maxLength = 20000;
      controls.append(input); read = () => input.value;
    } else {
      const fields = create('div', undefined, 'numeric-fields');
      const value = create('input'); value.type = 'text'; value.inputMode = 'decimal'; value.placeholder = '数值，例如 2 或 2e-3'; value.value = draft?.value || ''; value.maxLength = 1000;
      value.setAttribute('aria-label', `第 ${index + 1} 题数值`);
      const unit = create('input'); unit.type = 'text'; unit.placeholder = q.answer.unit ? '单位（区分大小写）' : '无量纲可留空'; unit.value = draft?.unit || ''; unit.maxLength = 100;
      unit.setAttribute('aria-label', `第 ${index + 1} 题单位`);
      fields.append(value, unit); controls.append(fields);
      let steps;
      if (q.rubric) {steps = create('textarea'); steps.placeholder = '写出公式、代入和必要计算步骤'; steps.setAttribute('aria-label', `第 ${index + 1} 题计算步骤`); steps.value = draft?.steps || ''; steps.maxLength = 20000; controls.append(steps);}
      read = () => ({value: value.value, unit: unit.value, ...(steps ? {steps: steps.value} : {})});
    }
    const button = create('button', '批改', 'submit'); button.type = 'submit';
    const ready = () => {
      const answer = read();
      return q.type === 'fill' ? answer.every(s => s.trim()) : q.type === 'choice' ? answer.length > 0 : q.type === 'boolean' ? typeof answer === 'boolean' : q.type === 'short' ? !!answer.trim() : !!answer.value.trim() && (!q.rubric || !!answer.steps.trim());
    };
    button.disabled = !ready();
    const edited = () => {
      state.drafts[q.id] = read(); delete state.results[q.id];
      item.querySelector('.result')?.remove(); button.disabled = !ready(); stats(); save();
    };
    controls.addEventListener('input', edited);
    form.append(controls, button); item.append(form);
    if (state.results[q.id]) item.append(feedback(q, state.results[q.id]));
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (!ready()) return;
      const answer = read(); const answerKey = JSON.stringify(answer); const startedGeneration = generation;
      state.drafts[q.id] = answer;
      let result = FinalHelpGrading.grade(q, answer);
      if (result.provisional && runtime.ai) {
        button.disabled = true; button.textContent = '批改中…';
        for (const input of controls.querySelectorAll('input,textarea')) input.disabled = true;
        const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 125000);
        try {
          const response = await fetch('/api/grade', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-FinalHelp-Token': runtime.token}, body: JSON.stringify({question_id: q.id, answer}), signal: controller.signal});
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'AI 暂不可用');
          if (data.method !== 'ai' || data.provisional !== false || data.max !== q.points || !Number.isFinite(data.score) || data.score < 0 || data.score > q.points || typeof data.feedback !== 'string') throw new Error('AI 返回格式不正确');
          result = data;
        } catch (error) {result.feedback = `AI 批改未完成，以下仅为规则初评。${error.name === 'AbortError' ? '请求超时，请稍后重试。' : error.message}`;}
        finally {clearTimeout(timeout); button.disabled = false; button.textContent = '批改'; for (const input of controls.querySelectorAll('input,textarea')) input.disabled = false;}
      }
      if (startedGeneration !== generation || JSON.stringify(state.drafts[q.id]) !== answerKey) return;
      state.results[q.id] = {...result, answerKey};
      if (!result.provisional && result.score < result.max && !state.history.includes(q.id)) state.history.push(q.id);
      save(); stats(); item.querySelector('.result')?.remove(); item.append(feedback(q, result));
    });
    return item;
  }
  function render() {
    const filtered = bank.questions.filter(q => (view.type === 'all' || q.type === view.type) && (!view.chapter || q.chapter === view.chapter) && (!view.knowledge || q.knowledge.includes(view.knowledge)) && (!view.wrong || state.history.includes(q.id)));
    const pages = Math.max(1, Math.ceil(filtered.length / size)); view.page = Math.min(view.page, pages - 1);
    for (const button of $('types').children) button.setAttribute('aria-pressed', button.dataset.type === view.type ? 'true' : 'false');
    $('sectionTitle').textContent = `${view.wrong ? '错题重练 · ' : ''}${view.type === 'all' ? '全部题目' : labels[view.type]}`;
    $('pageInfo').textContent = `${filtered.length} 题 · 第 ${view.page + 1}/${pages} 页`;
    $('pageLabel').textContent = `${view.page + 1} / ${pages}`;
    $('prev').disabled = view.page === 0; $('next').disabled = view.page >= pages - 1;
    $('questions').replaceChildren();
    filtered.slice(view.page * size, (view.page + 1) * size).forEach(q => $('questions').append(card(q, bank.questions.indexOf(q))));
    if (!filtered.length) $('questions').append(create('p', view.wrong ? '当前筛选下没有历史错题。主观题初评不计为确认错题。' : '没有符合条件的题目，请调整题型、章节或知识点。', 'empty'));
    stats();
  }
  ['chapter', 'knowledge'].forEach(id => $(id).addEventListener('change', () => {view[id] = $(id).value; view.page = 0; render();}));
  $('onlyWrong').addEventListener('change', () => {view.wrong = $('onlyWrong').checked; view.page = 0; render();});
  $('prev').addEventListener('click', () => {view.page--; render();});
  $('next').addEventListener('click', () => {view.page++; render();});
  $('retry').addEventListener('click', () => {
    if (!state.history.length) {notify('还没有确认错题。先完成几道客观题，或启用 AI 批改主观题。'); return;}
    generation++;
    state.history.forEach(id => {delete state.drafts[id]; delete state.results[id];});
    view = {type: 'all', chapter: '', knowledge: '', wrong: true, page: 0};
    $('chapter').value = ''; $('knowledge').value = ''; $('onlyWrong').checked = true;
    notify('已清空历史错题的本轮答案，保留其他题目进度。'); save(); render();
  });
  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({...state, exported_at: new Date().toISOString()}, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob); const link = create('a'); link.href = url; link.download = `${bank.id.replace(/[^a-z0-9_-]/gi, '_')}.answers.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已导出当前题库的学习记录。');
  });
  $('import').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0]; if (!file) return;
    try {
      if (file.size > 10000000) throw new Error('记录文件过大，最多允许 10 MB。');
      const imported = parseState(JSON.parse(await file.text()));
      if (!confirm('导入会替换当前题库的学习进度。建议先导出当前进度。继续吗？')) return;
      generation++; state = imported; save(); render(); notify('学习进度已恢复。');
    } catch (error) {notify(`导入失败：${error.message}`);}
    finally {$('importFile').value = '';}
  });
  render();
})();
