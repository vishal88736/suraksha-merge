import copy,json,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from research.common import ROOT,read_jsonl,write_jsonl
from research.human_review import build_queue,record_decision,materialize_reviewed,FIELDS,prepare_evaluation,finalize_evaluation
from phase2_aligntune_train_and_merge import validate_smoke_options,assert_tokenizer_matches_model,train,register_reward,training_settings
from scripts.check_training_environment import verify_metadata

class ReviewTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
  self.queue=self.root/'queue.jsonl';self.decisions=self.root/'decisions.jsonl'
  seed=copy.deepcopy(read_jsonl(ROOT/'data/seeds/synthetic_cases.jsonl')[0]);seed['provenance']={'fixture_only':True}
  from research.common import engine_batch
  seed['chosen_reply']=engine_batch([seed['input']])[0]['reply']['text']
  write_jsonl(self.root/'unified.jsonl',[seed]);build_queue(self.root,self.queue,review_type='fixture')
  self.rid=seed['sample_id']
 def decide(self,action,**kw):return record_decision(self.queue,self.decisions,self.rid,'fixture-human',action,attest=True,fields=list(FIELDS),**kw)
 def test_unreviewed_never_promoted_by_export(self):
  result=materialize_reviewed(self.queue,self.decisions,self.root/'out');self.assertEqual(result,{'reviewed':0,'rejected':0,'unreviewed':1})
 def test_accept_requires_identity_attestation_all_dimensions(self):
  for kw in ({'reviewer':'','attest':True},{'reviewer':'fixture','attest':False},{'reviewer':'fixture','attest':True,'fields':['classification']}):
   with self.assertRaises(ValueError):record_decision(self.queue,self.decisions,self.rid,action='accept',**kw)
  self.decide('accept');result=materialize_reviewed(self.queue,self.decisions,self.root/'out');self.assertEqual(result['reviewed'],1)
  r=read_jsonl(self.root/'out/reviewed.jsonl')[0];self.assertEqual(r['review_history'][0]['reviewer'],'fixture-human');self.assertTrue(r['review_history'][0]['timestamp_utc']);self.assertEqual(r['provenance'],{'fixture_only':True})
 def test_reject_reopen_and_history_preserved(self):
  self.decide('accept');self.decide('reject');self.assertEqual(materialize_reviewed(self.queue,self.decisions,self.root/'out')['rejected'],1)
  self.decide('reopen');self.assertEqual(materialize_reviewed(self.queue,self.decisions,self.root/'out')['unreviewed'],1)
  self.assertEqual(len(read_jsonl(self.root/'out/unreviewed.jsonl')[0]['review_history']),3)
 def test_correction_updates_real_ground_truth_and_rejects_invalid_schema(self):
  target=read_jsonl(self.queue)[0]['expected_json'];target['panic_severity']='MEDIUM'
  self.decide('correct',corrections={'expected_json':target})
  materialize_reviewed(self.queue,self.decisions,self.root/'out');self.assertEqual(read_jsonl(self.root/'out/reviewed.jsonl')[0]['expected_json']['panic_severity'],'MEDIUM')
  with self.assertRaises(ValueError):self.decide('correct',corrections={'expected_json':{}})
  with self.assertRaises(ValueError):self.decide('correct',corrections={'human_reviewed':True})
 def test_later_accept_keeps_previous_corrections(self):
  target=read_jsonl(self.queue)[0]['expected_json'];target['panic_severity']='MEDIUM'
  self.decide('correct',corrections={'expected_json':target});self.decide('accept')
  materialize_reviewed(self.queue,self.decisions,self.root/'out')
  self.assertEqual(read_jsonl(self.root/'out/reviewed.jsonl')[0]['expected_json']['panic_severity'],'MEDIUM')
  self.decide('reopen');materialize_reviewed(self.queue,self.decisions,self.root/'out')
  self.assertEqual(read_jsonl(self.root/'out/unreviewed.jsonl')[0]['expected_json']['panic_severity'],'MEDIUM')
 def test_modified_history_is_rejected(self):
  self.decide('accept');self.decide('reject');history=read_jsonl(self.decisions);history[0]['notes']='changed';write_jsonl(self.decisions,history)
  with self.assertRaises(ValueError):materialize_reviewed(self.queue,self.decisions,self.root/'out')
 def test_unsafe_chosen_reply_and_stale_provenance_blocked(self):
  with self.assertRaises(ValueError):self.decide('correct',corrections={'chosen_reply':'Your refund is 100% guaranteed'})
  self.decide('accept');rows=read_jsonl(self.queue);rows[0]['complaint_text']+=' changed';write_jsonl(self.queue,rows)
  with self.assertRaises(ValueError):materialize_reviewed(self.queue,self.decisions,self.root/'out')
 def test_evaluation_cannot_release_pending_cases(self):
  with self.assertRaises(ValueError):finalize_evaluation(self.queue,self.decisions,self.root/'eval')
 def fixture_coverage_queue(self):
  from research.human_review import CATEGORIES,LANGUAGES
  base=read_jsonl(self.queue)[0];rows=[]
  for ci,category in enumerate(CATEGORIES):
   for li,language in enumerate(LANGUAGES):
    row=copy.deepcopy(base);row['review_id']=f'fixture-{ci}-{li}';row['expected_json']['dispute_category']=category;row['expected_json']['detected_language']=language;row['split']='test';rows.append(row)
  write_jsonl(self.queue,rows)
  for row in rows:record_decision(self.queue,self.decisions,row['review_id'],'fixture-independent-human','accept',attest=True,fields=list(FIELDS))
  return rows
 def test_independent_evaluation_release_and_shared_reviewer_block(self):
  rows=self.fixture_coverage_queue();report=finalize_evaluation(self.queue,self.decisions,self.root/'release')
  self.assertEqual(report['reviewed'],35);self.assertFalse(report['model_evaluated'])
  self.assertTrue((self.root/'release/release_manifest.json').exists())
  with self.assertRaises(ValueError):finalize_evaluation(self.queue,self.decisions,self.root/'release')
  author=self.root/'author.jsonl';write_jsonl(author,[{'review_id':rows[0]['review_id'],'reviewer':'fixture-independent-human'}])
  with self.assertRaises(ValueError):finalize_evaluation(self.queue,self.decisions,self.root/'different',author)
 def test_training_export_excludes_heldout_cases_and_requires_coverage(self):
  from research.human_review import export_curation
  with self.assertRaises(ValueError):export_curation(self.queue,self.decisions,self.root/'train.jsonl')
  rows=self.fixture_coverage_queue()
  # New queue content requires fresh explicit decisions; old hashes cannot transfer.
  for i,row in enumerate(rows):row['split']='validation' if i==1 else 'train'
  heldout=copy.deepcopy(rows[0]);heldout['review_id']='heldout-fixture';heldout['split']='test';rows.append(heldout)
  write_jsonl(self.queue,rows);self.decisions.unlink()
  for row in rows:record_decision(self.queue,self.decisions,row['review_id'],'fixture-independent-human','accept',attest=True,fields=list(FIELDS))
  export_curation(self.queue,self.decisions,self.root/'train.jsonl')
  exported=read_jsonl(self.root/'train.jsonl');self.assertEqual(len(exported),35);self.assertTrue(all(r['split']!='test' for r in exported));self.assertTrue(all(r['review_reference'] for r in exported))
 def test_near_duplicate_family_leakage_blocks_evaluation(self):
  rows=read_jsonl(self.root/'unified.jsonl');other=copy.deepcopy(rows[0]);other['sample_id']='other';other['scenario_group']='different';other['split']='test';rows.append(other);write_jsonl(self.root/'unified.jsonl',rows)
  with self.assertRaises(ValueError):prepare_evaluation(self.root,self.root/'eval')

