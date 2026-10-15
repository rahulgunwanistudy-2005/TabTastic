import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatch, createTwoFilesPatch } from 'diff';
import { solveContrast } from './contrast.js';
import type { Fix } from './types.js';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = resolve(projectRoot, 'demo-store');
const fixedRoot = resolve(projectRoot, 'demo-store-fixed');
const files = ['index.html', 'style.css', 'script.js'] as const;
type SourceFile = typeof files[number];
type Template = Fix & { transform: (source: string) => string };

function replace(source: string, before: string, after: string): string {
  if (!source.includes(before)) throw new Error('Fix template no longer matches its source. Preview the current source before applying.');
  return source.replace(before, after);
}

const templates: Template[] = [
  {
    id: 'size-swatches', rule: 'clickable-div', file: 'index.html', approved: true, requiresApproval: false,
    description: 'Convert all four size swatches to native buttons with size names and pressed states.',
    transform: source => {
      let result = source;
      for (const [size, visible] of [['Small', 'S'], ['Medium', 'M'], ['Large', 'L'], ['Extra large', 'XL']]) {
        result = replace(result, `<div class="size-swatch" data-size="${size}" onclick="selectSize('${size}', this)"><span aria-hidden="true">${visible}</span></div>`, `<button type="button" class="size-swatch" data-size="${size}" aria-label="${size}" aria-pressed="false" onclick="selectSize('${size}', this)"><span aria-hidden="true">${visible}</span></button>`);
      }
      return result;
    },
  },
  {
    id: 'add-button-name', rule: 'button-name', file: 'index.html', approved: false, requiresApproval: true,
    description: 'Owner approval: name the bag icon button “Add to cart”.',
    transform: source => replace(source, 'type="button" data-add-to-cart onclick=', 'type="button" data-add-to-cart aria-label="Add to cart" onclick='),
  },
  {
    id: 'drawer-close-name', rule: 'button-name', file: 'index.html', approved: false, requiresApproval: true,
    description: 'Owner approval: name the drawer’s close icon “Close shopping bag”.',
    transform: source => replace(source, 'class="drawer-close" type="button" onclick=', 'class="drawer-close" type="button" aria-label="Close shopping bag" onclick='),
  },
  {
    id: 'drawer-escape', rule: 'focus-trap', file: 'script.js', approved: true, requiresApproval: false,
    description: 'Let Escape close the bag and restore focus to its opening control.',
    transform: source => replace(source, "  if (event.key !== 'Tab') return;", "  if (event.key === 'Escape') {\n    event.preventDefault();\n    closeCart();\n    return;\n  }\n  if (event.key !== 'Tab') return;"),
  },
  {
    id: 'product-image-alt', rule: 'image-alt', file: 'index.html', approved: false, requiresApproval: true,
    description: 'Owner approval: alt draft “Ivory cotton T-shirt with a round neck and short sleeves, laid flat.”',
    transform: source => replace(source, '<img class="product-image" src="./tee.svg" width=', '<img class="product-image" src="./tee.svg" alt="Ivory cotton T-shirt with a round neck and short sleeves, laid flat." width='),
  },
  {
    id: 'newsletter-label', rule: 'label', file: 'index.html', approved: true, requiresApproval: false,
    description: 'Associate the visible “Your email address” label with the newsletter input.',
    transform: source => replace(source, '<span aria-hidden="true">Your email address</span><input id="newsletter-email"', '<label class="newsletter-label" for="newsletter-email">Your email address</label><input id="newsletter-email"'),
  },
  {
    id: 'price-contrast', rule: 'color-contrast', file: 'style.css', approved: true, requiresApproval: false,
    description: 'Adjust only the price color variable in OKLCH, retaining hue and meeting 4.5:1 contrast.',
    transform: source => replace(source, '--price-color:#9a9a9a;', `--price-color:${solveContrast('#9a9a9a', '#ffffff', 4.5).color};`),
  },
];

/** Guarded template for an owner-approved accessible name, including link-name fixes. */
export function addApprovedName(source: string, openingTag: string, name: string): string {
  if (!/^<(?:a|button)\b/.test(openingTag) || !openingTag.endsWith('>')) throw new Error('Only a button or link opening tag can receive this template.');
  if (!name.trim()) throw new Error('An approved accessible name must not be empty.');
  const escaped = name.trim().replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return replace(source, openingTag, openingTag.slice(0, -1) + ` aria-label="${escaped}">`);
}

export function applyUnifiedDiff(original: string, patch: string): string {
  const result = applyPatch(original, patch, { fuzzFactor: 0 });
  if (result === false) throw new Error('The patch does not match the source; nothing was applied.');
  return result;
}

async function buildPatches(approvedIds?: string[]) {
  const selected = templates.filter(template => approvedIds === undefined || !template.requiresApproval || approvedIds.includes(template.id));
  const patches: { file: SourceFile; original: string; patch: string }[] = [];
  for (const file of files) {
    const original = await readFile(resolve(sourceRoot, file), 'utf8');
    const transformed = selected.filter(template => template.file === file).reduce((source, template) => template.transform(source), original);
    if (transformed === original) continue;
    const patch = createTwoFilesPatch(`a/demo-store/${file}`, `b/demo-store/${file}`, original, transformed, '', '', { context: 3 });
    patches.push({ file, original, patch });
  }
  return patches;
}

export async function previewFixes(): Promise<{ diff: string; fixes: Fix[] }> {
  const patches = await buildPatches();
  return {
    diff: patches.map(({ patch }) => patch).join('\n'),
    fixes: templates.map(({ transform: _transform, ...fix }) => ({ ...fix })),
  };
}

export async function applyFixes(approvedIds: string[]): Promise<void> {
  const unknown = approvedIds.filter(id => !templates.some(template => template.id === id));
  if (unknown.length) throw new Error(`Unknown fix ids: ${unknown.join(', ')}`);
  const patches = await buildPatches(approvedIds);
  // Validate every hunk before writing any output, then preserve the original store.
  const output = patches.map(({ file, original, patch }) => ({ file, content: applyUnifiedDiff(original, patch) }));
  await mkdir(fixedRoot, { recursive: true });
  await cp(sourceRoot, fixedRoot, { recursive: true });
  for (const { file, content } of output) await writeFile(resolve(fixedRoot, file), content, 'utf8');
}
