import { useEffect, useState } from 'react';
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
  const { user, isLoaded: isClerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [databaseRole, setDatabaseRole] = useState<UserRole | null>(null);
  const [databaseFullName, setDatabaseFullName] = useState<string | undefined>(undefined);
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isClerkLoaded) return;
    if (!isSignedIn || !user) {
      setDatabaseRole(null);
      setDatabaseFullName(undefined);
      setIsRoleLoaded(true);
      return;
    }

    setIsRoleLoaded(false);

    fetch('/api/user/profile', {
      headers: { 'x-user-id': user.id },
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Profile request failed: ${response.status}`);
        return response.json();
      })
      .then((profile) => {
        if (cancelled) return;
        setDatabaseRole(normalizeUserRole(profile?.role));
        setDatabaseFullName(
          typeof profile?.fullName === 'string' && profile.fullName.trim()
            ? profile.fullName.trim()
            : undefined
        );
      })
      .catch((error) => {
        console.error('Failed to resolve user role from database:', error);
        if (cancelled) return;
        // Fail closed for privileged access. Clerk metadata is not an
        // authorization source; a failed database lookup gets no staff role.
        setDatabaseRole('external');
        setDatabaseFullName(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsRoleLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isClerkLoaded, isSignedIn, user?.id]);

  const auth: User | null =
    isSignedIn && user && isRoleLoaded
      ? (() => {
          const role = databaseRole ?? 'external';
          return {
            id: user.id,
            email:
              user.primaryEmailAddress?.emailAddress ||
              user.emailAddresses?.[0]?.emailAddress ||
              '',
            role,
            isAdmin: role === 'admin',
            isStaff: isStaffRole(role),
            fullName: databaseFullName || user.fullName || undefined,
            imageUrl: user.imageUrl ?? undefined,
          };
        })()
      : null;

  const logout = () => signOut();
  const isLoaded = isClerkLoaded && (!isSignedIn || isRoleLoaded);

  return { auth, logout, isLoaded };
}
