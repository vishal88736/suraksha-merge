import test from "node:test";
import assert from "node:assert/strict";
import { initialTriageState, inputsMatch, isStale, triageReducer } from "../lib/triage-reducer.ts";
import { triage, type TriageInput } from "../lib/engine.ts";
const initial = initialTriageState;
const start = (input: TriageInput, id="request-1") => triageReducer(initial(), { type:"run/start", requestId:id, input });
test("every decision-affecting input invalidates the previous result", () => {
  for (const patch of [{message:"different"},{reporting_delay_working_days:10},{elapsed_calendar_days:6},{responsibility:"third_party"},{account_tier:"bsbd"},{language:"english"},{transaction_date:"2027-01-01"}] as Partial<TriageInput>[]) {
    const state=triageReducer(initial(),{type:"input/edit",patch}); assert.equal(isStale(state),true,JSON.stringify(patch)); assert.equal(state.status,"dirty");
  }
});
test("default and explicit unknown context compare equally", () => {
  assert.equal(inputsMatch({message:"hello"},{message:"hello",language:"auto",responsibility:"unknown",account_tier:"unknown",elapsed_calendar_days:null}),true);
});
test("a scenario selected during a request clears loading and invalidates its response",()=>{
  const running=start(initial().input);
  const selected=triageReducer(running,{type:"scenario/select",index:1});
  assert.equal(selected.status,"idle"); assert.equal(selected.requestId,null);
  assert.deepEqual(triageReducer(selected,{type:"run/success",requestId:"request-1",result:running.result}),selected);
});
test("an older request cannot replace a newer assessment or error",()=>{
  const state=start(initial().input,"new");
  assert.equal(triageReducer(state,{type:"run/error",requestId:"old",message:"network"}),state);
  assert.equal(triageReducer(state,{type:"run/success",requestId:"old",result:state.result}),state);
});
test("an edit made while waiting remains stale after the response",()=>{
  const input=initial().input;
  let state=start(input);
  state=triageReducer(state,{type:"input/edit",patch:{reporting_delay_working_days:10}});
  state=triageReducer(state,{type:"run/success",requestId:"request-1",result:triage(input)});
  assert.equal(isStale(state),true); assert.equal(state.status,"dirty"); assert.equal(state.submittedInput.reporting_delay_working_days,input.reporting_delay_working_days);
});
test("successful results retain their complete input snapshot",()=>{
  const input={...initial().input,reporting_delay_working_days:4} satisfies TriageInput;
  const state=triageReducer({...start(input),input},{type:"run/success",requestId:"request-1",result:triage(input)});
  assert.equal(isStale(state),false); assert.equal(state.hasRun,true); assert.equal(state.requestId,null);
});
test("cancellation is recoverable and keeps the previous result",()=>{
  const state=start(initial().input);
  const cancelled=triageReducer(state,{type:"run/cancel",requestId:"request-1"});
  assert.equal(cancelled.status,"idle"); assert.equal(cancelled.result,state.result);
});
test("errors keep the last assessment and expose a retryable state",()=>{
  const state=triageReducer(start(initial().input),{type:"run/error",requestId:"request-1",message:"network"});
  assert.equal(state.status,"error"); assert.equal(state.error,"network"); assert.equal(state.requestId,null);
});
test("PII is hidden on expiry, a new request, and scenario changes",()=>{
  const revealed=triageReducer(initial(),{type:"privacy/toggle"});
  assert.equal(revealed.revealed,true); assert.ok(revealed.revealUntil>Date.now());
  for(const action of [{type:"privacy/hide"},{type:"run/start",requestId:"x",input:revealed.input},{type:"scenario/select",index:2}] as const){ const state=triageReducer(revealed,action); assert.equal(state.masked,true);assert.equal(state.revealed,false); }
});
test("invalid scenario selection cannot crash the desk",()=>{const state=initial();assert.equal(triageReducer(state,{type:"scenario/select",index:999}),state);});
