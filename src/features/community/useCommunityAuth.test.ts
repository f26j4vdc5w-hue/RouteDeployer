import assert from 'node:assert/strict';
import test from 'node:test';
import { getCommunityRouteReturnTo } from './authRedirect';

test('Login kehrt nur bei einer Route zur aktuellen Seite zurück', () => {
  assert.equal(getCommunityRouteReturnTo('/roadbook/', '/roadbook/profil', '', ''), null);
  assert.equal(getCommunityRouteReturnTo('/roadbook/', '/roadbook/einstellungen', '', ''), null);
  assert.equal(getCommunityRouteReturnTo('/roadbook/', '/roadbook/getraenke', '', ''), null);
  assert.equal(getCommunityRouteReturnTo('/roadbook/', '/roadbook/admin', '', ''), null);
  assert.equal(getCommunityRouteReturnTo('/roadbook/', '/roadbook/', '', ''), null);

  assert.equal(
    getCommunityRouteReturnTo(
      '/roadbook/',
      '/roadbook/2026/after-work',
      '?tour=amtsberg-zschopau',
      '',
    ),
    '/roadbook/2026/after-work?tour=amtsberg-zschopau',
  );
});
