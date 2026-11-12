"""Pinned public-source audit and bounded, content-addressed local acquisition.

Dataset cards are checked before payloads are fetched. No remote code executes.
"""
from __future__ import annotations
import csv
import hashlib
import io
import json
import os
import tempfile
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from research.common import ROOT, strict_json

LOCK = ROOT / 'data/public_sources.lock.json'
ALLOWED_LICENSES = {'cc-by-4.0', 'apache-2.0'}


def load_registry(path=LOCK):
    registry = json.loads(Path(path).read_text())
    for source in registry['sources']:
        if source['license'] not in ALLOWED_LICENSES:
            raise ValueError('Source license requires explicit review')
        if len(source['revision']) != 40 or any(c not in '0123456789abcdef' for c in source['revision']):
            raise ValueError('An immutable source commit is required')
        for name in source['metadata_files'] + source['files']:
            if Path(name).is_absolute() or '..' in Path(name).parts:
                raise ValueError('Unsafe source file path')
    return registry


def source_url(source, name):
    repo, revision = source['repository'], source['revision']
    if source['provider'] == 'github':
        return f'https://raw.githubusercontent.com/{repo}/{revision}/{name}'
    kind = 'spaces' if source['provider'] == 'hf_space' else 'datasets'
    return f'https://huggingface.co/{kind}/{repo}/resolve/{revision}/{name}'


def api_url(source):
    if source['provider'] == 'github':
        return f"https://api.github.com/repos/{source['repository']}/commits/{source['revision']}"
    kind = 'spaces' if source['provider'] == 'hf_space' else 'datasets'
    return f"https://huggingface.co/api/{kind}/{source['repository']}/revision/{source['revision']}"


def get_bytes(url, limit):
    request = urllib.request.Request(url, headers={'User-Agent': 'SurakshaMergeDatasetAudit/1.0'})
    with urllib.request.urlopen(request, timeout=40) as response:
        declared = response.headers.get('content-length')
        if declared and int(declared) > limit:
            raise ValueError('Remote file exceeds the acquisition budget')
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Remote file exceeds the acquisition budget')
    return data


def private_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        path.chmod(0o600)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def save_json(path, value):
    private_write(path, (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False, allow_nan=False)+'\n').encode())


def audit_sources(raw_root, registry_path=LOCK):
    raw_root = Path(raw_root)
    registry = load_registry(registry_path)
    entries = []
    for source in registry['sources']:
        entry = {**source, 'available': False, 'license_verified': False, 'metadata': []}
        try:
            api = json.loads(get_bytes(api_url(source), 2_000_000))
            if api.get('sha') != source['revision'] or api.get('private') or api.get('gated'):
                raise ValueError('Pinned source is unavailable, private or gated')
            for name in source['metadata_files']:
                data = get_bytes(source_url(source, name), 2_000_000)
                if source.get('metadata_sha256', {}).get(name) not in (None, hashlib.sha256(data).hexdigest()):
                    raise ValueError('Pinned source card checksum mismatch')
                location = Path(source['id']) / source['revision'] / 'metadata' / name
                private_write(raw_root / location, data)
                entry['metadata'].append({'path': str(location), 'source_path': name, 'url': source_url(source,name), 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)})
            # Dataset-specific card governs data, rather than a host's code license.
            governing = 'DATASET_CARD.md' if source['id']=='chakravyuh_bench' else 'README.md'
            card = (raw_root / source['id'] / source['revision'] / 'metadata' / governing).read_text().lower()
            aliases = ('cc-by-4.0', 'cc by 4.0') if source['license']=='cc-by-4.0' else ('apache-2.0', 'apache license 2.0')
            if not any(value in card for value in aliases):
                raise ValueError('The governing card does not establish the selected license')
            entry.update(available=True, license_verified=True, preflight_columns=source['columns'], preflight_format=source['format'])
        except (urllib.error.URLError, ValueError, TimeoutError) as error:
            entry['skip_reason'] = type(error).__name__ + ': ' + str(error)
        entries.append(entry)
    report = {'schema_version': 1, 'registry_sha256': hashlib.sha256(Path(registry_path).read_bytes()).hexdigest(), 'checked_at': datetime.now(timezone.utc).isoformat(), 'sources': entries}
    save_json(raw_root/'audit.json', report)
    return report


