import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { authorAbbreviation, bookLabelLines, formatBookCatalog, physicalCopyNumbers } from './bookCatalog';

const book = { id: 27, courseSequence: 5, author: 'João dos Santos', catalogCode: 'GES-005', totalCopies: 3 };

test('uses the requested five lines and preserves course numbering', () => {
  assert.deepEqual(bookLabelLines(book, 1), ['ISPI - Biblioteca', '005', 'SAN', 'GES', 'Ex. 1']);
  assert.equal(formatBookCatalog(book), '005-SAN-GES');
  assert.deepEqual(bookLabelLines({ ...book, catalogCode: '005-SAN-GES' }, 2), ['ISPI - Biblioteca', '005', 'SAN', 'GES', 'Ex. 2']);
});

test('normalizes surnames, inverted names, accents and multiple authors', () => {
  assert.equal(authorAbbreviation('Santos, João'), 'SAN');
  assert.equal(authorAbbreviation('Maria Álvares; João Santos'), 'ALV');
  assert.equal(authorAbbreviation(''), 'SNA');
  assert.equal(formatBookCatalog({ ...book, author: 'Ana Costa' }, 'DIR'), '005-COS-DIR');
});

test('prints one label per physical copy and none for digital-only books', () => {
  assert.deepEqual(physicalCopyNumbers(book), [1, 2, 3]);
  assert.deepEqual(physicalCopyNumbers({ ...book, totalCopies: 0 }), []);
  assert.deepEqual(physicalCopyNumbers({ ...book, totalCopies: 1.5 }), []);
  assert.equal(bookLabelLines({ ...book, courseSequence: 1005 }, 3)[1], '1005');
});
