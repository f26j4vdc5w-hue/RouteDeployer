import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatDateRange, formatLong, formatShort, tourEndDate, tourIncludesDate } from './date';

test('formats single-day and multi-day events, including year boundaries', () => {
  assert.equal(formatDateRange('2027-12-30-abc123', undefined, formatShort), '30.12.');
  assert.equal(formatDateRange('2027-12-30-abc123', '2027-12-30', formatShort), '30.12.');
  assert.equal(formatDateRange('2027-12-30-abc123', '2028-01-02', formatShort), '30.12. – 02.01.');
  assert.equal(
    formatDateRange('2027-12-30-abc123', '2028-01-02', formatLong),
    'Donnerstag, 30. Dezember 2027 – Sonntag, 2. Januar 2028',
  );
});

test('event range includes both endpoints and handles single-day tours', () => {
  const event = { id: '2027-12-30-abc123', endDate: '2028-01-02' };
  assert.equal(tourEndDate(event), '2028-01-02');
  for (const date of ['2027-12-30', '2027-12-31', '2028-01-01', '2028-01-02']) {
    assert.equal(tourIncludesDate(event, date), true, date);
  }
  for (const date of ['2027-12-29', '2028-01-03']) {
    assert.equal(tourIncludesDate(event, date), false, date);
  }
  assert.equal(tourEndDate({ id: '2027-12-30-abc123' }), '2027-12-30');
  assert.equal(tourIncludesDate({ id: '2027-12-30-abc123' }, '2027-12-31'), false);
});
