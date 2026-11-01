"""Open a local quiz in the operating system's default browser."""
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit


def open_default_browser(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https', 'file'):
        raise ValueError('Only a web URL or local HTML file may be opened')
    if sys.platform == 'win32':
        os.startfile(url)
    else:
        command = ['open', url] if sys.platform == 'darwin' else ['xdg-open', url]
        subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('target', help='Web URL or local HTML file')
    args = parser.parse_args()
    target = args.target if urlsplit(args.target).scheme in ('http', 'https', 'file') else Path(args.target).resolve().as_uri()
    try: open_default_browser(target)
    except (OSError, ValueError) as error: parser.exit(1, f'Could not open default browser: {error}\n')
