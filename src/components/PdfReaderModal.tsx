import React, { useMemo } from 'react';
import { X } from 'lucide-react';

interface PdfReaderModalProps {
  title: string;
  pdfUrl: string;
  watermarkText: string;
  onClose: () => void;
}

export const PdfReaderModal = ({ title, pdfUrl, watermarkText, onClose }: PdfReaderModalProps) => {
  const stamp = useMemo(() => {
    const date = new Date().toLocaleString();
    return `${watermarkText} • ${date}`;
  }, [watermarkText]);

  const tiles = useMemo(() => Array.from({ length: 24 }), []);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">Leitor protegido</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="relative flex-1 bg-gray-50"
          onContextMenu={(e) => e.preventDefault()}
        >
          <iframe
            title="PDF Reader"
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts"
          />

          <div className="pointer-events-none absolute inset-0 select-none">
            <div className="absolute inset-0 grid grid-cols-3 md:grid-cols-4 gap-8 p-8 opacity-15 text-gray-600">
              {tiles.map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                  <span className="text-xs font-bold rotate-[-25deg] whitespace-nowrap">
                    {stamp} • NAO COPIAR
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-gray-100 bg-white text-[10px] text-gray-400">
          Este leitor bloqueia download direto. Capturas de ecrã ainda sao possiveis no dispositivo do utilizador.
        </div>
      </div>
    </div>
  );
};
