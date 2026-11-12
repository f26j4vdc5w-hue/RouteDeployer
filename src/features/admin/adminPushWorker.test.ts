import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

test('push opens the admin page relative to the deployed app scope', async () => {
  const handlers: Record<string, (event: unknown) => void> = {};
  const shown: { title: string; options: { data: { url: string } } }[] = [];
  const opened: string[] = [];
  const self = {
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    registration: {
      scope: 'https://example.test/roadbook/',
      showNotification: async (title: string, options: { data: { url: string } }) => {
        shown.push({ title, options });
      },
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => { opened.push(url); },
    },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, URL });

  let pending: Promise<unknown> = Promise.resolve();
  handlers.push({
    data: { json: () => ({ title: 'Neue Anfrage', body: 'Bitte prüfen', url: 'admin/' }) },
    waitUntil: (promise: Promise<unknown>) => { pending = promise; },
  });
  await pending;
  assert.equal(shown[0].title, 'Neue Anfrage');

  let closed = false;
  handlers.notificationclick({
    notification: { data: shown[0].options.data, close: () => { closed = true; } },
    waitUntil: (promise: Promise<unknown>) => { pending = promise; },
  });
  await pending;
  assert.equal(closed, true);
  assert.deepEqual(opened, ['https://example.test/roadbook/admin/']);
});
