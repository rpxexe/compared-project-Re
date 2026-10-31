const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer } = require('./helpers/harness');
const { UPLOAD_DIR } = require('../src/routes/uploads');

// Smallest valid PNG (1x1, transparent).
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082', 'hex');

let t; let user; const created = [];
test.before(async () => { t = await startServer(); user = await t.login('9833333333'); });
test.after(async () => {
  for (const f of created) await fs.promises.unlink(path.join(UPLOAD_DIR, f)).catch(() => {});
  await t.close();
});

function send(bytes, type, { token = user.token, field = 'image' } = {}) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), 'photo');
  return fetch(`${t.base}/uploads`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(async (res) => ({ status: res.status, body: await res.json() }));
}

test('upload needs a signed-in user', async () => {
  assert.equal((await send(PNG, 'image/png', { token: null })).status, 401);
});

test('a real PNG is stored and served back as an image', async () => {
  const r = await send(PNG, 'image/png');
  assert.equal(r.status, 201);
  const name = r.body.url.split('/uploads/')[1];
  assert.match(name, /^[0-9a-f-]{36}\.png$/);
  created.push(name);
  const img = await fetch(r.body.url);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), PNG);
});

test('non-images and files lying about their type are rejected and not kept', async () => {
  const before = fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0;
  assert.equal((await send(Buffer.from('<svg/>'), 'image/svg+xml')).status, 400);
  const fake = await send(Buffer.from('<script>alert(1)</script>'), 'image/png');
  assert.equal(fake.status, 400);
  assert.equal(fs.readdirSync(UPLOAD_DIR).length, before);
  assert.equal((await send(PNG, 'image/png', { field: 'other' })).status, 400);
});
