import {type Data,type Pet,type PetDraft,type PetFields,clone,uid,validatePet} from './v3Model';
export const profileKeys=['name','kind','breed','birthday','avatar'] as const;
export const profileLabels:Record<keyof PetFields,string>={name:'名字',kind:'类型',breed:'品种',birthday:'生日',avatar:'照片'};
export function localToday(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}
export function petFields(p:Pet):PetFields{return {name:p.name,kind:p.kind,breed:p.breed,birthday:p.birthday,avatar:p.avatar}}
export function validateProfile(fields:PetFields,today=localToday()){
 const errors=validatePet(fields);
 if(!errors.birthday&&fields.birthday&&fields.birthday>today)errors.birthday='生日不能晚于今天，也可以留空。';
 if(fields.avatar!==null&&(fields.avatar.length>2800000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(fields.avatar)))errors.avatar='照片无法保存，请重新选择。';
 return errors;
}
function target(data:Data,petId:string|null){const pet=data.pets.find(p=>p.id===petId&&!p.archived);if(!pet)throw Error('原宠物已移除或归档，输入仍保留，不会自动重建。');return pet}
export function newProfileDraft(data:Data,petId:string){const pet=target(data,petId),base=petFields(pet);return {draft:{id:uid('draft'),petId,fields:clone(base)},base}}
export function profileConflicts(data:Data,draft:PetDraft,base:PetFields|null):readonly (keyof PetFields)[]{
 const pet=data.pets.find(p=>p.id===draft.petId&&!p.archived);if(!pet)return [];
 if(!base)return profileKeys;
 return profileKeys.filter(k=>draft.fields[k]!==base[k]&&pet[k]!==base[k]&&pet[k]!==draft.fields[k]);
}
export function rebaseProfileDraft(data:Data,draft:PetDraft,base:PetFields|null){
 const latest=petFields(target(data,draft.petId)),changes=Object.fromEntries(profileKeys.filter(k=>!base||draft.fields[k]!==base[k]).map(k=>[k,draft.fields[k]])),fields={...latest,...changes};
 return {draft:{...draft,fields},base:clone(latest)};
}
// Only profile fields change. Messages, memories, conversations and historical citations retain identity.
export function saveProfileDraft(data:Data,draft:PetDraft,base:PetFields|null,now=new Date().toISOString()):Data {
 const pet=target(data,draft.petId);
 const conflicts=profileConflicts(data,draft,base);if(!base||conflicts.length)throw Error(`请先核对最新资料：${conflicts.map(k=>profileLabels[k]).join('、')}。本页修改仍保留。`);
 const merged=rebaseProfileDraft(data,draft,base).draft.fields,errors=validateProfile(merged);
 if(Object.keys(errors).length)throw Error(Object.values(errors).join(' '));
 const updated={...pet,...merged,updatedAt:now};
 return {...data,pets:data.pets.map(p=>p.id===pet.id?updated:p),petDrafts:data.petDrafts.filter(d=>d.id!==draft.id)};
}
