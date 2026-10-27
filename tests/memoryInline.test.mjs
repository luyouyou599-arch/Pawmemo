import {describe,it,expect} from 'vitest';
import {draftFor,rebaseMemoryDraft} from '../src/MemoryList';
import {applyExtraction,empty,revise,snapshot} from '../src/v3Model';
import {readFileSync} from 'node:fs';
const now='2026-10-26T08:00:00.000Z';
const m={id:'memory_a',petId:'pet_a',messageId:'msg_a',raw:'原文',quote:'原文',source:'text',createdAt:now,eventAt:null,versions:[{version:1,content:'原内容',tags:['原标签'],createdAt:now,withdrawn:false}]};
describe('inline draft conflict reconciliation',()=>{
 it('keeps changed content without editable tags',()=>{const draft={...draftFor(m),content:'本页修改'},newer={...m,versions:[...m.versions,{...m.versions[0],version:2,content:'另一页内容',tags:['新标签']}]};const rebased=rebaseMemoryDraft(draft,newer);expect(rebased.content).toBe('本页修改');expect('tags' in rebased).toBe(false);expect(rebased.baseVersion).toBe(2)});
 it('rejects draft belonging to another pet',()=>expect(()=>rebaseMemoryDraft({...draftFor(m),petId:'pet_b'},m)).toThrow());
});
it('recorded live rabbit response creates one memory; explicit correction preserves raw and immutable citation',()=>{const report=JSON.parse(readFileSync('tests/fixtures/memory-model-results.json','utf8')),r=report.results.find((x)=>x.id==='rabbit_food_preference'),extraction=r.response.result,d=empty();d.messages=[{id:'msg_a',petId:'pet_a',requestId:'r',conversationId:'c',text:r.input,source:'text',createdAt:now,extraction:'pending',answerState:'pending',result:null,memoryIds:[],answer:null,error:''}];const after=applyExtraction(d,'msg_a',extraction,now);expect(after.memories).toHaveLength(1);const original=after.memories[0],citation=snapshot(original),changed=revise(after,original.id,1,{content:'主人纠正后的偏好',tags:['饮食'],withdrawn:false});expect(changed.memories[0].raw).toBe(r.input);expect(changed.memories[0].versions[0]).toEqual(original.versions[0]);expect(citation.content).toBe(extraction.facts[0].content);expect(applyExtraction(after,'msg_a',extraction).memories).toHaveLength(1)});
