import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { artifactDir } from './paths.js';
import type { Run } from './types.js';

const esc = (x: unknown) => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function shot(run?:Run) {
 if (!run?.screenshot) return '';
 try { return `<img alt="Captured page at the end of the ${esc(run.status)} journey" src="data:image/png;base64,${(await fs.readFile(path.join(artifactDir, path.basename(run.screenshot)))).toString('base64')}">`; }
 catch { return '<p>Screenshot unavailable for this run.</p>'; }
}
export async function renderReport(run:Run, before?:Run):Promise<string> {
 const isPair = Boolean(before && run.status === 'passed' && run.mode === 'live');
 const steps = (r:Run) => r.steps.map(s => `<tr><td>${s.index}</td><td>${esc(s.action.type)}${s.action.index ? ` ${s.action.index}` : ''}</td><td>${esc(s.announcement)}</td></tr>`).join('');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><title>TabTastic evidence ${esc(run.id)}</title><style>
 @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:12px/1.55 Arial,sans-serif;color:#1e3026;margin:0;background:#fff}header{border-bottom:3px solid #1e3026;padding-bottom:18px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}h1{font-size:30px;line-height:1.15;letter-spacing:-1px;margin:16px 0}h2{font-size:19px;margin-top:28px;break-after:avoid}h3{font-size:14px}p{overflow-wrap:anywhere}.label{letter-spacing:2px;font-size:10px;text-transform:uppercase}.badge{display:inline-block;background:#d9f66f;border-radius:20px;padding:6px 12px;font-weight:bold}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;background:#f4f5ef}.muted{color:#5b655e}table{border-collapse:collapse;width:100%;font-size:10px}th,td{text-align:left;padding:8px;border-bottom:1px solid #dce0d8;vertical-align:top}th{background:#f4f5ef}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f5ef;padding:15px;font-size:9px;line-height:1.5}img{display:block;width:100%;border:1px solid #dce0d8;break-inside:avoid}.notice{padding:12px;border-left:3px solid #55713c;background:#f4f5ef}footer{margin-top:24px;font-size:10px;border-top:1px solid #ddd;padding-top:12px}tr{break-inside:avoid}</style>
 <header><strong>↳ TabTastic</strong><span class="label">Dated journey evidence</span></header>
 <span class="badge">${esc(isPair ? 'FIX VERIFIED' : run.status.toUpperCase())}</span>
 <h1>${run.journey === 'add_to_cart' ? 'Add to cart' : 'Find a menu'}<br>Journey evidence report</h1>
 <div class="meta"><div><b>Tested URL</b><br>${esc(run.url)}</div><div><b>Run ID</b><br>${esc(run.id)}</div><div><b>Started (UTC)</b><br>${esc(run.createdAt)}</div><div><b>Finished (UTC)</b><br>${esc(run.completedAt ?? 'In progress')}</div></div>
 <p class="notice">${run.mode === 'replay' ? 'REPLAY: this is a playback of previously recorded evidence. It is not a new test of the website.' : run.status === 'passed' ? 'The journey we tested passes, with dated evidence. This result applies only to this journey and this page state.' : 'The tested journey did not complete. The observations below identify where it stopped.'} Automated virtual screen reader testing does not replace testing with people who use assistive technology.</p>
 <p><b>Announcer:</b> ${esc(run.announcer ?? 'Recorded transcript')}<br><b>Action policy:</b> ${esc(run.llm ?? 'Recorded actions')}<br><b>Outcome:</b> ${esc(run.reason ?? run.status)}</p>
 ${before ? `<h2>Before repair</h2><p>${esc(before.url)} · ${esc(before.createdAt)} · ${esc(before.status)}</p><p>${esc(before.reason)}</p>${await shot(before)}<table><thead><tr><th>Step</th><th>Action</th><th>Announcement</th></tr></thead><tbody>${steps(before)}</tbody></table>` : ''}
 <h2>${before ? 'After repair' : 'Captured page'}</h2>${await shot(run)}
 <h2>Keyboard transcript</h2><table><thead><tr><th>Step</th><th>Action</th><th>Announcement</th></tr></thead><tbody>${steps(run)}</tbody></table>
 <h2>Detected barriers</h2>${(before?.findings ?? run.findings).map(f=>`<h3>${esc(f.rule)} · ${esc(f.impact)}</h3><p>${esc(f.description)}</p><pre>${esc(f.html)}</pre>`).join('') || '<p>No barriers recorded for this journey.</p>'}
 <h2>Source diff</h2><pre>${esc(run.diff ?? before?.diff ?? 'No source patch was applied to this run.')}</pre>
 <h2>Owner approvals</h2>${(run.fixes.length ? run.fixes : before?.fixes ?? []).map(f=>`<p>${f.approved ? 'Approved' : f.requiresApproval ? 'Pending owner review' : 'Template'}: ${esc(f.description)}</p>`).join('') || '<p>No fixes applied.</p>'}
 <footer>TabTastic · Find the block. Fix the flow !! · Evidence collected by keyboard navigation and accessibility tree announcements. Payment and form submissions are blocked on public sites. A pass is specific to the tested journey; it is not a site-wide accessibility guarantee.</footer></html>`;
}
export async function reportPdf(html:string):Promise<Buffer> {
 const browser = await chromium.launch({headless:true});
 try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent(html, {waitUntil:'load'});
  await page.emulateMedia({media:'print'});
  return await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#566158">TabTastic · Find the block. Fix the flow !! · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',margin:{bottom:'20mm'}});
 } finally { await browser.close(); }
}
