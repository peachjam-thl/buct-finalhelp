"""Validate a source-grounded question bank and build a portable HTML practice app."""
import argparse
import hashlib
import html
import json
import math
import re
from pathlib import Path

ASSETS = Path(__file__).resolve().parents[1] / 'assets' / 'quiz-app'
TYPES = {'choice', 'fill', 'boolean', 'short', 'calculation'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def validate_bank(bank):
    require(isinstance(bank, dict), 'bank must be an object')
    require(type(bank.get('version')) is int and bank['version'] == 1, 'version must be 1')
    for field in ('id', 'title'):
        require(nonempty(bank.get(field)), f'bank.{field} is required')
    require(isinstance(bank.get('sources'), list) and bank['sources'], 'sources must not be empty')
    sources = set()
    for source in bank['sources']:
        require(isinstance(source, dict), 'source must be an object')
        for field in ('id', 'title', 'locator', 'excerpt'):
            require(nonempty(source.get(field)), f'source.{field} is required')
        require(source['id'] not in sources, 'duplicate source id')
        sources.add(source['id'])
    require(isinstance(bank.get('questions'), list) and bank['questions'], 'questions must not be empty')
    require(len(bank['questions']) <= 5000, 'split banks larger than 5000 questions')
    ids = set()
    for q in bank['questions']:
        require(isinstance(q, dict), 'question must be an object')
        for field in ('id', 'chapter', 'prompt', 'explanation'):
            require(nonempty(q.get(field)), f'question.{field} is required')
        name = q['id']
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', name) and name not in ('constructor', 'prototype'), f'{name}: use a stable alphanumeric question ID')
        require(name not in ids, f'duplicate question id: {name}')
        ids.add(name)
        kind = q.get('type')
        require(isinstance(kind, str) and kind in TYPES, f'{name}: unsupported type')
        require(q.get('difficulty') in ('基础', '进阶', '综合'), f'{name}: invalid difficulty')
        require(isinstance(q.get('knowledge'), list) and q['knowledge'] and all(nonempty(k) for k in q['knowledge']), f'{name}: knowledge required')
        require(number(q.get('points')) and q['points'] > 0, f'{name}: points must be positive')
        require(isinstance(q.get('source_ids'), list) and q['source_ids'] and all(isinstance(s, str) and s in sources for s in q['source_ids']), f'{name}: unknown or missing source')
        answer = q.get('answer')
        if kind == 'choice':
            options = q.get('options')
            require(isinstance(options, list) and len(options) >= 2, f'{name}: at least two options')
            require(all(isinstance(o, dict) and nonempty(o.get('id')) and nonempty(o.get('text')) for o in options), f'{name}: invalid option')
            option_ids = [o['id'] for o in options]
            require(len(set(option_ids)) == len(option_ids), f'{name}: duplicate option')
            require(type(q.get('multiple')) is bool, f'{name}: multiple must be boolean')
            require(isinstance(answer, list) and answer and all(isinstance(a, str) and a in option_ids for a in answer), f'{name}: invalid answer')
            require(len(set(answer)) == len(answer), f'{name}: duplicate answer')
            require(q['multiple'] or len(answer) == 1, f'{name}: single choice needs one answer')
        elif kind == 'fill':
            require(isinstance(answer, list) and answer and all(isinstance(a, list) and a and all(nonempty(x) for x in a) for a in answer), f'{name}: fill answer needs aliases per blank')
        elif kind == 'boolean':
            require(type(answer) is bool, f'{name}: boolean answer must be true/false')
        elif kind == 'short':
            require(nonempty(answer), f'{name}: reference answer required')
            require(q.get('rubric'), f'{name}: rubric required')
        elif kind == 'calculation':
            require(isinstance(answer, dict), f'{name}: numeric answer required')
            require(number(answer.get('value')), f'{name}: finite answer required')
            require(isinstance(answer.get('unit'), str), f'{name}: explicit unit required (empty for dimensionless)')
            for tolerance in ('absolute_tolerance', 'relative_tolerance'):
                require(number(answer.get(tolerance)) and answer[tolerance] >= 0, f'{name}: {tolerance} must be nonnegative')
            require(isinstance(answer.get('unit_aliases', []), list) and all(nonempty(x) for x in answer.get('unit_aliases', [])), f'{name}: invalid unit aliases')
            if q.get('rubric'):
                require(nonempty(q.get('reference_answer')), f'{name}: step-based question needs reference_answer')
        if 'rubric' in q:
            require(kind in ('short', 'calculation'), f'{name}: rubric only for subjective questions')
            rubric = q['rubric']
            require(isinstance(rubric, list) and rubric, f'{name}: nonempty rubric required')
            rubric_ids = set()
            total = 0
            for part in rubric:
                require(isinstance(part, dict) and nonempty(part.get('id')) and nonempty(part.get('description')), f'{name}: invalid rubric')
                require(part['id'] not in rubric_ids, f'{name}: duplicate rubric id')
                rubric_ids.add(part['id'])
                require(number(part.get('points')) and part['points'] > 0, f'{name}: positive rubric points required')
                require(isinstance(part.get('keywords'), list) and part['keywords'] and all(nonempty(k) for k in part['keywords']), f'{name}: keywords required for preliminary scoring')
                total += part['points']
            require(math.isclose(total, q['points'], abs_tol=1e-8), f'{name}: rubric points must sum to question points')
    return bank


def load_bank(path):
    return validate_bank(json.loads(Path(path).read_text(encoding='utf-8-sig')))


def fingerprint(bank):
    canonical = json.dumps(bank, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:24]


def build_html(bank, runtime=None):
    validate_bank(bank)
    template = (ASSETS / 'index.html').read_text(encoding='utf-8')
    payload = dict(bank, fingerprint=fingerprint(bank))
    # JSON in script elements must escape '<' so material cannot terminate the element.
    def safe_json(value):
        return json.dumps(value, ensure_ascii=False, allow_nan=False).replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    replacements = {
        '<!--TITLE-->': html.escape(bank['title']),
        '/*STYLE*/': (ASSETS / 'style.css').read_text(encoding='utf-8'),
        '/*BANK*/': safe_json(payload),
        '/*RUNTIME*/': safe_json(runtime or {'ai': False}),
        '/*CORE*/': (ASSETS / 'grading.js').read_text(encoding='utf-8'),
        '/*APP*/': (ASSETS / 'app.js').read_text(encoding='utf-8')}
    # Substitute only original template markers; source text may contain marker-like strings.
    return re.sub(r'<!--TITLE-->|/\*(?:STYLE|BANK|RUNTIME|CORE|APP)\*/', lambda match: replacements[match.group()], template)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bank', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    try:
        bank = load_bank(args.bank)
        document = build_html(bank)
    except (ValueError, OSError) as error:
        parser.exit(1, f'Build rejected: {error}\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(document, encoding='utf-8')
    print(f'Built {len(bank["questions"])} questions: {args.output.resolve()}')


if __name__ == '__main__':
    main()
