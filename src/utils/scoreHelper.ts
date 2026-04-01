import { getUserRole } from '@/utils/roles';

export async function isStudent(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === 'student';
}
