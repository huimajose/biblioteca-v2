import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createTransactionReportPdf } from './transactionReportPdf';

async function readPdf(transactions: any[]) {
  const doc = createTransactionReportPdf(transactions, { start: '', end: '', status: 'all' });
  const pdf = await getDocument({ data: new Uint8Array(doc.output('arraybuffer')), useSystemFonts: true }).promise;
  try {
    const pages: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      pages.push(content.items.map(item => 'str' in item ? item.str : '').join(' '));
    }
    return pages;
  } finally { await pdf.destroy(); }
}

test('generated PDF contains both time columns and the actual timestamps', async () => {
  const pages = await readPdf([{ userName: 'Maria', bookTitle: 'Gestão', status: 'returned',
    borrowedAt: '2026-09-28T08:30:00Z', returnedAt: '2026-09-29T14:15:00Z' }]);
  assert.match(pages[0], /Hora de saída \(empréstimo\)/);
  assert.match(pages[0], /Hora de entrada \(devolução\)/);
  assert.match(pages[0], /28\/09\/2026, 09:30:00/);
  assert.match(pages[0], /29\/09\/2026, 15:15:00/);
});

test('empty reports retain the time columns', async () => {
  const [page] = await readPdf([]);
  assert.match(page, /Hora de saída/);
  assert.match(page, /Hora de entrada/);
  assert.match(page, /Sem transações/);
});

test('every page repeats the time columns and legacy rows do not invent hours', async () => {
  const pages = await readPdf(Array.from({ length: 70 }, () => ({ userName: 'Maria', bookTitle: 'Gestão', status: 'returned', borrowedDate: '2026-09-28', returnedDate: '2026-09-29' })));
  assert.ok(pages.length > 1);
  for (const page of pages) {
    assert.match(page, /Hora de saída/);
    assert.match(page, /Hora de entrada/);
    assert.match(page, /hora não registada/);
  }
});
