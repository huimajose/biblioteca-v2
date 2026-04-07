import { eq } from 'drizzle-orm';
import * as schema from '@/db/pgSchema';
import { getDb } from '@/app/api/_utils/db';
import { normalizeUserRole, type UserRole } from '@/utils/roles';

export async function getUserRole(userId: string): Promise<UserRole> {
  if (!userId) return 'external';
  try {
    const db = getDb();
    const user = await db
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.clerkId, userId))
      .limit(1);

    return normalizeUserRole(user[0]?.role || 'external');
  } catch {
    return 'external';
  }
}
