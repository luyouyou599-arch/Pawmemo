import {it,expect} from 'vitest';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {makeApp} from '../server/app.mjs';
import {prepareRequest} from '../src/v3Api';
import {empty} from '../src/v3Model';
it('audited long originals fit both real local HTTP routes with unchanged server/ledger limits',async()=>{
 const d=empty(),now=new Date().toISOString();d.pets=[{id:'pet_a',name:'团子',kind:'猫',breed:'',birthday:'',avatar:null,archived:false,createdAt:now,updatedAt:now}];d.activePetId='pet_a';
 d.memories=Array.from({length:24},(_,i)=>({id:'memory_'+i,petId:'pet_a',messageId:'message_'+i,raw:'团子喜欢在窗台休息。'.repeat(65),quote:'团子喜欢在窗台休息。',source:'text',createdAt:now,eventAt:null,versions:[{version:1,content:`团子在第${i}个窗台休息。`,tags:['休息'],createdAt:now,withdrawn:false}]}));
 const m={id:'message_query',requestId:'request_query',petId:'pet_a',conversationId:'conversation_a',text:'它在哪里休息？',source:'text',createdAt:now,extraction:'pending',answerState:'pending',result:null,memoryIds:[],answer:null,error:''};
 const originals=JSON.stringify(d.memories);
 const dir=await mkdtemp(join(tmpdir(),'pawmemo-fix01-')),ledger=join(dir,'usage.json');let calls=0,maxBound=0;
 const app=makeApp({config:{enabled:true,provider:'bailian',base:'https://fixture.invalid/v1',key:'fixture',model:'fixture',root:resolve('dist'),budgetFile:ledger,stopCny:40,totalCny:50,inputRate:0.8,outputRate:2,inputLimit:40000,outputLimit:1800},fetcher:async(_url,opts)=>{calls++;const p=JSON.parse(opts.body);maxBound=Math.max(maxBound,Buffer.byteLength(opts.body)+1024);const input=JSON.parse(p.messages[1].content);return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(input.text?{intent:'question',facts:[],question:input.text,clarification:''}:{text:'它在窗台休息。',citations:[input.memories[0].memoryId],insufficient:false})}}],usage:{prompt_tokens:100,completion_tokens:50}})}});
 await new Promise(r=>app.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.address().port,results=[];
 try{for(const phase of ['extract','answer']){const {body}=prepareRequest(d,m,phase);const r=await fetch(base+'/api/'+phase,{method:'POST',headers:{Origin:base,'X-Pawmemo-Request':'1','Content-Type':'application/json'},body:JSON.stringify(body)});results.push({phase,status:r.status,payloadBytes:Buffer.byteLength(JSON.stringify(body)),body:await r.json()});expect(r.status).toBe(200)}expect(JSON.stringify(d.memories)).toBe(originals);expect(calls).toBe(2);expect(maxBound).toBeLessThanOrEqual(40000);const usage=JSON.parse(await readFile(ledger,'utf8'));expect(usage.events).toHaveLength(2);expect(Object.keys(usage.reservations)).toHaveLength(0);await writeFile('docs/audit-evidence/'+(process.env.PAWMEMO_EVIDENCE_PREFIX??'dev-current')+'-long-context.json',JSON.stringify({syntheticOnly:true,upstream:'contract fixture',results,maxBound,ledgerEvents:usage.events.length,sourceRawPreserved:JSON.stringify(d.memories)===originals},null,2));}
 finally{app.closeAllConnections();await new Promise(r=>app.close(r))}
});
