import { useClerk, useUser } from '@clerk/clerk-react';
import { isStaffRole, normalizeUserRole, type UserRole } from '@/utils/roles.ts';

export interface User {
  id: string;
  isAdmin: boolean;
  isStaff: boolean;
  email: string;
  role: UserRole;
  fullName?: string;
  imageUrl?: string;
}

export function useAuth() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const auth: User | null =
    isSignedIn && user
      ? (() => {
          const metadata = user.publicMetadata as { role?: string; userType?: string } | undefined;
          const role = normalizeUserRole(metadata?.role || metadata?.userType || 'external');
          return {
            id: user.id,
            email:
              user.primaryEmailAddress?.emailAddress ||
              user.emailAddresses?.[0]?.emailAddress ||
              '',
            role,
            isAdmin: role === 'admin',
            isStaff: isStaffRole(role),
            fullName: user.fullName ?? undefined,
            imageUrl: user.imageUrl ?? undefined,
          };
        })()
      : null;

  const logout = () => signOut();

  return { auth, logout, isLoaded };
}
