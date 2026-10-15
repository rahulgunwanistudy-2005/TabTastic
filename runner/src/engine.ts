import { mkdir } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
import { Announcer, detectFocusLoop, installGuidepup, type AXNode, type Observation } from './announcer.js';
import { ActionPolicy } from './policy.js';
import type { Action, EngineOptions, Finding, Run } from './types.js';

const MAX_STEPS = 40;
const interactiveRoles = new Set(['button', 'link', 'checkbox', 'radio', 'combobox', 'textbox', 'menuitem', 'tab', 'switch', 'slider', 'spinbutton']);
const unsafePath = /(?:^|\/)(?:checkout|check-out|payment|payments|purchase|place-order|submit|login|sign-in|signin|logout|delete|unsubscribe)(?:[/.?_-]|$)/i;
const unsafeActivation = /\b(?:checkout|check out|payment|pay now|place order|purchase|buy now|subscribe|sign in|log in|submit|reserve|book a table|delete)\b/i;
const escapeMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export function isPrivateAddress(input: string): boolean {
  let address = input.replace(/^\[|\]$/g, '').toLowerCase();
  // Reject both dotted and hexadecimal IPv4-mapped IPv6; browsers canonicalize to hex.
  if (address.startsWith('::ffff:')) return true;
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  }
  return address === '::' || address === '::1' || /^f[cd]/.test(address) || /^fe[89ab]/.test(address) || /^ff/.test(address) || address.includes('%');
}

export async function validateTargetUrl(raw: string, baseUrl: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Enter a full http or https URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public http and https URLs without embedded credentials are supported.');
  if (unsafePath.test(url.pathname)) throw new Error('Payment, checkout, account and form-submission destinations are outside this read-only check.');
  const base = new URL(baseUrl);
  if (url.origin === base.origin && /^\/demo-(?:store(?:-fixed)?|restaurant)(?:\/|$)/.test(url.pathname)) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || /\.(?:localhost|local|internal|lan)$/.test(host) || isPrivateAddress(host)) throw new Error('Private network URLs are blocked. Use the included local demo or a public website.');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(record => isPrivateAddress(record.address))) throw new Error('This hostname resolves to a private network address and is blocked.');
  return url;
}

function isLocalDemo(url: URL, baseUrl: string): boolean {
  return url.origin === new URL(baseUrl).origin && /^\/demo-(?:store(?:-fixed)?|restaurant)(?:\/|$)/.test(url.pathname);
}

async function installReadOnlyGuards(context: BrowserContext, baseUrl: string, demo: boolean): Promise<{ blocked: string[]; writes: number[] }> {
  const blocked: string[] = [];
  const writes: number[] = [];
  const publicHosts = new Map<string, boolean>();
  await context.addInitScript(() => {
    document.addEventListener('submit', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
    // Guard programmatic submissions as well as keyboard-triggered ones.
    HTMLFormElement.prototype.submit = function () { throw new Error('Journeyproof blocks form submission.'); };
    HTMLFormElement.prototype.requestSubmit = function () { throw new Error('Journeyproof blocks form submission.'); };
    window.open = () => null;
    Object.defineProperty(navigator, 'sendBeacon', { value: () => false, configurable: true });
  });
  await context.route('**/*', async route => {
    const request = route.request();
    try {
      const target = new URL(request.url());
      if (!['http:', 'https:'].includes(target.protocol)) return await route.abort('blockedbyclient');
      const ownOrigin = target.origin === new URL(baseUrl).origin;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        // Navigations that write stop the run; background writes are aborted and timestamped.
        if (request.isNavigationRequest()) blocked.push(`Blocked ${request.method()} navigation: real-site checks are read-only.`);
        else writes.push(Date.now());
        return await route.abort('blockedbyclient');
      }
      if (request.isNavigationRequest() && unsafePath.test(target.pathname)) {
        blocked.push('Blocked navigation to a payment, account or form-submission destination.');
        return await route.abort('blockedbyclient');
      }
      if (demo && ownOrigin && request.isNavigationRequest() && !isLocalDemo(target, baseUrl)) {
        blocked.push('The local demo check cannot navigate to application or API routes.');
        return await route.abort('blockedbyclient');
      }
      if (!(demo && ownOrigin)) {
        const host = target.hostname;
        if (!publicHosts.has(host)) {
          try { await validateTargetUrl(`${target.origin}/`, baseUrl); publicHosts.set(host, true); }
          catch { publicHosts.set(host, false); }
        }
        if (!publicHosts.get(host)) {
          blocked.push('Blocked a request to a private network address.');
          return await route.abort('blockedbyclient');
        }
      }
      return await route.continue();
    } catch { return await route.abort('blockedbyclient'); }
  });
  return { blocked, writes };
}

