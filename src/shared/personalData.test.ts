import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isPlausible, missingPersonalFields, PERSONAL_FIELDS } from './personalData';

const values = {
  full_name: 'Max Mustermann',
  email: 'max@example.com',
  address: 'Musterstraße 1',
  birth_date: '1990-01-01',
  clothing_size: 'M',
  phone_number: '+49 (123) 456-789',
};

test('new fields are selectable and accepted as event requirements', () => {
  assert.deepEqual(PERSONAL_FIELDS.slice(-2).map((field) => field.key), ['clothing_size', 'phone_number']);
  assert.deepEqual(missingPersonalFields(['clothing_size', 'phone_number'], values), []);
});

test('clothing size must be present and no longer than 40 characters', () => {
  for (const clothing_size of ['', '   ', 'x'.repeat(41)]) {
    assert.equal(isPlausible('clothing_size', { ...values, clothing_size }), false);
  }
  assert.equal(isPlausible('clothing_size', { ...values, clothing_size: 'x'.repeat(40) }), true);
  assert.equal(isPlausible('clothing_size', { ...values, clothing_size: '🚴'.repeat(40) }), true);
  assert.equal(isPlausible('clothing_size', { ...values, clothing_size: ' 38/40 ' }), true);
});

test('phone number requires at least five digits and supported formatting', () => {
  for (const phone_number of ['', '1234', 'abc12345', '1'.repeat(41)]) {
    assert.equal(isPlausible('phone_number', { ...values, phone_number }), false);
  }
  for (const phone_number of ['12345', '+49 (123) 456-789', '0123/456 789']) {
    assert.equal(isPlausible('phone_number', { ...values, phone_number }), true);
  }
  assert.deepEqual(missingPersonalFields(['clothing_size', 'phone_number'], { ...values, phone_number: null }), ['phone_number']);
});
