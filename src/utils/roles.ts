import { eq } from 'drizzle-orm';
import * as schema from '@/db/pgSchema';
import { getDb } from '@/app/api/_utils/db';

export type UserRole = 'admin' | 'student' | 'external';

export async function getUserRole(userId: string): Promise<UserRole> {
  if (!userId) return 'external';
  try {
    const db = getDb();
    const user = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);

    const rawRole = String(user[0]?.role || 'external').toLowerCase();
    if (rawRole === 'admin' || rawRole === 'student' || rawRole === 'external') return rawRole;
    return 'external';
  } catch {
    return 'external';
  }
}
