import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Run } from '../runner/src/types.js';

test('owned store fails, approved source repair passes, evidence exports and replay works offline', {timeout:120000}, async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'tabtastic-e2e-'));
 process.env.DATA_DIR=temp;process.env.NODE_ENV='test';process.env.LLM_PROVIDER='';
 delete process.env.GEMINI_API_KEY;delete process.env.ANTHROPIC_API_KEY;
 const {buildServer}=await import('../runner/src/server.js');
 const {db}=await import('../runner/src/db.js');
 const app=await buildServer({port:3139});await app.listen({port:3139,host:'127.0.0.1'});
 const base='http://127.0.0.1:3139';
 const get=async(url:string)=>{const r=await fetch(base+url);assert.equal(r.ok,true,await r.clone().text());return r.json();};
 const post=async(url:string,body:unknown={})=>{const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.ok,true,await r.clone().text());return r.json() as Promise<{runId:string}>;};
 const finish=async(id:string):Promise<Run>=>{
  for(let i=0;i<300;i++){const run=await get('/api/runs/'+id) as Run;if(['passed','stuck','error'].includes(run.status))return run;await new Promise(r=>setTimeout(r,150));}
  throw new Error('Journey did not finish within 45 seconds');
 };
 try {
  const {runId}=await post('/api/runs',{url:'demo',journey:'add_to_cart'});
  const broken=await finish(runId);
  assert.equal(broken.status,'stuck',broken.reason);
  assert.match(broken.reason ?? '',/size|swatch|medium|accessibility tree/i);
  assert.ok(broken.findings.some(f=>f.rule==='clickable-no-role-name' || /clickable/.test(f.rule)),'Custom check identifies mouse-only controls');
  assert.ok(broken.steps.length>0 && broken.steps.length<=40);
  const proposal=await get(`/api/runs/${runId}/fixes`) as {diff:string;fixes:Run['fixes']};
  assert.match(proposal.diff,/^-.*<div.*data-size/m);assert.match(proposal.diff,/^\+.*<button/m);
  const unapproved=await fetch(base+`/api/runs/${runId}/fix`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approvedIds:[]})});
  assert.equal(unapproved.status,400,'Draft labels require owner approval');
  const fixedId=(await post(`/api/runs/${runId}/fix`,{approvedIds:proposal.fixes.filter(f=>f.requiresApproval).map(f=>f.id)})).runId;
  const fixed=await finish(fixedId);assert.equal(fixed.status,'passed',fixed.reason);
  assert.ok(fixed.steps.some(s=>/medium/i.test(s.announcement)),'Fixed size is announced');
  assert.ok(fixed.steps.some(s=>/added/i.test(s.announcement)),'Cart success is announced');
  assert.equal(fixed.parentId,runId);assert.ok(fixed.screenshot);
  const htmlResponse=await fetch(base+`/api/runs/${fixedId}/report.html`);const html=await htmlResponse.text();
  assert.match(html,/Before repair/);assert.match(html,/After repair/);assert.match(html,/data:image\/png;base64,/);
  const pdf=await fetch(base+`/api/runs/${fixedId}/report.pdf`);assert.equal(pdf.status,200);
  const pdfData=Buffer.from(await pdf.arrayBuffer());assert.equal(pdfData.subarray(0,4).toString(),'%PDF');
  assert.ok(pdfData.length>10000);
  // Simulate unavailable model networking. Replay must not make an external request.
  process.env.LLM_PROVIDER='gemini';process.env.GEMINI_API_KEY='offline-proof-invalid-key';
  const realFetch=globalThis.fetch;let externalAttempts=0;
  globalThis.fetch=(async(input:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{
   const url=String(input instanceof Request ? input.url : input);
   if(!url.startsWith(base)){externalAttempts++;throw new Error('LLM network is disabled for offline replay');}
   return realFetch(input,init);
  }) as typeof fetch;
  try {
   const replayId=(await post(`/api/runs/${fixedId}/replay`)).runId;
   const replay=await finish(replayId);assert.equal(replay.status,'passed');assert.equal(replay.mode,'replay');
   assert.deepEqual(replay.steps,fixed.steps);assert.equal(externalAttempts,0);assert.match(replay.llm ?? '',/offline replay/i);
  } finally {globalThis.fetch=realFetch;process.env.LLM_PROVIDER='';delete process.env.GEMINI_API_KEY;}
  const menuId=(await post('/api/runs',{url:'demo-menu',journey:'find_menu'})).runId;
  const menu=await finish(menuId);assert.equal(menu.status,'passed',menu.reason);
  const stream=await fetch(base+`/api/runs/${runId}/events`);assert.match(await stream.text(),/event: complete/);
  const checkout=await fetch(base+'/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:'store'})});
  if(!process.env.STRIPE_SECRET_KEY)assert.equal(checkout.status,503,'Missing Stripe credentials produce an honest configuration state');
  console.log(JSON.stringify({broken:broken.status,fixed:fixed.status,menu:menu.status,offlineReplay:true,pdfBytes:pdfData.length,steps:fixed.steps.length}));
 } finally {await app.close();db.close();await rm(temp,{recursive:true,force:true});}
});
