import test from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, oklchToRgb, rgbToOklch, solveContrast } from '../runner/src/contrast.js';

test('contrast uses WCAG relative luminance, including the planted 2.8:1 price', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.equal(contrastRatio('#fff', '#fff'), 1);
  assert.ok(Math.abs(contrastRatio('#9a9a9a', '#fff') - 2.8139) < 0.001);
});

test('price solver reaches 4.5:1 with the closest lightness and unchanged hue', () => {
  const solution = solveContrast('#9a9a9a', '#fff');
  const original = rgbToOklch({ r: 154 / 255, g: 154 / 255, b: 154 / 255 });
  assert.ok(solution.ratio >= 4.5);
  assert.ok(solution.ratio < 4.5001);
  assert.equal(solution.oklch.h, original.h);
  assert.equal(solution.oklch.c, original.c);
  assert.ok(contrastRatio(oklchToRgb({ ...solution.oklch, l: solution.oklch.l + 0.00001 }), '#fff') < 4.5);
});

test('colored fixes preserve the brand hue and can lighten on a dark background', () => {
  const solution = solveContrast('#655267', '#141414');
  const original = rgbToOklch({ r: 101 / 255, g: 82 / 255, b: 103 / 255 });
  assert.ok(solution.ratio >= 4.5);
  assert.ok(solution.oklch.l > original.l);
  assert.equal(solution.oklch.h, original.h);
  assert.ok(Math.abs(solution.oklch.c - original.c) < 0.000001);
});

test('an adequate color is kept verbatim and invalid targets are rejected', () => {
  assert.equal(solveContrast('#123456', '#fff').color, '#123456');
  assert.equal(solveContrast('#123456', '#fff').lightnessDelta, 0);
  assert.throws(() => solveContrast('#aaa', '#fff', 22), /between 1 and 21/);
});
