"""Install the bundled skill without overwriting an existing installation."""
import argparse
import os
from pathlib import Path
import shutil


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', type=Path, help='Parent skills directory; default CODEX_HOME/skills or ~/.codex/skills')
    parser.add_argument('--update', action='store_true', help='Update an existing buct-finalhelp installation')
    args = parser.parse_args()
    parent = args.target or Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
    destination = parent / 'buct-finalhelp'
    if destination.exists() and not args.update:
        parser.exit(1, f'Existing skill preserved: {destination}\nChoose another target or update it deliberately.\n')
    if destination.exists():
        entry = destination / 'SKILL.md'
        if not entry.is_file() or 'name: buct-finalhelp' not in entry.read_text(encoding='utf-8-sig'):
            parser.exit(1, 'Target is not an identifiable buct-finalhelp skill; no changes made.\n')
    source = Path(__file__).resolve().parents[1] / 'skills' / 'buct-finalhelp'
    parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, dirs_exist_ok=args.update, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    if args.update:
        # Remove only obsolete files from earlier releases of this same skill.
        for relative in ('assets/quiz-app/grading.js', 'assets/quiz-app/protocol.js', 'scripts/host_bridge.py', 'scripts/bridge.py', 'references/ai-grading.md', 'references/authoring.md'):
            obsolete = destination / relative
            if obsolete.is_file(): obsolete.unlink()
    print(f'Installed: {destination.resolve()}')


if __name__ == '__main__':
    main()