class TrainingChecks(unittest.TestCase):
 def test_padded_embedding_rows_allowed_but_overflow_blocked(self):
  tok=SimpleNamespace(get_vocab=lambda:{'a':0,'b':3});embed=SimpleNamespace(weight=SimpleNamespace(shape=(8,2)))
  model=SimpleNamespace(get_input_embeddings=lambda:embed,get_output_embeddings=lambda:embed)
  assert_tokenizer_matches_model(tok,model)
  bad=SimpleNamespace(get_vocab=lambda:{'a':8})
  with self.assertRaises(ValueError):assert_tokenizer_matches_model(bad,model)
  self.assertEqual(verify_metadata({'vocab_size':8},{'model':{'vocab':{'a':0}},'added_tokens':[{'id':3}]})['status'],'PASSED')
 def test_laptop_profile_is_shared_nf4_and_smoke_only(self):
  args=SimpleNamespace(profile='laptop-6gb',allow_bootstrap_data=True,smoke_test=True,max_steps=1,stage='schema',allow_cpu=False,output=ROOT/'artifacts/smoke-test/test-profile')
  torch=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda:True,is_bf16_supported=lambda:True))
  common,schema=training_settings(args,torch)
  args.stage='empathy';other,dpo=training_settings(args,torch)
  self.assertEqual(common,other);self.assertTrue(common['quantization']['load_in_4bit']);self.assertEqual(common['quantization']['bnb_4bit_quant_type'],'nf4');self.assertEqual(common['lora_r'],8);self.assertEqual(common['lora_target_modules'],['q_proj','v_proj']);self.assertEqual(common['max_seq_length'],1280);self.assertEqual(schema['loss_type'],'dr_grpo');self.assertEqual(schema['num_generations'],2);self.assertEqual(dpo['algorithm'],'dpo')
  args.max_steps=10
  with self.assertRaises(ValueError):training_settings(args,torch)
  args.max_steps=1;args.smoke_test=False
  with self.assertRaises(ValueError):training_settings(args,torch)
  args.smoke_test=True;args.allow_cpu=True
  with self.assertRaises(ValueError):training_settings(args,torch)
 def test_bootstrap_cannot_enable_full_training(self):
  args=SimpleNamespace(allow_bootstrap_data=True,smoke_test=False,max_steps=100)
  with self.assertRaises(ValueError):validate_smoke_options(args)
 def test_smoke_fixture_and_destination_limits(self):
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);(root/'manifest.json').write_text(json.dumps({'smoke_test_only':True}));write_jsonl(root/'unified.jsonl',[{'origin':'synthetic'}])
   args=SimpleNamespace(data=root,output=ROOT/'artifacts/smoke-test/fixture',allow_bootstrap_data=True,smoke_test=True,max_steps=1)
   validate_smoke_options(args)
   args.output=root/'final'
   with self.assertRaises(ValueError):validate_smoke_options(args)
   args.output=ROOT/'artifacts/smoke-test/fixture';write_jsonl(root/'unified.jsonl',[{'origin':'public_source'}])
   with self.assertRaises(ValueError):validate_smoke_options(args)
 def test_reward_registration_uses_reference_and_full_field_verifier(self):
  registry=SimpleNamespace(register_custom_reward=lambda name,cls,config:setattr(registry,'reward',cls()))
  modules={'aligntune.rewards.core':SimpleNamespace(RewardConfig=lambda **kw:kw,RewardFunction=object,RewardType=SimpleNamespace(FINANCIAL_ACCURACY='fixture')),'aligntune.rewards.registry':SimpleNamespace(RewardRegistry=registry)}
  with patch.dict('sys.modules',modules):register_reward()
  target=read_jsonl(ROOT/'data/seeds/synthetic_cases.jsonl')[0]['target']
  self.assertEqual(registry.reward.compute(json.dumps(target),reference=target),1)
  with self.assertRaises(ValueError):registry.reward.compute('{}')
 def test_both_training_configs_checkpoint_and_manifest_contract_with_mock_trainer(self):
  # This is an explicit CPU fixture test, not a trained checkpoint or model result.
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp);calls=[]
   def factory(**kwargs):
    calls.append(kwargs)
    def save():
     out=Path(kwargs['output_dir']);out.mkdir(parents=True,exist_ok=True);(out/'adapter_config.json').write_text('{}');(out/'adapter_model.safetensors').write_bytes(b'fixture-not-real-weights')
    return SimpleNamespace(train=save)
   args=SimpleNamespace(data=root,output=root/'outputs',stage='schema',allow_cpu=True,allow_bootstrap_data=False,smoke_test=False,max_steps=1,base='fixture')
   torch=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda:False))
   class Tok:
    eos_token='<|im_end|>';chat_template='fixture-template'
    @staticmethod
    def from_pretrained(source,**kwargs):return Tok()
    def apply_chat_template(self,messages,tokenize,add_generation_prompt):
     assert not tokenize and add_generation_prompt;return '<|im_start|>user\n'+messages[0]['content']+'<|im_end|>\n<|im_start|>assistant\n'
   modules={'aligntune.core.backend_factory':SimpleNamespace(create_rl_trainer=factory,create_sft_trainer=factory),'transformers':SimpleNamespace(AutoTokenizer=Tok)}
   write_jsonl(root/'train/rlvr.jsonl',[{'prompt':'P','answer':'{}','ground_truth_json':'{}'}])
   write_jsonl(root/'train/dpo.jsonl',[{'prompt':'P','chosen':'good','rejected':'bad'}])
   outcome={'parameters_updated':True,'trainer_metrics':None,'evidence':'fixture'}
   with patch.dict('sys.modules',modules),patch('phase2_aligntune_train_and_merge.check_data'),patch('phase2_aligntune_train_and_merge.require_gpu',return_value=torch),patch('phase2_aligntune_train_and_merge.identity',return_value={'fixture':True}),patch('phase2_aligntune_train_and_merge.materialize_base',return_value='fixture'),patch('phase2_aligntune_train_and_merge.pin_materialized_weights',side_effect=lambda ident,path:{**ident,'base_weights':{'w':'h'}}),patch('phase2_aligntune_train_and_merge.training_outcome',return_value=outcome),patch('phase2_aligntune_train_and_merge.register_reward'):
    (root/'manifest.json').write_text('{}')
    for stage in ('schema','empathy'):args.stage=stage;train(args)
   # Training must see the chat-formatted user turn used at inference.
   rl=read_jsonl(calls[0]['dataset_name']);dpo=read_jsonl(calls[1]['dataset_name'])
   self.assertEqual(rl[0]['prompt'],[{'role':'user','content':'P'}]);self.assertEqual(rl[0]['answer'],'{}')
   # DPO: AlignTune flattens message lists, so the prompt is template-rendered; TRL appends EOS to responses.
   self.assertEqual(dpo[0]['prompt'],'<|im_start|>user\nP<|im_end|>\n<|im_start|>assistant\n');self.assertEqual((dpo[0]['chosen'],dpo[0]['rejected']),('good','bad'))
   self.assertEqual(json.loads((root/'outputs/empathy/suraksha_manifest.json').read_text())['training_data']['eos_token'],'<|im_end|>')
   manifest=json.loads((root/'outputs/schema/suraksha_manifest.json').read_text())
   self.assertEqual(manifest['identity']['base_weights'],{'w':'h'});self.assertEqual(manifest['training_data']['format'],'chat_messages');self.assertTrue(manifest['training_outcome']['parameters_updated'])
   self.assertEqual([c['algorithm'] for c in calls],['drgrpo','dpo']);self.assertEqual(calls[0]['lora_target_modules'],calls[1]['lora_target_modules']);self.assertEqual(calls[0]['lora_r'],calls[1]['lora_r']);self.assertEqual(calls[1]['field_mappings'],{'prompt':'prompt','chosen':'chosen','rejected':'rejected'})
   self.assertTrue((root/'outputs/schema/suraksha_manifest.json').exists())
   from research.artifacts import resolve_adapter
   resolve_adapter(root/'outputs/empathy')
   (root/'outputs/empathy/adapter_model.safetensors').write_bytes(b'changed')
   with self.assertRaises(ValueError):resolve_adapter(root/'outputs/empathy')
 @unittest.skipUnless(__import__('importlib.util').util.find_spec('torch') and __import__('importlib.util').util.find_spec('safetensors'),'requires torch+safetensors (.venv-training)')
 def test_zero_update_is_measured_and_fails_after_preserving_manifest(self):
  import torch
  from safetensors.torch import save_file
  from phase2_aligntune_train_and_merge import training_outcome
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp);ckpt=out/'checkpoint-1';ckpt.mkdir()
   (ckpt/'trainer_state.json').write_text(json.dumps({'log_history':[{'step':1,'loss':0.0,'grad_norm':0.0,'reward':-1.0,'reward_std':0.0}]}))
   (out/'adapter_config.json').write_text(json.dumps({'init_lora_weights':True}))
   save_file({'x.lora_A.weight':torch.ones(2,2),'x.lora_B.weight':torch.zeros(2,2)},str(out/'adapter_model.safetensors'))
   result=training_outcome(out,out)
   self.assertIs(result['parameters_updated'],False);self.assertEqual(result['trainer_metrics']['grad_norm'],0.0)
   save_file({'x.lora_A.weight':torch.ones(2,2),'x.lora_B.weight':torch.full((2,2),5e-6)},str(out/'adapter_model.safetensors'))
   self.assertIs(training_outcome(out,out)['parameters_updated'],True)
   (out/'adapter_config.json').write_text(json.dumps({'init_lora_weights':'gaussian'}))
   self.assertIsNone(training_outcome(out,out)['parameters_updated'])
 def test_materialized_hub_weights_are_hashed_and_mismatch_rejected(self):
  from phase2_aligntune_train_and_merge import pin_materialized_weights
  from research.artifacts import file_digest
  with tempfile.TemporaryDirectory() as tmp:
   snap=Path(tmp);(snap/'model-00001-of-00001.safetensors').write_bytes(b'fixture-weights')
   pinned=pin_materialized_weights({'base_revision':'a'*40,'base_weights':{}},snap)
   self.assertEqual(pinned['base_weights'],{'model-00001-of-00001.safetensors':file_digest(snap/'model-00001-of-00001.safetensors')})
   with self.assertRaises(ValueError):pin_materialized_weights({'base_weights':{'model-00001-of-00001.safetensors':'0'*64}},snap)
   with self.assertRaises(ValueError):pin_materialized_weights({'base_weights':{}},snap/'missing')
 def test_chat_formatting_rejects_non_string_fields(self):
  from phase2_aligntune_train_and_merge import chat_formatted_dataset
  with tempfile.TemporaryDirectory() as tmp:
   src=Path(tmp)/'dpo.jsonl';write_jsonl(src,[{'prompt':'P','chosen':'','rejected':'r'}])
   with self.assertRaises(ValueError):chat_formatted_dataset(src,Path(tmp)/'out.jsonl','dpo')
   write_jsonl(src,[{'prompt':'P','chosen':'c','rejected':'r'}])
   with self.assertRaises(ValueError):chat_formatted_dataset(src,Path(tmp)/'out.jsonl','dpo') # tokenizer required
 def test_unreviewed_pilot_is_gated_labelled_and_sft_stays_raw(self):
  from phase2_aligntune_train_and_merge import chat_formatted_dataset,PILOT_ROOT
  with tempfile.TemporaryDirectory() as tmp:
   data=Path(tmp);(data/'manifest.json').write_text(json.dumps({'bootstrap_only':True}))
   ok=SimpleNamespace(stage='curated-sft',unreviewed_pilot=True,allow_bootstrap_data=True,smoke_test=False,data=data,output=PILOT_ROOT/'run-x',max_steps=50,allow_cpu=False,profile='laptop-6gb')
   validate_smoke_options(ok)
   for change in ({'stage':'schema'},{'allow_bootstrap_data':False},{'smoke_test':True},{'output':ROOT/'checkpoints'}):
    with self.assertRaises(ValueError):validate_smoke_options(SimpleNamespace(**{**vars(ok),**change}))
   (data/'manifest.json').write_text(json.dumps({'smoke_test_only':True}))
   with self.assertRaises(ValueError):validate_smoke_options(ok)
   fake=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda:True,is_bf16_supported=lambda:True))
   common,_=training_settings(ok,fake)
   self.assertEqual((common['lora_r'],common['lora_alpha'],common['learning_rate'],common['max_seq_length']),(16,32,1e-4,1280))
   with self.assertRaises(ValueError):training_settings(SimpleNamespace(**{**vars(ok),'unreviewed_pilot':False}),fake)
   src=data/'sft.jsonl';write_jsonl(src,[{'instruction':'Do X','input':'','output':'{}','provenance':{'a':1}}])
   tok=SimpleNamespace(eos_token='<|im_end|>',chat_template='t')
   info=chat_formatted_dataset(src,data/'out.jsonl','sft',tok)
   self.assertEqual(read_jsonl(data/'out.jsonl'),[{'prompt':'Do X','completion':'{}','provenance':{'a':1}}])
   self.assertEqual(info['format'],'messages_rendered_by_trl_assistant_only_loss')
   src2=data/'rlvr.jsonl';write_jsonl(src2,[{'prompt':'P','answer':'{"a":1}','ground_truth_json':{'a':1},'provenance':{}}])
   chat_formatted_dataset(src2,data/'out2.jsonl','schema_sft',tok)
   self.assertEqual(read_jsonl(data/'out2.jsonl'),[{'prompt':'P','completion':'{"a":1}','provenance':{}}])
 def test_pilot_grpo_requires_a_verified_pilot_merge(self):
  from phase2_aligntune_train_and_merge import PILOT_ROOT,weight_digests
  with tempfile.TemporaryDirectory(dir=PILOT_ROOT.parent) as tmp:
   data=Path(tmp)/'data';data.mkdir();(data/'manifest.json').write_text(json.dumps({'bootstrap_only':True}))
   base=PILOT_ROOT/('test-merge-'+Path(tmp).name);base.mkdir(parents=True)
   self.addCleanup(lambda:__import__('shutil').rmtree(base,ignore_errors=True))
   (base/'model.safetensors').write_bytes(b'fixture')
   args=SimpleNamespace(stage='schema',unreviewed_pilot=True,allow_bootstrap_data=True,smoke_test=False,data=data,output=PILOT_ROOT/'grpo-x',shared_base=None)
   with self.assertRaises(ValueError):validate_smoke_options(args) # no base
   args.shared_base=base
   with self.assertRaises(ValueError):validate_smoke_options(args) # no merge record
   (base/'suraksha_pilot_merge.json').write_text(json.dumps({'unreviewed_pilot':True,'merged_weights':weight_digests(base)}))
   validate_smoke_options(args)
   (base/'model.safetensors').write_bytes(b'changed')
   with self.assertRaises(ValueError):validate_smoke_options(args) # weights changed after merge
   fake=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda:True,is_bf16_supported=lambda:True))
   common,specific=training_settings(SimpleNamespace(**{**vars(args),'max_steps':150,'allow_cpu':False,'profile':'laptop-6gb','pilot_task':'schema'}),fake)
   self.assertEqual((common['learning_rate'],specific['num_generations'],specific['generation_batch_size'],common['gradient_accumulation_steps']),(2e-5,4,4,4))
 def test_pilot_dpo_shares_the_schema_pilot_base_and_lora_shape(self):
  from phase2_aligntune_train_and_merge import PILOT_ROOT
  with tempfile.TemporaryDirectory() as tmp:
   data=Path(tmp);(data/'manifest.json').write_text(json.dumps({'bootstrap_only':True}))
   args=SimpleNamespace(stage='empathy',unreviewed_pilot=True,allow_bootstrap_data=True,smoke_test=False,data=data,output=PILOT_ROOT/'dpo-x',shared_base=None,max_steps=190,allow_cpu=False,profile='laptop-6gb',pilot_task='schema')
   validate_smoke_options(args)
   with self.assertRaises(ValueError):validate_smoke_options(SimpleNamespace(**{**vars(args),'shared_base':PILOT_ROOT/'merged'}))
   with self.assertRaises(ValueError):validate_smoke_options(SimpleNamespace(**{**vars(args),'output':Path(tmp)/'out'}))
   fake=SimpleNamespace(cuda=SimpleNamespace(is_available=lambda:True,is_bf16_supported=lambda:True))
   common,specific=training_settings(args,fake)
   sft,_=training_settings(SimpleNamespace(**{**vars(args),'stage':'curated-sft'}),fake)
   self.assertEqual((common['lora_r'],common['lora_alpha'],common['lora_target_modules']),(sft['lora_r'],sft['lora_alpha'],sft['lora_target_modules']))
   self.assertEqual((specific['algorithm'],specific['precompute_ref_log_probs'],common['max_seq_length']),('dpo',True,1664))
if __name__=='__main__':unittest.main()
