'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const { workspaces, isLoading: wsLoading } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoading, isLoggedIn, router]);

  // Redirect to onboarding if no workspaces (unless already on workspaces page)
  useEffect(() => {
    if (!isLoading && !wsLoading && isLoggedIn && workspaces.length === 0 && pathname !== '/private/workspaces') {
      router.replace('/private/workspaces');
    }
  }, [isLoading, wsLoading, isLoggedIn, workspaces, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return <div className="app-selects">{children}</div>;
}