def download_sources(raw_root, registry_path=LOCK):
    raw_root = Path(raw_root)
    report = json.loads((raw_root/'audit.json').read_text())
    if report['registry_sha256'] != hashlib.sha256(Path(registry_path).read_bytes()).hexdigest():
        raise ValueError('The source registry changed after preflight')
    previous = json.loads((raw_root/'downloads.json').read_text()) if (raw_root/'downloads.json').exists() else {'files': []}
    known = {r['path']:r for r in previous['files']}
    registry = load_registry(registry_path)
    audited = {entry['id']: entry for entry in report['sources']}
    files = []
    for source in registry['sources']:
        state = audited.get(source['id'], {})
        if not state.get('available') or not state.get('license_verified'):
            continue
        for name in source['files']:
            location = Path(source['id'])/source['revision']/'original'/name
            path = raw_root/location
            if path.exists():
                data=path.read_bytes()
                expected=source.get('files_sha256',{}).get(name) or known.get(str(location),{}).get('sha256')
                if not expected or hashlib.sha256(data).hexdigest()!=expected:
                    raise ValueError('Existing raw download is unverified or modified')
            else:
                data=get_bytes(source_url(source,name),source['max_file_bytes'])
                if source.get('files_sha256', {}).get(name) not in (None, hashlib.sha256(data).hexdigest()):
                    raise ValueError('Pinned source payload checksum mismatch')
                private_write(path,data)
            if source.get('files_sha256', {}).get(name) not in (None, hashlib.sha256(data).hexdigest()):
                raise ValueError('Pinned source payload checksum mismatch')
            files.append({'source_id':source['id'],'revision':source['revision'],'source_path':name,'path':str(location),'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'url':source_url(source,name),'license':source['license'],'role':source['role']})
            save_json(raw_root/'downloads.json', {'registry_sha256':report['registry_sha256'],'files':files})
    result={'registry_sha256':report['registry_sha256'],'files':files}
    save_json(raw_root/'downloads.json', result)
    return result


def verified_downloads(raw_root):
    raw_root=Path(raw_root)
    manifest=json.loads((raw_root/'downloads.json').read_text())
    registry_sha=hashlib.sha256(LOCK.read_bytes()).hexdigest()
    if manifest['registry_sha256']!=registry_sha:
        raise ValueError('Downloaded source lock mismatch')
    if not (raw_root/'audit.json').is_file():
        raise ValueError('A source preflight is required before preparing data')
    audit=json.loads((raw_root/'audit.json').read_text())
    if audit['registry_sha256']!=registry_sha:
        raise ValueError('Source preflight lock mismatch')
    registry={s['id']:s for s in load_registry()['sources']}
    available={s['id'] for s in audit['sources'] if s['available'] and s['license_verified']}
    if not available.issubset(registry):
        raise ValueError('Unexpected source in preflight')
    expected={(key,name) for key in available for name in registry[key]['files']}
    actual={(r.get('source_id'),r.get('source_path')) for r in manifest['files']}
    if expected!=actual or len(actual)!=len(manifest['files']):
        raise ValueError('Acquisition is incomplete or duplicated; resume downloads before preparing data')
    for record in manifest['files']:
        source=registry[record['source_id']]
        name=record['source_path']
        location=Path(source['id'])/source['revision']/'original'/name
        expected_hash=source.get('files_sha256',{}).get(name)
        if any(record.get(k)!=value for k,value in {
            'path':str(location),'revision':source['revision'],'license':source['license'],
            'role':source['role'],'url':source_url(source,name),'sha256':expected_hash,
        }.items()) or not expected_hash:
            raise ValueError('Download manifest disagrees with the pinned source lock')
        path=(raw_root/location).resolve()
        if not path.is_relative_to(raw_root.resolve()):
            raise ValueError('Raw download checksum/path mismatch')
        data=path.read_bytes()
        if len(data)!=record.get('bytes') or len(data)>source['max_file_bytes'] or hashlib.sha256(data).hexdigest()!=expected_hash:
            raise ValueError('Raw download checksum/path mismatch')
        yield record,path


def iter_source_rows(path, format_name):
    path=Path(path)
    if format_name=='parquet':
        import pyarrow.parquet as pq
        yield from pq.read_table(path).to_pylist()
    elif format_name=='csv':
        with path.open(encoding='utf-8-sig',newline='') as stream:
            yield from csv.DictReader(stream)
    elif format_name=='jsonl':
        with path.open(encoding='utf-8-sig') as stream:
            for line in stream:
                if line.strip():yield strict_json(line)
    elif format_name=='zip_jsonl':
        with zipfile.ZipFile(path) as archive:
            members=[m for m in archive.infolist() if m.filename.endswith('.jsonl') and not m.is_dir() and not m.filename.startswith('__MACOSX/')]
            if not members or sum(m.file_size for m in members)>256*1024*1024:
                raise ValueError('Unexpected or oversized conversation archive')
            for member in members:
                if member.flag_bits & 1 or '..' in Path(member.filename).parts or Path(member.filename).is_absolute():
                    raise ValueError('Unsafe archive member')
                with archive.open(member) as stream:
                    for line in io.TextIOWrapper(stream,encoding='utf-8-sig'):
                        if len(line)>1_000_000:raise ValueError('Conversation row exceeds size budget')
                        if line.strip():yield strict_json(line)
    else:raise ValueError('Unsupported pinned source format')
