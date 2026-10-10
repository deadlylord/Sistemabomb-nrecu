import test from 'node:test';
import assert from 'node:assert/strict';
import { previousPeriod } from '../services/previousPeriod.ts';

const ymd = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const check = (from, to, expectedFrom, expectedTo) => {
  const result = previousPeriod(from, to);
  assert.equal(ymd(result.start), expectedFrom);
  assert.equal(ymd(result.end), expectedTo);
  assert.equal(result.start.getHours(), 0);
  assert.equal(result.end.getHours(), 23);
  assert.equal(result.end.getMilliseconds(), 999);
};

test('month selections compare matching calendar dates instead of the final days of the previous month', () => {
  check('2026-10-01', '2026-10-10', '2026-09-01', '2026-09-10');
  check('2026-10-01', '2026-10-30', '2026-09-01', '2026-09-30');
  check('2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30');
  check('2026-09-01', '2026-09-30', '2026-08-01', '2026-08-31');
  check('2026-03-01', '2026-03-30', '2026-02-01', '2026-02-28');
  check('2024-03-01', '2024-03-30', '2024-02-01', '2024-02-29');
  check('2026-01-01', '2026-01-10', '2025-12-01', '2025-12-10');
});

test('other ranges preserve equal-length adjacent comparisons and reject invalid dates', () => {
  check('2026-10-10', '2026-10-10', '2026-10-09', '2026-10-09');
  check('2026-10-04', '2026-10-10', '2026-09-27', '2026-10-03');
  check('2026-09-28', '2026-10-04', '2026-09-21', '2026-09-27');
  assert.equal(previousPeriod('', '2026-10-10'), null);
  assert.equal(previousPeriod('2026-02-30', '2026-03-01'), null);
  assert.equal(previousPeriod('2026-10-10', '2026-10-01'), null);
});
