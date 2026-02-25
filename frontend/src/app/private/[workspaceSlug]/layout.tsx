'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { workspaces, currentWorkspace, setCurrentWorkspace, isLoading } = useWorkspace();

  useEffect(() => {
    if (!isLoading && workspaces.length > 0 && workspaceSlug) {
      const ws = workspaces.find(w => w.slug === workspaceSlug);
      if (ws && currentWorkspace?.slug !== workspaceSlug) {
        setCurrentWorkspace(ws);
      }
    }
  }, [workspaceSlug, workspaces, isLoading]);

  return <>{children}</>;
}
