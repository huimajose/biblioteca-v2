export function planBookInventory(input: {
  total: number; additional: number; physicalCount: number; borrowedCount: number;
}) {
  const { total, additional, physicalCount, borrowedCount } = input;
  if (![total, additional].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error('Indique quantidades inteiras e não negativas de exemplares.');
  }
  const target = total + additional;
  if (!Number.isSafeInteger(target)) throw new Error('Quantidade de exemplares inválida.');
  if (target < physicalCount) {
    throw new Error(`Existem ${physicalCount} exemplares físicos registados. O total não pode ser inferior a esse número.`);
  }
  return { totalCopies: target, availableCopies: target - borrowedCount, copiesToCreate: target - physicalCount };
}
