import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { navigateFromPush } from './adminPushNavigation';

test('notification messages navigate only to the scoped admin page', () => {
  const visited: string[] = [];
  const location = { origin: 'https://example.test', assign: (url: string | URL) => { visited.push(String(url)); } };
  navigateFromPush({ type: 'ROADBOOK_OPEN_NOTIFICATION', url: 'https://example.test/roadbook/admin/' }, location, '/roadbook/');
  navigateFromPush({ type: 'ROADBOOK_OPEN_NOTIFICATION', url: 'https://other.test/roadbook/admin/' }, location, '/roadbook/');
  navigateFromPush({ type: 'unrelated', url: 'https://example.test/roadbook/admin/' }, location, '/roadbook/');
  assert.deepEqual(visited, ['https://example.test/roadbook/admin/']);
});
