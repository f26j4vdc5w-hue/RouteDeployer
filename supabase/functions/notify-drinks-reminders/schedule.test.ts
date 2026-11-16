import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { reminderDate } from './schedule';

test('reminder window follows Berlin winter and summer time', () => {
  assert.equal(reminderDate(new Date('2026-01-06T20:00:00Z')), '2026-01-06');
  assert.equal(reminderDate(new Date('2026-01-06T19:00:00Z')), null);
  assert.equal(reminderDate(new Date('2026-07-07T19:00:00Z')), '2026-07-07');
  assert.equal(reminderDate(new Date('2026-07-07T20:00:00Z')), null);
  assert.equal(reminderDate(new Date('2026-07-08T19:00:00Z')), null);
});
