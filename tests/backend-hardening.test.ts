import test from "node:test";
import assert from "node:assert/strict";
import { createTriageHandler } from "../lib/triage-api.ts";
import { guardTriageApi } from "../lib/api-guard.ts";
import { createRateLimiter, clientKey, secretsMatch } from "../lib/rate-limit.ts";
import { parseStrictJson } from "../lib/strict-json.ts";
import { triageResponseSchema } from "../lib/triage-response.ts";
const endpoint="https://suraksha.test/api/triage";
const request=(body:BodyInit,headers:Record<string,string>={})=>new Request(endpoint,{method:"POST",headers:{"Content-Type":"application/json",...headers},body,duplex:"half"} as RequestInit);
const POST=createTriageHandler();
test("strict JSON rejects duplicate decoded keys, overflow and excessive nesting",()=>{
 for(const value of ['{"message":"a","message":"b"}','{"message":"a","messa\\u0067e":"b"}','{"x":1e999}', '['.repeat(60)+'0'+']'.repeat(60)])assert.throws(()=>parseStrictJson(value));
 assert.deepEqual(parseStrictJson(String.raw`{"message":"literal \" escaped", "x":[{"a":true}]}`),{message:'literal " escaped',x:[{a:true}]});
});
test("the API rejects ambiguous JSON, unexpected fields and invalid dates",async()=>{
 for(const body of ['{"message":"a","message":"b"}',JSON.stringify({message:"hello",transaction_date:"2026-02-30"}),JSON.stringify({message:"hello",responsibility:"bad-value"})]) assert.equal((await POST(request(body))).status,400);
 for(const media of ["application/json-evil","text/plain; application/json"] )assert.equal((await POST(request('{}',{"Content-Type":media}))).status,415);
});
test("unknown field names and values are not echoed by validation errors",async()=>{
 const response=await POST(request(JSON.stringify({message:"hello","9876543210":"secret"})));
 const text=await response.text(); assert.ok(!text.includes("9876543210")); assert.ok(!text.includes("secret"));
 assert.equal(response.headers.get("x-request-id"),JSON.parse(text).error.request_id);
});
test("valid long Indic messages fit the same character budget as English",async()=>{
 const response=await POST(request(JSON.stringify({message:"ह".repeat(12000)})));
 assert.equal(response.status,200); assert.ok(triageResponseSchema.safeParse(await response.json()).success);
});
test("malformed UTF-8 is rejected rather than silently changing the source",async()=>{
 const bytes=new Uint8Array([123,34,109,101,115,115,97,103,101,34,58,34,0xff,34,125]);
 assert.equal((await POST(request(bytes))).status,400);
});
test("stalled request bodies hit a real deadline",async()=>{
 const stream=new ReadableStream({pull:()=>new Promise(()=>{})});
 const response=await createTriageHandler({timeoutMs:15})(request(stream));
 assert.equal(response.status,408); assert.equal(((await response.json()) as {error:{code:string}}).error.code,"request_timeout");
});
test("engine exceptions do not leak customer data to responses or logs",async()=>{
 const events:Record<string,string>[]=[];
 const handler=createTriageHandler({engine:()=>{throw new Error("9876543210 confidential customer");},log:event=>events.push(event)});
 const response=await handler(request('{"message":"hello"}'));
 assert.equal(response.status,500); assert.ok(!JSON.stringify(events).includes("9876543210")); assert.ok(!(await response.text()).includes("confidential"));
});
test("the API method contract is explicit",async()=>{const r=await POST(new Request(endpoint));assert.equal(r.status,405);assert.equal(r.headers.get("allow"),"POST");});
test("rate limiting expires correctly and never evicts active clients to admit a flood",()=>{
 let now=0; const limit=createRateLimiter({limit:2,windowMs:1000,maxBuckets:2,now:()=>now});
 assert.equal(limit("a").ok,true); assert.equal(limit("a").remaining,0); assert.equal(limit("a").ok,false);
 assert.equal(limit("b").ok,true); assert.equal(limit("c").ok,false); assert.equal(limit("a").ok,false);
 now=1000;assert.equal(limit("c").ok,true);assert.equal(limit("a").ok,true);
});
test("untrusted forwarded headers cannot rotate rate-limit identities",()=>{
 assert.equal(clientKey(new Request(endpoint,{headers:{"x-forwarded-for":"1.2.3.4"}})),"anonymous");
 assert.equal(clientKey(new Request(endpoint,{headers:{"cf-connecting-ip":"2001:db8::1"}})),"2001:db8::1");
});
test("protected service keys and throttling use consistent errors",async()=>{
 assert.equal(secretsMatch("example-key","example-key"),true); for(const key of [null,"","wrong","example-key-extra"])assert.equal(secretsMatch(key,"example-key"),false);
 const denied=guardTriageApi(request('{}'),{apiKey:"example-key"})!; assert.equal(denied.status,401);assert.equal(denied.headers.get("x-request-id"),((await denied.json()) as {error:{request_id:string}}).error.request_id);
 assert.equal(guardTriageApi(request('{}',{"x-api-key":"example-key"}),{apiKey:"example-key",limit:()=>({ok:true,remaining:1,retryAfterSeconds:0})}),null);
 const throttled=guardTriageApi(request('{}'),{limit:()=>({ok:false,remaining:0,retryAfterSeconds:42})})!;assert.equal(throttled.status,429);assert.equal(throttled.headers.get("retry-after"),"42");
});
