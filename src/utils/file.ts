export const resolveBookFileUrl = (
  fileUrl?: string | null,
  bookId?: number | string
): string | null => {
  if (!fileUrl) return null;
  if (fileUrl.startsWith('http')) return fileUrl;

  const basePublicUrl =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET_URL;
  const publicUrl = basePublicUrl
    ? basePublicUrl.replace(/\/$/, '').endsWith('/public')
      ? `${basePublicUrl.replace(/\/$/, '')}/books`
      : basePublicUrl.replace(/\/$/, '')
    : null;
  const safeBookId = bookId ? String(bookId) : '';
  const rawName = fileUrl.split('?')[0];
  const nameOnly = rawName.includes('/') ? rawName.split('/').pop() || rawName : rawName;
  const encodedName = encodeURIComponent(nameOnly);
  const path = safeBookId ? `${safeBookId}/${encodedName}` : encodedName;

  const publicPath = publicUrl ? `${publicUrl}/${path}` : null;
  const proxyPath = `/api/books/file?path=${encodeURIComponent(path)}`;
  return publicPath || proxyPath;
};

export const resolveBookFileFallback = (
  fileUrl?: string | null,
  bookId?: number | string
): { primary: string | null; fallback: string | null } => {
  if (!fileUrl) return { primary: null, fallback: null };
  if (fileUrl.startsWith('http')) return { primary: fileUrl, fallback: null };

  const basePublicUrl =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_BUCKET_URL;
  const publicUrl = basePublicUrl
    ? basePublicUrl.replace(/\/$/, '').endsWith('/public')
      ? `${basePublicUrl.replace(/\/$/, '')}/books`
      : basePublicUrl.replace(/\/$/, '')
    : null;
  const safeBookId = bookId ? String(bookId) : '';
  const rawName = fileUrl.split('?')[0];
  const nameOnly = rawName.includes('/') ? rawName.split('/').pop() || rawName : rawName;
  const encodedName = encodeURIComponent(nameOnly);
  const path = safeBookId ? `${safeBookId}/${encodedName}` : encodedName;

  return {
    primary: publicUrl ? `${publicUrl}/${path}` : null,
    fallback: `/api/books/file?path=${encodeURIComponent(path)}`,
  };
};
