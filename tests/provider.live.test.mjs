// Explicit opt-in only. Reads private environment in-process; never emits credentials.
import {it,expect,vi} from 'vitest';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {makeApp} from '../server/app.mjs';
import {answer,prepareRequest} from '../src/v3Api';
import {empty} from '../src/v3Model';
it.skipIf(process.env.PAWMEMO_LIVE_TEST!=='1')('real Bailian revision samples through persistent budget',async()=>{
 const e=process.env,nativeFetch=fetch,config={enabled:true,provider:'bailian',base:e.AI_BASE_URL,key:e.AI_API_KEY,model:e.CHAT_MODEL,root:resolve('.pawmemo/build'),budgetFile:resolve(e.PAWMEMO_USAGE_FILE),stopCny:40,totalCny:50,inputRate:Number(e.AI_INPUT_CNY_PER_MILLION),outputRate:Number(e.AI_OUTPUT_CNY_PER_MILLION),inputLimit:40000,outputLimit:1800},observed=[];
 const app=makeApp({config,fetcher:async(url,opts)=>{const r=await nativeFetch(url,opts);const v=await r.clone().json().catch(()=>({}));observed.push({status:r.status,inputTokens:v.usage?.prompt_tokens,outputTokens:v.usage?.completion_tokens});return r}});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port;
 vi.stubGlobal('fetch',(url,opts)=>nativeFetch(base+url,{...opts,headers:{...opts.headers,Origin:base}}));
 const now='2026-10-25T00:00:00Z',d=empty();d.pets=[{id:'pet_synthetic',name:'团子',kind:'猫',breed:'',birthday:'',avatar:null,archived:false,createdAt:now,updatedAt:now}];d.activePetId='pet_synthetic';
 const memory=(i,content)=>({id:'memory_'+i,petId:'pet_synthetic',messageId:'message_'+i,raw:(content+'这是一段虚构的日常说明。').repeat(40),quote:content,source:'text',createdAt:now,eventAt:null,versions:[{version:1,content,tags:['日常'],createdAt:now,withdrawn:false}]});
 d.memories=[memory(0,'电铃一响，团子就钻进床下面。'),...Array.from({length:24},(_,i)=>memory(i+1,`团子第${i+1}天在窗台休息。`))];
 const results=[];
 try{for(const [name,text]of [['synonym','有人按门铃时如何安置它？'],['long_raw','它听见电铃时躲到哪里？'],['summary','总结全部日常记录。']]){if(e.PAWMEMO_LIVE_CASE==='summary'&&name!=='summary')continue;const m={id:'message_'+name,petId:'pet_synthetic',requestId:'request_fix01_'+name,conversationId:'conversation_synthetic',text,source:'text',createdAt:now,extraction:'done',answerState:'pending',result:{intent:'question',facts:[],question:text,clarification:''},memoryIds:[],answer:null,error:''};const p=prepareRequest(d,m,'answer'),a=await answer(d,m);expect(a.text).toContain('25 条有效记忆中的 24 条');if(name!=='summary'){expect(a.citations.some(c=>c.memoryId==='memory_0')).toBe(true);expect(a.insufficient).toBe(false)}expect(a.citations.every(c=>c.raw===d.memories.find(m=>m.id===c.memoryId).raw)).toBe(true);results.push({name,payloadBytes:Buffer.byteLength(JSON.stringify(p.body)),selected:p.citations.length,total:p.total,text:a.text,citations:a.citations.map(c=>({memoryId:c.memoryId,version:c.version,fullRawPreserved:c.raw.length>240})),insufficient:a.insufficient})}
 const ledger=JSON.parse(await readFile(config.budgetFile,'utf8'));await writeFile(e.PAWMEMO_LIVE_CASE==='summary'?'.pawmemo/test-results/provider-summary.json':'.pawmemo/test-results/provider-live.json',JSON.stringify({syntheticOnly:true,provider:'bailian-beijing',model:config.model,throughPersistentBudget:true,observed,results,cumulativeListPriceEquivalentCny:ledger.spentCny,cumulativeEvents:ledger.events.length},null,2));
 }finally{vi.unstubAllGlobals();app.closeAllConnections();await new Promise(r=>app.close(r))}
},120000);
