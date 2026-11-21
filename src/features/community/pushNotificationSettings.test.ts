import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPushDeviceType,
  getPushSetupExplanation,
} from './PushNotificationSettings';

test('Push-Mitteilungen erhalten gerätespezifische Einrichtungsanweisungen', () => {
  assert.equal(getPushDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(getPushDeviceType('Mozilla/5.0 (Linux; Android 15)'), 'android');
  assert.equal(getPushDeviceType('Mozilla/5.0 (X11; Linux x86_64)'), 'desktop');

  assert.match(getPushSetupExplanation('ios', false), /Zum Home-Bildschirm/);
  assert.match(getPushSetupExplanation('ios', true), /Einstellungen/);
  assert.match(getPushSetupExplanation('android', false), /Schloss-/);
  assert.match(getPushSetupExplanation('desktop', false), /Adressleiste/);
});
