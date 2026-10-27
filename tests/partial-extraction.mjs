import {browserBase,artifact} from './browserSupport.mjs';
import {chromium,expect} from 'playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true}),key='pawmemo:lifecycle:v1';
const b=(p,name)=>p.getByRole('button',{name,exact:true});
const text='咪咪今天在窗台晒太阳。它吃了兔肉粮，很喜欢。后来它和奶酪那样了，我没看清。',followup='后来咪咪躲到了床底。',clarification='后来咪咪和奶酪发生了什么？';
try{for(const width of [320,393]){
 const c=await browser.newContext({viewport:{width,height:852}}),p=await c.newPage();let calls=0;
 await p.route('**/api/**',async route=>{const v=route.request().postDataJSON();assert(new URL(route.request().url()).pathname.endsWith('/extract'));calls++;
 const first=v.text===text;const result=first?{intent:'record',facts:[{content:'咪咪今天在窗台晒太阳。',quote:'咪咪今天在窗台晒太阳。',tags:['日常','日光浴'],eventAt:null},{content:'咪咪喜欢兔肉粮（品牌未知）。',quote:'它吃了兔肉粮，很喜欢。',tags:['食物偏好'],eventAt:null}],question:'',clarification}:{intent:'record',facts:[{content:followup,quote:followup,tags:['行为'],eventAt:null}],question:'',clarification:''};
 if(!first){assert(v.history.some(h=>h.clarification===clarification));assert.equal(v.memories.length,2)}
 await route.fulfill({json:{petId:v.petId,messageId:v.messageId,requestId:v.requestId,result}});
 });
 await p.goto(browserBase);await b(p,'建立宠物档案').click();await p.locator('[name=name]').fill('咪咪');await p.locator('[name=kind]').selectOption('猫');await b(p,'创建档案').click();
 const pill=p.locator('.pet-pill'),icon=p.locator('.pet-pill>.v3-icon'),avatar=p.locator('.pet-pill>.avatar'),name=p.locator('.pet-name');
 await expect(icon.locator('img')).toHaveAttribute('src','/v3/switch-pets.svg');
 const rects=await Promise.all([pill,icon,avatar,name].map(l=>l.boundingBox()));for(const r of rects.slice(1))assert(Math.abs(r.y+r.height/2-rects[0].y-rects[0].height/2)<1);
 await p.screenshot({path:artifact(`switch-icon-${width}.png`)});
 await b(p,'切换宠物').click();await expect(p.locator('.nav-title')).toHaveText('切换宠物');await b(p,'添加另一只宠物').click();await p.locator('[name=name]').fill('奶酪');await p.locator('[name=kind]').selectOption('猫');await b(p,'创建档案').click();await b(p,'切换宠物').click();const row=p.locator('.pet-row').filter({hasText:'咪咪'}),switchIcon=row.locator(':scope>.v3-icon');await expect(switchIcon.locator('img')).toHaveAttribute('src','/v3/switch-pets.svg');const rr=await row.boundingBox(),ir=await switchIcon.boundingBox(),cr=await p.locator('.pet-row.selected>b').boundingBox();assert(Math.abs(rr.y+rr.height/2-ir.y-ir.height/2)<1);assert(Math.abs(ir.x+ir.width-cr.x-cr.width)<1);assert(rr.x+rr.width-ir.x-ir.width<14);await p.screenshot({path:artifact(`switch-list-${width}.png`)});await row.click();await b(p,'进入对话').click();
 const input=p.getByRole('textbox',{name:'记一件事，或问个问题',exact:true});await input.fill(text);await b(p,'发送').click();await expect(p.locator('.chat-reply,.chat-bubble').getByText(clarification,{exact:true})).toBeVisible();
 let d=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);assert.equal(d.memories.length,2);assert.deepEqual(d.memories[1].versions[0].tags,['食物偏好']);
 await p.screenshot({path:artifact(`partial-extraction-${width}.png`)});
 await input.fill(followup);await b(p,'发送').click();await expect.poll(()=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)).data.memories.length,key)).toBe(3);
 await b(p,'查看记忆').click();await expect(p.locator('.inline-memory')).toHaveCount(3);await expect(p.locator('.inline-memory input')).toHaveCount(0);
 d=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).data,key);assert.equal(d.memories.filter(m=>m.quote===followup).length,1);assert.equal(calls,2);await c.close();console.log('PASS partial fact persistence, follow-up, system tags and centered switch icon',width);
}}finally{await browser.close()}
