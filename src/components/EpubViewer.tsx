'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Book, Rendition } from 'epubjs';
import type Section from 'epubjs/types/section';
import { Button } from '@/components/ui/Button';

interface Props {
  url: string | null;
  fallbackUrl?: string | null;
  watermarkText?: string;
  initialPage?: number;
  maxAccessiblePage?: number | null;
  onDocumentLoad?: (total: number) => void;
  onPageChange?: (page: number, total: number) => void;
  onBlockedPageAttempt?: () => void;
}

// EPUB sections are stable across viewport and font changes, unlike screen pages.
export function EpubViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const [sections, setSections] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [fontSize, setFontSize] = useState(100);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    let book: Book | undefined;
    let rendition: Rendition | undefined;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFontSize(100);
    const open = async () => {
      const { default: ePub } = await import('epubjs');
      for (const source of [...new Set([props.url, props.fallbackUrl].filter(Boolean))]) {
        try {
          const response = await fetch(source!, { signal: controller.signal });
          if (!response.ok) throw new Error('Download failed');
          const buffer = await response.arrayBuffer();
          if (disposed) return;
          book = ePub();
          await book.open(buffer, 'binary');
          if (disposed || !host.current) return;
          const titles: string[] = [];
          book.spine.each((section: Section) => titles.push(`Secção ${section.index + 1}`));
          if (!titles.length) throw new Error('Empty EPUB');
          rendition = book.renderTo(host.current, {
            width: '100%', height: 600, flow: 'scrolled-doc', spread: 'none',
            allowScriptedContent: false,
          });
          // Enforce preview for internal links as well as the section controls.
          const originalDisplay = rendition.display.bind(rendition);
          rendition.display = (target?: string | number) => {
            const section = book!.spine.get(target);
            const limit = latest.current.maxAccessiblePage;
            if (limit && section && section.index + 1 > limit) {
              latest.current.onBlockedPageAttempt?.();
              return Promise.resolve();
            }
            return originalDisplay(target);
          };
          rendition.on('relocated', (location: { start: { index: number } }) => {
            if (disposed) return;
            const next = location.start.index + 1;
            setPage(next);
            latest.current.onPageChange?.(next, titles.length);
          });
          renditionRef.current = rendition;
          setSections(titles);
          latest.current.onDocumentLoad?.(titles.length);
          const start = Math.min(Math.max(1, latest.current.initialPage || 1), titles.length,
            latest.current.maxAccessiblePage || titles.length);
          await rendition.display(start - 1);
          if (!disposed) setLoading(false);
          return;
        } catch (err) {
          rendition?.destroy();
          book?.destroy();
          rendition = undefined;
          book = undefined;
          if (disposed) return;
        }
      }
      throw new Error('Não foi possível abrir o EPUB. Verifique o ficheiro e a ligação e tente novamente.');
    };
    open().catch((err: Error) => { if (!disposed) { setError(err.message); setLoading(false); } });
    return () => {
      disposed = true;
      controller.abort();
      rendition?.destroy();
      book?.destroy();
      renditionRef.current = null;
    };
  }, [props.url, props.fallbackUrl, retry]);

  const go = async (next: number) => {
    if (busy || !renditionRef.current) return;
    setBusy(true);
    try { await renditionRef.current.display(next - 1); }
    catch { setError('Não foi possível abrir esta secção. Tente novamente.'); }
    finally { setBusy(false); }
  };

  return <div className="bg-white text-gray-900">
    <div className="flex flex-wrap items-center gap-3 border-b p-3">
      <Button variant="secondary" disabled={loading || busy || page <= 1} onClick={() => void go(page - 1)}>Anterior</Button>
      <label className="text-sm">Secção
        <select className="ml-2 rounded border p-2" value={page} disabled={loading || busy} onChange={e => void go(Number(e.target.value))}>
          {sections.map((title, index) => <option key={index} value={index + 1}>{title}</option>)}
        </select>
      </label>
      <Button variant="secondary" disabled={loading || busy || page >= sections.length} onClick={() => void go(page + 1)}>Seguinte</Button>
      <label className="text-sm">Texto
        <select className="ml-2 rounded border p-2" value={fontSize} onChange={e => {
          const size = Number(e.target.value);
          setFontSize(size);
          renditionRef.current?.themes.fontSize(`${size}%`);
        }}>
          {[80, 100, 120, 150, 180].map(size => <option key={size} value={size}>{size}%</option>)}
        </select>
      </label>
      <span className="text-sm" role="status">{loading ? 'A carregar EPUB…' : `${page} de ${sections.length} secções`}</span>
    </div>
    {error && <div role="alert" className="p-6 text-red-700">{error} <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></div>}
    <div className="relative">
      <div ref={host} className="min-h-[600px]" hidden={Boolean(error)} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden text-center text-lg text-gray-500/20">{props.watermarkText}</div>
    </div>
    <p className="p-3 text-xs text-gray-500">O progresso é guardado por secção. Ao retomar, a leitura começa no início da última secção.</p>
  </div>;
}
