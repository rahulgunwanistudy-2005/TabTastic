import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFocusLoop, formatAnnouncement } from '../runner/src/announcer.js';
import { isPrivateAddress, validateTargetUrl } from '../runner/src/engine.js';
import { deterministicAction, parseAction } from '../runner/src/policy.js';

test('announcer uses accessible role, name and state without inventing a name', () => {
  assert.equal(formatAnnouncement({ nodeId: '1', role: { value: 'button' }, name: { value: 'Medium' }, properties: [{ name: 'pressed', value: { value: true } }] }), 'button, Medium, pressed');
  assert.equal(formatAnnouncement({ nodeId: '2', role: { value: 'button' }, name: { value: '' } }), 'button, unnamed');
  assert.equal(formatAnnouncement({ nodeId: '3', role: { value: 'heading' }, name: { value: 'The menu' }, properties: [{ name: 'level', value: { value: 1 } }] }), 'heading, The menu, level 1');
  assert.equal(formatAnnouncement({ nodeId: '4', role: { value: 'checkbox' }, name: { value: 'Updates' }, properties: [{ name: 'checked', value: { value: false } }] }), 'checkbox, Updates, not checked');
});

test('stuck detector catches four unchanged actions and short repeating cycles', () => {
  assert.match(detectFocusLoop(['x', 'x', 'x', 'x', 'x'])!, /four actions/);
  assert.match(detectFocusLoop(['a', 'b', 'a', 'b', 'a', 'b'])!, /cycle of 2/);
  assert.match(detectFocusLoop(['a', 'b', 'c', 'a', 'b', 'c', 'a', 'b', 'c'])!, /cycle of 3/);
  assert.equal(detectFocusLoop(['a', 'b', 'b', 'c', 'd']), undefined);
});

test('model output accepts only the fixed action set and bounded indices', () => {
  assert.deepEqual(parseAction('{"type":"jump","index":3}'), { type: 'jump', index: 3 });
  assert.throws(() => parseAction('{"type":"click","selector":"button"}'));
  assert.throws(() => parseAction('{"type":"jump","index":0}'));
  assert.throws(() => parseAction('{"type":"type","text":42}'));
});

test('keyboard policy selects Medium before adding an item', () => {
  const quickNav = [{ index: 1, role: 'button', name: 'Medium' }, { index: 2, role: 'button', name: 'Add to cart' }];
  assert.deepEqual(deterministicAction({ goal: 'add_to_cart', announcement: 'document', last10: [], quickNav }), { type: 'jump', index: 1 });
  assert.deepEqual(deterministicAction({ goal: 'add_to_cart', announcement: 'button, Medium', last10: [], quickNav }), { type: 'Enter' });
  assert.deepEqual(deterministicAction({ goal: 'add_to_cart', announcement: 'button, Medium, pressed', last10: ['button, Medium, pressed'], quickNav }), { type: 'jump', index: 2 });
});

test('URL checks reject non-public destinations and checkout paths', async () => {
  const base = 'http://127.0.0.1:3001';
  assert.equal((await validateTargetUrl(`${base}/demo-store/`, base)).pathname, '/demo-store/');
  for (const url of ['file:///etc/passwd', 'http://localhost:8080/', 'http://127.0.0.1:9999/', 'http://10.0.0.1/', 'http://169.254.169.254/', 'http://[::1]/', 'https://example.com/checkout', 'https://name:secret@example.com/']) await assert.rejects(validateTargetUrl(url, base));
  for (const address of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.31.0.1', '169.254.169.254', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1']) assert.equal(isPrivateAddress(address), true);
  await assert.rejects(validateTargetUrl('http://[::ffff:7f00:1]:9999/', base));
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});
