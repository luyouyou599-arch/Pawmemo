import {CollectionStorage as LegacyStorage, type Pet, type PetDraft, type PetFields, validatePet, COLLECTION_KEY} from './legacyV1';
export {validatePet, type Pet, type PetDraft, type PetFields};
export const KEY=COLLECTION_KEY, VERSION=3;
export type Stage='pending'|'working'|'done'|'failed';
export interface Fact {content:string;tags:string[];quote:string;eventAt:string|null}
export interface Extraction {intent:'record'|'question'|'mixed'|'clarify';facts:Fact[];question:string;clarification:string}
export interface MemoryVersion {version:number;content:string;tags:string[];createdAt:string;withdrawn:boolean}
export interface Memory {id:string;petId:string;messageId:string;raw:string;quote:string;source:'text'|'voice';createdAt:string;eventAt:string|null;versions:MemoryVersion[]}
export interface Citation {memoryId:string;petId:string;version:number;content:string;tags:string[];raw:string;quote:string;source:'text'|'voice';createdAt:string}
export interface Answer {text:string;citations:Citation[];createdAt:string;insufficient:boolean}
export interface Message {id:string;petId:string;requestId:string;conversationId:string;text:string;source:'text'|'voice';createdAt:string;extraction:Stage;answerState:Stage;result:Extraction|null;memoryIds:string[];answer:Answer|null;error:string}
export interface Data {localMode:boolean;activePetId:string|null;pets:Pet[];petDrafts:PetDraft[];memories:Memory[];messages:Message[];drafts:Record<string,string>;conversations:Record<string,string>}
export const empty=():Data=>({localMode:true,activePetId:null,pets:[],petDrafts:[],memories:[],messages:[],drafts:{},conversations:{}});
export const uid=(type:string)=>`${type}_${crypto.randomUUID()}`;
export const clone=<T,>(v:T):T=>JSON.parse(JSON.stringify(v));
export const latest=(m:Memory)=>m.versions[m.versions.length-1];
export function factsFor(d:Data,petId:string){return d.memories.filter(m=>m.petId===petId&&!latest(m).withdrawn)}
export function snapshot(m:Memory):Citation {const v=latest(m);return {memoryId:m.id,petId:m.petId,version:v.version,content:v.content,tags:[...v.tags],raw:m.raw,quote:m.quote,source:m.source,createdAt:m.createdAt}}
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,max=12000):v is string=>typeof v==='string'&&v.length<=max;
const stamp=(v:unknown):v is string=>str(v,40)&&Number.isFinite(Date.parse(v));
const strings=(v:unknown,max=12)=>Array.isArray(v)&&v.length<=max&&v.every(t=>str(t,80)&&t.trim());
export function validExtraction(v:unknown,raw:string):v is Extraction {
 if(!object(v)||!['record','question','mixed','clarify'].includes(v.intent)||!Array.isArray(v.facts)||v.facts.length>20||!str(v.question)||!str(v.clarification))return false;
 if(!v.facts.every((f:unknown)=>object(f)&&str(f.content,4000)&&f.content.trim()&&strings(f.tags)&&str(f.quote)&&f.quote.trim()&&raw.includes(f.quote)&&(f.eventAt===null||(str(f.eventAt,40)&&Number.isFinite(Date.parse(f.eventAt))))))return false;
 if(['question','clarify'].includes(v.intent)&&v.facts.length)return false;
 if(['record','mixed'].includes(v.intent)&&!v.facts.length)return false;
 if(['question','mixed'].includes(v.intent)&&!v.question.trim())return false;
 if(v.intent==='clarify'&&!v.clarification.trim())return false;
 return true;
}
function unique(v:{id:string}[]){return new Set(v.map(x=>x.id)).size===v.length}
export function validData(v:unknown):v is Data {
 try {
 if(!object(v)||typeof v.localMode!=='boolean'||!Array.isArray(v.pets)||!Array.isArray(v.petDrafts)||!Array.isArray(v.messages)||!Array.isArray(v.memories)||!object(v.drafts)||!object(v.conversations))return false;
 if(!v.pets.every((p:any)=>object(p)&&str(p.id,120)&&p.id.startsWith('pet_')&&['name','kind','breed','birthday'].every(k=>str(p[k],80))&&Object.keys(validatePet(p as PetFields)).length===0&&typeof p.archived==='boolean'&&stamp(p.createdAt)&&stamp(p.updatedAt)&&(p.avatar===null||(str(p.avatar,2800000)&&/^data:image\/(png|jpeg|webp);base64,/.test(p.avatar)))))return false;
 if(!unique(v.pets)||!unique(v.messages)||!unique(v.memories)||!unique(v.petDrafts))return false;
 if(v.activePetId!==null&&!v.pets.some((p:Pet)=>p.id===v.activePetId&&!p.archived))return false;if(v.activePetId===null&&v.pets.some((p:Pet)=>!p.archived))return false;
 const belongs=(id:unknown)=>v.pets.some((p:Pet)=>p.id===id);
 if(!v.petDrafts.every((d:any)=>object(d)&&str(d.id,120)&&(d.petId===null||belongs(d.petId))&&object(d.fields)&&['name','kind','breed','birthday'].every(k=>str(d.fields[k],80))&&(d.fields.avatar===null||str(d.fields.avatar,2800000))))return false;
 if(!Object.entries(v.drafts).every(([id,t])=>belongs(id)&&str(t))||!Object.entries(v.conversations).every(([id,c])=>belongs(id)&&str(c,120)))return false;
 if(!v.messages.every((m:any)=>object(m)&&str(m.id,120)&&belongs(m.petId)&&str(m.requestId,120)&&str(m.conversationId,120)&&str(m.text)&&m.text.trim()&&['text','voice'].includes(m.source)&&stamp(m.createdAt)&&['pending','working','done','failed'].includes(m.extraction)&&['pending','working','done','failed'].includes(m.answerState)&&str(m.error,2000)&&Array.isArray(m.memoryIds)&&(m.result===null||validExtraction(m.result,m.text))))return false;
 if(!v.memories.every((m:any)=>object(m)&&str(m.id,120)&&belongs(m.petId)&&v.messages.some((msg:Message)=>msg.id===m.messageId&&msg.petId===m.petId&&msg.text===m.raw)&&str(m.raw)&&str(m.quote)&&m.raw.includes(m.quote)&&['text','voice'].includes(m.source)&&stamp(m.createdAt)&&Array.isArray(m.versions)&&m.versions.length&&m.versions.every((x:any,i:number)=>object(x)&&x.version===i+1&&str(x.content,4000)&&x.content.trim()&&strings(x.tags)&&typeof x.withdrawn==='boolean'&&stamp(x.createdAt))))return false;
 for(const m of v.messages){if(!m.memoryIds.every((id:unknown)=>v.memories.some((x:Memory)=>x.id===id&&x.messageId===m.id&&x.petId===m.petId)))return false;
 if(m.answer!==null&&(!object(m.answer)||!str(m.answer.text)||typeof m.answer.insufficient!=='boolean'||!stamp(m.answer.createdAt)||!Array.isArray(m.answer.citations)||!m.answer.citations.every((c:any)=>object(c)&&c.petId===m.petId&&v.memories.some((x:Memory)=>x.id===c.memoryId&&x.petId===c.petId&&x.versions.some(y=>y.version===c.version&&y.content===c.content&&JSON.stringify(y.tags)===JSON.stringify(c.tags))&&x.raw===c.raw&&x.quote===c.quote&&x.source===c.source&&x.createdAt===c.createdAt)) ))return false;}
 return true;
 }catch{return false}
}
export class StoreError extends Error {constructor(public kind:'denied'|'corrupt'|'version'|'conflict'|'quota'|'unread'|'unsupported',message:string){super(message)}}
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
type Lock=<T>(work:()=>Promise<T>)=>Promise<T>;
export class V3Storage {
 private baseline:string|null|undefined;private ready=false;
 constructor(private access:()=>StorageLike=()=>localStorage,private lock:Lock=async work=>{if(!navigator.locks)throw new StoreError('unsupported','当前浏览器无法安全协调资料保存，请使用支持安全存储的浏览器。');return navigator.locks.request('pawmemo-collection',work)}){}
 async read():Promise<Data>{return this.lock(async()=>{this.ready=false;let raw:string|null;try{raw=this.access().getItem(KEY)}catch{throw new StoreError('denied','无法读取本机资料。原资料不会被覆盖。')}
 if(raw===null){this.baseline=null;this.ready=true;return empty()}
 let env:any;try{env=JSON.parse(raw)}catch{throw new StoreError('corrupt','本机资料无法解析。原文仍保留，不会覆盖。')}
 if(env?.version===1){const legacy=new LegacyStorage(this.access).read();if(legacy.kind!=='ready')throw new StoreError('corrupt','旧资料校验未通过，尚未迁移。');const d:Data={...empty(),localMode:true,pets:legacy.data.pets,petDrafts:legacy.data.petDrafts,activePetId:legacy.data.activePetId};
 this.baseline=raw;try {const b=KEY+':backup:1';const old=this.access().getItem(b);if(old!==null&&old!==raw)throw new StoreError('conflict','已存在不同的旧资料备份，请先保留并核对原资料。');this.access().setItem(b,raw);this.writeRaw(d)}catch(e){this.ready=false;throw this.convert(e)}this.ready=true;return d;}
 if(env?.version!==VERSION)throw new StoreError('version','资料版本暂不支持。请保留原资料，勿覆盖。');
 if(!validData(env.data))throw new StoreError('corrupt','资料校验失败。原文仍保留，不会覆盖。');this.baseline=raw;this.ready=true;return clone(env.data);
 })}
 private convert(e:unknown){if(e instanceof StoreError)return e;return new StoreError((e as DOMException)?.name==='QuotaExceededError'?'quota':'denied',(e as DOMException)?.name==='QuotaExceededError'?'本机空间不足，内容未保存。请保留输入后释放空间再重试。':'本机保存失败，输入仍保留。')}
 private writeRaw(d:Data){if(!validData(d))throw new StoreError('corrupt','资料校验失败，本次未保存。');if(this.access().getItem(KEY)!==this.baseline){this.ready=false;throw new StoreError('conflict','资料已在其他页面变化。本页输入保留，请读取最新资料后再重试。')}const raw=JSON.stringify({version:VERSION,data:d});this.access().setItem(KEY,raw);this.baseline=raw;}
 async write(d:Data){return this.lock(async()=>{if(!this.ready)throw new StoreError('unread','请先成功读取最新资料。');try{this.writeRaw(d)}catch(e){throw this.convert(e)}})}
}
export function applyExtraction(d:Data,messageId:string,r:Extraction,now=new Date().toISOString()):Data{
 const n=clone(d),m=n.messages.find(m=>m.id===messageId);if(!m)throw Error('找不到原消息');if(m.extraction==='done')return n;if(!validExtraction(r,m.text))throw Error('整理结果不符合原文，请重试。');
 m.result=r;m.extraction='done';m.error='';for(const [i,f]of r.facts.entries()){const id=`memory_${m.id}_${i}`;if(n.memories.some(x=>x.id===id))continue;n.memories.push({id,petId:m.petId,messageId:m.id,raw:m.text,quote:f.quote,source:m.source,createdAt:now,eventAt:f.eventAt,versions:[{version:1,content:f.content,tags:[...f.tags],createdAt:now,withdrawn:false}]});m.memoryIds.push(id)}if(!['question','mixed'].includes(r.intent))m.answerState='done';return n;
}
export function revise(d:Data,id:string,expected:number,patch:Pick<MemoryVersion,'content'|'tags'|'withdrawn'>):Data{const n=clone(d),m=n.memories.find(m=>m.id===id);if(!m||latest(m).version!==expected)throw new StoreError('conflict','这条记忆已更新，请重新查看后修改。');if(!patch.content.trim()||patch.content.length>4000||!strings(patch.tags))throw Error('请填写有效内容和标签。');m.versions.push({...patch,version:expected+1,createdAt:new Date().toISOString()});return n}
