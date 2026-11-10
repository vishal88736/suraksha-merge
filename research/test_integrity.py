import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from phase1_curatorkit_pipeline import curate
from phase2_aligntune_train_and_merge import check_data, resolve_shared_base, write_manifest
from phase3_auditkit_eval import evaluate, paired_bootstrap, score_prediction
from research.artifacts import file_digest, resolve_adapter, safe_dataset_file, verify_prediction_manifest
from research.common import ROOT, extraction_reward, read_jsonl, strict_json, write_jsonl

class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.rows=read_jsonl(ROOT/'data/seeds/synthetic_cases.jsonl')
        self.target=self.rows[0]['target']
    def test_checkpoint_only_outputs_resolve_without_loading_a_model(self):
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'schema';adapter=output/'checkpoint-100';adapter.mkdir(parents=True)
            (adapter/'adapter_config.json').write_text('{}');(adapter/'adapter_model.safetensors').write_bytes(b'fixture')
            write_manifest(adapter,output,{'stage':'schema'})
            actual,manifest=resolve_adapter(output)
            self.assertEqual(actual,adapter.resolve());self.assertEqual(manifest['stage'],'schema')
            # The same checkpoint remains discoverable after moving the project.
            moved=Path(tmp)/'moved';output.rename(moved)
            self.assertEqual(resolve_adapter(moved)[0],moved/'checkpoint-100')
            (moved/'checkpoint-100'/'adapter_model.safetensors').write_bytes(b'tampered')
            with self.assertRaises(ValueError):resolve_adapter(moved)
    def test_adapter_manifests_cannot_escape_the_selected_directory(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'suraksha_manifest.json').write_text(json.dumps({'adapter_relative_path':'../escape'}))
            with self.assertRaises(ValueError):resolve_adapter(root)
    def test_original_vocabulary_remains_a_valid_explicit_choice(self):
        args=SimpleNamespace(base='Qwen/Qwen2.5-3B-Instruct',shared_base=None)
        self.assertEqual(resolve_shared_base(args),args.base)
        args.shared_base=Path('/not/a/shared/model')
        with self.assertRaises(FileNotFoundError):resolve_shared_base(args)
    def test_baseline_is_stable_when_prediction_flags_are_reordered(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);benchmark=root/'benchmark.jsonl';prediction=root/'prediction.jsonl'
            write_jsonl(benchmark,[{'sample_id':'1','scenario_group':'one','input':'case','target':json.dumps(self.target)}])
            write_jsonl(prediction,[{'sample_id':'1','prediction':json.dumps(self.target)+'\n---REPLY---\nNotify bank, 1930 and cybercrime.gov.in'}])
            for mapping in [{'empathy':prediction,'base':prediction},{'base':prediction,'empathy':prediction}]:
                report=evaluate(benchmark,mapping,root/'report.json',fixture_mode=True)
                self.assertEqual(report['baseline'],'base');self.assertFalse(report['model_quality_claim_permitted'])
            with self.assertRaises(ValueError):evaluate(benchmark,{'base':prediction},root/'report.json',fixture_mode=True,args_baseline='missing')
    def test_modified_predictions_and_benchmarks_fail_provenance_checks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);prediction=root/'pred.jsonl';benchmark=root/'bench.jsonl'
            write_jsonl(prediction,[{'sample_id':'1','prediction':'x'}]);write_jsonl(benchmark,[{'sample_id':'1'}])
            manifest={'model':'fixture-only','repairs_applied':False,'predictions_sha256':file_digest(prediction),'benchmark_sha256':file_digest(benchmark)}
            prediction.with_suffix('.manifest.json').write_text(json.dumps(manifest))
            self.assertEqual(verify_prediction_manifest(prediction,benchmark)['model'],'fixture-only')
            prediction.write_text('tampered')
            with self.assertRaises(ValueError):verify_prediction_manifest(prediction,benchmark)
    def test_jsonl_writes_are_atomic_and_private(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'data.jsonl';write_jsonl(path,[{'valid':1}])
            with self.assertRaises(ValueError):write_jsonl(path,[{'invalid':float('nan')}])
            self.assertEqual(read_jsonl(path),[{'valid':1}]);self.assertEqual(path.stat().st_mode&0o777,0o600)
    def test_stale_files_do_not_enter_a_new_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'stale.jsonl').write_text('private stale material')
            manifest=curate(self.rows,root)
            self.assertNotIn('stale.jsonl',manifest['files'])
            self.assertEqual(manifest['accepted'],18)
    def test_empty_and_tampered_datasets_cannot_start_training(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);manifest=curate(self.rows,root)
            args=SimpleNamespace(data=root,allow_bootstrap_data=True)
            check_data(args)
            (root/'train/rlvr.jsonl').write_text('tampered')
            with self.assertRaises(ValueError):check_data(args)
            manifest['accepted']=0;manifest['files']={};(root/'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):check_data(args)
    def test_manifest_paths_cannot_read_outside_the_dataset(self):
        with tempfile.TemporaryDirectory() as tmp:
            for path in ['../secret','/etc/passwd']:
                with self.assertRaises(ValueError):safe_dataset_file(Path(tmp),path)
    def test_action_order_does_not_change_the_schema_reward(self):
        changed=copy.deepcopy(self.target);changed['mandatory_actions'].reverse()
        self.assertEqual(extraction_reward(json.dumps(changed),self.target),1.0)
    def test_malformed_gold_is_rejected_without_crashing_the_run(self):
        rows=copy.deepcopy(self.rows[:1]);rows[0]['target']['mandatory_actions']=[{}]
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(curate(rows,Path(tmp))['rejected'],1)
    def test_incomplete_output_never_earns_dual_task_utility(self):
        self.assertEqual(score_prediction(json.dumps(self.target),self.target)['utility'],0)
        self.assertEqual(score_prediction('{broken\n---REPLY---\nCall bank and 1930',self.target)['utility'],0)
    def test_nonfinite_exponents_and_bad_bootstrap_sizes_fail_closed(self):
        with self.assertRaises(ValueError):strict_json('{"x":1e999}')
        with self.assertRaises(ValueError):paired_bootstrap([{'scenario_group':'x'}],[{'utility':0}],[{'utility':1}],repeats=0)
if __name__=='__main__':unittest.main()
