const getContentType = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'pdf':
      return 'application/pdf';
    case 'epub':
      return 'application/epub+zip';
    case 'mobi':
      return 'application/x-mobipocket-ebook';
    default:
      return 'application/octet-stream';
  }
};
