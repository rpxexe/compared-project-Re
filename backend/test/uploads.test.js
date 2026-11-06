const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { startServer, models } = require('./helpers/harness');
const { UPLOAD_DIR } = require('../src/routes/uploads');
const { uploadedFiles } = require('../src/utils/listingCleanup');

// 1x1 PNG with a transparent pixel (built in before()).
let PNG;

let t; let user; let other; const created = [];
test.before(async () => {
  PNG = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  t = await startServer();
  user = await t.login('9833333333');
  other = await t.login('9833333334');
});
test.after(async () => {
  for (const f of created) await fs.promises.unlink(path.join(UPLOAD_DIR, f)).catch(() => {});
  await t.close();
});

function send(bytes, type, { token = user.token, field = 'image', filename = 'photo' } = {}) {
  const form = new FormData();
  form.append(field, new Blob([bytes], { type }), filename);
  return fetch(`${t.base}/uploads`, { method: 'POST', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then(async (res) => ({ status: res.status, body: await res.json() }));
}
const nameOf = (url) => url.split('/uploads/')[1];
const fileCount = () => (fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR).length : 0);

// A camera-style JPEG: 40x20 pixels stored sideways (EXIF orientation 6), with maker, owner and
// GPS position tags.
async function cameraJpeg() {
  return sharp({ create: { width: 40, height: 20, channels: 3, background: '#cc0000' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'SpyPhone', Model: 'X1', Copyright: 'secret-owner' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '19/1 4/1 3000/100', GPSLongitudeRef: 'E', GPSLongitude: '72/1 52/1 0/1' },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}
// GPS IFD pointer tag 0x8825, in either byte order.
const hasGpsIfd = (exif) => exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]));

test('upload needs a signed-in user', async () => {
  assert.equal((await send(PNG, 'image/png', { token: null })).status, 401);
});

test('uploads are re-encoded to a metadata-free JPEG: EXIF and GPS removed, orientation applied', async () => {
  const original = await cameraJpeg();
  const before = await sharp(original).metadata();
  assert.ok(before.exif && hasGpsIfd(before.exif), 'fixture carries EXIF with a GPS block');
  assert.ok(original.includes(Buffer.from('SpyPhone')));

  const r = await send(original, 'image/jpeg', { filename: '../../../evil.php' });
  assert.equal(r.status, 201);
  const name = nameOf(r.body.url);
  created.push(name);
  assert.match(name, /^[0-9a-f-]{36}\.jpg$/, 'random name, never the client file name');

  const served = await fetch(r.body.url);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');
  const bytes = Buffer.from(await served.arrayBuffer());
  const after = await sharp(bytes).metadata();
  assert.equal(after.format, 'jpeg');
  assert.equal(after.exif, undefined, 'no EXIF (so no GPS position)');
  assert.equal(after.xmp, undefined);
  assert.equal(after.iptc, undefined);
  assert.equal(after.orientation, undefined);
  assert.deepEqual([after.width, after.height], [20, 40], 'rotated upright before the orientation tag was dropped');
  assert.ok(!bytes.includes(Buffer.from('SpyPhone')) && !bytes.includes(Buffer.from('secret-owner')));
  assert.notDeepEqual(bytes, original);
});

test('PNG and WebP uploads are normalised to JPEG too', async () => {
  const r = await send(PNG, 'image/png');
  assert.equal(r.status, 201);
  const name = nameOf(r.body.url);
  created.push(name);
  assert.match(name, /^[0-9a-f-]{36}\.jpg$/);
  const meta = await sharp(path.join(UPLOAD_DIR, name)).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 1, 1]);

  const webp = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#00f' } }).webp().toBuffer();
  const w = await send(webp, 'image/webp');
  assert.equal(w.status, 201);
  created.push(nameOf(w.body.url));
  assert.equal((await sharp(path.join(UPLOAD_DIR, nameOf(w.body.url))).metadata()).format, 'jpeg');
});

test('non-images, files lying about their type and corrupt images are rejected and not kept', async () => {
  const before = fileCount();
  assert.equal((await send(Buffer.from('<svg/>'), 'image/svg+xml')).status, 400);
  assert.equal((await send(Buffer.from('<script>alert(1)</script>'), 'image/png')).status, 400);
  // Right magic bytes, garbage after them.
  assert.equal((await send(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]), 'image/jpeg')).status, 400);
  // A real PNG sent as "image/jpeg".
  assert.equal((await send(PNG, 'image/jpeg')).status, 400);
  assert.equal((await send(PNG, 'image/png', { field: 'other' })).status, 400);
  assert.equal(fileCount(), before);
});

test('deleting a listing deletes its uploaded photos (but never one another listing uses)', async () => {
  const upload = async () => { const r = await send(PNG, 'image/png'); created.push(nameOf(r.body.url)); return r.body.url; };
  const [own, shared] = [await upload(), await upload()];
  const post = { title: 'Photo Flat', city: 'Pune', locality: 'Baner', propertyType: 'Flats/Apartments', bhk: '2', price: '9000000', area: '900', description: 'A flat with real photos.', images: [own, shared] };
  const mine = await t.call('POST', '/post-property', { token: user.token, body: post });
  assert.equal(mine.status, 201);
  // Someone else's listing pointing at one of the same files (URLs are just strings).
  const copy = await t.call('POST', '/post-property', { token: other.token, body: { ...post, images: [shared.replace('127.0.0.1', 'localhost')] } });
  assert.equal(copy.status, 201);
  assert.deepEqual(uploadedFiles(models.Property._rows.find((p) => String(p._id) === mine.body.property.id)).sort(), [nameOf(own), nameOf(shared)].sort());

  // A file that is already gone must not break the deletion.
  const gone = await upload();
  const third = await t.call('POST', '/post-property', { token: user.token, body: { ...post, images: [gone] } });
  fs.unlinkSync(path.join(UPLOAD_DIR, nameOf(gone)));

  assert.equal((await t.call('DELETE', `/users/me/properties/${mine.body.property.id}`, { token: user.token })).status, 200);
  assert.equal(fs.existsSync(path.join(UPLOAD_DIR, nameOf(own))), false, 'own photo deleted');
  assert.equal(fs.existsSync(path.join(UPLOAD_DIR, nameOf(shared))), true, 'photo used by another listing kept');
  assert.equal((await t.call('DELETE', `/users/me/properties/${third.body.property.id}`, { token: user.token })).status, 200);
  assert.equal(models.Property._rows.some((p) => String(p._id) === third.body.property.id), false);
});

test('listing cleanup only ever touches this API\'s own upload file names', () => {
  const doc = {
    coverImage: { url: 'https://api.test/uploads/11111111-2222-3333-4444-555555555555.jpg' },
    galleryImages: [
      'https://api.test/uploads/../../src/server.js',
      'https://api.test/uploads/%2e%2e%2fpackage.json',
      'https://cdn.test/other/66666666-7777-8888-9999-000000000000.jpg',
      'https://api.test/uploads/66666666-7777-8888-9999-000000000000.png',
      'javascript:alert(1)',
    ],
  };
  assert.deepEqual(uploadedFiles(doc).sort(), ['11111111-2222-3333-4444-555555555555.jpg', '66666666-7777-8888-9999-000000000000.png']);
});
