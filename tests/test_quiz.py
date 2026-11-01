import copy
from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / 'skills' / 'buct-finalhelp' / 'scripts'
sys.path.insert(0, str(SCRIPTS))
from build_quiz import build_html, fingerprint, load_bank, validate_bank
from serve_quiz import make_server
import browser_open


class QuizTests(unittest.TestCase):
    def setUp(self): self.bank = load_bank(ROOT / 'examples' / 'demo-bank.json')

    def test_every_type_has_a_complete_answer_explanation_and_source_before_build(self):
        self.assertEqual({q['type'] for q in self.bank['questions']}, {'fill','boolean','choice','short','calculation'})
        changes = [lambda b: b['questions'][0].update(source_ids=['missing']), lambda b: b['questions'][0].update(solution_steps=[]), lambda b: b['questions'][6].update(answer=''), lambda b: b['questions'][8].update(explanation=''), lambda b: b['questions'][0].update(points=3), lambda b: b['questions'][2].update(answer='false'), lambda b: b['questions'][0].update(id='__proto__')]
        for change in changes:
            bad=copy.deepcopy(self.bank); change(bad)
            with self.assertRaises(ValueError): validate_bank(bad)

    def test_content_changes_isolate_learning_progress(self):
        before=fingerprint(self.bank)
        self.assertEqual(before,fingerprint(dict(reversed(list(self.bank.items())))))
        self.bank['questions'][0]['answer'][0]=['修改答案']
        self.assertNotEqual(before,fingerprint(self.bank))

    def test_untrusted_material_remains_data(self):
        payload='</script><script>alert(1)</script> /*APP*/'
        self.bank['questions'][0]['prompt']=payload
        page=build_html(self.bank)
        class Parser(HTMLParser):
            def __init__(self): super().__init__(); self.scripts=0; self.in_bank=False; self.bank_text=''
            def handle_starttag(self,tag,attrs):
                if tag=='script': self.scripts+=1
                if dict(attrs).get('id')=='bank': self.in_bank=True
            def handle_endtag(self,tag):
                if tag=='script': self.in_bank=False
            def handle_data(self,data):
                if self.in_bank:self.bank_text+=data
        p=Parser();p.feed(page)
        self.assertEqual(p.scripts,3)
        self.assertEqual(json.loads(p.bank_text)['questions'][0]['prompt'],payload)
        self.assertIn('解题步骤',page)

    def test_local_server_delivers_ready_answers_without_a_submission_channel(self):
        server=make_server(self.bank,port=0); worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start()
        base=f'http://127.0.0.1:{server.server_address[1]}'
        try:
            with urllib.request.urlopen(base) as response:
                page=response.read().decode();self.assertIn("connect-src 'none'",response.headers['Content-Security-Policy'])
                self.assertIn('I=U/R=12/6=2 A',page)
            with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(urllib.request.Request(base+'/api/submit',data=b'{}'))
            self.assertEqual(caught.exception.code,501)
            for url,headers in [(base+'/.env',{}),(base,{'Host':'evil.invalid'})]:
                with self.assertRaises(urllib.error.HTTPError) as caught:urllib.request.urlopen(urllib.request.Request(url,headers=headers))
                self.assertIn(caught.exception.code,(403,404))
        finally:server.shutdown();server.server_close();worker.join(timeout=2)

    def test_default_browser_uses_operating_system_association(self):
        with patch.object(browser_open.sys,'platform','win32'),patch.object(browser_open.os,'startfile',create=True) as launch:
            browser_open.open_default_browser('http://127.0.0.1:8765');launch.assert_called_once_with('http://127.0.0.1:8765')
        for platform,program in [('darwin','open'),('linux','xdg-open')]:
            with patch.object(browser_open.sys,'platform',platform),patch.object(browser_open.subprocess,'Popen') as launch:
                browser_open.open_default_browser('http://127.0.0.1:8765');self.assertEqual(launch.call_args.args[0],[program,'http://127.0.0.1:8765'])
        with self.assertRaises(ValueError):browser_open.open_default_browser('javascript:alert(1)')

    def test_installer_protects_existing_skill_and_can_explicitly_update_older_release(self):
        with tempfile.TemporaryDirectory() as target:
            cmd=[sys.executable,'-X','utf8',str(ROOT/'scripts/install_skill.py'),'--target',target]
            run=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8');self.assertEqual(run.returncode,0,run.stderr)
            run=subprocess.run(cmd,capture_output=True);self.assertNotEqual(run.returncode,0)
            stale=Path(target)/'buct-finalhelp/assets/quiz-app/grading.js';stale.write_text('obsolete',encoding='utf-8')
            run=subprocess.run(cmd+['--update'],capture_output=True,text=True,encoding='utf-8');self.assertEqual(run.returncode,0,run.stderr)
            self.assertFalse(stale.exists());self.assertTrue((stale.parent/'study.js').is_file())


if __name__=='__main__':unittest.main()
