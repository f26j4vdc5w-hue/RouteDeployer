import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { deliverReminders, handleReminderRequest, type PushSubscription } from './handler';

const validTime = new Date('2026-07-07T19:00:00Z');

test('only authenticated scheduled requests dispatch reminders', async () => {
  const dates: string[] = [];
  const options = { secret: 'secret', now: validTime, run: async (date: string) => { dates.push(date); return 0; }, log: () => {} };
  assert.equal((await handleReminderRequest(new Request('https://example.test', { method: 'POST' }), options)).status, 401);
  assert.equal((await handleReminderRequest(new Request('https://example.test', { headers: { 'x-reminder-secret': 'secret' } }), options)).status, 405);
  const request = () => new Request('https://example.test', { method: 'POST', headers: { 'x-reminder-secret': 'secret' } });
  assert.equal((await handleReminderRequest(request(), { ...options, now: new Date('2026-07-07T20:00:00Z') })).status, 200);
  assert.deepEqual(dates, []);
  assert.equal((await handleReminderRequest(request(), options)).status, 200);
  assert.deepEqual(dates, ['2026-07-07']);
  assert.equal((await handleReminderRequest(request(), { ...options, run: async () => 1 })).status, 500);
  assert.equal((await handleReminderRequest(request(), { ...options, run: async () => { throw new Error('failed'); } })).status, 500);
});

test('removes expired subscriptions and reports other delivery failures', async () => {
  const subscriptions: PushSubscription[] = ['ok', 'expired', 'failed', 'cannot-remove'].map((endpoint) => ({ endpoint, p256dh: 'key', auth: 'auth' }));
  const removed: string[] = [];
  const logs: string[] = [];
  const failures = await deliverReminders('2026-07-07', {
    claim: async () => subscriptions,
    send: async ({ endpoint }) => {
      if (endpoint === 'expired' || endpoint === 'cannot-remove') throw { statusCode: 410 };
      if (endpoint === 'failed') throw { statusCode: 503 };
    },
    remove: async (endpoint) => { if (endpoint === 'cannot-remove') throw new Error('failed'); removed.push(endpoint); },
    log: (message) => logs.push(message),
  });
  assert.deepEqual(removed, ['expired']);
  assert.equal(failures, 2);
  assert.equal(logs.length, 2);
  assert.ok(logs.every((message) => !message.includes('expired') || message === 'Could not remove expired subscription'));
});