async function ensureSafeActivation(page: Page, action: Action, demo: boolean): Promise<string | undefined> {
  if (!['Enter', 'Space', 'type'].includes(action.type)) return undefined;
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    const link = el.closest('a');
    const input = el as HTMLInputElement;
    const button = el as HTMLButtonElement;
    return {
      tag: el.tagName.toLowerCase(), type: input.type ?? '',
      name: el.getAttribute('aria-label') || el.textContent || '', href: link?.href,
      inForm: Boolean(el.closest('form')), submit: (el.tagName === 'BUTTON' && button.type !== 'button') || (el.tagName === 'INPUT' && ['submit', 'image'].includes(input.type)),
      editable: el.isContentEditable,
    };
  });
  if (!focused) return undefined;
  if (focused.href) {
    const target = new URL(focused.href);
    if (!['http:', 'https:'].includes(target.protocol) || unsafePath.test(target.pathname)) return 'Stopped before activating an unsafe navigation target.';
  }
  if (focused.inForm && (focused.submit || (action.type === 'Enter' && ['input', 'select', 'textarea'].includes(focused.tag)))) return 'Stopped before submitting a form.';
  if (!demo && unsafeActivation.test(focused.name)) return 'Stopped before a payment, account, reservation or submission action.';
  if (action.type === 'type' && (!['input', 'textarea'].includes(focused.tag) && !focused.editable)) return 'The focused item is not a text field.';
  if (action.type === 'type' && ['password', 'email', 'tel', 'credit-card'].includes(focused.type)) return 'This read-only journey does not enter personal information.';
  return undefined;
}

async function executeAction(page: Page, announcer: Announcer, observation: Observation, action: Action, demo: boolean): Promise<string | undefined> {
  const unsafe = await ensureSafeActivation(page, action, demo);
  if (unsafe) return unsafe;
  if (action.type === 'jump') {
    const target = observation.quickNav.find(item => item.index === action.index);
    if (!target) return 'The requested quick-navigation item is no longer available.';
    await announcer.focus(target);
  } else if (action.type === 'type') {
    await page.keyboard.type(action.text ?? '', { delay: 15 });
  } else if (!['done', 'stuck'].includes(action.type)) {
    await page.keyboard.press(action.type === 'Space' ? 'Space' : action.type);
  }
  await page.waitForTimeout(120);
  return undefined;
}

async function cartEvidence(page: Page): Promise<{ count?: number; added: boolean }> {
  return await page.evaluate(() => {
    const countEl = document.querySelector('[data-cart-count], [data-cart-quantity], .cart-count, #cart-count');
    let count: number | undefined;
    if (countEl) {
      const match = (countEl.getAttribute('data-cart-count') || countEl.textContent || '').match(/\d+/);
      if (match) count = Number(match[0]);
    }
    if (count === undefined) {
      const cart = Array.from(document.querySelectorAll('a,button,[role="button"]')).find(element => /\bcart\b/i.test(element.getAttribute('aria-label') || element.textContent || ''));
      const match = (cart?.getAttribute('aria-label') || cart?.textContent || '').match(/(?:cart\D{0,8}(\d+)|(\d+)\s*(?:items?\s*)?in (?:your )?cart)/i);
      if (match) count = Number(match[1] || match[2]);
    }
    const added = Array.from(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).some(element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && /\badded\b/i.test(element.textContent || '');
    });
    return { count, added };
  });
}

