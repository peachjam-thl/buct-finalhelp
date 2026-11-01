"""Install the bundled skill without overwriting an existing installation."""
import argparse
import os
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', type=Path, help='Parent skills directory; default CODEX_HOME/skills or ~/.codex/skills')
    args = parser.parse_args()
    parent = args.target or Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
    destination = parent / 'buct-finalhelp'
    if destination.exists():
        parser.exit(1, f'Existing skill preserved: {destination}\nChoose another target or update it deliberately.\n')
    source = Path(__file__).resolve().parents[1] / 'skills' / 'buct-finalhelp'
    parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    print(f'Installed: {destination.resolve()}')


if __name__ == '__main__':
    main()
