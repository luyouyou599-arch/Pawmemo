import {useLayoutEffect,useRef,useState,useEffect} from 'react';
import {latest,type Memory} from './v3Model';
import {Button,Card,Tags} from './v3UI';
export type InlineMemoryDraft={memoryId:string;petId:string;baseVersion:number;baseContent:string;content:string;error:string;notice:string};
export const draftFor=(m:Memory):InlineMemoryDraft=>{const v=latest(m);return {memoryId:m.id,petId:m.petId,baseVersion:v.version,baseContent:v.content,content:v.content,error:'',notice:''}};
export const dirtyDraft=(d:InlineMemoryDraft)=>d.content!==d.baseContent;
export function rebaseMemoryDraft(d:InlineMemoryDraft,m:Memory):InlineMemoryDraft{if(d.memoryId!==m.id||d.petId!==m.petId)throw Error('记忆不属于这份草稿');const fresh=draftFor(m);return {...fresh,content:d.content===d.baseContent?fresh.content:d.content,notice:'已保留本页修改，请核对后保存。'}}
type Props={memories:Memory[];petId:string;cache:Map<string,InlineMemoryDraft>;savingIds:string[];onSave:(draft:InlineMemoryDraft)=>Promise<{memory?:Memory;error?:string}>;onReload:()=>Promise<string>;onDetails:(id:string)=>void};
function MemoryRow({memory,index,cache,saving,onSave,onReload,onDetails,onChange}:{memory:Memory;index:number;cache:Props['cache'];saving:boolean;onSave:Props['onSave'];onReload:Props['onReload'];onDetails:Props['onDetails'];onChange:()=>void}){
 const area=useRef<HTMLTextAreaElement>(null),mounted=useRef(true),[tick,render]=useState(0),[reading,setReading]=useState(false);void tick;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 let draft=cache.get(memory.id)??draftFor(memory);if(draft.petId!==memory.petId||(!dirtyDraft(draft)&&draft.baseVersion!==latest(memory).version)){draft=draftFor(memory);cache.delete(memory.id)}
 const dirty=dirtyDraft(draft),conflict=dirty&&draft.baseVersion!==latest(memory).version;
 const refresh=()=>{if(mounted.current)render(n=>n+1);onChange()};
 const update=(patch:Partial<InlineMemoryDraft>)=>{cache.set(memory.id,{...draft,...patch,error:'',notice:''});refresh()};
 useLayoutEffect(()=>{const e=area.current;if(e){e.style.height='auto';e.style.height=Math.min(e.scrollHeight,224)+'px'}},[draft.content]);
 async function save(){if(saving||conflict)return;const result=await onSave({...draft});if(result.memory)cache.set(memory.id,{...draftFor(result.memory),notice:'已保存'});else cache.set(memory.id,{...(cache.get(memory.id)??draft),error:result.error??'未能保存，本页修改仍保留。'});refresh();if(result.memory&&mounted.current)area.current?.focus({preventScroll:true})}
 async function reload(){setReading(true);const error=await onReload();const current=cache.get(memory.id)??draft;cache.set(memory.id,{...current,error,notice:error?'':'已读取最新资料，请核对这条修改。'});if(mounted.current)setReading(false);refresh()}
 return <Card title={`${latest(memory).withdrawn?'已撤回':'主人记录'} ${new Date(memory.createdAt).toLocaleString('zh-CN',{hour12:false})}`} icon="memory"><div className="inline-memory" data-memory-id={memory.id}>
  <textarea ref={area} aria-label={`记忆内容 ${index}`} value={draft.content} maxLength={4000} rows={2} disabled={saving} onChange={e=>update({content:e.target.value})}/>
  <Tags tags={latest(memory).tags}/>
  {conflict&&<div className="inline-memory-conflict" role="alert"><p>这条记忆已有新版本，本页修改仍保留。</p><details><summary>查看已保存内容</summary><p>{latest(memory).content}</p><p>标签：{latest(memory).tags.join('、')||'无'}</p></details><Button icon="edit" tone="quiet" disabled={saving} onClick={()=>{cache.set(memory.id,rebaseMemoryDraft(draft,memory));refresh()}}>保留本页修改，基于新版本核对</Button></div>}
  {draft.error&&<p className="field-error" role="alert">{draft.error}</p>}{draft.notice&&<p className="muted" role="status">{draft.notice}</p>}
  {(draft.error||conflict)&&<Button icon="retry" tone="quiet" disabled={reading||saving} onClick={()=>void reload()}>{reading?'正在读取…':'读取最新资料，保留本条输入'}</Button>}
  {dirty&&<div className="inline-memory-actions"><Button icon="check" tone="primary" disabled={saving||conflict||!draft.content.trim()} onClick={()=>void save()}>{saving?'正在保存…':'保存'}</Button><Button icon="close" tone="quiet" disabled={saving} onClick={()=>{cache.delete(memory.id);refresh()}}>取消</Button></div>}
  <Button icon="source" tone="quiet" onClick={()=>onDetails(memory.id)}>原文与历史</Button>
 </div></Card>
}
export function MemoryList(props:Props){const [,render]=useState(0),changed=()=>render(n=>n+1),dirty=[...props.cache.values()].filter(d=>d.petId===props.petId&&dirtyDraft(d)),ids=new Set(props.memories.map(m=>m.id)),orphans=dirty.filter(d=>!ids.has(d.memoryId));return <>{dirty.length>0&&<p className="muted" role="status">{dirty.length} 条修改未保存；返回或切换仍保留，刷新前请保存。</p>}{[...props.memories].reverse().map((m,i)=><MemoryRow key={m.id} memory={m} index={i+1} cache={props.cache} saving={props.savingIds.includes(m.id)} onSave={props.onSave} onReload={props.onReload} onDetails={props.onDetails} onChange={changed}/>)}{orphans.map(d=><Card key={d.memoryId} title="原记忆已不在最新资料中" icon="alert"><p>本页草稿仍保留，可复制内容；不会重建或改写其他记忆。</p><textarea aria-label="未保存的记忆草稿" value={d.content} readOnly/><Button icon="close" tone="quiet" onClick={()=>{props.cache.delete(d.memoryId);changed()}}>放弃这份本页草稿</Button></Card>)}</>}
