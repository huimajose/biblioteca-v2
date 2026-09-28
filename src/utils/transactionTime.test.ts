import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { formatTransactionTime, getTransactionTimes } from './transactionTime';

test('shows Angola time including day rollover', () => {
  assert.equal(formatTransactionTime('2026-09-28T23:15:30Z'), '29/09/2026, 00:15:30');
});

test('does not invent times for old records or confuse rejections with returns', () => {
  assert.equal(formatTransactionTime(null, '2026-09-28'), '28/09/2026 (hora não registada)');
  assert.equal(formatTransactionTime('invalid', null), 'Não registado');
  assert.deepEqual(getTransactionTimes({ status: 'REJECTED', borrowedDate: '2026-09-28', returnedDate: '2026-09-28' }), { departure: '—', arrival: '—' });
  assert.equal(getTransactionTimes({ status: 'borrowed' }).arrival, '—');
  assert.equal(getTransactionTimes({ status: 'PENDING' }).departure, '—');
});

test('uses actual return timestamp rather than the loan deadline', () => {
  assert.deepEqual(getTransactionTimes({
    status: 'RETURNED', borrowedAt: '2026-09-27T08:30:00Z', returnedAt: '2026-09-28T14:45:10Z',
  }), { departure: '27/09/2026, 09:30:00', arrival: '28/09/2026, 15:45:10' });
});
