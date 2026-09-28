import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { planBookInventory } from './bookInventory';

test('changing total creates copies and preserves borrowed stock', () => {
  assert.deepEqual(planBookInventory({ total: 5, additional: 0, physicalCount: 2, borrowedCount: 1 }),
    { totalCopies: 5, availableCopies: 4, copiesToCreate: 3 });
});

test('adds copies and repairs missing physical records', () => {
  assert.deepEqual(planBookInventory({ total: 5, additional: 2, physicalCount: 3, borrowedCount: 2 }),
    { totalCopies: 7, availableCopies: 5, copiesToCreate: 4 });
});

test('saving the same total does not duplicate copies', () => {
  assert.deepEqual(planBookInventory({ total: 7, additional: 0, physicalCount: 7, borrowedCount: 2 }),
    { totalCopies: 7, availableCopies: 5, copiesToCreate: 0 });
});

test('rejects invalid counts and reductions that would orphan physical copies', () => {
  for (const total of [-1, 1.5, NaN, Infinity, 1]) {
    assert.throws(() => planBookInventory({ total, additional: 0, physicalCount: 2, borrowedCount: 1 }));
  }
  assert.throws(() => planBookInventory({ total: 2, additional: -1, physicalCount: 2, borrowedCount: 0 }));
});
