import test from 'node:test';
import assert from 'node:assert/strict';
import { createTwoFilesPatch } from 'diff';
import { addApprovedName, applyUnifiedDiff, previewFixes } from '../runner/src/fixes.js';

test('unified diff applies an exact hunk and preserves unrelated content', () => {
  const original = '<main>\n<button>Buy</button>\n<p>Shipping is free.</p>\n</main>\n';
  const fixed = original.replace('<button>', '<button aria-label="Add to cart">');
  const patch = createTwoFilesPatch('a/index.html', 'b/index.html', original, fixed);
  assert.equal(applyUnifiedDiff(original, patch), fixed);
  assert.throws(() => applyUnifiedDiff(original.replace('Buy', 'Subscribe'), patch), /does not match/);
});

test('accessible name template supports links and escapes approved text', () => {
  assert.equal(addApprovedName('<a href="/menu"><svg></svg></a>', '<a href="/menu">', 'Menu & hours'), '<a href="/menu" aria-label="Menu &amp; hours"><svg></svg></a>');
  assert.throws(() => addApprovedName('<div></div>', '<div>', 'Menu'), /button or link/);
  assert.throws(() => addApprovedName('<button></button>', '<button>', ' '), /must not be empty/);
});

test('preview is deterministic and explicitly gates drafted names and image alt', async () => {
  const first = await previewFixes();
  const second = await previewFixes();
  assert.equal(first.diff, second.diff);
  assert.ok(first.diff.includes('--- a/demo-store/index.html'));
  assert.ok(first.diff.includes('+          <button type="button" class="size-swatch" data-size="Medium" aria-label="Medium" aria-pressed="false"'));
  assert.ok(first.diff.includes('--price-color:oklch('));
  assert.ok(first.diff.includes("+  if (event.key === 'Escape')"));
  assert.deepEqual(first.fixes.filter(fix => fix.requiresApproval).map(fix => fix.id), ['add-button-name', 'drawer-close-name', 'product-image-alt']);
  assert.ok(first.fixes.filter(fix => fix.requiresApproval).every(fix => fix.approved === false));
});
