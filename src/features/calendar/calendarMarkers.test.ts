import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { weeklyRangeMarkers } from './calendarMarkers';

const dates = ['2027-12-27', '2027-12-28', '2027-12-29', '2027-12-30', '2027-12-31', null, null];
const first = { tour: { id: '2027-12-27-first', endDate: '2027-12-30' } };
const overlap = { tour: { id: '2027-12-29-overlap', endDate: '2028-01-02' } };
const after = { tour: { id: '2027-12-31-after', endDate: '2028-01-01' } };
const single = { tour: { id: '2027-12-28-single' } };

test('overlapping ranges keep separate lanes and non-overlapping ranges reuse them', () => {
  const markers = weeklyRangeMarkers(dates, [overlap, single, after, first]);
  assert.deepEqual(markers[0], [first, null]);
  assert.deepEqual(markers[2], [first, overlap]);
  assert.deepEqual(markers[3], [first, overlap]);
  assert.deepEqual(markers[4], [after, overlap]);
  assert.deepEqual(markers[5], [null, null]);
});

test('ranges crossing weeks and years remain present on each covered date', () => {
  const markers = weeklyRangeMarkers(['2028-01-01', '2028-01-02', '2028-01-03'], [overlap, after]);
  assert.equal(markers[0].filter(Boolean).length, 2);
  assert.equal(markers[1].filter(Boolean).length, 1);
  assert.equal(markers[2].filter(Boolean).length, 0);
  assert.deepEqual(weeklyRangeMarkers([null, null], [overlap]), [[], []]);
});
