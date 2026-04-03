import jsPDF from 'jspdf';

export type WatermarkOptions = {
  width?: number;
  opacity?: number;
};

export const loadWatermarkImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

export const addCenteredWatermarkToAllPages = (
  doc: jsPDF,
  img: HTMLImageElement,
  options: WatermarkOptions = {}
) => {
  const pages = doc.getNumberOfPages();
  const targetW = options.width ?? 160;
  const opacity = options.opacity ?? 0.08;
  const targetH = targetW * (img.height / img.width);

  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const x = (pageW - targetW) / 2;
    const y = (pageH - targetH) / 2;
    if ((doc as any).GState && doc.setGState) {
      doc.setGState(new (doc as any).GState({ opacity }));
    }
    doc.addImage(img, 'PNG', x, y, targetW, targetH);
    if ((doc as any).GState && doc.setGState) {
      doc.setGState(new (doc as any).GState({ opacity: 1 }));
    }
  }
};
