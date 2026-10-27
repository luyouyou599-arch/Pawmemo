import {type Data,type Message,type Citation,type Extraction,validExtraction,snapshot,factsFor} from './v3Model';
export class ApiError extends Error {constructor(public code:string,message:string){super(message)}}
async function post(path:string,body:unknown,signal?:AbortSignal){
 const timer=AbortSignal.timeout(65000),combined=signal?AbortSignal.any([signal,timer]):timer;
 let response:Response;try{response=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Pawmemo-Request':'1'},body:JSON.stringify(body),signal:combined})}catch(e){if(signal?.aborted)throw new ApiError('cancelled','请求已取消。');throw new ApiError('network',timer.aborted?'等待超时，请稍后重试。':'这次未能连接服务。输入仍保留，请重试。')}
 let result:any;try{result=await response.json()}catch{throw new ApiError('invalid','服务返回异常，请重试。')}
 if(!response.ok)throw new ApiError(result.code??'service',result.message??'服务暂不可用，请重试。');return result;
}
export function contextFor(data:Data,message:Message):Citation[]{
 const all=factsFor(data,message.petId),question=message.result?.question||message.text;
 const grams=bigrams(question),concepts=conceptGroups.filter(g=>g.some(w=>question.includes(w)));
 const ranked=all.map((m,i)=>{const text=latestText(m)+m.versions.at(-1)!.tags.join('');return {m,i,score:[...grams].filter(g=>text.includes(g)).length+concepts.filter(g=>g.some(w=>text.includes(w))).length*8}}).sort((a,b)=>b.score-a.score||b.i-a.i);
 // Broad summaries sample across the collection, instead of silently taking only recent rows.
 if(isSummary(message.text)&&all.length>24){return Array.from({length:24},(_,i)=>snapshot(all[Math.round(i*(all.length-1)/23)]))}
 return ranked.map(x=>snapshot(x.m));
}
// Small, explicit vocabulary expansion; this does not claim general semantic search.
const conceptGroups=[['门铃','电铃','门响','按铃'],['床底','床下','床下面'],['躲藏','躲起来','躲到','钻进','藏起来'],['吃饭','进食','食欲','吃东西','食量'],['喝水','饮水','饮水量'],['休息','睡觉','睡眠','打盹'],['便便','排便','大便'],['尿尿','排尿','小便'],['来客','客人','访客'],['吸尘器','扫地机']];
function bigrams(text:string){const chars=[...text.replace(/\s/g,'')];return new Set(chars.slice(0,-1).map((c,i)=>c+chars[i+1]))}
function isSummary(text:string){
 // Only a complete, explicit request may replace Q&A with scoped excerpts.
 // Ambiguous wording, quoted examples and questions about summaries stay in Q&A.
 if(/[\r\n]/.test(text.trim()))return false;
 const task=text.trim().replace(/\s+/g,'').replace(/[。！？!?]+$/g,'');
 if(/[，,。！？!?；;：“”「」"'\n]/.test(task)||/(?:不要|别|不用|不必|无需|不想|先不|暂不|不需要).*(?:总结|概括|汇总|罗列|列出|梳理|摘要)/.test(task))return false;
 if(/(?:是否|是不是|会不会|为什么|为何|怎么|如何|哪|多少|区别|相比|比较|相同|不同|一样|对不对|准确|正确|意味着)/.test(task))return false;
 const request=task.match(/^(?:(?:请|麻烦|劳驾)你?)?(?:能否|可否|能不能|可不可以|可以|能)?(?:帮我|为我|替我)?(?:总结|概括|汇总|罗列|列出|梳理)(?:一下|下|一遍)?(.*?)(?:吗|好吗|可以吗)?$/);
 const object=request?.[1];
 if(object!==undefined)return object===''||/^(?![里中的得和与是指了过着出]).{0,60}(?:记录|记忆|日常|观察)(?:情况)?$/.test(object);
 return /^(?:请)?(?:帮我)?把.{1,60}(?:记录|记忆|日常|观察)(?:总结|概括|汇总|梳理)(?:一下|下|一遍)?(?:吗|好吗)?$/.test(task)||/^(?:请)?(?:给我|我想要|我需要)(?:一份|一个)?.{1,60}(?:记录|记忆|日常|观察)的(?:总结|概括|汇总|摘要)$/.test(task);
}
function latestText(m:Data['memories'][number]){return m.versions.at(-1)!.content}
// The server embeds this JSON as a string inside the provider envelope; count escaping too.
const bytes=(v:unknown)=>new TextEncoder().encode(JSON.stringify(JSON.stringify(v))).length;
// Leave room under the server's unchanged 40k conservative bound for prompts/schema/overhead.
const REQUEST_BYTES=28000;
export function prepareRequest(data:Data,message:Message,phase:'extract'|'answer'){
 const pet=data.pets.find(p=>p.id===message.petId);if(!pet)throw new Error('找不到这只宠物。');
 const ranked=contextFor(data,message),total=factsFor(data,pet.id).length;
 const history=phase==='extract'?data.messages.filter(m=>m.petId===pet.id&&m.conversationId===message.conversationId&&m.id!==message.id).slice(-8).map(m=>({text:m.text,clarification:m.result?.clarification??''})):[];
 const citations:Citation[]=[],memories:ReturnType<typeof wireMemory>[]=[];
 const body={petId:pet.id,messageId:message.id,requestId:message.requestId,pet:{name:pet.name,kind:pet.kind},...(phase==='extract'?{text:message.text,history}:{question:message.result?.question||message.text}),memories,contextScope:{total,selected:0,partial:total>0}};
 // Prior conversation must not consume the space needed for actual memory evidence.
 while(bytes(history)>6000&&history.length)history.shift();
 while(bytes(body)>REQUEST_BYTES&&history.length)history.shift();
 if(bytes(body)>REQUEST_BYTES)throw new ApiError('context','这条消息较长，请分成几条发送；已有记忆会保留。');
 for(const c of ranked){if(citations.length===24)break;const wire=wireMemory(c);memories.push(wire);body.contextScope.selected=memories.length;body.contextScope.partial=memories.length<total;if(bytes(body)>REQUEST_BYTES){memories.pop();continue}citations.push(c)}
 body.contextScope.selected=memories.length;body.contextScope.partial=memories.length<total;
 return {body,citations,total};
}
function wireMemory(c:Citation){return {memoryId:c.memoryId,petId:c.petId,version:c.version,content:c.content,tags:c.tags,raw:[...c.quote].slice(0,240).join('')}}
export async function extract(data:Data,message:Message,signal?:AbortSignal):Promise<Extraction>{
 const {body}=prepareRequest(data,message,'extract');
 const result=await post('extract',body,signal);
 if(result.petId!==body.petId||result.messageId!==message.id||result.requestId!==message.requestId||!validExtraction(result.result,message.text))throw new ApiError('invalid','整理结果未通过原文核对，没有新增记忆。');return result.result;
}
export async function answer(data:Data,message:Message,signal?:AbortSignal){
 const {body,citations,total}=prepareRequest(data,message,'answer');
 const scope=body.contextScope.partial?`本次参考了 ${total} 条有效记忆中的 ${citations.length} 条，未覆盖全部记录。\n\n`:'';
 // A partial summary must not infer that omitted rows do not exist. Use faithful excerpts.
 if(body.contextScope.partial&&isSummary(message.text))return {text:scope+'以下为本次选中记忆的内容摘录，完整内容可从引用查看：\n'+citations.map((c,i)=>`${i+1}. ${[...c.content].slice(0,240).join('')}${[...c.content].length>240?'…':''}`).join('\n'),citations,insufficient:citations.length===0,createdAt:new Date().toISOString()};
 const result=await post('answer',body,signal);
 if(result.petId!==body.petId||result.messageId!==message.id||result.requestId!==message.requestId||typeof result.text!=='string'||!result.text.trim()||result.text.length>12000||typeof result.insufficient!=='boolean'||!Array.isArray(result.citations))throw new ApiError('invalid','回答格式异常，请重试回答。');
 const selected:Citation[]=[];for(const id of result.citations){const c=citations.find(c=>c.memoryId===id);if(!c)throw new ApiError('invalid','回答包含未提供的来源，请重试。');if(!selected.some(x=>x.memoryId===id))selected.push(c)}
 if(!result.insufficient&&!selected.length)throw new ApiError('invalid','回答缺少可核对的记忆来源，请重试。');
 return {text:scope+result.text,citations:selected,insufficient:result.insufficient,createdAt:new Date().toISOString()};
}
export async function transcribe(blob:Blob,petId:string,signal:AbortSignal){
 if(!blob.size||blob.size>10*1024*1024)throw new ApiError('size','录音为空或超过10MB，请重新录音。');
 const form=new FormData();form.set('audio',blob,'recording.wav');form.set('petId',petId);
 let response:Response;try{response=await fetch('/api/transcriptions',{method:'POST',headers:{'X-Pawmemo-Request':'1'},body:form,signal:AbortSignal.any([signal,AbortSignal.timeout(65000)])})}catch{throw new ApiError('transcription','转写没有完成，尚未发送给助手。')}
 const result=await response.json().catch(()=>({}));if(!response.ok)throw new ApiError(result.code??'transcription',result.message??'转写没有完成，请重新录音或改用文字。');if(typeof result.text!=='string'||!result.text.trim()||result.text.length>12000)throw new ApiError('transcription','没有得到可用的转写文字，请重新录音。');return result.text;
}
