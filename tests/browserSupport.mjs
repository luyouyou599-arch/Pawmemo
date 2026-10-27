import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
export const browserBase=process.env.PAWMEMO_TEST_BASE;
if(!browserBase||!/^http:\/\/127\.0\.0\.1:\d+$/.test(browserBase))throw Error('Use npm run test:browser to start the isolated local fixture server.');
const output=resolve(process.env.PAWMEMO_TEST_OUTPUT??'.pawmemo/test-results/browser');
await mkdir(output,{recursive:true});
export const artifact=name=>join(output,name);
