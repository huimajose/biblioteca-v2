const formatter = new Intl.DateTimeFormat('pt-PT', {
  timeZone: 'Africa/Luanda',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function formatTransactionTime(timestamp?: string | null, legacyDate?: string | null): string {
  if (timestamp) {
    const date = new Date(timestamp);
    if (!Number.isNaN(date.getTime())) return formatter.format(date);
  }
  const match = legacyDate?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} (hora não registada)` : 'Não registado';
}

export function getTransactionTimes(transaction: {
  status?: string; borrowedAt?: string | null; returnedAt?: string | null;
  borrowedDate?: string | null; returnedDate?: string | null;
}) {
  const status = transaction.status?.toLowerCase();
  return {
    departure: status === 'borrowed' || status === 'returned'
      ? formatTransactionTime(transaction.borrowedAt, transaction.borrowedDate) : '—',
    arrival: status === 'returned'
      ? formatTransactionTime(transaction.returnedAt, transaction.returnedDate) : '—',
  };
}
