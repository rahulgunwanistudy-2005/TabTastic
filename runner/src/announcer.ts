import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { BrowserContext, CDPSession, Page } from 'playwright';

export type AXNode = {
  nodeId: string;
  ignored?: boolean;
  backendDOMNodeId?: number;
  parentId?: string;
  childIds?: string[];
  role?: { value?: unknown };
  name?: { value?: unknown };
  value?: { value?: unknown };
  properties?: { name: string; value: { value?: unknown } }[];
};
export type NavItem = { index: number; role: string; name: string; backendId: number };
export type Observation = {
  announcement: string;
  focusKey: string;
  focused?: AXNode;
  nodes: AXNode[];
  quickNav: NavItem[];
  menuReadouts: string[];
};

const navRoles = new Set(['heading', 'button', 'link', 'textbox', 'searchbox', 'combobox', 'checkbox', 'radio', 'slider', 'spinbutton', 'menuitem', 'tab']);
const pricePattern = /(?:[$€£₹]\s?\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s?(?:USD|EUR|GBP|INR))/i;
const textOf = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

/** CDP-backed phrases are simulations, never recordings of a real screen reader. */
export function formatAnnouncement(node?: AXNode): string {
  if (!node) return 'document, no element focused';
  const role = textOf(node.role?.value) || 'generic';
  const name = textOf(node.name?.value);
  const parts = [role === 'RootWebArea' ? 'document' : role];
  if (name) parts.push(name);
  else if (navRoles.has(role) && role !== 'heading') parts.push('unnamed');
  const properties = new Map(node.properties?.map(p => [p.name, p.value.value]) ?? []);
  for (const state of ['disabled', 'required', 'selected', 'expanded', 'pressed', 'checked', 'invalid']) {
    const value = properties.get(state);
    if (value === true || value === 'true') parts.push(state);
    else if (value === 'mixed') parts.push(`${state}, mixed`);
    else if ((state === 'expanded' || state === 'pressed' || state === 'checked') && value === false) {
      parts.push(state === 'expanded' ? 'collapsed' : `not ${state}`);
    }
  }
  const level = properties.get('level');
  if (role === 'heading' && level) parts.push(`level ${level}`);
  const value = textOf(node.value?.value);
  if (value && value !== name) parts.push(value);
  return parts.join(', ');
}

export function detectFocusLoop(keys: string[]): string | undefined {
  if (keys.length >= 5 && new Set(keys.slice(-5)).size === 1) return 'Focus did not change for four actions.';
  // Three repetitions keep an ordinary back-and-forth size selection from being a loop.
  for (let period = 2; period <= 3; period++) {
    if (keys.length < period * 3) continue;
    const tail = keys.slice(-period * 3);
    if (tail.every((key, index) => key === tail[index % period])) return `Focus is trapped in a repeating cycle of ${period} elements.`;
  }
  return undefined;
}

function menuReadouts(nodes: AXNode[]): string[] {
  const byId = new Map(nodes.map(node => [node.nodeId, node]));
  const subtree = (node: AXNode, depth = 0): string => {
    if (depth > 10) return '';
    if (node.ignored) return (node.childIds ?? []).map(id => byId.get(id)).filter(Boolean).map(child => subtree(child!, depth + 1)).join(' ');
    const children = (node.childIds ?? []).map(id => byId.get(id)).filter(Boolean);
    const name = textOf(node.name?.value);
    const childText = children.map(child => subtree(child!, depth + 1)).filter(Boolean).join(' ');
    return childText || name;
  };
  const items = nodes.filter(node => !node.ignored && ['listitem', 'article', 'row'].includes(textOf(node.role?.value)))
    .map(node => textOf(subtree(node))).filter(text => text.length < 500 && pricePattern.test(text));
  if (items.length >= 5) return [...new Set(items)];
  // Some menus have no list markup. Pair nearby exposed text nodes, never hidden DOM text.
  const staticText = nodes.filter(node => !node.ignored && textOf(node.role?.value) === 'StaticText')
    .map(node => textOf(node.name?.value)).filter(Boolean);
  for (let index = 0; index < staticText.length; index++) {
    if (!pricePattern.test(staticText[index])) continue;
    const current = staticText[index];
    const previous = staticText[index - 1];
    const label = /[a-z]/i.test(current.replace(pricePattern, '')) ? current : previous && !pricePattern.test(previous) ? `${previous}, ${current}` : current;
    if (/[a-z]/i.test(label.replace(pricePattern, ''))) items.push(label);
  }
  return [...new Set(items)];
}

/** Install only the local bundle; navigation never downloads executable reader code. */
export async function installGuidepup(context: BrowserContext): Promise<string | undefined> {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve('@guidepup/virtual-screen-reader');
    const candidates = [join(dirname(entry), '../esm/index.browser.js'), join(dirname(entry), 'index.browser.js')];
    let source = '';
    for (const candidate of candidates) {
      try { source = await readFile(candidate, 'utf8'); break; } catch { /* Try the next package layout. */ }
    }
    if (!source) return 'installed package has no browser bundle';
    if (/^\s*import\s/m.test(source)) return 'browser entry requires a bundler';
    source = source.replace(/export\s*\{([^}]+)\};?/g, (_match, names: string) => {
      const name = names.split(',').map(value => value.trim()).find(value => /\bvirtual\b/.test(value));
      if (!name) return '';
      return `globalThis.__journeyVirtual = ${name.split(/\s+as\s+/)[0]};`;
    });
    await context.addInitScript({ content: `(() => {${source}\n;globalThis.__journeyGuidepupInjected = true;})();` });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : 'bundle unavailable';
  }
}

