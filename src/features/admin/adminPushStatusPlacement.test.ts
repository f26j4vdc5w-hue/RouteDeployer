import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('push status is rendered in dashboard content instead of the header', () => {
  const toggle = readFileSync('src/features/admin/AdminPushToggle.tsx', 'utf8');
  const dashboard = readFileSync('src/features/admin/AdminApp.tsx', 'utf8');

  assert.match(toggle, /onStatusChange\?/);
  assert.doesNotMatch(toggle, /<p className="admin-muted"/);
  assert.match(dashboard, /onStatusChange=\{setPushStatus\}/);
  assert.match(dashboard, /\{pushStatus &&[\s\S]*<p className="admin-muted" role="status">/);
});
