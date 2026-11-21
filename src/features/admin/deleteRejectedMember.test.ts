import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('member deletion uses an authorized database RPC instead of browser admin auth', () => {
  const adminSource = readFileSync('src/features/admin/AdminApp.tsx', 'utf8');
  const migration = readFileSync(
    'supabase/migrations/202611210002_delete_rejected_members.sql',
    'utf8',
  );

  assert.match(adminSource, /client\.rpc\('delete_rejected_community_member'/);
  assert.doesNotMatch(adminSource, /auth\.admin\.deleteUser/);
  assert.match(migration, /set search_path = ''/);
  assert.match(migration, /\(auth\.jwt\(\) -> 'app_metadata' ->> 'role'\)/);
  assert.match(migration, /status = 'rejected'/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});