export class Announcer {
  readonly cdp: CDPSession;
  backend: string;
  private guidepupDisabled = false;
  private readonly seenLive = new Map<string, string>();
  private readIndex = 0;
  constructor(private readonly page: Page, cdp: CDPSession, bundleFailure?: string) {
    this.cdp = cdp;
    this.backend = `CDP accessibility tree simulation${bundleFailure ? ` (Guidepup: ${bundleFailure})` : ''}`;
    this.guidepupDisabled = Boolean(bundleFailure);
  }

  async observe(readNext = false): Promise<Observation> {
    const { nodes } = await this.cdp.send('Accessibility.getFullAXTree') as { nodes: AXNode[] };
    const focused = nodes.find(node => !node.ignored && textOf(node.role?.value) !== 'RootWebArea' && node.properties?.some(property => property.name === 'focused' && property.value.value === true))
      ?? nodes.find(node => textOf(node.role?.value) === 'RootWebArea');
    const quickNav: NavItem[] = nodes.filter(node => !node.ignored && node.backendDOMNodeId && navRoles.has(textOf(node.role?.value)))
      .slice(0, 120).map((node, index) => ({ index: index + 1, role: textOf(node.role?.value), name: textOf(node.name?.value), backendId: node.backendDOMNodeId! }));
    const readouts = menuReadouts(nodes);
    let announcement = formatAnnouncement(focused);
    let focusKey = String(focused?.backendDOMNodeId ?? focused?.nodeId ?? 'document');
    if (readNext && readouts.length) {
      const index = this.readIndex++ % readouts.length;
      announcement = `menu item, ${readouts[index]}`;
      focusKey = `reading-menu-${index}`;
      this.backend = 'CDP accessibility tree simulation (menu item reading; keyboard-focus announcements use Guidepup when available)';
    } else if (!this.guidepupDisabled && focused?.backendDOMNodeId) {
      const phrase = await this.guidepupFocusedPhrase(focused.backendDOMNodeId);
      if (phrase) {
        const state = (focused.properties ?? []).filter(property => ['pressed', 'checked', 'selected', 'expanded', 'disabled', 'required'].includes(property.name) && property.value.value === true)
          .map(property => property.name).filter(value => !phrase.toLowerCase().includes(value));
        announcement = [phrase, ...state].join(', ');
        this.backend = 'Guidepup virtual screen reader (CDP accessibility state and quick navigation)';
      }
    }
    for (const node of nodes) {
      if (node.ignored || !node.properties?.some(property => property.name === 'live' && property.value.value !== 'off')) continue;
      const key = String(node.backendDOMNodeId ?? node.nodeId);
      const descendants = nodes.filter(child => child.parentId === node.nodeId);
      const text = textOf(node.name?.value) || descendants.map(child => textOf(child.name?.value)).filter(Boolean).join(' ');
      if (text && text !== this.seenLive.get(key)) announcement += `; live region: ${text}`;
      this.seenLive.set(key, text);
    }
    return { announcement, focusKey, focused, nodes, quickNav, menuReadouts: readouts };
  }

  private async guidepupFocusedPhrase(backendId: number): Promise<string | undefined> {
    try {
      const resolved = await this.cdp.send('DOM.resolveNode', { backendNodeId: backendId });
      const result = await this.cdp.send('Runtime.callFunctionOn', {
        objectId: resolved.object.objectId,
        functionDeclaration: `async function() {
          const reader = globalThis.__journeyVirtual;
          if (!reader || !document.body) return null;
          try { await reader.stop(); } catch {}
          await reader.start({container: document.body});
          for (let index = 0; index < 160; index++) {
            if (reader.activeNode === this) return await reader.lastSpokenPhrase();
            await reader.next();
            if (await reader.lastSpokenPhrase() === 'end of document') break;
          }
          return null;
        }`,
        awaitPromise: true, returnByValue: true,
      });
      if (result.exceptionDetails || typeof result.result.value !== 'string') {
        this.guidepupDisabled = true;
        this.backend = 'CDP accessibility tree simulation (Guidepup could not align its virtual cursor with keyboard focus)';
        return undefined;
      }
      return result.result.value;
    } catch {
      this.guidepupDisabled = true;
      this.backend = 'CDP accessibility tree simulation (Guidepup browser initialization unavailable)';
      return undefined;
    }
  }

  async focus(item: NavItem): Promise<void> {
    const resolved = await this.cdp.send('DOM.resolveNode', { backendNodeId: item.backendId });
    await this.cdp.send('Runtime.callFunctionOn', {
      objectId: resolved.object.objectId,
      functionDeclaration: `function() {
        if (typeof this.focus !== 'function') return;
        const needsTabindex = !this.matches('a[href],button,input,select,textarea,[tabindex]');
        if (needsTabindex) this.setAttribute('tabindex', '-1');
        this.focus({preventScroll: false});
      }`,
    });
  }
}
