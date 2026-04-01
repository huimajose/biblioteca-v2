import { clerkClient } from '@clerk/nextjs/server';

export type UserRole = 'admin' | 'student' | 'external';

export async function getUserRole(userId: string): Promise<UserRole> {
  if (!userId) return 'external';
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const metadata = (user.publicMetadata || {}) as { role?: string; userType?: string };
    const rawRole = metadata.role || metadata.userType || 'external';
    if (rawRole === 'admin' || rawRole === 'student' || rawRole === 'external') return rawRole;
    return 'external';
  } catch {
    return 'external';
  }
}
