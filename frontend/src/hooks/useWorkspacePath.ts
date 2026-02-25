'use client';

import { useWorkspace } from '@/hooks/useWorkspace';

/**
 * Returns a function to build workspace-scoped paths.
 * Usage: const wp = useWorkspacePath(); wp('/tickets') => '/private/default/tickets'
 */
export function useWorkspacePath() {
  const { currentWorkspace } = useWorkspace();
  const slug = currentWorkspace?.slug || '';
  return (path: string) => `/private/${slug}${path}`;
}
