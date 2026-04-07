import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

import express from 'express';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './src/db/pgSchema.ts';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import ImageKit from 'imagekit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL in environment variables.');
}

const db = drizzle(databaseUrl);
const DEFAULT_MAX_DAYS = 15;
const DEFAULT_BOOK_COVER_URL = '/cover_2.jpeg';

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@biblioteca.local';
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const imagekitPublicKey =
  process.env.IMAGEKIT_PUBLIC_KEY ||
  process.env.VITE_IMAGEKIT_PUBLIC_KEY ||
  process.env.NEXT_PUBLIC_PUBLIC_KEY;
const imagekitPrivateKey =
  process.env.IMAGEKIT_PRIVATE_KEY ||
  process.env.PRIVATE_KEY;
const imagekitUrlEndpoint =
  process.env.IMAGEKIT_URL_ENDPOINT ||
  process.env.VITE_IMAGEKIT_URL_ENDPOINT ||
  process.env.NEXT_PUBLIC_URL_ENDPOINT;
const imagekit =
  imagekitPublicKey && imagekitPrivateKey && imagekitUrlEndpoint
    ? new ImageKit({
      publicKey: imagekitPublicKey,
      privateKey: imagekitPrivateKey,
      urlEndpoint: imagekitUrlEndpoint,
    })
    : null;
let cachedImagekitAuth: { signature: string; expire: number; token: string } | null = null;
let imagekitAuthExpiry = 0;

const sseClients = new Map<string, Set<any>>();

const mapBookRow = (row: any) => ({
  id: row.id,
  title: row.title,
  author: row.author,
  genre: row.genre ?? '',
  totalCopies: row.totalCopies ?? 0,
  availableCopies: row.availableCopies ?? 0,
  cover: row.cover || DEFAULT_BOOK_COVER_URL,
  editora: row.editora ?? '',
  cdu: row.cdu ?? '',
  armario: row.armario ?? '',
  prateleira: row.prateleira ?? null,
  courseSequence: row.courseSequence ?? row.course_sequence ?? null,
  catalogCode: row.catalogCode ?? row.catalog_code ?? null,
  anoEdicao: row.anoEdicao ?? null,
  edicao: row.edicao ?? null,
  isbn: row.isbn,
  fileUrl: row.fileUrl ?? null,
  documentType: row.document_type ?? 1,
  isDigital: row.is_digital ?? Boolean(row.fileUrl),
  createdAt: row.created_at ?? row.createdAt,
});

const normalizeStatus = (status: string | null | undefined) => {
  if (!status) return status;
  return status.toLowerCase();
};

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

const createPhysicalCopies = async (bookId: number, copies: number) => {
  if (copies <= 0) return;
  const rows = Array.from({ length: copies }).map(() => ({
    bookId,
    borrowed: false,
    returnDate: null,
    userId: null,
    currTransactionId: 0,
  }));
  await db.insert(schema.physicalBooks).values(rows);
};

const normalizeCourseCode = (value: string | null | undefined) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);

const renumberBooksForGenre = async (genreName?: string | null) => {
  if (genreName && String(genreName).trim()) {
    await db.execute(sql`
      WITH ranked AS (
        SELECT
          b.id,
          ROW_NUMBER() OVER (
            PARTITION BY b.genre
            ORDER BY
              CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
              b.prateleira ASC,
              b.title ASC,
              b.id ASC
          )::int AS next_sequence,
          CONCAT(
            COALESCE(NULLIF(TRIM(g.code), ''), 'CUR'),
            '-',
            LPAD(
              ROW_NUMBER() OVER (
                PARTITION BY b.genre
                ORDER BY
                  CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
                  b.prateleira ASC,
                  b.title ASC,
                  b.id ASC
              )::text,
              3,
              '0'
            )
          ) AS next_catalog_code
        FROM books b
        LEFT JOIN genres g ON g.name = b.genre
        WHERE b.genre = ${genreName}
      )
      UPDATE books AS b
      SET
        course_sequence = ranked.next_sequence,
        catalog_code = ranked.next_catalog_code
      FROM ranked
      WHERE ranked.id = b.id
    `);
    return;
  }

  await db.execute(sql`
    WITH ranked AS (
      SELECT
        b.id,
        ROW_NUMBER() OVER (
          PARTITION BY b.genre
          ORDER BY
            CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
            b.prateleira ASC,
            b.title ASC,
            b.id ASC
        )::int AS next_sequence,
        CONCAT(
          COALESCE(NULLIF(TRIM(g.code), ''), 'CUR'),
          '-',
          LPAD(
            ROW_NUMBER() OVER (
              PARTITION BY b.genre
              ORDER BY
                CASE WHEN b.prateleira IS NULL THEN 1 ELSE 0 END,
                b.prateleira ASC,
                b.title ASC,
                b.id ASC
            )::text,
            3,
            '0'
          )
        ) AS next_catalog_code
      FROM books b
      LEFT JOIN genres g ON g.name = b.genre
    )
    UPDATE books AS b
    SET
      course_sequence = ranked.next_sequence,
      catalog_code = ranked.next_catalog_code
    FROM ranked
    WHERE ranked.id = b.id
  `);
};

const formatCatalogCode = (code: string, sequence: number) =>
  `${code}-${String(sequence).padStart(3, '0')}`;

const resolveBookCatalogData = async (input: {
  genre: string;
  armario?: string | null;
  currentBookId?: number;
  preserveSequence?: number | null;
  preserveCatalogCode?: string | null;
}) => {
  const genreName = String(input.genre || '').trim();
  const genreRow = genreName
    ? (
      await db
        .select()
        .from(schema.genres)
        .where(eq(schema.genres.name, genreName))
        .limit(1)
    )[0]
    : null;

  const courseCode = String(genreRow?.code || 'CUR').trim().toUpperCase();
  const armario = String(input.armario ?? genreRow?.defaultArmario ?? '').trim();

  if (input.preserveSequence && input.preserveCatalogCode) {
    return {
      armario,
      courseSequence: input.preserveSequence,
      catalogCode: input.preserveCatalogCode,
    };
  }

  const sameGenreBooks = await db
    .select({
      id: schema.books.id,
      courseSequence: schema.books.courseSequence,
    })
    .from(schema.books)
    .where(eq(schema.books.genre, genreName));

  const filtered = sameGenreBooks.filter((book) => book.id !== input.currentBookId);
  const nextSequence =
    filtered.reduce((max, book) => Math.max(max, Number(book.courseSequence ?? 0)), 0) + 1;

  return {
    armario,
    courseSequence: nextSequence,
    catalogCode: formatCatalogCode(courseCode, nextSequence),
  };
};

