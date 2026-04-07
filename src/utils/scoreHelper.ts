import { getUserRole } from '@/utils/serverRoles';

export async function isStudent(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === 'student';
}
