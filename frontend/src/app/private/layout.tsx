'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function PrivateLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading, user } = useAuth();
  const { workspaces, isLoading: wsLoading } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      // Preserve the current path so login can redirect back after auth
      const returnPath = pathname + (typeof window !== 'undefined' ? window.location.search : '');
      const redirectParam = returnPath && returnPath !== '/' ? `?redirect=${encodeURIComponent(returnPath)}` : '';
      router.replace(`/login${redirectParam}`);
    }
  }, [isLoading, isLoggedIn, router, pathname]);

  // Redirect to email verification if human user has email but hasn't verified
  // Skip if user came from verify-email page with skip_verify param
  useEffect(() => {
    if (!isLoading && isLoggedIn && user && user.user_type === 'HUMAN' && user.email && !user.email_verified) {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('skip_verify')) {
        router.replace('/verify-email');
      }
    }
  }, [isLoading, isLoggedIn, user, router]);

  // Redirect to onboarding if no workspaces (only for verified users)
  // Only redirect if workspace loading is complete AND truly empty
  useEffect(() => {
    if (!isLoading && !wsLoading && isLoggedIn && workspaces.length === 0) {
      // Skip if user needs email verification first
      if (user && user.user_type === 'HUMAN' && user.email && !user.email_verified) return;
      // Only redirect if on a workspace-specific page (not already on workspaces)
      if (pathname !== '/private/workspaces' && !pathname.startsWith('/private/workspaces')) {
        router.replace('/private/workspaces');
      }
    }
  }, [isLoading, wsLoading, isLoggedIn, user, workspaces, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!isLoggedIn) return null;

  return <div className="app-selects">{children}</div>;
}
