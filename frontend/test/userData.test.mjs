import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { userDataKeys, DEVICE_KEYS } from '../src/utils/userData.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

// Every "cp_..." storage key (or key prefix) written anywhere in the app source.
function keysInSource(dir = SRC, out = new Set()) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) keysInSource(file, out);
    else if (file.endsWith('.js')) for (const m of fs.readFileSync(file, 'utf8').matchAll(/["'](cp_[a-z0-9_]+)["']/g)) out.add(m[1]);
  }
  return out;
}

test('sign-out clears every user-specific cp_* key', () => {
  const personal = [
    'cp_token', 'cp_user', 'cp_is_guest', 'cp_compare_ids', 'cp_search_history', 'cp_view_history',
    'cp_compare_history', 'cp_recent_locations', 'cp_city', 'cp_exact_location', 'cp_location_title',
    'cp_city_choice', 'cp_filters_context', 'cp_filters_buy_residential', 'cp_filters_rent_residential', 'cp_intent',
  ];
  assert.deepEqual(userDataKeys([...personal, ...DEVICE_KEYS, 'other_lib_key', 'RCTAsyncStorage']), personal);
});

test('every cp_* key used in the app is either cleared on sign-out or an explicit device key', () => {
  const found = [...keysInSource()];
  assert.ok(found.length >= 15, `found ${found.length} keys`);
  const kept = found.filter((k) => !userDataKeys([k]).length);
  assert.deepEqual(kept.sort(), [...DEVICE_KEYS].sort(), 'only device-level keys survive sign-out');
  for (const k of ['cp_search_history', 'cp_compare_history', 'cp_recent_locations', 'cp_exact_location', 'cp_compare_ids', 'cp_filters_']) {
    assert.ok(found.includes(k), `${k} is still used`);
    assert.equal(userDataKeys([k]).length, 1, `${k} is cleared`);
  }
});

test('userDataKeys tolerates bad input', () => {
  assert.deepEqual(userDataKeys(null), []);
  assert.deepEqual(userDataKeys([null, 3, 'cp_city']), ['cp_city']);
});
