import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function readPhysicalBooksByUser(userId: string) {
  return db
    .select()
    .from(schema.physicalBooks)
    .where(eq(schema.physicalBooks.userId, userId))
    .all();
}
