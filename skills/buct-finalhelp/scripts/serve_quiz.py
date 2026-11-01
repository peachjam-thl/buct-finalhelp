"""Serve a fixed-answer practice page and open the operating system's default browser."""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from build_quiz import build_html, load_bank
from browser_open import open_default_browser


def make_server(bank=None, port=8765, demo=None):
    document = build_html(bank,demo).encode('utf-8')
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args): pass
        def do_GET(self):
            port = self.server.server_address[1]
            if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
                status, body, mime = 403, b'Forbidden', 'text/plain'
            elif self.path.split('?')[0] in ('/', '/index.html'):
                status, body, mime = 200, document, 'text/html; charset=utf-8'
            else:
                status, body, mime = 404, b'Not found', 'text/plain'
            self.send_response(status)
            for k, v in {'Content-Type': mime, 'Content-Length': str(len(body)), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}.items(): self.send_header(k, v)
            self.end_headers()
            try: self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError): pass
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler); server.daemon_threads = True
    return server


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bank',nargs='?'); parser.add_argument('--demo'); parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-open', action='store_true', help='Headless/automated checks only')
    args = parser.parse_args()
    try: server = make_server(load_bank(args.bank) if args.bank else None, args.port,load_bank(args.demo) if args.demo else None)
    except (OSError, ValueError) as error: parser.exit(1, f'Cannot start: {error}\n')
    url = f'http://127.0.0.1:{server.server_address[1]}'
    print(f'FinalHelp: {url}', flush=True)
    print('All answers and explanations are ready. No model connection or online grading is needed.', flush=True)
    if not args.no_open:
        try: open_default_browser(url)
        except (OSError, ValueError): print('Could not open the system default browser; open the printed URL manually.', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__ == '__main__': main()
