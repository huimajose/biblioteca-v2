export type StaffRole = 'admin' | 'operator' | 'catalogador';
export type UserRole = StaffRole | 'student' | 'external';
export type AdminSection =
  | 'dashboard'
  | 'books'
  | 'catalog-review'
  | 'courses'
  | 'users'
  | 'student-verifications'
  | 'transactions'
  | 'reports'
  | 'audit'
  | 'reader-mode';

const ADMIN_SECTION_ACCESS: Record<StaffRole, AdminSection[]> = {
  admin: [
    'dashboard',
    'books',
    'catalog-review',
    'courses',
    'users',
    'student-verifications',
    'transactions',
    'reports',
    'audit',
    'reader-mode',
  ],
  operator: ['dashboard', 'transactions', 'reports', 'reader-mode'],
  catalogador: ['dashboard', 'books', 'catalog-review', 'courses', 'reports', 'reader-mode'],
};

export const normalizeUserRole = (value: string | null | undefined): UserRole => {
  const rawRole = String(value || 'external').toLowerCase();
  if (rawRole === 'admin' || rawRole === 'operator' || rawRole === 'catalogador' || rawRole === 'student' || rawRole === 'external') {
    return rawRole;
  }
  return 'external';
};

export const isStaffRole = (role: string | null | undefined): role is StaffRole => {
  const normalized = normalizeUserRole(role);
  return normalized === 'admin' || normalized === 'operator' || normalized === 'catalogador';
};

export const canAccessAdminSection = (role: string | null | undefined, section: AdminSection) => {
  const normalized = normalizeUserRole(role);
  if (!isStaffRole(normalized)) return false;
  return ADMIN_SECTION_ACCESS[normalized].includes(section);
};

export const getRoleLabel = (role: string | null | undefined) => {
  const normalized = normalizeUserRole(role);
  if (normalized === 'admin') return 'Administrador';
  if (normalized === 'operator') return 'Operador';
  if (normalized === 'catalogador') return 'Catalogador';
  if (normalized === 'student') return 'Estudante';
  return 'Externo';
};
