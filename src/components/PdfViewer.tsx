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
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(url);
  const [triedFallback, setTriedFallback] = useState(false);
  const [pageTurnDirection, setPageTurnDirection] = useState<1 | -1>(1);
  const [viewerWidth, setViewerWidth] = useState<number>(0);
  const prefersReducedMotion = useReducedMotion();
  const pageViewportRef = useRef<HTMLDivElement | null>(null);

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

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateWidth())
        : null;
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
  const onPageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > numPages) val = numPages;
    else if (val < 1) val = 1;
    applyPageChange(val);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const toggleDarkMode = () => setDarkMode((prev) => !prev);
  const readingProgress = numPages > 0 ? Math.round((pageNumber / numPages) * 100) : 0;

  const pdfOptions = useMemo(() => ({ cMapUrl: 'cmaps/', cMapPacked: true }), []);
  const pageRenderWidth = useMemo(() => {
    if (!viewerWidth) return undefined;
    const horizontalReserve = viewerWidth <= 360 ? 84 : viewerWidth <= 480 ? 72 : viewerWidth <= 768 ? 56 : 40;
    const safeViewportWidth = Math.max(150, viewerWidth - horizontalReserve);
    return Math.max(150, Math.round(safeViewportWidth * scale));
  }, [scale, viewerWidth]);
  const watermarkFontSize = useMemo(() => {
    if (!viewerWidth) return 42;
    if (viewerWidth <= 280) return 12;
    if (viewerWidth <= 360) return 14;
    if (viewerWidth <= 480) return 18;
    if (viewerWidth <= 640) return 24;
    if (viewerWidth <= 820) return 34;
    return 42;
  }, [viewerWidth]);
  const pageTurnTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.35, ease: [0.22, 0.61, 0.36, 1] as const };

  const watermark = watermarkText && !loadError ? (
    <div
      className="pointer-events-none select-none"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: 'rotate(-30deg)',
        opacity: 0.12,
        fontSize: watermarkFontSize,
        fontWeight: 800,
        color: darkMode ? '#fff' : '#000',
        whiteSpace: viewerWidth <= 480 ? 'normal' : 'nowrap',
        textAlign: 'center',
        maxWidth: viewerWidth <= 480 ? '78%' : '92%',
        lineHeight: 1.2,
        wordBreak: 'break-word',
        zIndex: 10,
      }}
      aria-hidden="true"
    >
      {watermarkText}
    </div>
  ) : null;

  const pageTurnVariants = {
    enter: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction > 0 ? 46 : -46,
      rotateY: direction > 0 ? -10 : 10,
      scale: 0.985,
    }),
    center: {
      opacity: 1,
      x: 0,
      rotateY: 0,
      scale: 1,
    },
    exit: (direction: 1 | -1) => ({
      opacity: 0,
      x: direction > 0 ? -34 : 34,
      rotateY: direction > 0 ? 8 : -8,
      scale: 0.99,
    }),
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
      {watermark}
      <div className="mb-4 flex flex-col gap-4">
        <div
          className="flex flex-col gap-3 rounded-3xl border px-4 py-4 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between md:px-5 md:py-4"
          style={{
            borderColor: darkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(120, 53, 15, 0.14)',
            backgroundColor: darkMode ? 'rgba(15, 23, 42, 0.72)' : 'rgba(255, 251, 235, 0.82)',
          }}
        >
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] opacity-60">Modo leitura</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold">{numPages > 0 ? `Pagina ${pageNumber}` : 'Preparando leitor'}</h2>
              <span className="text-sm opacity-70">{numPages > 0 ? `${readingProgress}% concluido` : 'A carregar PDF'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              className="rounded-full border px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: darkMode ? '#334155' : '#d6c2a6' }}
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
            >
              Anterior
            </button>
            <div
              className="flex items-center gap-2 rounded-full border px-3 py-1.5"
              style={{ borderColor: darkMode ? '#334155' : '#d6c2a6' }}
            >
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={onPageInputChange}
                className="w-16 bg-transparent text-center outline-none"
                aria-label="Numero da pagina"
              />
              <span className="text-xs opacity-70">de {numPages}</span>
            </div>
            <button
              className="rounded-full border px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: darkMode ? '#334155' : '#d6c2a6' }}
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
            >
              Proxima
            </button>
            <button
              className="rounded-full border px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: darkMode ? '#334155' : '#d6c2a6' }}
              onClick={zoomOut}
              disabled={scale <= 0.5}
            >
              -
            </button>
            <span className="min-w-14 text-center text-xs opacity-75">{(scale * 100).toFixed(0)}%</span>
            <button
              className="rounded-full border px-3 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: darkMode ? '#334155' : '#d6c2a6' }}
              onClick={zoomIn}
              disabled={scale >= 3}
            >
              +
            </button>
            <button
              className="rounded-full border px-3 py-1.5 transition"
              style={{ borderColor: darkMode ? '#334155' : '#d6c2a6' }}
              onClick={toggleDarkMode}
            >
              {darkMode ? 'Modo Claro' : 'Modo Escuro'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${readingProgress}%`,
                background: darkMode
                  ? 'linear-gradient(90deg, #fde68a 0%, #fb7185 100%)'
                  : 'linear-gradient(90deg, #92400e 0%, #ea580c 100%)',
              }}
              animate={{ width: `${readingProgress}%` }}
              transition={pageTurnTransition}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] opacity-60">
            <span>Toque nas laterais para virar</span>
            <span>{numPages > 0 ? `${pageNumber} / ${numPages}` : '---'}</span>
          </div>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-[32px] border p-3 md:p-5"
        style={{
          borderColor: darkMode ? '#334155' : '#d8c4a7',
          background: darkMode
            ? 'radial-gradient(circle at top, rgba(30,41,59,0.88), rgba(2,6,23,0.98))'
            : 'radial-gradient(circle at top, rgba(255,255,255,0.95), rgba(245,236,220,0.92))',
        }}
      >
        {watermark}
        {!activeUrl ? (
          <div className="p-10 text-center text-sm text-gray-500">
            PDF indisponivel no momento.
          </div>
        ) : loadError ? (
          <div className="p-10 text-center text-sm text-gray-500">
            {loadError}
          </div>
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
              className="relative flex min-h-[60vh] items-center justify-center overflow-x-auto overflow-y-hidden rounded-[28px] px-1 py-6 md:px-8"
            >
              <button
                type="button"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="absolute inset-y-0 left-0 z-20 w-12 transition disabled:cursor-not-allowed disabled:opacity-0 md:w-16"
                aria-label="Pagina anterior"
                title="Pagina anterior"
              >
                <div className="mx-auto flex h-full items-center justify-center">
                  <span
                    className="hidden rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] shadow-sm md:inline-flex"
                    style={{
                      borderColor: darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(120,53,15,0.18)',
                      backgroundColor: darkMode ? 'rgba(15,23,42,0.68)' : 'rgba(255,255,255,0.72)',
                    }}
                  >
                    Voltar
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="absolute inset-y-0 right-0 z-20 w-12 transition disabled:cursor-not-allowed disabled:opacity-0 md:w-16"
                aria-label="Proxima pagina"
                title="Proxima pagina"
              >
                <div className="mx-auto flex h-full items-center justify-center">
                  <span
                    className="hidden rounded-full border px-3 py-2 text-xs uppercase tracking-[0.2em] shadow-sm md:inline-flex"
                    style={{
                      borderColor: darkMode ? 'rgba(148,163,184,0.22)' : 'rgba(120,53,15,0.18)',
                      backgroundColor: darkMode ? 'rgba(15,23,42,0.68)' : 'rgba(255,255,255,0.72)',
                    }}
                  >
                    Avancar
                  </span>
                </div>
              </button>

              <div
                className="relative mx-auto w-full max-w-full"
                style={{ perspective: '1600px' }}
              >
                <div
                  className="pointer-events-none absolute inset-y-3 left-1/2 z-10 w-8 -translate-x-1/2 rounded-full blur-xl"
                  style={{
                    background: darkMode
                      ? 'linear-gradient(180deg, rgba(15,23,42,0.24), rgba(148,163,184,0.12), rgba(15,23,42,0.24))'
                      : 'linear-gradient(180deg, rgba(120,53,15,0.16), rgba(120,53,15,0.05), rgba(120,53,15,0.16))',
                  }}
                />

                <AnimatePresence mode="wait" custom={pageTurnDirection}>
                  <motion.div
                    key={`${pageNumber}-${scale}-${darkMode ? 'dark' : 'light'}`}
                    custom={pageTurnDirection}
                    variants={pageTurnVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={pageTurnTransition}
                    className="relative mx-auto w-fit max-w-full rounded-[24px] p-2 shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
                    style={{
                      transformStyle: 'preserve-3d',
                      background: darkMode ? '#0f172a' : '#fffdf7',
                    }}
                  >
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
