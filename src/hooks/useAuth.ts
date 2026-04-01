import { useClerk, useUser } from '@clerk/clerk-react';

export type UserRole = 'admin' | 'student' | 'external';

export interface User {
  id: string;
  isAdmin: boolean;
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
          const rawRole = metadata?.role || metadata?.userType || 'external';
          const role: UserRole =
            rawRole === 'admin' || rawRole === 'student' || rawRole === 'external'
              ? rawRole
              : 'external';
          return {
            id: user.id,
            email:
              user.primaryEmailAddress?.emailAddress ||
              user.emailAddresses?.[0]?.emailAddress ||
              '',
            role,
            isAdmin: role === 'admin',
            fullName: user.fullName ?? undefined,
            imageUrl: user.imageUrl ?? undefined,
          };
        })()
      : null;

  const logout = () => signOut();

  return { auth, logout, isLoaded };
}
