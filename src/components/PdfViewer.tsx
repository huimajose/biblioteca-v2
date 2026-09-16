import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string | null;
  fallbackUrl?: string | null;
  watermarkText?: string;
  initialPage?: number;
  maxAccessiblePage?: number | null;
  onDocumentLoad?: (numPages: number) => void;
  onPageChange?: (pageNumber: number, numPages: number) => void;
  onBlockedPageAttempt?: (attemptedPage: number) => void;
}

export const PdfViewer = ({
  url,
  fallbackUrl,
  watermarkText,
  initialPage = 1,
  maxAccessiblePage = null,
  onDocumentLoad,
  onPageChange,
  onBlockedPageAttempt,
}: PdfViewerProps) => {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(url);
  const [triedFallback, setTriedFallback] = useState(false);
  const [pageTurnDirection, setPageTurnDirection] = useState<1 | -1>(1);
  const [viewerWidth, setViewerWidth] = useState(0);
  const pageViewportRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  React.useEffect(() => {
    setActiveUrl(url);
    setTriedFallback(false);
    setLoadError(null);
  }, [url]);

  React.useEffect(() => {
    const nextPage = Math.max(1, Number(initialPage || 1));
    setPageNumber(numPages > 0 ? Math.min(nextPage, numPages) : nextPage);
  }, [initialPage, numPages]);

  React.useEffect(() => {
    const element = pageViewportRef.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = Math.max(220, Math.floor(element.clientWidth));
      setViewerWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    updateWidth();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidth) : null;
    observer?.observe(element);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const applyPageChange = (nextPage: number, pages = numPages) => {
    const safeUpperBound = pages > 0 ? pages : Math.max(nextPage, 1);
    const normalized = Math.min(Math.max(1, nextPage), safeUpperBound);
    if (maxAccessiblePage && normalized > maxAccessiblePage) {
      onBlockedPageAttempt?.(normalized);
      return;
    }
    if (normalized === pageNumber) return;
    setPageTurnDirection(normalized > pageNumber ? 1 : -1);
    setPageNumber(normalized);
    onPageChange?.(normalized, pages);
  };

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    const nextPage = Math.min(Math.max(1, Number(initialPage || 1)), pages);
    const accessiblePage = maxAccessiblePage ? Math.min(nextPage, maxAccessiblePage) : nextPage;
    setPageNumber(accessiblePage);
    setLoadError(null);
    onDocumentLoad?.(pages);
    onPageChange?.(accessiblePage, pages);
  };

  const goToPrevPage = () => applyPageChange(pageNumber - 1);
  const goToNextPage = () => applyPageChange(pageNumber + 1);
  const onPageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = Number(event.target.value);
    if (value > numPages) value = numPages;
    if (value < 1) value = 1;
    applyPageChange(value);
  };

  const zoomIn = () => setScale((value) => Math.min(Number((value + 0.25).toFixed(2)), 3));
  const zoomOut = () => setScale((value) => Math.max(Number((value - 0.25).toFixed(2)), 0.5));
  const resetZoom = () => setScale(1);
  const toggleDarkMode = () => setDarkMode((value) => !value);
  const readingProgress = numPages > 0 ? Math.round((pageNumber / numPages) * 100) : 0;

  const pdfOptions = useMemo(() => ({ cMapUrl: 'cmaps/', cMapPacked: true }), []);
  const basePageWidth = useMemo(() => {
    if (!viewerWidth) return undefined;
    const horizontalReserve = viewerWidth <= 360 ? 28 : viewerWidth <= 480 ? 36 : viewerWidth <= 768 ? 56 : 80;
    return Math.max(180, viewerWidth - horizontalReserve);
  }, [viewerWidth]);
  const pageRenderWidth = basePageWidth ? Math.round(basePageWidth * scale) : undefined;
  const watermarkFontSize = viewerWidth <= 360 ? 14 : viewerWidth <= 480 ? 18 : viewerWidth <= 640 ? 24 : 42;
  const pageTurnTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.3, ease: [0.22, 0.61, 0.36, 1] as const };

  const watermark = watermarkText && !loadError ? (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex select-none items-center justify-center text-center font-extrabold"
      style={{
        transform: 'rotate(-30deg)',
        opacity: 0.12,
        fontSize: watermarkFontSize,
        color: darkMode ? '#fff' : '#000',
      }}
      aria-hidden="true"
    >
      {watermarkText}
    </div>
  ) : null;

  const pageTurnVariants = {
    enter: (direction: 1 | -1) => ({ opacity: 0, x: direction > 0 ? 36 : -36, scale: 0.99 }),
    center: { opacity: 1, x: 0, scale: 1 },
    exit: (direction: 1 | -1) => ({ opacity: 0, x: direction > 0 ? -28 : 28, scale: 0.99 }),
  };

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border p-4 shadow-[0_22px_70px_rgba(15,23,42,0.16)]"
      style={{
        background: darkMode
          ? 'linear-gradient(180deg, #0f172a 0%, #111827 52%, #020617 100%)'
          : 'linear-gradient(180deg, #fffef7 0%, #f6efe4 45%, #efe3d1 100%)',
        color: darkMode ? '#eee' : '#000',
        borderColor: darkMode ? '#1f2937' : '#e7d9c3',
      }}
    >
      <div className="mb-4 flex flex-col gap-4">
        <div
          className="flex flex-col gap-3 rounded-3xl border px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-5"
          style={{
            borderColor: darkMode ? '#334155' : '#d6c2a6',
            backgroundColor: darkMode ? 'rgba(15,23,42,.72)' : 'rgba(255,251,235,.82)',
          }}
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] opacity-60">Modo leitura</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{numPages ? `Pagina ${pageNumber}` : 'Preparando leitor'}</h2>
              <span className="text-sm opacity-70">{numPages ? `${readingProgress}% concluido` : 'A carregar PDF'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button className="rounded-full border px-3 py-1.5 disabled:opacity-40" onClick={goToPrevPage} disabled={pageNumber <= 1}>Anterior</button>
            <div className="flex items-center gap-2 rounded-full border px-3 py-1.5">
              <input type="number" min={1} max={numPages} value={pageNumber} onChange={onPageInputChange} className="w-14 bg-transparent text-center outline-none" aria-label="Numero da pagina" />
              <span className="text-xs opacity-70">de {numPages}</span>
            </div>
            <button className="rounded-full border px-3 py-1.5 disabled:opacity-40" onClick={goToNextPage} disabled={pageNumber >= numPages}>Proxima</button>
            <button className="rounded-full border px-3 py-1.5 disabled:opacity-40" onClick={zoomOut} disabled={scale <= 0.5} aria-label="Diminuir zoom">−</button>
            <button className="min-w-16 rounded-full border px-3 py-1.5 text-xs" onClick={resetZoom} title="Repor zoom para 100%">{Math.round(scale * 100)}%</button>
            <button className="rounded-full border px-3 py-1.5 disabled:opacity-40" onClick={zoomIn} disabled={scale >= 3} aria-label="Aumentar zoom">+</button>
            <button className="rounded-full border px-3 py-1.5" onClick={toggleDarkMode}>{darkMode ? 'Modo Claro' : 'Modo Escuro'}</button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${readingProgress}%` }}
              transition={pageTurnTransition}
              style={{ background: darkMode ? '#fde68a' : '#92400e' }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] opacity-60">
            <span>{scale > 1 ? 'Arraste horizontalmente para explorar a pagina' : 'Toque nas laterais para virar'}</span>
            <span>{numPages ? `${pageNumber} / ${numPages}` : '---'}</span>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-[32px] border p-3 md:p-5"
        style={{
          borderColor: darkMode ? '#334155' : '#d8c4a7',
          background: darkMode ? '#020617' : '#f5ecdc',
        }}
      >
        {!activeUrl ? (
          <div className="p-10 text-center text-sm text-gray-500">PDF indisponivel no momento.</div>
        ) : loadError ? (
          <div className="p-10 text-center text-sm text-gray-500">{loadError}</div>
        ) : (
          <Document
            file={activeUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={() => {
              if (fallbackUrl && !triedFallback) {
                setTriedFallback(true);
                setActiveUrl(fallbackUrl);
                return;
              }
              setLoadError('PDF indisponivel ou corrompido. Tente novamente mais tarde.');
            }}
            loading="Carregando PDF..."
            options={pdfOptions}
          >
            <div
              ref={pageViewportRef}
              className="relative min-h-[60vh] overflow-auto rounded-[28px] py-6"
            >
              <button type="button" onClick={goToPrevPage} disabled={pageNumber <= 1} className="sticky left-0 top-0 z-20 float-left h-[60vh] w-10 disabled:pointer-events-none disabled:opacity-0 md:w-14" aria-label="Pagina anterior" />
              <button type="button" onClick={goToNextPage} disabled={pageNumber >= numPages} className="sticky right-0 top-0 z-20 float-right h-[60vh] w-10 disabled:pointer-events-none disabled:opacity-0 md:w-14" aria-label="Proxima pagina" />

              <div
                className="relative mx-auto"
                style={{
                  width: pageRenderWidth ? `${pageRenderWidth + 16}px` : '100%',
                  minWidth: pageRenderWidth ? `${pageRenderWidth + 16}px` : '100%',
                }}
              >
                <AnimatePresence mode="wait" custom={pageTurnDirection}>
                  <motion.div
                    key={`${pageNumber}-${scale}-${darkMode ? 'dark' : 'light'}`}
                    custom={pageTurnDirection}
                    variants={pageTurnVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={pageTurnTransition}
                    className="relative mx-auto w-fit rounded-[24px] p-2 shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
                    style={{ background: darkMode ? '#0f172a' : '#fffdf7' }}
                  >
                    {watermark}
                    <Page
                      pageNumber={pageNumber}
                      width={pageRenderWidth}
                      renderAnnotationLayer={false}
                      renderTextLayer
                      loading="Carregando pagina..."
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Document>
        )}
      </div>
    </div>
  );
};
