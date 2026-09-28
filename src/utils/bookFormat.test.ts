import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isEpub, isReadingFile } from './bookFormat';

test('detects EPUB URLs with encoded filenames, queries and fragments', () => {
  for (const url of ['livro.epub', 'https://cdn.example/Livro%20A.EPUB?token=123#chapter']) {
    assert.equal(isEpub(url), true);
  }
  for (const url of [null, '', 'livro.pdf', 'livro.epub.exe', '%invalid.epub']) {
    assert.equal(isEpub(url), false);
  }
});

test('accepts supported reading files including missing or generic MIME types', () => {
  for (const file of [
    { name: 'book.epub', type: 'application/epub+zip' },
    { name: 'BOOK.EPUB', type: '' },
    { name: 'book.epub', type: 'application/octet-stream' },
    { name: 'book.pdf', type: 'application/pdf' },
  ]) assert.equal(isReadingFile(file), true);
  for (const file of [
    { name: 'book.exe', type: 'application/epub+zip' },
    { name: 'book.epub', type: 'text/html' },
    { name: 'book.pdf', type: 'application/epub+zip' },
  ]) assert.equal(isReadingFile(file), false);
});
