import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readAllPages } from './readAllPages';

test('reads every row even when the server enforces a smaller page limit', async () => {
  const rows = Array.from({ length: 1201 }, (_, index) => index);
  const loaded = await readAllPages(async (from, to) => ({
    data: rows.slice(from, Math.min(to + 1, from + 137)),
    count: rows.length,
  }));
  assert.deepEqual(loaded, rows);
});

test('does not silently accept incomplete pagination', async () => {
  await assert.rejects(() => readAllPages(async () => ({ data: [], count: null })), /nicht vollständig/);
  await assert.rejects(() => readAllPages(async () => ({ data: [], count: 1 })), /nicht vollständig/);
});