async function missingRequiredTarget(page: Page, observation: Observation): Promise<string | undefined> {
  // Demo instrumentation identifies the required option, but never supplies an action target.
  // Generic pages are checked against their own labelled required size option where available.
  const candidate = await page.evaluate(() => {
    const element = document.querySelector('[data-size="Medium"], [data-size="medium"]');
    if (!element) return null;
    const style = getComputedStyle(element);
    if (element.getClientRects().length === 0 || style.display === 'none' || style.visibility === 'hidden') return null;
    const active = document.activeElement;
    // Only judge once the keyboard user has moved beyond the size picker, so the transcript shows the miss.
    const passed = Boolean(active && active !== document.body && element.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { passed };
  });
  if (!candidate?.passed) return undefined;
  const exposed = observation.nodes.some(node => !node.ignored && interactiveRoles.has(String(node.role?.value)) && /\bmedium\b/i.test(String(node.name?.value)));
  if (!exposed) return 'Keyboard focus moved past the size picker without ever reaching size Medium. It exists visually in the DOM but is absent as a named interactive control in the accessibility tree, so keyboard and screen-reader users cannot select it.';
  return undefined;
}

async function customClickableFindings(page: Page, announcer: Announcer, observation: Observation): Promise<Finding[]> {
  const findings: Finding[] = [];
  const result = await announcer.cdp.send('Runtime.evaluate', { expression: `Array.from(document.querySelectorAll('[onclick], [data-size], div, span')).filter(el => {
    const style = getComputedStyle(el); return el.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden' && (el.hasAttribute('onclick') || el.hasAttribute('data-size') || style.cursor === 'pointer');
  }).slice(0,100)`, returnByValue: false });
  if (!result.result.objectId) return findings;
  const properties = await announcer.cdp.send('Runtime.getProperties', { objectId: result.result.objectId, ownProperties: true });
  const byBackend = new Map(observation.nodes.map(node => [node.backendDOMNodeId, node]));
  for (const property of properties.result) {
    if (!/^\d+$/.test(property.name) || !property.value?.objectId) continue;
    try {
      const listeners = await announcer.cdp.send('DOMDebugger.getEventListeners', { objectId: property.value.objectId });
      if (!listeners.listeners.some(listener => listener.type === 'click')) continue;
      const description = await announcer.cdp.send('DOM.describeNode', { objectId: property.value.objectId });
      const node = byBackend.get(description.node.backendNodeId);
      const role = String(node?.role?.value ?? '');
      const name = String(node?.name?.value ?? '').trim();
      if (interactiveRoles.has(role) && name) continue;
      const detail = await announcer.cdp.send('Runtime.callFunctionOn', {
        objectId: property.value.objectId,
        functionDeclaration: `function() {
          let selector = this.id ? '#' + CSS.escape(this.id) : this.hasAttribute('data-size') ? '[data-size="' + CSS.escape(this.getAttribute('data-size')) + '"]' : this.tagName.toLowerCase();
          return {selector,html:this.outerHTML.slice(0,600)};
        }`, returnByValue: true,
      });
      const value = detail.result.value as { selector: string; html: string };
      findings.push({ id: `clickable-${findings.length + 1}`, rule: 'clickable-no-role-or-name', impact: 'critical', description: `Click handler found by CDP DOMDebugger, but the element ${!interactiveRoles.has(role) ? 'has no interactive accessibility role' : 'has no accessible name'}.`, selector: value.selector, html: value.html, helpUrl: 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html' });
    } catch { /* A dynamic page may remove a candidate while diagnosis runs. */ }
  }
  return findings;
}

async function diagnose(page: Page, announcer: Announcer, observation: Observation): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const scope = await page.evaluate(() => {
      const target = document.querySelector('[data-size="Medium"], [data-size="medium"]') || document.activeElement;
      const region = target?.closest('main,article,section,[role="dialog"]') || document.querySelector('main') || document.body;
      region?.setAttribute('data-journeyproof-diagnosis', 'true');
      return '[data-journeyproof-diagnosis="true"]';
    });
    const result = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    for (const violation of result.violations) {
      for (const [index, node] of violation.nodes.entries()) findings.push({
        id: `${violation.id}-${index + 1}`, rule: violation.id,
        impact: (violation.impact ?? 'moderate') as Finding['impact'],
        description: violation.description,
        selector: node.target.map(target => typeof target === 'string' ? target : target.join(' ')).join(', '),
        html: node.html, helpUrl: violation.helpUrl,
      });
    }
  } catch (error) {
    findings.push({ id: 'diagnosis-unavailable', rule: 'diagnosis-unavailable', impact: 'minor', description: `Scoped axe diagnosis could not finish: ${escapeMessage(error)}`, selector: '', html: '' });
  }
  findings.push(...await customClickableFindings(page, announcer, observation));
  return findings;
}

function recordStep(options: EngineOptions, action: Action, observation: Observation): void {
  const step = {
    index: options.run.steps.length,
    timestamp: new Date().toISOString(), action,
    announcement: observation.announcement, focusKey: observation.focusKey,
    quickNav: observation.quickNav.map(({ index, role, name }) => ({ index, role, name })),
  };
  options.run.steps.push(step);
  options.emit({ type: 'step', data: step });
}

/** All application interactions are keyboard presses, typing, or AX-derived focus moves. */
export async function executeRun(options: EngineOptions): Promise<Run> {
  const { run, emit } = options;
  let browser: Browser | undefined;
  let page: Page | undefined;
  let announcer: Announcer | undefined;
  let observation: Observation | undefined;
  let outcome: Run['status'] | undefined;
  try {
    const target = await validateTargetUrl(run.url, options.baseUrl);
    const demo = isLocalDemo(target, options.baseUrl);
    run.status = 'running';
    emit({ type: 'status', data: run });
    browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block', acceptDownloads: false });
    const guard = await installReadOnlyGuards(context, options.baseUrl, demo);
    const bundleFailure = await installGuidepup(context);
    page = await context.newPage();
    page.setDefaultTimeout(5000);
    page.on('dialog', dialog => { void dialog.dismiss(); });
    page.on('popup', popup => { void popup.close(); });
    await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(250);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Accessibility.enable');
    announcer = new Announcer(page, cdp, bundleFailure);
    const policy = new ActionPolicy();
    const baseline = await cartEvidence(page);
    const heardMenuItems = new Set<string>();
    await page.keyboard.press('Tab');
    observation = await announcer.observe();
    run.announcer = announcer.backend;
    run.llm = policy.source;
    recordStep(options, { type: 'Tab' }, observation);
    emit({ type: 'status', data: run });
    for (let index = 1; index < MAX_STEPS; index++) {
      if (options.signal?.aborted) throw new Error('Run cancelled.');
      if (run.journey === 'add_to_cart' && index >= 2) {
        const absent = await missingRequiredTarget(page, observation);
        if (absent) { run.status = 'stuck'; run.reason = absent; break; }
      }
      const decision = await policy.choose({ goal: run.journey, announcement: observation.announcement, last10: run.steps.slice(-10).map(step => step.announcement), quickNav: observation.quickNav });
      let action = decision.action;
      run.llm = decision.source;
      // A model cannot declare success. Continue reading when its done claim lacks evidence.
      if (action.type === 'done') action = { type: run.journey === 'find_menu' ? 'ArrowDown' : 'Tab', reason: 'Verifying deterministic success evidence.' };
      if (action.type === 'stuck') { run.status = 'stuck'; run.reason = action.reason || 'No accessible action could complete the journey.'; recordStep(options, action, observation); break; }
      const actionStarted = Date.now();
      const safetyStop = await executeAction(page, announcer, observation, action, demo);
      if (safetyStop) { run.status = 'stuck'; run.reason = safetyStop; recordStep(options, { type: 'stuck', reason: safetyStop }, observation); break; }
      observation = await announcer.observe(run.journey === 'find_menu' && action.type === 'ArrowDown');
      run.announcer = announcer.backend;
      recordStep(options, action, observation);
      if (run.journey === 'add_to_cart') {
        const evidence = await cartEvidence(page);
        const changed = baseline.count !== undefined && evidence.count !== undefined && evidence.count > baseline.count;
        const newlyAdded = !baseline.added && evidence.added && /live region:.*\badded\b/i.test(observation.announcement);
        if (changed || newlyAdded) {
          run.status = 'passed';
          run.reason = changed ? `Cart count increased from ${baseline.count} to ${evidence.count}; journey completed without checkout.` : 'A newly updated live region announced that the item was added to cart.';
          break;
        }
      } else {
        if (observation.announcement.startsWith('menu item,')) heardMenuItems.add(observation.announcement);
        if (heardMenuItems.size >= 5) { run.status = 'passed'; run.reason = `${heardMenuItems.size} distinct menu items with prices were announced from the accessibility tree.`; break; }
      }
      if (guard.blocked.length && run.steps.length >= 3) { run.status = 'stuck'; run.reason = guard.blocked.at(-1); break; }
      if (!demo && ['Enter', 'Space', 'type'].includes(action.type) && guard.writes.some(time => time >= actionStarted)) {
        run.status = 'stuck'; run.reason = `The last ${action.type} action tried to send data to the site. Real-site checks are read-only, so the journey stopped there.`; break;
      }
      const loop = detectFocusLoop(run.steps.slice(-10).map(step => step.focusKey));
      if (loop) { run.status = 'stuck'; run.reason = loop; break; }
    }
    if (run.status === 'running') { run.status = 'stuck'; run.reason = `The ${MAX_STEPS}-action limit was reached without deterministic success evidence.`; }
    outcome = run.status;
    // A terminal status means diagnosis and evidence are ready to read.
    run.status = 'running';
    if (outcome === 'stuck' && observation) {
      if (run.steps.length < MAX_STEPS && !run.steps.at(-1)?.action.reason?.includes(run.reason ?? '')) recordStep(options, { type: 'stuck', reason: run.reason }, observation);
      run.findings = await diagnose(page, announcer, observation);
      for (const finding of run.findings) emit({ type: 'finding', data: finding });
    }
  } catch (error) {
    outcome = 'error';
    run.status = 'running';
    run.reason = escapeMessage(error);
    emit({ type: 'error', data: { message: run.reason } });
  } finally {
    if (page) {
      try {
        await mkdir(options.artifactDir, { recursive: true });
        const filename = `${run.id.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
        await page.screenshot({ path: join(options.artifactDir, filename), fullPage: true, animations: 'disabled', timeout: 5000 });
        run.screenshot = `/api/artifacts/${filename}`;
      } catch { /* Preserve the run and diagnosis if a page disappears before capture. */ }
    }
    await browser?.close();
    run.status = outcome ?? 'error';
    run.completedAt = new Date().toISOString();
    emit({ type: 'complete', data: run });
  }
  return run;
}
