// Explicit, bounded opt-in. Synthetic text only; never prints environment credentials.
import {makeApp} from '../server/app.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
if(process.env.PAWMEMO_PARTIAL_LIVE!=='1')throw Error('Live model evaluation requires explicit opt-in and user authorization.');
const reportPath='.pawmemo/test-results/partial-extraction-live.json';
const prior=process.env.PAWMEMO_PARTIAL_RECHECK==='1'?JSON.parse(await readFile(reportPath,'utf8')):null;
const previousObserved=prior?.observed??[],previousCalls=prior?.calls??0,maxCalls=prior?6:3;
const e=process.env,file=resolve(e.PAWMEMO_USAGE_FILE??'.pawmemo/usage.json'),before=JSON.parse(await readFile(file,'utf8')),observed=[];
const config={enabled:e.EXTERNAL_AI_ENABLED==='true',provider:e.AI_PROVIDER,base:e.AI_BASE_URL,key:e.AI_API_KEY,model:e.CHAT_MODEL,root:resolve('.pawmemo/build'),budgetFile:file,stopCny:Math.min(Number(e.DEMO_BUDGET_STOP_CNY??40),before.spentCny+.1-previousObserved.reduce((s,r)=>s+r.reservedUpperBoundCny,0)),totalCny:Number(e.DEMO_BUDGET_CNY??50),inputRate:Number(e.AI_INPUT_CNY_PER_MILLION),outputRate:Number(e.AI_OUTPUT_CNY_PER_MILLION),inputLimit:40000,outputLimit:1800};
let calls=0;
const app=makeApp({config,fetcher:async(url,opts)=>{assert(++calls+previousCalls<=maxCalls,'Authorized call count exceeded');const payload=JSON.parse(opts.body),estimate=((Buffer.byteLength(JSON.stringify(payload),'utf8')+1024)*config.inputRate+1800*config.outputRate)/1e6;
 assert([...previousObserved,...observed].reduce((s,r)=>s+r.reservedUpperBoundCny,0)+estimate<=.1+1e-9,'Authorized total cap exceeded');
 const record={reservedUpperBoundCny:estimate};observed.push(record);const response=await fetch(url,opts);const result=await response.clone().json().catch(()=>({}));record.providerOutput=result.choices?.[0]?.message?.content;record.finishReason=result.choices?.[0]?.finish_reason;record.status=response.status;record.inputTokens=result.usage?.prompt_tokens??null;record.outputTokens=result.usage?.completion_tokens??null;return response;}});
await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;
const samples=[
 {name:'two-known-events-and-unclear-event',text:'咪咪今天在窗台晒太阳。它吃了兔肉粮，很喜欢。后来它和奶酪那样了，我没看清。',check:r=>{assert.equal(r.facts.length,2);assert(r.facts.some(f=>f.content.includes('晒太阳')));assert(r.facts.some(f=>f.content.includes('兔肉粮')&&f.content.includes('喜欢')));assert(r.clarification.trim());assert(r.facts.every(f=>!f.quote.includes('那样')))}},
 {name:'unclear-only-does-not-create-facts',text:'后来它又那样了，我没看清。',check:r=>{assert.equal(r.facts.length,0);assert.equal(r.intent,'clarify');assert(r.clarification.trim())}},
 {name:'known-event-clear-question-and-unclear-event',text:'咪咪今天在窗台晒太阳。后来它又那样了，我没看清。根据已经记录的情况，它平时喜欢什么食物？',check:r=>{assert.equal(r.facts.length,1);assert(r.facts[0].content.includes('晒太阳'));assert.equal(r.intent,'mixed');assert(r.question.includes('食物'));assert(r.clarification.trim())}}
];
const results=[];
try{for(const [i,sample]of samples.entries()){
 if(e.PAWMEMO_PARTIAL_CASES&&!e.PAWMEMO_PARTIAL_CASES.split(',').includes(String(i)))continue;
 let result;try{
 const body={petId:'pet_synthetic',messageId:'message_partial_'+i,requestId:'request_partial_'+crypto.randomUUID(),pet:{name:'咪咪',kind:'猫'},text:sample.text,history:[],memories:[]};
 const response=await fetch(base+'/api/extract',{method:'POST',headers:{Origin:base,'X-Pawmemo-Request':'1','Content-Type':'application/json'},body:JSON.stringify(body)}),v=await response.json();assert.equal(response.status,200,JSON.stringify(v));result=v.result;
 sample.check(result);assert(result.facts.every(f=>f.tags.length>0&&sample.text.includes(f.quote)));assert(!/petId|内部编号/.test(result.clarification));results.push({name:sample.name,input:sample.text,result,status:'passed'});console.log('PASS',sample.name);
 }catch(error){results.push({name:sample.name,input:sample.text,result,status:'failed',error:error.message});console.log('FAIL',sample.name,error.message)}
 }}finally{await new Promise(r=>app.close(r));await writeFile(reportPath,JSON.stringify({syntheticOnly:true,model:config.model,maxCalls,capCny:.1,calls:calls+previousCalls,observed:[...previousObserved,...observed],results:[...(prior?.results??[]),...results]},null,2))}
console.log(JSON.stringify({calls,reservedUpperBoundCny:observed.reduce((s,r)=>s+r.reservedUpperBoundCny,0)}));if(results.some(r=>r.status==='failed'))process.exitCode=1;