const addNotification = async (userId: string, title: string, message: string) => {
  const inserted = await db.insert(schema.notifications).values({
    userId,
    title,
    message,
    read: false,
  }).returning();

  const payload = { title, message };

  const clients = sseClients.get(userId);
  if (clients) {
    clients.forEach((res) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
  }

  if (vapidPublic && vapidPrivate) {
    const settings = await db.select().from(schema.notificationSettings)
      .where(eq(schema.notificationSettings.userId, userId))
      .limit(1);
    if (settings[0] && settings[0].pushEnabled === false) {
      return inserted[0];
    }
    const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          } as any,
          JSON.stringify(payload)
        )
      )
    );
  }

  return inserted[0];
};

const notifyAdmins = async (title: string, message: string) => {
  const admins = await db.select().from(schema.admin);
  if (!admins.length) return;
  await Promise.allSettled(admins.map((a) => addNotification(a.clerkId, title, message)));
};

const updateClerkRole = async (userId: string, role: 'student' | 'external') => {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) return;
  try {
    await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        public_metadata: { role },
      }),
    });
  } catch (error) {
    console.error('Failed to update Clerk role:', error);
  }
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.use((req, _res, next) => {
    const userId = req.headers['x-user-id'] as string;
    const isAdmin = req.headers['x-is-admin'] === 'true';
    (req as any).user = { id: userId, isAdmin };
    next();
  });

  app.get('/api/books', async (_req, res) => {
    try {
      const books = await db.select().from(schema.books).orderBy(asc(schema.books.id));
      res.json(books.map(mapBookRow));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao carregar livros' });
    }
  });

  app.get('/api/books/count', async (_req, res) => {
    const result = await db.select({ count: sql<number>`count(*)` }).from(schema.books);
    res.json({ count: result[0]?.count ?? 0 });
  });

  app.get('/api/genres', async (_req, res) => {
    try {
      const genres = await db
        .select()
        .from(schema.genres)
        .orderBy(asc(schema.genres.displayOrder), asc(schema.genres.name));
      res.json(genres);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro ao carregar cursos' });
    }
  });

  app.post('/api/genres', async (req, res) => {
    try {
      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome do curso obrigatorio' });

      const created = await db.insert(schema.genres).values({
        name,
        code: normalizeCourseCode(body.code) || null,
        displayOrder: body.displayOrder ? Number(body.displayOrder) : null,
        defaultArmario: String(body.defaultArmario || '').trim() || null,
        shelfStart: body.shelfStart === null || body.shelfStart === '' || body.shelfStart === undefined ? null : Number(body.shelfStart),
        shelfEnd: body.shelfEnd === null || body.shelfEnd === '' || body.shelfEnd === undefined ? null : Number(body.shelfEnd),
      }).returning();

      res.json(created[0]);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro ao criar curso' });
    }
  });

  app.put('/api/genres/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ error: 'Curso invalido' });

      const body = req.body || {};
      const name = String(body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Nome do curso obrigatorio' });
      const existing = await db.select().from(schema.genres).where(eq(schema.genres.id, id)).limit(1);
      if (!existing[0]) return res.status(404).json({ error: 'Curso nao encontrado' });

      const updated = await db.update(schema.genres).set({
        name,
        code: normalizeCourseCode(body.code) || null,
        displayOrder: body.displayOrder ? Number(body.displayOrder) : null,
        defaultArmario: String(body.defaultArmario || '').trim() || null,
        shelfStart: body.shelfStart === null || body.shelfStart === '' || body.shelfStart === undefined ? null : Number(body.shelfStart),
        shelfEnd: body.shelfEnd === null || body.shelfEnd === '' || body.shelfEnd === undefined ? null : Number(body.shelfEnd),
      }).where(eq(schema.genres.id, id)).returning();

      await db.update(schema.books)
        .set({ genre: updated[0].name })
        .where(eq(schema.books.genre, existing[0].name));

      await db.update(schema.books)
        .set({ armario: String(updated[0].defaultArmario || '').trim() || null })
        .where(and(eq(schema.books.genre, updated[0].name), sql`(armario IS NULL OR trim(armario) = '')`));

      await renumberBooksForGenre(updated[0].name);
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro ao atualizar curso' });
    }
  });

  app.post('/api/genres/renumber', async (req, res) => {
    try {
      const genreName = String(req.body?.genreName || '').trim();
      await renumberBooksForGenre(genreName || undefined);
      res.json({ success: true, scope: genreName || 'all' });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erro ao renumerar curso' });
    }
  });

  app.get('/api/books/recommendations', async (_req, res) => {
    const books = await db.select().from(schema.books).orderBy(desc(schema.books.availableCopies)).limit(6);
    res.json(books.map(mapBookRow));
  });

  app.get('/api/books/:id', async (req, res) => {
    const bookId = Number(req.params.id);
    if (Number.isNaN(bookId)) return res.status(400).json({ error: 'Livro invalido' });
    const book = await db.select().from(schema.books).where(eq(schema.books.id, bookId)).limit(1);
    if (!book[0]) return res.status(404).json({ error: 'Livro nao encontrado' });
    res.json(mapBookRow(book[0]));
  });

  app.get('/api/books/cover', async (req, res) => {
    const { isbn } = req.query as { isbn?: string };
    if (!isbn) return res.status(400).json({ error: 'ISBN obrigatorio' });
    const url = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    res.json({ url });
  });

  app.get('/api/books/file-check', async (req, res) => {
    const { url } = req.query as { url?: string };
    if (!url) return res.status(400).json({ ok: false, error: 'URL obrigatoria' });
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return res.json({ ok: response.ok, status: response.status });
    } catch (error: any) {
      return res.json({ ok: false, error: error.message || 'Falha ao validar' });
    }
  });

  app.get('/api/auth', async (_req, res) => {
    if (!imagekit) {
      return res.status(500).json({ error: 'ImageKit nao configurado' });
    }
    const now = Date.now();
    if (cachedImagekitAuth && imagekitAuthExpiry > now) {
      return res.json(cachedImagekitAuth);
    }
    const auth = imagekit.getAuthenticationParameters();
    cachedImagekitAuth = auth;
    imagekitAuthExpiry = now + 10 * 60 * 1000;
    return res.json(auth);
  });

  app.get('/api/books/file', async (req, res) => {
    const rawQuery = req.query.path ?? req.query.p ?? req.query.file;
    let pathParam = '';
    if (typeof rawQuery === 'string') pathParam = rawQuery;
    if (Array.isArray(rawQuery)) pathParam = rawQuery[0] ?? '';
    if (!pathParam) {
      const parsed = new URL(req.originalUrl, 'http://localhost').searchParams.get('path');
      if (parsed) pathParam = parsed;
    }
    if (!pathParam) {
      return res.status(400).json({ error: 'Path obrigatorio' });
    }

    if (!supabase) return res.status(500).json({ error: 'Supabase nao configurado' });

    let cleanPath = pathParam.trim();
    if (cleanPath.startsWith('http')) {
      const marker = '/storage/v1/object/public/books/';
      const idx = cleanPath.indexOf(marker);
      if (idx >= 0) cleanPath = cleanPath.slice(idx + marker.length);
    }
    try {
      cleanPath = decodeURIComponent(cleanPath);
    } catch {
      // keep as-is if decoding fails
    }

    try {
      const { data, error } = await supabase.storage.from('books').createSignedUrl(cleanPath, 60 * 5);
      if (error || !data?.signedUrl) {
        return res.status(404).json({ error: 'Arquivo nao encontrado' });
      }
      return res.redirect(data.signedUrl);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Erro ao carregar ficheiro' });
    }
  });

  app.post('/api/books', async (req, res) => {
    const { bookId, fileName, base64 } = req.body || {};
    if (!bookId || !fileName || !base64) {
      return res.status(400).json({ error: 'Campos obrigatorios em falta (bookId, fileName, base64)' });
    }
    if (!supabase) return res.status(500).json({ error: 'Supabase nao configurado' });

    const normalizeFileName = (name: string) =>
      name
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-zA-Z0-9_.]/g, '_');

    const safeFileName = normalizeFileName(String(fileName));
    const filePath = `${bookId}/${safeFileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('books')
        .upload(filePath, Buffer.from(base64, 'base64'), {
          contentType: getContentType(String(fileName)),
          upsert: true,
        });

      if (uploadError) {
        return res.status(500).json({ error: 'Erro ao fazer upload para o Supabase Storage' });
      }

      await db.update(schema.books)
        .set({ fileUrl: safeFileName })
        .where(eq(schema.books.id, Number(bookId)));

      return res.json({
        success: true,
        fileUrl: safeFileName,
        url: `${bookId}/${safeFileName}`,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Erro ao processar o upload' });
    }
  });

  app.post('/api/admin/books', async (req, res) => {
    try {
      const body = req.body;
      const hasDigital = Boolean(body.fileUrl) || body.hasDigital === true || body.isDigital === true || body.documentType === 2;
      const isPhysical = (body.documentType ?? 1) !== 2;
      const totalCopies = isPhysical ? Number(body.totalCopies ?? 1) : 0;
      const availableCopies = isPhysical ? totalCopies : 0;
      const catalogData = await resolveBookCatalogData({
        genre: body.genre ?? '',
        armario: body.armario ?? null,
      });

      const inserted = await db.insert(schema.books).values({
        title: body.title,
        author: body.author,
        genre: body.genre ?? '',
        totalCopies,
        availableCopies,
        cover: body.cover || DEFAULT_BOOK_COVER_URL,
        editora: body.editora ?? null,
        cdu: body.cdu ?? null,
        armario: catalogData.armario || null,
        prateleira: body.prateleira ?? null,
        courseSequence: catalogData.courseSequence,
        catalogCode: catalogData.catalogCode,
        anoEdicao: body.anoEdicao ?? null,
        edicao: body.edicao ?? null,
        isbn: body.isbn,
        fileUrl: body.fileUrl ?? null,
        document_type: body.documentType ?? 1,
        is_digital: hasDigital,
      }).returning();

      const created = inserted[0];
      if (isPhysical && availableCopies > 0) {
        await createPhysicalCopies(created.id, availableCopies);
      }
      res.json(mapBookRow(created));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao criar livro' });
    }
  });

  app.put('/api/admin/books/:id', async (req, res) => {
    try {
      const bookId = Number(req.params.id);
      if (Number.isNaN(bookId)) return res.status(400).json({ error: 'Livro invalido' });

      const body = req.body;
      const existing = await db.select().from(schema.books).where(eq(schema.books.id, bookId)).limit(1);
      if (!existing[0]) return res.status(404).json({ error: 'Livro nao encontrado' });

      const addCopies = Number(body.addCopies ?? 0);
      const nextDocumentType = body.documentType ?? existing[0].document_type ?? 1;
      const isPhysical = nextDocumentType !== 2;
      const hasDigital = Boolean(body.fileUrl ?? existing[0].fileUrl) || body.hasDigital === true || body.isDigital === true || nextDocumentType === 2;
      const nextGenre = body.genre ?? existing[0].genre ?? '';
      const genreChanged = nextGenre !== existing[0].genre;
      const catalogData = await resolveBookCatalogData({
        genre: nextGenre,
        armario: body.armario ?? existing[0].armario ?? null,
        currentBookId: bookId,
        preserveSequence: genreChanged ? null : (existing[0].courseSequence ?? existing[0].course_sequence ?? null),
        preserveCatalogCode: genreChanged ? null : (existing[0].catalogCode ?? existing[0].catalog_code ?? null),
      });

      const baseTotal = Number(body.totalCopies ?? existing[0].totalCopies ?? 0);
      const totalCopies = isPhysical ? baseTotal + Math.max(addCopies, 0) : 0;
      const availableCopies = isPhysical ? (existing[0].availableCopies ?? 0) + Math.max(addCopies, 0) : 0;

      const updated = await db.update(schema.books).set({
        title: body.title ?? existing[0].title,
        author: body.author ?? existing[0].author,
        genre: nextGenre,
        totalCopies,
        availableCopies,
        cover: body.cover ?? existing[0].cover ?? DEFAULT_BOOK_COVER_URL,
        editora: body.editora ?? existing[0].editora ?? null,
        cdu: body.cdu ?? existing[0].cdu ?? null,
        armario: catalogData.armario || null,
        prateleira: body.prateleira ?? existing[0].prateleira ?? null,
        courseSequence: catalogData.courseSequence,
        catalogCode: catalogData.catalogCode,
        anoEdicao: body.anoEdicao ?? existing[0].anoEdicao ?? null,
        edicao: body.edicao ?? existing[0].edicao ?? null,
        isbn: body.isbn ?? existing[0].isbn,
        fileUrl: body.fileUrl ?? existing[0].fileUrl,
        document_type: nextDocumentType,
        is_digital: hasDigital,
      }).where(eq(schema.books.id, bookId)).returning();

      if (isPhysical && addCopies > 0) {
        await createPhysicalCopies(bookId, addCopies);
      }
      if (!isPhysical) {
        await db.delete(schema.physicalBooks).where(eq(schema.physicalBooks.bookId, bookId));
      }

      res.json(mapBookRow(updated[0]));
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao atualizar livro' });
    }
  });

  app.post('/api/books/:id/add-to-shelf', async (req, res) => {
    const bookId = Number(req.params.id);
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Nao autorizado' });
    if (Number.isNaN(bookId)) return res.status(400).json({ success: false, message: 'Livro invalido' });

    try {
      await db.insert(schema.userDigitalBooks).values({
        userId,
        bookId,
      });
      res.json({ success: true, message: 'Livro adicionado a estante.' });
    } catch {
      res.status(400).json({ success: false, message: 'Livro ja existe na sua estante.' });
    }
  });

  app.post('/api/transactions/borrow', async (req, res) => {
    const { bookId, userId } = req.body;
    if (!bookId || !userId) return res.status(400).json({ error: 'Dados em falta' });

    const now = new Date();
    const book = await db.select().from(schema.books).where(eq(schema.books.id, bookId)).limit(1);
    if (!book[0]) return res.status(404).json({ error: 'Livro nao encontrado' });
    if (book[0].is_digital) return res.status(400).json({ error: 'Livro digital nao requer emprestimo' });
    if ((book[0].availableCopies ?? 0) <= 0) {
      return res.status(400).json({ error: 'Sem exemplares disponiveis' });
    }

    const anyPhysical = await db
      .select()
      .from(schema.physicalBooks)
      .where(eq(schema.physicalBooks.bookId, bookId))
      .limit(1);

    if (!anyPhysical[0] && (book[0].totalCopies ?? 0) > 0) {
      await createPhysicalCopies(bookId, book[0].totalCopies ?? 0);
    }

    const physicalRef = anyPhysical[0]
      || (await db.select().from(schema.physicalBooks).where(eq(schema.physicalBooks.bookId, bookId)).limit(1))[0];

    if (!physicalRef) return res.status(400).json({ error: 'Sem exemplares disponiveis' });

    const transaction = await db.insert(schema.transactions).values({
      physicalBookId: physicalRef.pid,
      userId,
      adminId: 'pending',
      status: 'PENDING',
      borrowedDate: now,
      returnedDate: null,
      scoreApplied: false,
      user_name: userId,
    }).returning();

    await addNotification(userId, 'Pedido enviado', `O seu pedido do livro "${book[0].title}" foi enviado para aprovacao.`);
    await notifyAdmins('Novo pedido de emprestimo', `Pedido de ${userId} para "${book[0].title}".`);

    res.json({
      tid: transaction[0].tid,
      status: normalizeStatus(transaction[0].status),
      message: 'Pedido enviado para aprovacao.',
    });
  });

  app.post('/api/transactions/borrow-bulk', async (req, res) => {
    const { bookIds, userId } = req.body;
    const adminId = (req as any).user?.id || 'system';

    if (!Array.isArray(bookIds) || !userId) return res.status(400).json({ error: 'Dados em falta' });

    const userRecord = await db.select().from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);
    let userName = userRecord[0]?.fullName || null;
    const userEmail = userRecord[0]?.primaryEmail || null;
    if (!userName) {
      const verification = await db.select().from(schema.studentVerifications)
        .where(eq(schema.studentVerifications.clerkId, userId))
        .limit(1);
      userName = verification[0]?.fullName || null;
    }

    const results: any[] = [];
    const errors: any[] = [];
    const now = new Date();
    const expectedReturnDate = new Date(now.getTime() + DEFAULT_MAX_DAYS * 24 * 60 * 60 * 1000);

    for (const bookId of bookIds) {
      const physical = await db
        .select()
        .from(schema.physicalBooks)
        .where(and(
          eq(schema.physicalBooks.bookId, bookId),
          eq(schema.physicalBooks.borrowed, false)
        ))
        .limit(1);

      if (!physical[0]) {
        errors.push({ bookId, error: 'Sem exemplares disponiveis' });
        continue;
      }

      const transaction = await db.insert(schema.transactions).values({
        physicalBookId: physical[0].pid,
        userId,
        adminId,
        status: 'BORROWED',
        borrowedDate: now,
        returnedDate: null,
        scoreApplied: false,
        user_name: userId,
      }).returning();

      await db.update(schema.physicalBooks)
        .set({
          borrowed: true,
          userId,
          currTransactionId: transaction[0].tid,
          returnDate: expectedReturnDate,
        })
        .where(eq(schema.physicalBooks.pid, physical[0].pid));

      const book = await db.select().from(schema.books).where(eq(schema.books.id, bookId)).limit(1);
      if (book[0]) {
        await db.update(schema.books)
          .set({ availableCopies: Math.max((book[0].availableCopies ?? 0) - 1, 0) })
          .where(eq(schema.books.id, bookId));
      }

      results.push({
        tid: transaction[0].tid,
        userId: transaction[0].userId,
        userName,
        userEmail,
        borrowedDate: transaction[0].borrowedDate,
        status: normalizeStatus(transaction[0].status),
        bookTitle: book[0]?.title,
        bookAuthor: book[0]?.author,
        isbn: book[0]?.isbn,
      });
    }

    res.json({ success: results.length > 0, results, errors });
  });

  app.post('/api/transactions/accept', async (req, res) => {
    const { tid, userId } = req.body || {};
    if (!tid || !userId) return res.status(400).json({ error: 'Dados invalidos' });

    const adminId = (req as any).user?.id ?? 'system';
    const tx = await db.select().from(schema.transactions).where(eq(schema.transactions.tid, tid)).limit(1);
    if (!tx[0]) return res.status(404).json({ error: 'Transacao nao encontrada' });
    if (tx[0].status !== 'PENDING') return res.status(400).json({ error: 'Transacao nao esta pendente' });

    const physicalRef = await db.select().from(schema.physicalBooks)
      .where(eq(schema.physicalBooks.pid, tx[0].physicalBookId))
      .limit(1);
    if (!physicalRef[0]) return res.status(400).json({ error: 'Exemplar fisico nao encontrado' });

    const bookId = physicalRef[0].bookId;
    const book = await db.select().from(schema.books).where(eq(schema.books.id, bookId)).limit(1);
    if (!book[0]) return res.status(404).json({ error: 'Livro nao encontrado' });
    if ((book[0].availableCopies ?? 0) <= 0) return res.status(400).json({ error: 'Sem exemplares disponiveis' });

    const availablePhysical = await db.select().from(schema.physicalBooks)
      .where(and(eq(schema.physicalBooks.bookId, bookId), eq(schema.physicalBooks.borrowed, false)))
      .limit(1);
    if (!availablePhysical[0]) return res.status(400).json({ error: 'Sem exemplares disponiveis' });

    const now = new Date();
    const expectedReturnDate = new Date(now.getTime() + DEFAULT_MAX_DAYS * 24 * 60 * 60 * 1000);

    await db.update(schema.transactions).set({
      status: 'BORROWED',
      adminId,
      borrowedDate: now,
      physicalBookId: availablePhysical[0].pid,
    }).where(eq(schema.transactions.tid, tid));

    await db.update(schema.physicalBooks)
      .set({
        borrowed: true,
        userId,
        currTransactionId: tid,
        returnDate: expectedReturnDate,
      })
      .where(eq(schema.physicalBooks.pid, availablePhysical[0].pid));

    await db.update(schema.books)
      .set({ availableCopies: Math.max((book[0].availableCopies ?? 0) - 1, 0) })
      .where(eq(schema.books.id, bookId));

    await addNotification(userId, 'Pedido aprovado', `O seu pedido do livro "${book[0].title}" foi aprovado.`);

    res.json({ success: true });
  });

  app.post('/api/transactions/reject', async (req, res) => {
    const { tid, userId } = req.body || {};
    if (!tid || !userId) return res.status(400).json({ error: 'Dados invalidos' });

    const adminId = (req as any).user?.id ?? 'system';
    const tx = await db.select().from(schema.transactions).where(eq(schema.transactions.tid, tid)).limit(1);
    if (!tx[0]) return res.status(404).json({ error: 'Transacao nao encontrada' });
    if (tx[0].status !== 'PENDING') return res.status(400).json({ error: 'Transacao nao esta pendente' });

    await db.update(schema.transactions).set({
      status: 'REJECTED',
      adminId,
      returnedDate: new Date(),
    }).where(eq(schema.transactions.tid, tid));

    await addNotification(userId, 'Pedido rejeitado', 'O seu pedido de emprestimo foi rejeitado.');

    res.json({ success: true });
  });

  app.post('/api/transactions/return', async (req, res) => {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: 'Transacao invalida' });

    const transaction = await db.select().from(schema.transactions).where(eq(schema.transactions.tid, transactionId)).limit(1);
    if (!transaction[0] || transaction[0].status !== 'BORROWED') {
      return res.status(400).json({ error: 'Transacao invalida' });
    }

    await db.update(schema.transactions).set({
      status: 'RETURNED',
      returnedDate: new Date(),
    }).where(eq(schema.transactions.tid, transactionId));

    const physical = await db.update(schema.physicalBooks)
      .set({
        borrowed: false,
        userId: null,
        currTransactionId: 0,
        returnDate: null,
      })
      .where(eq(schema.physicalBooks.pid, transaction[0].physicalBookId))
      .returning();

    if (physical[0]?.bookId) {
      const book = await db.select().from(schema.books).where(eq(schema.books.id, physical[0].bookId)).limit(1);
      if (book[0]) {
        await db.update(schema.books)
          .set({ availableCopies: (book[0].availableCopies ?? 0) + 1 })
          .where(eq(schema.books.id, physical[0].bookId));
      }
    }

    await addNotification(transaction[0].userId, 'Livro devolvido', 'A devolucao foi registada com sucesso.');
    res.json({ success: true });
  });

  app.get('/api/admin/stats', async (_req, res) => {
    const booksCount = await db.select({ count: sql<number>`count(*)` }).from(schema.books);
    const usersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const borrowsCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, 'BORROWED'));
    const pendingCount = await db.select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.status, 'PENDING'));

    res.json({
      books: booksCount[0]?.count ?? 0,
      users: usersCount[0]?.count ?? 0,
      borrows: borrowsCount[0]?.count ?? 0,
      pending: pendingCount[0]?.count ?? 0,
    });
  });

  app.get('/api/admin/users', async (req, res) => {
    const { verified } = req.query as { verified?: string };
    let users = await db.select().from(schema.users);

    if (verified === 'true') {
      const verifications = await db.select().from(schema.studentVerifications);
      const approvedIds = new Set<string>(
        verifications
          .filter((s) => String(s.status || '').toLowerCase() === 'approved')
          .map((s) => s.clerkId)
      );
      users = users.filter((u) => approvedIds.has(u.clerkId) && (u.role || '').toLowerCase() === 'student');
    }

    const mapped = users.map(u => ({
      clerkId: u.clerkId,
      primaryEmail: u.primaryEmail,
      fullName: u.fullName ?? '',
      role: u.role ?? 'external',
    }));
    res.json(mapped);
  });

  app.get('/api/user/profile', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });
    const record = await db.select().from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);
    res.json(record[0] || { fullName: '' });
  });

  app.post('/api/user/profile', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });
    const { fullName, email, role } = req.body || {};
    const name = String(fullName || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome completo obrigatorio' });

    await db.insert(schema.users).values({
      clerkId: userId,
      primaryEmail: email || '',
      fullName: name,
      role: role || 'external',
    }).onConflictDoUpdate({
      target: schema.users.clerkId,
      set: { fullName: name, primaryEmail: email || '', role: role || 'external' },
    });

    res.json({ success: true });
  });

  app.get('/api/user/count', async (_req, res) => {
    const result = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    res.json({ count: result[0]?.count ?? 0 });
  });

  app.get('/api/admin/pending-users', async (_req, res) => {
    const pending = await db.select().from(schema.verifyPending).orderBy(desc(schema.verifyPending.id));
    const mapped = pending.map(u => ({
      clerkId: u.clerkId,
      email: u.email,
    }));
    res.json(mapped);
  });

  app.post('/api/student-verifications', async (req, res) => {
    const userId = (req as any).user?.id;
    const { studentNumber, fullName } = req.body;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });
    if (!studentNumber || !fullName) return res.status(400).json({ error: 'Dados em falta' });

    try {
      await db.insert(schema.studentVerifications).values({
        clerkId: userId,
        fullName,
        studentNumber,
        status: 'pending',
        createdAt: new Date(),
      });
      await db.insert(schema.studentsVerifications).values({
        clerkId: userId,
        fullName,
        studentNumber,
        status: 'pending',
        createdAt: new Date(),
      });

      await notifyAdmins(
        'Nova verificacao de estudante',
        `Pedido de verificacao: ${fullName} (${studentNumber})`
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Erro ao enviar pedido' });
    }
  });

  app.get('/api/admin/student-verifications', async (_req, res) => {
    const pending = await db.select().from(schema.studentVerifications)
      .orderBy(desc(schema.studentVerifications.createdAt));
    res.json(pending);
  });

  app.post('/api/admin/student-verifications/:id/decision', async (req, res) => {
    const id = Number(req.params.id);
    const { approve } = req.body;
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Pedido invalido' });

    const entry = await db.select().from(schema.studentVerifications)
      .where(eq(schema.studentVerifications.id, id)).limit(1);
    if (!entry[0]) return res.status(404).json({ error: 'Pedido nao encontrado' });

    const newStatus = approve ? 'approved' : 'rejected';
    await db.update(schema.studentVerifications)
      .set({ status: newStatus, verifiedAt: new Date() })
      .where(eq(schema.studentVerifications.id, id));
    await db.update(schema.studentsVerifications)
      .set({ status: newStatus, verifiedAt: new Date() })
      .where(eq(schema.studentsVerifications.clerkId, entry[0].clerkId));

    await db.update(schema.users)
      .set({ role: approve ? 'student' : 'external' })
      .where(eq(schema.users.clerkId, entry[0].clerkId));

    await updateClerkRole(entry[0].clerkId, approve ? 'student' : 'external');

    await addNotification(
      entry[0].clerkId,
      approve ? 'Verificacao aprovada' : 'Verificacao rejeitada',
      approve
        ? 'O seu pedido foi aprovado. A sua conta agora e considerada estudante.'
        : 'O seu pedido foi rejeitado. A sua conta permanece como externo.'
    );

    res.json({ success: true });
  });

  app.post('/api/admin/approve-user', async (req, res) => {
    const { clerkId, approve } = req.body;
    if (!clerkId) return res.status(400).json({ error: 'ID invalido' });

    const pending = await db.select().from(schema.verifyPending).where(eq(schema.verifyPending.clerkId, clerkId)).limit(1);
    if (!pending[0]) return res.status(404).json({ error: 'Pedido nao encontrado' });

    if (approve) {
      await db.insert(schema.users).values({
        clerkId: pending[0].clerkId ?? clerkId,
        primaryEmail: pending[0].email,
        fullName: '',
        role: 'external',
      });
    }

    await db.delete(schema.verifyPending).where(eq(schema.verifyPending.clerkId, clerkId));
    res.json({ success: true });
  });

  app.get('/api/notifications/:userId', async (req, res) => {
    const { userId } = req.params;
    const notes = await db.select().from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt));
    res.json(notes);
  });

  app.get('/api/notifications/unread-count', async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });

    const settings = await db.select().from(schema.notificationSettings)
      .where(eq(schema.notificationSettings.userId, userId)).limit(1);
    const lastSeen = settings[0]?.lastSeenAt;

    const query = lastSeen
      ? db.select({ count: sql<number>`count(*)` }).from(schema.notifications).where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false),
            gte(schema.notifications.createdAt, lastSeen)
          )
        )
      : db.select({ count: sql<number>`count(*)` }).from(schema.notifications).where(
          and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false))
        );

    const result = await query;
    res.json({ count: result[0]?.count ?? 0 });
  });

  app.post('/api/notifications/mark-seen', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });
    const now = new Date();

    await db.update(schema.notifications)
      .set({ read: true })
      .where(eq(schema.notifications.userId, userId));

    await db.insert(schema.notificationSettings)
      .values({ userId, lastSeenAt: now, pushEnabled: true })
      .onConflictDoUpdate({ target: schema.notificationSettings.userId, set: { lastSeenAt: now } });

    res.json({ success: true });
  });

  app.get('/api/notifications/settings', async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId requerido' });
    const settings = await db.select().from(schema.notificationSettings)
      .where(eq(schema.notificationSettings.userId, userId)).limit(1);
    res.json(settings[0] || { userId, pushEnabled: true, lastSeenAt: null });
  });

  app.post('/api/notifications/settings', async (req, res) => {
    const userId = (req as any).user?.id;
    const { pushEnabled } = req.body || {};
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });

    await db.insert(schema.notificationSettings)
      .values({ userId, pushEnabled: !!pushEnabled })
      .onConflictDoUpdate({ target: schema.notificationSettings.userId, set: { pushEnabled: !!pushEnabled } });

    res.json({ success: true });
  });

  app.get('/api/notifications/stream', async (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).end();
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const clients = sseClients.get(userId) || new Set();
    clients.add(res);
    sseClients.set(userId, clients);

    res.write('event: ready\n');
    res.write('data: {}\n\n');

    req.on('close', () => {
      const set = sseClients.get(userId);
      if (set) {
        set.delete(res);
        if (set.size === 0) sseClients.delete(userId);
      }
    });
  });

  app.post('/api/push/subscribe', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Subscricao invalida' });

    await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, endpoint));
    await db.insert(schema.pushSubscriptions).values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    });

    res.json({ success: true });
  });

  app.post('/api/notifications/:userId/read', async (req, res) => {
    const { userId } = req.params;
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, userId));
    res.json({ success: true });
  });

  app.get('/api/user/shelf', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });

    const shelf = await db.select().from(schema.userDigitalBooks)
      .where(eq(schema.userDigitalBooks.userId, userId));

    const enriched = await Promise.all(shelf.map(async (row) => {
      const book = await db.select().from(schema.books).where(eq(schema.books.id, row.bookId)).limit(1);
      return {
        id: row.id,
        addedAt: row.addedAt,
        book: book[0] ? mapBookRow(book[0]) : null,
      };
    }));

    res.json(enriched.filter((b) => b.book));
  });

  app.get('/api/user/history', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });

    const transactions = await db.select().from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .orderBy(desc(schema.transactions.borrowedDate));

    const filtered = transactions.filter((t) => t.status === 'BORROWED' || t.status === 'RETURNED');
    const enriched = await Promise.all(filtered.map(async (t) => {
      const pbook = await db.select().from(schema.physicalBooks).where(eq(schema.physicalBooks.pid, t.physicalBookId)).limit(1);
      const book = pbook[0] ? await db.select().from(schema.books).where(eq(schema.books.id, pbook[0].bookId)).limit(1) : [];
      return {
        tid: t.tid,
        status: normalizeStatus(t.status),
        borrowedDate: t.borrowedDate,
        returnedDate: t.returnedDate,
        expectedReturnDate: pbook[0]?.returnDate ?? null,
        bookTitle: book[0]?.title ?? 'N/D',
        bookAuthor: book[0]?.author ?? 'N/D',
        book: book[0] ? mapBookRow(book[0]) : null,
      };
    }));

    res.json(enriched);
  });

  app.get('/api/user/score', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });
    const score = await db.select().from(schema.userScores).where(eq(schema.userScores.userId, userId)).limit(1);
    res.json({ points: score[0]?.points ?? 100 });
  });

  app.get('/api/user/student-info', async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Nao autorizado' });

    const record = await db.select().from(schema.studentVerifications)
      .where(eq(schema.studentVerifications.clerkId, userId))
      .orderBy(desc(schema.studentVerifications.createdAt))
      .limit(1);
    const recordAlt = await db.select().from(schema.studentsVerifications)
      .where(eq(schema.studentsVerifications.clerkId, userId))
      .orderBy(desc(schema.studentsVerifications.createdAt))
      .limit(1);

    const user = await db.select().from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);

    res.json({
      fullName: record[0]?.fullName ?? recordAlt[0]?.fullName ?? null,
      studentNumber: record[0]?.studentNumber ?? recordAlt[0]?.studentNumber ?? null,
      status: record[0]?.status ?? recordAlt[0]?.status ?? null,
      verifiedAt: record[0]?.verifiedAt ?? recordAlt[0]?.verifiedAt ?? null,
      role: user[0]?.role ?? 'external',
    });
  });

  app.get('/api/admin/reports/activity', async (req, res) => {
    const { start, end, includePending, status } = req.query as {
      start?: string;
      end?: string;
      includePending?: string;
      status?: string;
    };
      const borrowedDateOnly = sql<string>`date(${schema.transactions.borrowedDate})`;
      let query = db.select({
        tid: schema.transactions.tid,
        physicalBookId: schema.transactions.physicalBookId,
        userId: schema.transactions.userId,
        adminId: schema.transactions.adminId,
        status: schema.transactions.status,
        borrowedDate: schema.transactions.borrowedDate,
        returnedDate: schema.transactions.returnedDate,
        scoreApplied: schema.transactions.scoreApplied,
      }).from(schema.transactions).orderBy(desc(schema.transactions.borrowedDate));
      const dateFilters = [
        start ? gte(borrowedDateOnly, start) : undefined,
        end ? lte(borrowedDateOnly, end) : undefined,
      ].filter(Boolean);
      if (dateFilters.length > 0) {
        query = query.where(and(...dateFilters));
      }

    let data: any[] = [];
    try {
      data = await query;
    } catch (error: any) {
      console.error('Erro ao carregar relatorio de atividade:', error?.message || error);
      return res.json([]);
    }
    const normalizedStatus = status ? status.toLowerCase() : '';
    const filtered = (data || []).filter((t) => {
      const current = normalizeStatus(t.status);
      if (normalizedStatus && normalizedStatus !== 'all') {
        return current === normalizedStatus;
      }
      if (includePending === 'true') return true;
      return t.status !== 'PENDING' && t.status !== 'REJECTED';
    });
    const usersMap = new Map<string, any>(
      (await db.select().from(schema.users)).map((u) => [u.clerkId, u])
    );

    const activities = await Promise.all(filtered.map(async (t) => {
      const pbook = await db.select().from(schema.physicalBooks).where(eq(schema.physicalBooks.pid, t.physicalBookId)).limit(1);
      const book = pbook[0] ? await db.select().from(schema.books).where(eq(schema.books.id, pbook[0].bookId)).limit(1) : [];
      const userInfo = usersMap.get(t.userId);
      const adminInfo = usersMap.get(t.adminId);
      return {
        tid: t.tid,
        userId: t.userId,
        userName: userInfo?.fullName || null,
        userEmail: userInfo?.primaryEmail || null,
        adminId: t.adminId,
        adminName: adminInfo?.fullName || null,
        adminEmail: adminInfo?.primaryEmail || null,
        borrowedDate: t.borrowedDate,
        status: normalizeStatus(t.status),
        physicalBookId: t.physicalBookId,
        bookTitle: book[0]?.title ?? 'N/D',
        bookAuthor: book[0]?.author ?? 'N/D',
        isbn: book[0]?.isbn ?? 'N/D',
        catalogCode: book[0]?.catalogCode ?? book[0]?.catalog_code ?? null,
        bookArmario: book[0]?.armario ?? null,
        bookPrateleira: book[0]?.prateleira ?? null,
        bookGenre: book[0]?.genre ?? null,
      };
    }));
    res.json(activities);
  });

  app.get('/api/admin/reports/never-borrowed', async (_req, res) => {
    const [books, physicalBooks, transactions] = await Promise.all([
      db.select().from(schema.books),
      db.select().from(schema.physicalBooks),
      db.select().from(schema.transactions),
    ]);

    const physicalToBookId = new Map<number, number>();
    physicalBooks.forEach((copy) => {
      physicalToBookId.set(copy.pid, copy.bookId);
    });

    const borrowedBookIds = new Set<number>();
    transactions.forEach((transaction) => {
      const bookId = physicalToBookId.get(transaction.physicalBookId);
      if (bookId) borrowedBookIds.add(bookId);
    });

    const neverBorrowed = books
      .filter((book) => !borrowedBookIds.has(book.id))
      .map((book) => {
        const rawBook = book as any;
        return {
          id: book.id,
          title: book.title ?? 'N/D',
          author: book.author ?? 'N/D',
          genre: book.genre ?? '',
          isbn: book.isbn ?? 'N/D',
          catalogCode: rawBook.catalogCode ?? rawBook.catalog_code ?? null,
          armario: book.armario ?? null,
          prateleira: book.prateleira ?? null,
          totalCopies: rawBook.totalCopies ?? rawBook.total_copies ?? 0,
          availableCopies: rawBook.availableCopies ?? rawBook.available_copies ?? 0,
          isDigital: rawBook.isDigital ?? rawBook.is_digital ?? false,
        };
      })
      .sort((a, b) => {
        const genreCompare = String(a.genre || '').localeCompare(String(b.genre || ''), undefined, { sensitivity: 'base' });
        if (genreCompare !== 0) return genreCompare;

        const armarioCompare = String(a.armario || '').localeCompare(String(b.armario || ''), undefined, { numeric: true, sensitivity: 'base' });
        if (armarioCompare !== 0) return armarioCompare;

        const shelfA = Number.isFinite(Number(a.prateleira)) ? Number(a.prateleira) : Number.MAX_SAFE_INTEGER;
        const shelfB = Number.isFinite(Number(b.prateleira)) ? Number(b.prateleira) : Number.MAX_SAFE_INTEGER;
        if (shelfA !== shelfB) return shelfA - shelfB;

        return String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' });
      });

    res.json(neverBorrowed);
  });

  app.get('/api/admin/reports/users', async (_req, res) => {
    const users = await db.select().from(schema.users);
    const activeTransactions = await db.select().from(schema.transactions)
      .where(eq(schema.transactions.status, 'BORROWED'));

    const enriched = await Promise.all(activeTransactions.map(async (t) => {
      const pbook = await db.select().from(schema.physicalBooks).where(eq(schema.physicalBooks.pid, t.physicalBookId)).limit(1);
      const book = pbook[0] ? await db.select().from(schema.books).where(eq(schema.books.id, pbook[0].bookId)).limit(1) : [];
      return {
        tid: t.tid,
        userId: t.userId,
        borrowedDate: t.borrowedDate,
        physicalBookId: t.physicalBookId,
        bookTitle: book[0]?.title ?? 'N/D',
      };
    }));

    const reports = users.map(u => ({
      clerkId: u.clerkId,
      primaryEmail: u.primaryEmail,
      fullName: u.fullName ?? '',
      status: u.role ?? 'member',
      createdAt: null,
      activeBorrows: enriched.filter(t => t.userId === u.clerkId),
    }));

    res.json(reports);
  });

  app.get('/api/health/db', async (_req, res) => {
    try {
      const checks = {
        books: false,
        users: false,
        verifyPending: false,
        physical_books: false,
        transactions: false,
        user_digital_books: false,
        notifications: false,
      };

      await db.select({ count: sql<number>`count(*)` }).from(schema.books);
      checks.books = true;

      await db.select({ count: sql<number>`count(*)` }).from(schema.users);
      checks.users = true;

      await db.select({ count: sql<number>`count(*)` }).from(schema.verifyPending);
      checks.verifyPending = true;

      await db.select({ count: sql<number>`count(*)` }).from(schema.physicalBooks);
      checks.physical_books = true;

      await db.select({ count: sql<number>`count(*)` }).from(schema.transactions);
      checks.transactions = true;

      await db.select({ count: sql<number>`count(*)` }).from(schema.userDigitalBooks);
      checks.user_digital_books = true;

      await db.select({ count: sql<number>`count(*)` }).from(schema.notifications);
      checks.notifications = true;

      res.json({ ok: true, checks });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: error.message || 'DB health check failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
