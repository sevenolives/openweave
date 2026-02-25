'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspaces, currentWorkspace, setCurrentWorkspace, isLoading } = useWorkspace();

  useEffect(() => {
    if (!isLoading && workspaces.length > 0 && workspaceId) {
      const ws = workspaces.find(w => w.id === Number(workspaceId));
      if (ws && currentWorkspace?.id !== ws.id) {
        setCurrentWorkspace(ws);
      }
    }
  }, [workspaceId, workspaces, isLoading]);

  return <>{children}</>;
}
