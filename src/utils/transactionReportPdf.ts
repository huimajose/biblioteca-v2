import { jsPDF } from 'jspdf';
import autoTableModule from 'jspdf-autotable';
import { getTransactionTimes } from './transactionTime';

// Support the package's CommonJS export in Node and its browser default export.
const autoTable = typeof autoTableModule === 'function'
  ? autoTableModule
  : (autoTableModule as unknown as { default: typeof autoTableModule }).default;

export function createTransactionReportPdf(transactions: any[], filters: { start: string; end: string; status: string }) {
  const doc = new jsPDF('landscape', 'pt', 'a4');
  const statusLabels: Record<string, string> = { all: 'Todos', borrowed: 'Emprestado', returned: 'Devolvido', rejected: 'Rejeitado' };
  doc.setFontSize(16);
  doc.text('Relatório de transações', 40, 40);
  doc.setFontSize(10);
  doc.text(`Intervalo: ${filters.start || 'Todos'} - ${filters.end || 'Todos'}`, 40, 58);
  doc.text(`Estado: ${statusLabels[filters.status] || filters.status}`, 40, 72);
  doc.text('Saída = empréstimo | Entrada = devolução | Horário de Angola (UTC+1)', 40, 88);

  const rows = transactions.map(transaction => {
    const times = getTransactionTimes(transaction);
    const user = transaction.userName || transaction.userId || 'N/D';
    return [
      transaction.isTempUser ? `${user} (Temp)` : user,
      transaction.bookTitle || 'N/D',
      statusLabels[String(transaction.status || '').toLowerCase()] || transaction.status || 'N/D',
      times.departure,
      times.arrival,
    ];
  });
  autoTable(doc, {
    startY: 104,
    margin: { left: 40, right: 40 },
    head: [['Utilizador', 'Livro', 'Estado', 'Hora de saída (empréstimo)', 'Hora de entrada (devolução)']],
    body: rows.length ? rows : [['Sem transações neste intervalo', '-', '-', '-', '-']],
    styles: { fontSize: 9, overflow: 'linebreak', cellPadding: 6 },
    columnStyles: { 2: { cellWidth: 75 }, 3: { cellWidth: 160 }, 4: { cellWidth: 160 } },
    headStyles: { fillColor: [101, 163, 13] },
    showHead: 'everyPage',
  });
  return doc;
}
