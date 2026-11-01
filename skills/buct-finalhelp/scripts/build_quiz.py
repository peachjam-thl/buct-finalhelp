"""Validate an AI-authored fixed-answer bank and build a self-contained practice page."""
import argparse
import base64
import hashlib
import html
import json
from pathlib import Path
import re

ASSETS = Path(__file__).resolve().parents[1] / 'assets' / 'quiz-app'
TYPES = {'choice', 'fill', 'boolean', 'short', 'calculation'}


def require(condition, message):
    if not condition: raise ValueError(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def texts(value):
    return isinstance(value, list) and bool(value) and all(nonempty(s) for s in value)


def validate_bank(bank):
    require(isinstance(bank, dict) and type(bank.get('version')) is int and bank['version'] == 2, '需要固定答案题库 version: 2')
    for key in ('id', 'title'): require(nonempty(bank.get(key)), f'bank.{key} 必填')
    require(isinstance(bank.get('sources'), list) and bank['sources'], '缺少资料来源')
    sources = set()
    for s in bank['sources']:
        require(isinstance(s, dict), '来源格式错误')
        for key in ('id', 'title', 'locator', 'excerpt'): require(nonempty(s.get(key)), f'source.{key} 必填')
        require(s['id'] not in sources, '来源 ID 重复'); sources.add(s['id'])
    require(isinstance(bank.get('questions'), list) and 0 < len(bank['questions']) <= 5000, '题库须包含 1–5000 题')
    seen = set()
    for q in bank['questions']:
        require(isinstance(q, dict), '题目格式错误')
        for key in ('id', 'chapter', 'prompt', 'explanation'): require(nonempty(q.get(key)), f'question.{key} 必填')
        name = q['id']
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', name) and name not in ('constructor', 'prototype'), '题目 ID 无效')
        require(name not in seen, '题目 ID 重复'); seen.add(name)
        require(isinstance(q.get('type'), str) and q['type'] in TYPES, f'{name}: 题型不支持')
        require(q.get('difficulty') in ('基础', '进阶', '综合'), f'{name}: 难度无效')
        for key in ('knowledge', 'solution_steps', 'checkpoints', 'common_mistakes'): require(texts(q.get(key)), f'{name}: {key} 须预先写完整')
        require(texts(q.get('source_ids')) and all(s in sources for s in q['source_ids']), f'{name}: 来源无效')
        require(not {'points', 'score', 'rubric', 'keywords'}.intersection(q), f'{name}: 新题库不使用评分配置')
        answer = q.get('answer')
        if q['type'] == 'choice':
            options = q.get('options')
            require(isinstance(options, list) and len(options) >= 2 and all(isinstance(o, dict) and nonempty(o.get('id')) and nonempty(o.get('text')) for o in options), f'{name}: 选项无效')
            ids = [o['id'] for o in options]
            require(len(set(ids)) == len(ids) and type(q.get('multiple')) is bool, f'{name}: 选项重复或缺少 multiple')
            require(texts(answer) and len(set(answer)) == len(answer) and all(a in ids for a in answer) and (q['multiple'] or len(answer) == 1), f'{name}: 选择题答案无效')
        elif q['type'] == 'fill':
            require(isinstance(answer, list) and answer and all(texts(a) for a in answer), f'{name}: 逐空答案无效')
            if 'answer_display' in q: require(texts(q['answer_display']) and len(q['answer_display'])==len(answer), f'{name}: 展示答案须逐空对应')
        elif q['type'] == 'boolean': require(type(answer) is bool, f'{name}: 判断题答案须为布尔值')
        else: require(nonempty(answer), f'{name}: 须预先写好完整固定答案')
    return bank


def load_bank(path):
    return validate_bank(json.loads(Path(path).read_text(encoding='utf-8-sig')))


def fingerprint(bank):
    data = json.dumps(bank, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return hashlib.sha256(data.encode('utf-8')).hexdigest()[:24]


def build_html(bank):
    validate_bank(bank)
    def payload(value):
        return json.dumps(value, ensure_ascii=False, allow_nan=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    vendor=ASSETS/'vendor'/'katex'
    css=(vendor/'katex.min.css').read_text(encoding='utf-8')
    def embed_font(match):
        encoded=base64.b64encode((vendor/match.group(1)).read_bytes()).decode('ascii')
        return f'src:url(data:font/woff2;base64,{encoded}) format("woff2")'
    css=re.sub(r'src:url\((fonts/[^)]+\.woff2)\)[^}]*',embed_font,css)
    replacements = {'<!--TITLE-->': html.escape(bank['title']),
                    '/*BANK*/': payload(dict(bank,fingerprint=fingerprint(bank))),
                    '/*STYLE*/': css+'\n'+(ASSETS / 'style.css').read_text(encoding='utf-8'),
                    '/*KATEX*/': (vendor/'katex.min.js').read_text(encoding='utf-8').replace('</script','<\\/script'),
                    '/*MATH*/': (ASSETS/'math.js').read_text(encoding='utf-8'),
                    '/*BANKTOOLS*/': (ASSETS/'bank.js').read_text(encoding='utf-8'),
                    '/*CORE*/': (ASSETS / 'study.js').read_text(encoding='utf-8'),
                    '/*APP*/': (ASSETS / 'app.js').read_text(encoding='utf-8')}
    return re.sub(r'<!--TITLE-->|/\*(?:STYLE|BANK|KATEX|MATH|BANKTOOLS|CORE|APP)\*/', lambda m: replacements[m.group()], (ASSETS / 'index.html').read_text(encoding='utf-8'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bank', type=Path); parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try: document = build_html(load_bank(args.bank))
    except (ValueError, OSError) as error: parser.exit(1, f'Build rejected: {error}\n')
    args.output.parent.mkdir(parents=True, exist_ok=True); args.output.write_text(document, encoding='utf-8', newline='\n')
    print(f'Built fixed-answer practice page: {args.output.resolve()}')


if __name__ == '__main__': main()
