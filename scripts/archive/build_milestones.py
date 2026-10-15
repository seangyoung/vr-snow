#!/usr/bin/env python3
"""Build portable, frozen milestone sites from exact Git commits (not the checkout)."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'milestone-archives')
parser.add_argument('--only', help='Build just this milestone slug')
args = parser.parse_args()
output = args.output.resolve()
output.mkdir(parents=True, exist_ok=True)
items = json.loads((ROOT / 'docs/milestones/index.json').read_text())
if args.only:
    items = [item for item in items if item['slug'] == args.only]
    if not items:
        parser.error('Unknown milestone slug')

for item in items:
    slug = item['slug']
    destination = output / slug
    if destination.exists():
        raise SystemExit(f'{destination} exists; choose another output directory to preserve the archive.')
    with tempfile.TemporaryDirectory(prefix='vr-snow-milestone-') as temp:
        source = Path(temp)
        archive = source / 'source.tar'
        # Include only the historical build inputs. Large authoring .blend files remain in Git.
        subprocess.run(['git', 'archive', '--format=tar', '-o', str(archive), item['commit'],
                        'src', 'public', 'index.html', 'package.json', 'package-lock.json',
                        'tsconfig.json', 'vite.config.ts'], cwd=ROOT, check=True)
        with tarfile.open(archive) as tar:
            tar.extractall(source, filter='data')
        log = output / f'{slug}.build.log'
        with log.open('w') as stream:
            subprocess.run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=source, stdout=stream,
                           stderr=subprocess.STDOUT, check=True)
            subprocess.run(['npm', 'run', 'build'], cwd=source, env={**os.environ, 'VITE_BASE_PATH': './'},
                           stdout=stream, stderr=subprocess.STDOUT, check=True)
        shutil.copytree(source / 'dist', destination / 'site')
        shutil.copy2(source / 'package-lock.json', destination / 'package-lock.json')
        shutil.copy2(log, destination / 'build.log')
    metadata = {**item, 'archiveDate': __import__('datetime').date.today().isoformat(),
                'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                'npm': subprocess.check_output(['npm', '--version'], text=True).strip(),
                'buildBase': './', 'sourceModified': False}
    (destination / 'snapshot.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (destination / 'README.txt').write_text(
        f"The Broad Street Inquiry — {item['title']}\n\n{item['description']}\n"
        f"Source: {item['commit']}\nTag: {item['tag']}\n\n"
        "This is a frozen historical build. It is not the current app.\n"
        "From this folder run: python3 -m http.server 8080 --bind 127.0.0.1 --directory site\n"
        "Then open http://127.0.0.1:8080/ in a desktop browser. Do not open index.html directly.\n"
        "No npm install or build is needed to play this snapshot.\n"
        "For headset use, serve site/ over HTTPS; a remote headset cannot use desktop localhost.\n"
        "The historical controls, limitations and bugs are preserved. Browser compatibility may change.\n"
        "See snapshot.json for source and build provenance, package-lock.json for dependencies.\n"
    )
    lines = []
    for path in sorted(destination.rglob('*')):
        if path.is_file():
            lines.append(f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(destination).as_posix()}')
    (destination / 'SHA256SUMS.txt').write_text('\n'.join(lines) + '\n')
    with zipfile.ZipFile(output / f'{slug}.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(destination.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(output))
    print(f'Built {slug}: {item["commit"]}', flush=True)

