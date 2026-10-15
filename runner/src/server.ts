import 'dotenv/config';
import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import cors from '@fastify/cors';
import PQueue from 'p-queue';
import Stripe from 'stripe';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { root, dataDir, artifactDir } from './paths.js';
import { db, getRun, listRuns, saveRun } from './db.js';
import { executeRun } from './engine.js';
import { previewFixes, applyFixes } from './fixes.js';
import { renderReport, reportPdf } from './report.js';
import type { Journey, Run, RunEvent } from './types.js';
import type { ServerResponse } from 'node:http';

const queue = new PQueue({concurrency:2});
const subscribers = new Map<string, Set<ServerResponse>>();
const current = new Map<string, Run>();
const terminal = (run:Run) => ['stuck','passed','error'].includes(run.status);
function broadcast(run:Run,event:RunEvent) {
 saveRun(run);
 const packet=`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
 for (const client of subscribers.get(run.id) ?? []) if (!client.destroyed) client.write(packet);
}
async function tape(run:Run) {
 await fs.writeFile(path.join(dataDir,'tapes',`${run.id}.json`),JSON.stringify({version:1,recordedAt:new Date().toISOString(),run},null,2));
}
export async function buildServer(options:{port?:number;baseUrl?:string}={}) {
 const app = Fastify({logger:process.env.NODE_ENV !== 'test',bodyLimit:16*1024});
 const port=options.port ?? Number(process.env.PORT ?? 3001);
 const baseUrl=options.baseUrl ?? `http://127.0.0.1:${port}`;
 await Promise.all([fs.mkdir(artifactDir,{recursive:true}),fs.mkdir(path.join(dataDir,'tapes'),{recursive:true}),fs.mkdir(path.join(root,'demo-store-fixed'),{recursive:true})]);
 await app.register(cors,{origin:[`http://localhost:5173`,`http://127.0.0.1:5173`,`http://localhost:${port}`,baseUrl]});
 app.addHook('onRequest',async(req,reply)=>{
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.headers.origin && ![`http://localhost:5173`,`http://127.0.0.1:5173`,`http://localhost:${port}`,baseUrl].includes(req.headers.origin)) return reply.code(403).send({message:'Origin is not allowed.'});
 });
 await app.register(staticFiles,{root:path.join(root,'demo-store'),prefix:'/demo-store/'});
 await app.register(staticFiles,{root:path.join(root,'demo-store-fixed'),prefix:'/demo-store-fixed/',decorateReply:false});
 await app.register(staticFiles,{root:artifactDir,prefix:'/api/artifacts/',decorateReply:false});
 const resolveRun = (id:string) => current.get(id) ?? getRun(id);
 function createRun(url:string,journey:Journey,parentId?:string):Run {
  const run:Run={id:randomUUID(),url,journey,status:'queued',createdAt:new Date().toISOString(),steps:[],findings:[],fixes:[],mode:'live',...(parentId ? {parentId} : {})};
  saveRun(run);current.set(run.id,run);return run;
 }
 function enqueue(run:Run) {
  void queue.add(async()=>{
   try { await executeRun({run,baseUrl,artifactDir,emit:event=>{ if(event.type!=='complete') broadcast(run,event); }}); }
   catch(error) {run.status='error';run.reason=error instanceof Error ? error.message : String(error);run.completedAt=new Date().toISOString();}
   await tape(run);broadcast(run,{type:'complete',data:run});current.delete(run.id);
  }).catch(error=>app.log.error(error));
 }
 app.get('/api/health',async()=>({ok:true,queue:queue.size,running:queue.pending,llmConfigured:Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY),stripeTestConfigured:Boolean(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))}));
 app.get('/api/runs',async()=>listRuns());
 app.post<{Body:{url?:string;journey?:Journey}}>('/api/runs',async(req,reply)=>{
  if(queue.size > 20) return reply.code(429).send({message:'The journey queue is full. Try again shortly.'});
  const {url,journey}=req.body ?? {};
  if(!url || !['add_to_cart','find_menu'].includes(journey ?? '')) return reply.code(400).send({message:'Provide an http(s) URL and a supported journey.'});
  let target=url==='demo' ? `${baseUrl}/demo-store/` : url==='demo-menu' ? `${baseUrl}/demo-store/menu.html` : url;
  // The Vite proxy is only a display origin; the browser runner uses its own server.
  try {const u=new URL(target);if (['localhost','127.0.0.1'].includes(u.hostname) && u.port==='5173' && u.pathname.startsWith('/demo-store')) target=baseUrl+u.pathname;}
  catch{return reply.code(400).send({message:'Enter a valid URL.'});}
  const run=createRun(target,journey!);enqueue(run);return reply.code(202).send({runId:run.id});
 });
 app.get<{Params:{id:string}}>('/api/runs/:id',async(req,reply)=>resolveRun(req.params.id) ?? reply.code(404).send({message:'Run not found.'}));
 app.get<{Params:{id:string}}>('/api/runs/:id/events',async(req,reply)=>{
  const run=resolveRun(req.params.id);if(!run)return reply.code(404).send({message:'Run not found.'});
  reply.hijack();const res=reply.raw;
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.write(`event: status\ndata: ${JSON.stringify(run)}\n\n`);
  if(terminal(run)){res.write(`event: complete\ndata: ${JSON.stringify(run)}\n\n`);res.end();return;}
  const clients=subscribers.get(run.id) ?? new Set<ServerResponse>();clients.add(res);subscribers.set(run.id,clients);
  const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);
  req.raw.on('close',()=>{clearInterval(timer);clients.delete(res);if(!clients.size)subscribers.delete(run.id);});
 });
 app.get<{Params:{id:string}}>('/api/runs/:id/tape',async(req,reply)=>{
  const run=resolveRun(req.params.id);if(!run)return reply.code(404).send({message:'Run not found.'});
  return reply.header('Content-Disposition',`attachment; filename="journeyproof-${run.id}.json"`).send({version:1,run});
 });
 const demoRun=(run:Run)=>run.mode==='live' && run.url.startsWith(`${baseUrl}/demo-store/`);
 app.get<{Params:{id:string}}>('/api/runs/:id/fixes',async(req,reply)=>{
  const run=resolveRun(req.params.id);if(!run)return reply.code(404).send({message:'Run not found.'});
  if(!demoRun(run) || run.status!=='stuck')return reply.code(409).send({message:'Source fixes are available for the stuck demo store only.'});
  const proposal=await previewFixes();run.diff=proposal.diff;run.fixes=proposal.fixes;saveRun(run);return proposal;
 });
 app.post<{Params:{id:string};Body:{approvedIds?:string[]}}>('/api/runs/:id/fix',async(req,reply)=>{
  const before=resolveRun(req.params.id);if(!before)return reply.code(404).send({message:'Run not found.'});
  if(!demoRun(before) || before.status!=='stuck')return reply.code(409).send({message:'Repair requires a stuck run on the owned demo store.'});
  if(before.fixedRunId)return {runId:before.fixedRunId};
  const proposal=await previewFixes();const approvedIds=req.body?.approvedIds ?? [];
  if(!Array.isArray(approvedIds) || approvedIds.some(x=>typeof x!=='string'))return reply.code(400).send({message:'Choose valid owner approvals.'});
  if(approvedIds.some(id=>!proposal.fixes.some(f=>f.id===id)))return reply.code(400).send({message:'An approval refers to an unknown fix.'});
  const missing=proposal.fixes.filter(f=>f.requiresApproval && !approvedIds.includes(f.id));
  if(missing.length)return reply.code(400).send({message:'Approve the proposed control labels and image description before applying.',missing:missing.map(f=>f.id)});
  await applyFixes(approvedIds);
  const run=createRun(`${baseUrl}/demo-store-fixed/`,before.journey,before.id);
  run.diff=proposal.diff;run.fixes=proposal.fixes.map(f=>({...f,approved:!f.requiresApproval || approvedIds.includes(f.id)}));
  before.diff=proposal.diff;before.fixes=run.fixes;before.fixedRunId=run.id;saveRun(before);saveRun(run);await tape(before);enqueue(run);return reply.code(202).send({runId:run.id});
 });
 app.post<{Params:{id:string}}>('/api/runs/:id/replay',async(req,reply)=>{
  const source=resolveRun(req.params.id);if(!source)return reply.code(404).send({message:'Run not found.'});
  if(!terminal(source))return reply.code(409).send({message:'Wait for this run to finish before replaying it.'});
  const run=createRun(source.url,source.journey,source.id);run.mode='replay';saveRun(run);
  void queue.add(async()=>{
   run.status='running';run.announcer=source.announcer;run.llm='Offline replay · no model or browser requests';broadcast(run,{type:'status',data:run});
   for(const step of source.steps){run.steps.push(structuredClone(step));broadcast(run,{type:'step',data:step});await new Promise(r=>setTimeout(r,180));}
   run.status=source.status;run.reason=`Recorded outcome from ${source.createdAt}: ${source.reason ?? source.status}`;run.findings=structuredClone(source.findings);run.screenshot=source.screenshot;run.completedAt=new Date().toISOString();
   await tape(run);broadcast(run,{type:'complete',data:run});current.delete(run.id);
  });return reply.code(202).send({runId:run.id});
 });
 for(const format of ['html','pdf'] as const) app.get<{Params:{id:string}}>(`/api/runs/:id/report.${format}`,async(req,reply)=>{
  const run=resolveRun(req.params.id);if(!run)return reply.code(404).send({message:'Run not found.'});
  if(!terminal(run))return reply.code(409).send({message:'The run must finish before exporting evidence.'});
  const before=run.parentId && run.mode==='live' ? resolveRun(run.parentId) : undefined;
  const html=await renderReport(run,before);
  if(format==='html')return reply.type('text/html').send(html);
  return reply.type('application/pdf').header('Content-Disposition',`attachment; filename="journeyproof-${run.id}.pdf"`).send(await reportPdf(html));
 });
 app.post<{Body:{plan?:string}}>('/api/checkout',async(req,reply)=>{
  const plan=req.body?.plan;const prices:Record<string,number>={restaurant:3900,store:4900,agency:29900};
  if(!plan || !prices[plan])return reply.code(400).send({message:'Choose a valid paid plan.'});
  const key=process.env.STRIPE_SECRET_KEY;
  if(!key?.startsWith('sk_test_'))return reply.code(503).send({message:'Stripe test checkout is not configured. Add STRIPE_SECRET_KEY=sk_test_… to .env to try the test subscription.'});
  const stripe=new Stripe(key);const web=process.env.WEB_URL ?? 'http://localhost:5173';
  const session=await stripe.checkout.sessions.create({mode:'subscription',payment_method_types:['card'],line_items:[{price_data:{currency:'usd',unit_amount:prices[plan],recurring:{interval:'month'},product_data:{name:`Journeyproof ${plan}`}},quantity:1}],success_url:`${web}/pricing?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${web}/pricing?cancelled=1`,metadata:{app:'journeyproof',plan}});
  db.prepare('INSERT INTO billing_sessions VALUES (?,?,0,?)').run(session.id,plan,new Date().toISOString());return {url:session.url};
 });
 app.get<{Querystring:{session_id?:string}}>('/api/billing/session',async(req,reply)=>{
  const id=req.query.session_id;const key=process.env.STRIPE_SECRET_KEY;
  if(!id || !key?.startsWith('sk_test_'))return reply.code(400).send({message:'A configured test checkout session is required.'});
  const stored=db.prepare('SELECT * FROM billing_sessions WHERE id=?').get(id) as {plan:string}|undefined;
  if(!stored)return reply.code(404).send({message:'Checkout session not found.'});
  const session=await new Stripe(key).checkout.sessions.retrieve(id,{expand:['subscription']});
  const subscription=session.subscription as Stripe.Subscription|null;
  const active=!session.livemode && session.status==='complete' && session.payment_status==='paid' && ['active','trialing'].includes(subscription?.status ?? '');
  db.prepare('UPDATE billing_sessions SET active=? WHERE id=?').run(Number(active),id);
  return {active,plan:stored.plan,testMode:!session.livemode};
 });
 const webDist=path.join(root,'web/dist');
 try {await fs.access(path.join(webDist,'index.html'));await app.register(staticFiles,{root:webDist,prefix:'/',decorateReply:false});app.setNotFoundHandler(async(req,reply)=>req.url.startsWith('/api/') ? reply.code(404).send({message:'Not found.'}) : reply.type('text/html').send(await fs.readFile(path.join(webDist,'index.html'),'utf8')));}catch{/* Vite serves development UI. */}
 app.addHook('onClose',async()=>{await queue.onIdle();for(const clients of subscribers.values())for(const res of clients)res.end();});
 return app;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const app=await buildServer();await app.listen({port:Number(process.env.PORT ?? 3001),host:process.env.HOST ?? '127.0.0.1'});
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{void app.close().then(()=>process.exit(0));});
}
