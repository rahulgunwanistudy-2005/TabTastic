import test from 'node:test';
import assert from 'node:assert/strict';
import { ActionPolicy } from '../runner/src/policy.js';

test('provider boundary strips DOM, selectors and backend IDs from the model input', async()=>{
 const originalFetch=globalThis.fetch;
 const previous={provider:process.env.LLM_PROVIDER,key:process.env.GEMINI_API_KEY,model:process.env.LLM_MODEL};
 process.env.LLM_PROVIDER='gemini';process.env.GEMINI_API_KEY='unit-test-key';delete process.env.LLM_MODEL;
 let sent:Record<string,unknown>|undefined;
 globalThis.fetch=(async(_input,init)=>{
  const body=JSON.parse(String(init?.body));sent=JSON.parse(body.contents[0].parts[0].text);
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"type":"jump","index":1}'}]}}]}),{status:200});
 }) as typeof fetch;
 try {
  const result=await new ActionPolicy().choose({goal:'add_to_cart',announcement:'button, Medium',last10:Array.from({length:15},(_,i)=>'announcement '+i),quickNav:[{index:1,role:'button',name:'Medium',backendId:900,selector:'#private-selector',html:'<button>'}] as never});
  assert.deepEqual(result.action,{type:'jump',index:1});
  assert.deepEqual(Object.keys(sent!).sort(),['announcement','goal','last10','quickNav']);
  assert.equal((sent!.last10 as unknown[]).length,10);
  assert.deepEqual(sent!.quickNav,[{index:1,role:'button',name:'Medium'}]);
  assert.doesNotMatch(JSON.stringify(sent),/private-selector|backendId|<button>/);
 } finally {
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries({LLM_PROVIDER:previous.provider,GEMINI_API_KEY:previous.key,LLM_MODEL:previous.model})) if(value===undefined)delete process.env[key];else process.env[key]=value;
 }
});
