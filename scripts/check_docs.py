"""Checks this discovery delivery without dependencies, network, or credentials."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
required = [
    'README.md', 'AGENTS.md', '.env.example', 'docs/discovery.md',
    'docs/feature-parity.md', 'docs/architecture.md', 'docs/roadmap.md',
    'docs/design-system.md', 'docs/backend-readiness.md',
    'docs/source-inventory.md', 'docs/validation.md', 'docs/phase-1a.md',
    'docs/backend-contracts.md', 'docs/device-checklist.md',
    'docs/phase-1b.md',
]
errors = []
for name in required:
    if not (root / name).is_file() or not (root / name).read_text().strip():
        errors.append(f'Missing or empty: {name}')
for path in [root / 'README.md', root / 'AGENTS.md', *sorted((root / 'docs').glob('*.md')), root / '.env.example']:
    if not path.exists():
        continue
    text = path.read_text()
    # Catch JWT-shaped values without displaying them.
    if re.search(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', text):
        errors.append(f'JWT-shaped value found: {path.relative_to(root)}')
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', text):
        if '://' in target or target.startswith('#'):
            continue
        if not (path.parent / target.split('#')[0]).exists():
            errors.append(f'Broken link: {path.relative_to(root)} -> {target}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'PASS: {len(required)} required documents/configs; relative Markdown links; no JWT-shaped values.')
print('Scope: documentary checks only; no runtime, remote RLS, or device validation.')
