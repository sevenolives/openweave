'use client';

import { useWorkspace } from '@/hooks/useWorkspace';

/**
 * Returns a function to build workspace-scoped paths.
 * Usage: const wp = useWorkspacePath(); wp('/tickets') => '/private/1/tickets'
 */
export function useWorkspacePath() {
  const { currentWorkspace } = useWorkspace();
  const wsId = currentWorkspace?.id || 0;
  return (path: string) => `/private/${wsId}${path}`;
}
