import assert from "node:assert/strict";

// Exercise the built Worker with synthetic fixtures. This is HTTP integration,
// not a browser, trained-model or bank-integration test.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:8791");
if (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
  throw new Error("HTTP smoke checks are restricted to a local Worker.");
}
const key = process.env.TRIAGE_SMOKE_API_KEY;
const checks = [];
let requests = 0;
const valid = {message: "Scammer debited Rs 24500 by collect request. RRN 431289014421. Call 9876543210.", reporting_delay_working_days: 1, responsibility: "unknown", language: "hinglish"};
async function request(path, {body, headers, ...init} = {}) {
  requests++;
  return fetch(new URL(path, base), { ...init, body, headers: { ...(body !== undefined ? {"content-type":"application/json"} : {}), ...(key ? {"x-api-key":key} : {}), ...headers }, signal: AbortSignal.timeout(10_000), redirect: "manual" });
}
async function check(name, action) {
  await action();
  checks.push(name);
}
async function error(response, status, code) {
  assert.equal(response.status,status);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const body=await response.json();
  assert.equal(body.error.code, code);
  assert.equal(body.error.request_id, response.headers.get("x-request-id"));
  assert.ok(body.error.request_id);
}
await check("landing and all linked console views serve HTML", async () => {
  for (const view of ["home", "desk", "pipeline", "benchmarks", "policy"]) {
    const response=await request(`/?view=${view}&lang=hi`);
    assert.equal(response.status,200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await response.text(), /Suraksha/i);
  }
});
await check("health declares the actual runtime capabilities", async () => {
  const response=await request("/api/health");
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const health=await response.json();
  assert.equal(health.trained_model_connected,false);
  assert.equal(health.bank_integration_connected,false);
  assert.equal(health.persists_customer_messages,false);
});
await check("triage method contract survives the Worker boundary", async () => {
  const response=await request("/api/triage");
  await error(response,405,"method_not_allowed");
  assert.equal(response.headers.get("allow"),"POST");
});
if(key) await check("the configured key is required", async () => {
  for(const value of ["", "incorrect-fixture-key"]) await error(await request("/api/triage",{method:"POST", body:JSON.stringify(valid),headers:{"x-api-key":value}}),401,"unauthorized");
});
await check("a real triage response is grounded and masks PII", async () => {
  const response=await request("/api/triage",{method:"POST",body:JSON.stringify(valid)});
  assert.equal(response.status,200);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  const result=await response.json();
  assert.equal(result.payload.utr_number,"431289014421");
  assert.equal(result.payload.amount_inr,24500);
  assert.equal(result.payload.rbi_liability_tier,"PENDING_VERIFICATION");
  assert.equal(result.audit.external_actions_taken,false);
  assert.equal(result.audit.no_unauthorized_promises,true);
  assert.equal(result.audit.utr_grounded,true);
  assert.ok(!result.privacy.sanitized.includes("9876543210"));
  assert.ok(result.reply.text.includes("1930"));
});
for(const [name, body, status, code] of [
  ["duplicate JSON keys",'{"message":"first","message":"second"}',400,"invalid_json"],
  ["impossible calendar dates",JSON.stringify({...valid, transaction_date:"2026-02-30"}),400,"invalid_input"],
  ["unexpected fields",JSON.stringify({...valid, private_secret:"smoke-value"}),400,"invalid_input"],
  ["oversized messages",JSON.stringify({message:"a".repeat(12001)}),413,"payload_too_large"],
]) await check(name+" fail safely", async()=>{await error(await request("/api/triage",{method:"POST",body}),status,code)});
await check("media type is checked exactly",async()=>{
  await error(await request("/api/triage",{method:"POST",body:JSON.stringify(valid),headers:{"content-type":"text/plain"}}),415,"unsupported_media_type");
});
await check("the full Indic character budget survives the HTTP boundary",async()=>{
  const response=await request("/api/triage",{method:"POST",body:JSON.stringify({message:"अ".repeat(12000),language:"hindi_devanagari"})});
  assert.equal(response.status,200);await response.arrayBuffer();
});
await check("request bursts are bounded by the Worker guard",async()=>{
  for(let i=0;i<32;i++) {
    const response=await request("/api/triage",{method:"POST",body:JSON.stringify(valid)});
    if(response.status===429){assert.ok(Number(response.headers.get("retry-after"))>0);await error(response,429,"rate_limited");return;}
    assert.equal(response.status,200);await response.arrayBuffer();
  }
  assert.fail("The request limit was not enforced");
});
console.log(JSON.stringify({mode:"LOCAL_HTTP_INTEGRATION",passed:checks.length,requests,checks,browser_verified:false,model_inference_executed:false},null,2));
