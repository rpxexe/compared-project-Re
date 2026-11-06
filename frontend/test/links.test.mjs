import test from 'node:test';
import assert from 'node:assert/strict';
import { safeExternalUrl, isSafeExternalUrl, openExternal } from '../src/utils/links.js';

const SAFE = [
  'https://example.com',
  'https://example.com/brochure.pdf',
  'https://www.google.com/maps/search/?api=1&query=Baner%2C%20Pune',
  'HTTPS://Tour.Example.com:8443/v/1#start',
  ' https://cdn.example.com/a.pdf ',
];

const UNSAFE = [
  'http://example.com/brochure.pdf',
  'upi://pay?pa=fraud@bank&am=50000',
  'tel:+919999999999',
  'sms:+919999999999',
  'mailto:a@b.co',
  'javascript:alert(1)',
  'JavaScript:alert(1)',
  'file:///sdcard/Download/a.pdf',
  'intent://scan/#Intent;scheme=zxing;package=com.evil;end',
  'content://com.android.contacts/contacts',
  'myapp://open/payment',
  'data:text/html,<script>alert(1)</script>',
  'https:example.com',
  'https:/example.com',
  '//example.com/a',
  'https://user:pass@example.com/',
  'https://good.com@evil.com/',
  'https://exa mple.com/',
  'https://example.com/\nheader',
  'https://example.com\\@evil.com',
  'https://',
  'not a url',
  '',
  null,
  undefined,
  42,
  { url: 'https://example.com' },
  `https://example.com/${'a'.repeat(3000)}`,
];

test('links: only absolute https:// web addresses are considered safe', () => {
  for (const url of SAFE) assert.equal(isSafeExternalUrl(url), true, String(url));
  for (const url of UNSAFE) assert.equal(isSafeExternalUrl(url), false, JSON.stringify(url));
  assert.equal(safeExternalUrl(' https://cdn.example.com/a.pdf '), 'https://cdn.example.com/a.pdf');
});

test('openExternal: safe links are opened, everything else is refused without reaching the OS', async () => {
  const opened = [];
  const errors = [];
  const opener = async (url) => { opened.push(url); };
  const onError = (m) => errors.push(m);

  assert.equal(await openExternal('https://example.com/brochure.pdf', { opener, onError }), true);
  for (const url of UNSAFE) assert.equal(await openExternal(url, { opener, onError }), false, JSON.stringify(url));

  assert.deepEqual(opened, ['https://example.com/brochure.pdf']);
  assert.equal(errors.length, UNSAFE.length);
  assert.ok(errors.every((m) => m === "This link can't be opened."));
});

test('openExternal: an OS failure is reported, not thrown', async () => {
  const errors = [];
  const ok = await openExternal('https://example.com', { opener: async () => { throw new Error('no browser'); }, onError: (m) => errors.push(m) });
  assert.equal(ok, false);
  assert.deepEqual(errors, ['Could not open this link']);
});
