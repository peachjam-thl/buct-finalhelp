import copy
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import sys
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'skills' / 'buct-finalhelp' / 'scripts'))
from build_quiz import build_html, fingerprint, load_bank, validate_bank
from serve_quiz import GradingError, grade_with_ai, make_server, validate_ai_result


class QuizTests(unittest.TestCase):
    def setUp(self):
        self.bank = load_bank(ROOT / 'examples' / 'demo-bank.json')

    def test_bank_has_all_requested_types_and_change_isolates_progress(self):
        self.assertEqual({q['type'] for q in self.bank['questions']}, {'fill', 'boolean', 'choice', 'short', 'calculation'})
        before = fingerprint(self.bank)
        reordered = dict(reversed(list(self.bank.items())))
        self.assertEqual(before, fingerprint(reordered))
        self.bank['questions'][0]['prompt'] += ' changed'
        self.assertNotEqual(before, fingerprint(self.bank))

    def test_invalid_banks_are_rejected(self):
        changes = [
            lambda b: b['questions'][0].update(source_ids=['missing']),
            lambda b: b['questions'][0].update(id=b['questions'][1]['id']),
            lambda b: b['questions'][0].update(id='__proto__'),
            lambda b: b['questions'][0].update(id='constructor'),
            lambda b: b['questions'][2].update(answer='false'),
            lambda b: b['questions'][8]['answer'].update(value=float('nan')),
            lambda b: b['questions'][8]['answer'].update(absolute_tolerance=-1),
            lambda b: b['questions'][6]['rubric'][0].update(points=999),
            lambda b: b['questions'][4].update(answer=['X']),
            lambda b: b['questions'][0].update(points=True),
            lambda b: b['sources'][0].update(locator=''),
        ]
        for mutate in changes:
            bank = copy.deepcopy(self.bank)
            mutate(bank)
            with self.subTest(mutation=changes.index(mutate)), self.assertRaises(ValueError):
                validate_bank(bank)

    def test_document_cannot_execute_material_as_html_or_template(self):
        dangerous = '</script><script>alert(1)</script> /*APP*/ /*RUNTIME*/'
        self.bank['questions'][0]['prompt'] = dangerous
        self.bank['title'] = '<img src=x onerror=alert(1)>'
        page = build_html(self.bank)
        class Parser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.scripts = 0
                self.in_bank = False
                self.bank_text = ''
            def handle_starttag(self, tag, attrs):
                if tag == 'script': self.scripts += 1
                if dict(attrs).get('id') == 'bank': self.in_bank = True
            def handle_endtag(self, tag):
                if tag == 'script': self.in_bank = False
            def handle_data(self, data):
                if self.in_bank: self.bank_text += data
        parser = Parser()
        parser.feed(page)
        self.assertEqual(parser.scripts, 4)
        self.assertEqual(json.loads(parser.bank_text)['questions'][0]['prompt'], dangerous)
        self.assertIn('&lt;img src=x onerror=alert(1)&gt;', page)
        self.assertNotIn('cdn.', page)

    def test_ai_contract_validates_every_point_and_derives_total(self):
        q = self.bank['questions'][6]
        good = {'parts': [{'id': 'r1', 'awarded': 2, 'feedback': '正确'}, {'id': 'r2', 'awarded': 1, 'feedback': '不完整'}], 'feedback': '补充信号转换的用途。'}
        result = validate_ai_result(q, good)
        self.assertEqual(result['score'], 3)
        self.assertFalse(result['provisional'])
        for parts in [good['parts'][:1], good['parts'] * 2, [{'id': 'r1', 'awarded': 20, 'feedback': ''}], [{'id': 'r1', 'awarded': float('nan'), 'feedback': ''}]]:
            with self.assertRaises(GradingError):
                validate_ai_result(q, {'parts': parts, 'feedback': ''})

    def test_responses_request_and_failure_modes_with_mock_transport(self):
        q = self.bank['questions'][6]
        good = {'parts': [{'id': p['id'], 'awarded': p['points'], 'feedback': '正确'} for p in q['rubric']], 'feedback': '完整。'}
        observed = {}
        def transport(request, timeout):
            observed.update(payload=json.loads(request.data), timeout=timeout, url=request.full_url)
            return io.BytesIO(json.dumps({'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'output_text', 'text': json.dumps(good)}]}]}).encode())
        result = grade_with_ai(self.bank, q, '学生回答', 'test-only', 'chosen-model', 'https://example.invalid/v1', transport=transport)
        self.assertEqual(result['score'], 4)
        self.assertEqual(observed['url'], 'https://example.invalid/v1/responses')
        self.assertFalse(observed['payload']['store'])
        self.assertTrue(observed['payload']['text']['format']['strict'])
        self.assertEqual(observed['payload']['model'], 'chosen-model')
        for response in [
            {'status': 'incomplete', 'output': []},
            {'status': 'completed', 'output': [{'type': 'message', 'content': [{'type': 'refusal'}]}]},
            {'status': 'completed', 'output': []}]:
            with self.assertRaises(GradingError):
                grade_with_ai(self.bank, q, '学生回答', 'test-only', 'model', 'https://example.invalid', transport=lambda *_args, **_kwargs: io.BytesIO(json.dumps(response).encode()))

    def test_loopback_server_does_not_serve_files_or_accept_cross_origin_grading(self):
        server = make_server(self.bank, port=0)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        base = f'http://127.0.0.1:{server.server_address[1]}'
        try:
            with urllib.request.urlopen(base) as response:
                self.assertEqual(response.status, 200)
                self.assertIn('frame-ancestors', response.headers['Content-Security-Policy'])
                self.assertIn('BUCT FINALHELP', response.read().decode())
            with urllib.request.urlopen(base + '/health') as response:
                self.assertFalse(json.load(response)['ai'])
            for path in ['/../README.md', '/.env']:
                with self.assertRaises(urllib.error.HTTPError) as caught:
                    urllib.request.urlopen(base + path)
                self.assertEqual(caught.exception.code, 404)
            for headers, expected in [({'Origin': 'https://evil.invalid'}, 403), ({'Origin': base}, 503)]:
                with self.assertRaises(urllib.error.HTTPError) as caught:
                    urllib.request.urlopen(urllib.request.Request(base + '/api/grade', data=b'{}', headers=headers))
                self.assertEqual(caught.exception.code, expected)
            with self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(urllib.request.Request(base, headers={'Host': 'evil.invalid'}))
            self.assertEqual(caught.exception.code, 403)
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=2)


if __name__ == '__main__':
    unittest.main()
