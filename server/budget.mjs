import {mkdir,open,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export class BudgetError extends Error{constructor(code,message){super(message);this.code=code;this.status=code==='budget_limit'?402:503}}
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export class Budget{
 constructor({file,stopCny=40,totalCny=50}){this.file=file;this.stop=stopCny;this.total=totalCny;if(!file||!finite(stopCny)||!finite(totalCny)||stopCny<=0||stopCny>totalCny)throw new BudgetError('budget_configuration','费用保护配置无效，暂不发起付费请求。')}
 async transaction(change){await mkdir(dirname(this.file),{recursive:true,mode:0o700});let handle;for(let i=0;i<30;i++){try{handle=await open(this.file+'.lock','wx',0o600);break}catch(e){if(e.code!=='EEXIST')throw new BudgetError('budget_storage','费用记录无法锁定，暂不发起付费请求。');await new Promise(r=>setTimeout(r,25))}}if(!handle)throw new BudgetError('budget_storage','费用记录正在使用，暂不发起付费请求。');
 let temp;try{let data;try{data=JSON.parse(await readFile(this.file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw new BudgetError('budget_storage','费用记录无法读取，暂不发起付费请求。');data={version:1,spentCny:0,reservations:{},events:[]}}
 if(data.version!==1||!finite(data.spentCny)||!data.reservations||typeof data.reservations!=='object'||!Array.isArray(data.events)||!Object.values(data.reservations).every(x=>finite(x.amount)))throw new BudgetError('budget_storage','费用记录校验失败，暂不发起付费请求。');
 const result=change(data);temp=this.file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await rename(temp,this.file);temp=null;return result;
 }catch(e){if(e instanceof BudgetError)throw e;throw new BudgetError('budget_storage','费用记录无法保存，暂不继续付费请求。')}finally{if(temp)await unlink(temp).catch(()=>{});await handle.close();await unlink(this.file+'.lock').catch(()=>{})}}
 async reserve(amount,metadata){if(!finite(amount)||amount<=0)throw new BudgetError('budget_configuration','尚未确认服务费率，暂不发起付费请求。');return this.transaction(d=>{const pending=Object.values(d.reservations).reduce((s,r)=>s+r.amount,0),used=d.spentCny+pending;if(used+amount>this.stop+1e-9)throw new BudgetError('budget_limit','Demo费用预留已接近停止额度，已暂停新增付费请求。');const id=randomUUID();d.reservations[id]={amount,at:new Date().toISOString(),...metadata};return id})}
 async settle(id,actual,metadata){return this.transaction(d=>{const reserved=d.reservations[id];if(!reserved)throw new BudgetError('budget_storage','费用预留记录缺失，已暂停后续请求。');const charge=finite(actual)?actual:reserved.amount;d.spentCny+=charge;d.events.push({at:new Date().toISOString(),...reserved,...metadata,chargeCny:charge});d.events=d.events.slice(-256);delete d.reservations[id];return {spentCny:d.spentCny,reservedCny:Object.values(d.reservations).reduce((s,r)=>s+r.amount,0),stopCny:this.stop,totalCny:this.total}})}
}
