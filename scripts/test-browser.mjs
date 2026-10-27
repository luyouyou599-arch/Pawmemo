import {makeApp} from '../server/app.mjs';
import {access,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
const root=resolve('.pawmemo/build'),output=resolve('.pawmemo/test-results/browser');
await access(join(root,'index.html'));await mkdir(output,{recursive:true});
const temp=await mkdtemp(join(tmpdir(),'pawmemo-browser-'));
const app=makeApp({config:{enabled:false,root,budgetFile:join(temp,'fixture-budget.json')},fetcher:async()=>{throw Error('External calls forbidden in browser regression')}});
await new Promise(r=>app.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+app.address().port;
const all=['partial-extraction','memory-inline','voice-home','voice-chat','photo-input','profile-photo','ui-copy'];
const selected=process.env.PAWMEMO_BROWSER_CASES?.split(',')??all;
if(selected.some(s=>!all.includes(s)))throw Error('Unknown browser case selection');
const results=[];
try{for(const name of selected){const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['tests/'+name+'.mjs'],{stdio:'inherit',env:{...process.env,EXTERNAL_AI_ENABLED:'false',PAWMEMO_LIVE_TEST:'0',PAWMEMO_TEST_BASE:base,PAWMEMO_TEST_OUTPUT:output}});child.on('error',reject);child.on('exit',code=>resolve(code??1))});results.push({name,exitCode:code});if(code)process.exitCode=1}}
finally{app.closeAllConnections();await new Promise(r=>app.close(r));await rm(temp,{recursive:true,force:true});await writeFile(join(output,'suite.json'),JSON.stringify({scope:'Isolated server with external AI disabled; browser APIs intercepted fixtures. No real AI/ASR calls.',results},null,2))}
