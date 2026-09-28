export const isEpub = (url?: string | null): boolean => {
  if (!url) return false;
  try {
    return /\.epub$/i.test(decodeURIComponent(url.split(/[?#]/)[0]));
  } catch {
    return false;
  }
};

export const isReadingFile = (file: Pick<File, 'name' | 'type'>): boolean => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mime = file.type.toLowerCase();
  return (extension === 'pdf' || extension === 'epub') &&
    (!mime || mime === 'application/octet-stream' ||
      mime === (extension === 'epub' ? 'application/epub+zip' : 'application/pdf'));
};
