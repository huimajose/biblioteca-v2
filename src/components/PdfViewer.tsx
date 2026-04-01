import React, { useMemo, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string | null;
  fallbackUrl?: string | null;
  watermarkText?: string;
}

export const PdfViewer = ({ url, fallbackUrl, watermarkText }: PdfViewerProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(url);
  const [triedFallback, setTriedFallback] = useState(false);

  React.useEffect(() => {
    setActiveUrl(url);
    setTriedFallback(false);
    setLoadError(null);
  }, [url]);

  const onDocumentLoadSuccess = ({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setPageNumber(1);
    setLoadError(null);
  };

  const goToPrevPage = () => setPageNumber((prev) => (prev > 1 ? prev - 1 : prev));
  const goToNextPage = () => setPageNumber((prev) => (prev < numPages ? prev + 1 : prev));
  const onPageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = Number(e.target.value);
    if (val > numPages) val = numPages;
    else if (val < 1) val = 1;
    setPageNumber(val);
  };

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

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
        fontSize: 42,
        fontWeight: 800,
        color: darkMode ? '#fff' : '#000',
        whiteSpace: 'nowrap',
        zIndex: 10,
      }}
      aria-hidden="true"
    >
      {watermarkText}
    </div>
  ) : null;

  const pdfOptions = useMemo(() => ({ cMapUrl: 'cmaps/', cMapPacked: true }), []);

  return (
    <div
      className="relative rounded-xl p-4"
      style={{
        backgroundColor: darkMode ? '#121212' : '#fff',
        color: darkMode ? '#eee' : '#000',
      }}
    >
      {watermark}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4 text-sm">
        <button className="px-3 py-1 border rounded" onClick={goToPrevPage} disabled={pageNumber <= 1}>
          Anterior
        </button>
        <input
          type="number"
          min={1}
          max={numPages}
          value={pageNumber}
          onChange={onPageInputChange}
          className="w-16 px-2 py-1 border rounded text-center"
          aria-label="Numero da pagina"
        />
        <span className="text-xs">de {numPages}</span>
        <button className="px-3 py-1 border rounded" onClick={goToNextPage} disabled={pageNumber >= numPages}>
          Proxima
        </button>
        <button className="px-2 py-1 border rounded" onClick={zoomOut} disabled={scale <= 0.5}>
          -
        </button>
        <span className="text-xs">{(scale * 100).toFixed(0)}%</span>
        <button className="px-2 py-1 border rounded" onClick={zoomIn} disabled={scale >= 3}>
          +
        </button>
        <button className="px-3 py-1 border rounded" onClick={toggleDarkMode}>
          {darkMode ? 'Modo Claro' : 'Modo Escuro'}
        </button>
      </div>

      <div
        className="relative flex justify-center border rounded bg-gray-50 overflow-hidden"
        style={{ borderColor: darkMode ? '#444' : '#e5e7eb' }}
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
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderAnnotationLayer={false}
              renderTextLayer
              loading="Carregando pagina..."
            />
          </Document>
        )}
      </div>
    </div>
  );
};
