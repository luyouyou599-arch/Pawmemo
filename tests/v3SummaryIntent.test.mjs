import {it,expect,vi,afterEach,afterAll} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import {answer,prepareRequest} from '../src/v3Api';
import {empty} from '../src/v3Model';
const now='2026-10-25T00:00:00Z',observations=[];
function fixture(){const d=empty();d.pets=[{id:'pet_a',name:'团子',kind:'猫',breed:'',birthday:'',avatar:null,archived:false,createdAt:now,updatedAt:now}];d.activePetId='pet_a';d.memories=Array.from({length:25},(_,i)=>({id:'memory_'+i,petId:'pet_a',messageId:'message_'+i,raw:(i?`第${i}天在窗台休息。`:'电铃一响，团子就钻进床下面。')+'完整虚构原文。'.repeat(100),quote:i?`第${i}天在窗台休息。`:'电铃一响，团子就钻进床下面。',source:'text',createdAt:now,eventAt:null,versions:[{version:1,content:i?`第${i}天在窗台休息。`:'电铃一响，团子就钻进床下面。',tags:['日常'],createdAt:now,withdrawn:false}]}));return d}
function message(text){return {id:'message_query',petId:'pet_a',requestId:'request_query',conversationId:'conversation_a',text,source:'text',createdAt:now,extraction:'done',answerState:'pending',result:{intent:'question',facts:[],question:text,clarification:''},memoryIds:[],answer:null,error:''}}
afterEach(()=>vi.unstubAllGlobals());
const normal=[
 '所有门铃声都会让它躲起来吗？','全部门铃声都一样吗？','整体来看它更怕门铃还是吸尘器？',
 '所有门铃声和吸尘器声相比有什么区别？','不是所有门铃声都会让它躲起来，对吗？',
 '它的日常记录能说明它害怕所有声音吗？','不要总结全部记录，只回答门铃问题。','请不要总结所有记录。',
 '不用罗列全部记忆。','不需要概括日常记录。','总结里说它怕所有声音，这准确吗？','为什么总结缺了门铃记录？',
 '“总结全部记录”这句话是什么意思？','请解释总结和概括的区别。','总结和全部记录相比有什么不同？',
 '所有记录需要总结吗？','如何总结日常记录？','请判断所有门铃声是否都会使它躲藏。',
 '总结了全部记录吗？','汇总过所有记录。','概括出来的全部记录。',
 '请比较全部门铃记录与吸尘器记录。','门铃反应是否与总结中的判断一致？',
 '请总结哪些记录存在矛盾？','请给我哪些记录的总结？','请总结全部记录，再回答它是否害怕所有声音。',
 '有人按门铃时如何安置它？','它在哪里休息？',
];
const summaries=[
 '总结全部日常记录。','请总结全部日常记录？','帮我总结一下所有记录。','能帮我总结最近的记忆吗？',
 '请概括一下最近的观察。','麻烦你汇总本周记录。','请列出所有记忆。','罗列一下全部记录。',
 '能否梳理最近的日常记录？','可以帮我概括一下这些记忆吗？','请把所有记录总结一下。',
 '请给我一份全部记录的总结。','我想要一份最近记忆的摘要。','总结一下。','请总结。',
];
it.each(normal)('ordinary task stays Q&A: %s',async text=>{const d=fixture(),m=message(text),f=vi.fn(async(_url,opts)=>{const v=JSON.parse(opts.body);return Response.json({...v,text:'现有记录只能说明一次电铃反应，不能据此判断所有门铃声。',citations:[v.memories[0].memoryId],insufficient:false})});vi.stubGlobal('fetch',f);const p=prepareRequest(d,m,'answer'),a=await answer(d,m);expect(f).toHaveBeenCalledTimes(1);expect(a.text).not.toContain('内容摘录');expect(a.text).toContain('25 条有效记忆中的 24 条');expect(a.citations[0].raw).toBe(d.memories.find(x=>x.id===a.citations[0].memoryId).raw);expect(new TextEncoder().encode(JSON.stringify(JSON.stringify(p.body))).length).toBeLessThanOrEqual(28000);if(text==='所有门铃声都会让它躲起来吗？'){expect(p.citations[0].memoryId).toBe('memory_0');expect(p.citations[1].memoryId).toBe('memory_24')}observations.push({text,expected:'Q&A',answerCalls:f.mock.calls.length,first:p.citations[0].memoryId,scope:p.body.contextScope,fullRawPreserved:true})});
it.each(summaries)('explicit summary/list stays scoped: %s',async text=>{const d=fixture(),m=message(text),f=vi.fn();vi.stubGlobal('fetch',f);const a=await answer(d,m);expect(f).not.toHaveBeenCalled();expect(a.text).toContain('内容摘录');expect(a.text).toContain('25 条有效记忆中的 24 条');expect(a.citations[0].memoryId).toBe('memory_0');expect(a.citations.at(-1).memoryId).toBe('memory_24');expect(a.citations[0].raw).toBe(d.memories[0].raw);observations.push({text,expected:'scoped excerpts',answerCalls:0,selected:a.citations.length,first:a.citations[0].memoryId,last:a.citations.at(-1).memoryId,fullRawPreserved:true})});
it('a derived question cannot promote an ordinary original message to local summary',async()=>{const d=fixture(),m=message('所有门铃声都会让它躲起来吗？');m.result.question='请总结全部日常记录。';const f=vi.fn(async(_url,opts)=>{const v=JSON.parse(opts.body);return Response.json({...v,text:'回答夹具。',citations:[v.memories[0].memoryId],insufficient:false})});vi.stubGlobal('fetch',f);const a=await answer(d,m);expect(f).toHaveBeenCalledTimes(1);expect(a.text).not.toContain('内容摘录');observations.push({text:m.text,derivedQuestion:m.result.question,expected:'Q&A',answerCalls:1})});
it('a derived question cannot cancel an explicit original summary request',async()=>{const d=fixture(),m=message('请总结全部日常记录。');m.result.question='所有门铃声都会让它躲起来吗？';const f=vi.fn();vi.stubGlobal('fetch',f);const a=await answer(d,m);expect(f).not.toHaveBeenCalled();expect(a.text).toContain('内容摘录');observations.push({text:m.text,derivedQuestion:m.result.question,expected:'scoped excerpts',answerCalls:0})});
afterAll(()=>{mkdirSync('.pawmemo/test-results',{recursive:true});writeFileSync('.pawmemo/test-results/'+(process.env.PAWMEMO_EVIDENCE_PREFIX??'dev-current')+'-intent-results.json',JSON.stringify({scope:'Synthetic deterministic routing contracts; answer text is a fixture, not model semantic evidence. Zero external calls.',observations},null,2));});
