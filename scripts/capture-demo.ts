import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

// Run against npm run dev. Captures real UI behavior, without synthetic results.
const origin=process.env.DEMO_WEB_URL ?? 'http://localhost:5173';
await fs.mkdir('output/video',{recursive:true});
await fs.mkdir('output/pdf',{recursive:true});
await fs.mkdir('output/qa',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'output/video',size:{width:1440,height:1000}}});
const page=await context.newPage();
const errors:string[]=[];
page.on('pageerror',error=>errors.push(error.message));
let fixedId='';let brokenId='';
try {
 await page.goto(origin);await page.waitForTimeout(1200);
 await page.getByRole('button',{name:'Run the demo'}).press('Enter');
 await page.locator('.status-stuck').waitFor({timeout:45000});
 brokenId=new URL(page.url()).pathname.split('/').at(-1)!;
 await page.screenshot({path:'output/qa/broken-run.png',fullPage:true});
 await page.locator('.fix-list').waitFor();
 await page.locator('.fix-list').scrollIntoViewIfNeeded();await page.waitForTimeout(1800);
 for(const checkbox of await page.locator('.fix-needs-approval input').all()) await checkbox.press('Space');
 await page.getByRole('button',{name:'Fix & re-test'}).scrollIntoViewIfNeeded();await page.waitForTimeout(1800);
 await page.getByRole('button',{name:'Fix & re-test'}).press('Enter');
 await page.locator('.status-passed').waitFor({timeout:45000});
 fixedId=new URL(page.url()).pathname.split('/').at(-1)!;
 await page.screenshot({path:'output/qa/fixed-run.png',fullPage:true});
 await page.waitForTimeout(2500);
 await page.getByRole('link',{name:'View journey report'}).press('Enter');
 await page.getByRole('heading',{name:'Proof of the journey.'}).waitFor();
 await page.locator('.comparison-grid').waitFor();
 await page.screenshot({path:'output/qa/report-desktop.png',fullPage:true});
 await page.locator('.comparison-grid').scrollIntoViewIfNeeded();await page.waitForTimeout(2500);
 const report=await context.request.get(`${origin}/api/runs/${fixedId}/report.pdf`);
 if(!report.ok())throw new Error('Evidence PDF failed to export.');
 await fs.writeFile('output/pdf/tabtastic-evidence.pdf',await report.body());
 const tape=await context.request.get(`${origin}/api/runs/${fixedId}/tape`);
 await fs.writeFile('output/tabtastic-replay.json',await tape.body());
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'output/qa/report-mobile.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
 if(overflow)throw new Error('The mobile report has horizontal overflow.');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${origin}/pricing`);await page.waitForTimeout(1500);
 await page.screenshot({path:'output/qa/pricing.png',fullPage:true});
 await page.goto(`${origin}/runs/${fixedId}`);
 await page.getByRole('button',{name:'Replay recorded journey'}).press('Enter');
 await page.getByText('RECORDED JOURNEY · OFFLINE REPLAY',{exact:true}).waitFor();
 await page.locator('.status-passed').waitFor({timeout:30000});
 await page.waitForTimeout(1500);
 await page.screenshot({path:'output/qa/replay.png',fullPage:true});
 if(errors.length)throw new Error(errors.join('\n'));
 const manifest={capturedAt:new Date().toISOString(),brokenId,fixedId,silentClip:true,origin};
 await fs.writeFile('output/capture.json',JSON.stringify(manifest,null,2));
 console.log(JSON.stringify(manifest));
} finally {
 const video=page.video();await context.close();
 if(video){const videoPath=await video.path();await fs.rename(videoPath,path.resolve('output/video/tabtastic-demo.webm'));}
 await browser.close();
}
