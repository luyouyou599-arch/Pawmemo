import {mkdir} from 'node:fs/promises';
await mkdir('.pawmemo/test-results',{recursive:true});
import {Budget} from '../server/budget.mjs';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const dir=await mkdtemp(join(tmpdir(),'pawmemo-budget-')),file=join(dir,'usage.json'),results=[];
async function test(name,fn){try{await fn();results.push({name,result:'passed'});console.log('PASS',name)}catch(e){results.push({name,result:'failed',error:e.stack});console.log('FAIL',name,e.message)}}
await test('reservation is persisted before external use and survives a fresh Budget instance',async()=>{const b=new Budget({file,stopCny:40,totalCny:50});await b.reserve(10,{phase:'extract',model:'fixture'});const fresh=new Budget({file,stopCny:40,totalCny:50});await assert.rejects(()=>fresh.reserve(31,{phase:'answer'}),e=>e.code==='budget_limit');assert.equal(Object.keys(JSON.parse(await readFile(file,'utf8')).reservations).length,1)});
await test('a separate restarted Node process reads prior reservations and is denied before exceeding budget',async()=>{const code=`import {Budget} from ${JSON.stringify(new URL('../server/budget.mjs',import.meta.url).href)};try{await new Budget({file:process.argv[1],stopCny:40,totalCny:50}).reserve(31,{phase:'extract'});process.exitCode=1}catch(e){if(e.code!=='budget_limit')throw e;console.log('budget_limit')}`;const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',code,file]);assert.equal(stdout.trim(),'budget_limit')});
await test('concurrent instances cannot jointly reserve past stop threshold',async()=>{const a=new Budget({file,stopCny:40,totalCny:50}),b=new Budget({file,stopCny:40,totalCny:50});const r=await Promise.allSettled([a.reserve(20,{phase:'extract'}),b.reserve(20,{phase:'answer'})]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1)});
await test('unknown failure cost conservatively consumes reservation; successful usage settles explicitly',async()=>{const b=new Budget({file,stopCny:40,totalCny:50}),data=JSON.parse(await readFile(file,'utf8')),ids=Object.keys(data.reservations);await b.settle(ids[0],undefined,{status:'unknown_failure'});await b.settle(ids[1],2,{status:'success',inputTokens:20,outputTokens:10});const d=JSON.parse(await readFile(file,'utf8'));assert.equal(d.spentCny,12);assert.equal(Object.keys(d.reservations).length,0);assert.equal(d.events[0].chargeCny,10);assert(!JSON.stringify(d).includes('主人原文'))});
await test('corrupt ledger fails closed and original bytes remain',async()=>{await writeFile(file,'{broken');await assert.rejects(()=>new Budget({file}).reserve(1,{phase:'extract'}),e=>e.code==='budget_storage');assert.equal(await readFile(file,'utf8'),'{broken')});
await test('missing/invalid positive fee estimate never authorizes spending',async()=>{await rm(file);await assert.rejects(()=>new Budget({file}).reserve(0,{phase:'extract'}),e=>e.code==='budget_configuration');await assert.rejects(()=>new Budget({file}).reserve(NaN,{phase:'extract'}),e=>e.code==='budget_configuration')});
await rm(dir,{recursive:true,force:true});await writeFile('.pawmemo/test-results/budget.json',JSON.stringify({scope:'local persisted budget transactions only; zero paid requests; price estimates are not official account hard caps',results},null,2));if(results.some(x=>x.result==='failed'))process.exitCode=1;
