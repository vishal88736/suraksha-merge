"""Model-independent checkpoint and provenance checks, usable without a GPU."""
import hashlib
import json
from pathlib import Path

def file_digest(path):
    result=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(8*1024*1024),b''):result.update(block)
    return result.hexdigest()

def adapter_fingerprints(path):
    path=Path(path)
    required=['adapter_config.json','adapter_model.safetensors']
    if not all((path/name).is_file() for name in required):
        raise FileNotFoundError('A complete safetensors LoRA checkpoint is required')
    return {name:file_digest(path/name) for name in required}

def write_adapter_manifest(adapter, output, manifest):
    adapter,output=Path(adapter).resolve(),Path(output).resolve()
    relative=adapter.relative_to(output)
    enriched={**manifest,'adapter_path':str(adapter),'artifacts':adapter_fingerprints(adapter)}
    for directory,location in [(adapter,'.'),(output,str(relative))]:
        directory.mkdir(parents=True,exist_ok=True)
        (directory/'suraksha_manifest.json').write_text(json.dumps({**enriched,'adapter_relative_path':location},indent=2)+'\n')

def read_adapter_manifest(path):
    path=Path(path)
    for location in [path/'suraksha_manifest.json',path.parent/'suraksha_manifest.json']:
        if location.is_file():return json.loads(location.read_text())
    raise FileNotFoundError('Checkpoint provenance manifest is missing')

def resolve_adapter(path):
    root=Path(path).resolve()
    manifest=read_adapter_manifest(root)
    if (root/'adapter_model.safetensors').is_file():
        adapter=root
    else:
        relative=manifest.get('adapter_relative_path')
        if relative is None:
            # Legacy manifests can identify a checkpoint by basename after a
            # project move; integrity verification below still remains required.
            relative=Path(manifest.get('adapter_path','')).name
        adapter=(root/relative).resolve()
        if not adapter.is_relative_to(root):raise ValueError('Adapter path escapes its selected output directory')
    actual=adapter_fingerprints(adapter)
    if manifest.get('artifacts')!=actual:
        raise ValueError('Adapter fingerprint missing or mismatched; use a checkpoint with a verified training manifest')
    return adapter,manifest

def safe_dataset_file(root,name):
    root=Path(root).resolve()
    if not isinstance(name,str) or Path(name).is_absolute():raise ValueError('Invalid dataset manifest path')
    path=(root/name).resolve()
    if not path.is_relative_to(root):raise ValueError('Dataset manifest path escapes its output directory')
    return path

def verify_prediction_manifest(path, benchmark):
    path=Path(path)
    manifest_path=path.with_suffix('.manifest.json')
    if not manifest_path.is_file():raise ValueError('Prediction manifest missing; use the generator or explicitly allow unverified predictions')
    manifest=json.loads(manifest_path.read_text())
    if manifest.get('benchmark_sha256')!=file_digest(benchmark) or manifest.get('predictions_sha256')!=file_digest(path):
        raise ValueError('Prediction or benchmark checksum does not match its inference manifest')
    if manifest.get('repairs_applied') is not False or not manifest.get('model'):
        raise ValueError('Inference provenance is incomplete or model outputs were repaired')
    return manifest
