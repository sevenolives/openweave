'use client';

import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { api, Workspace } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  setCurrentWorkspace: (ws: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isLoggedIn } = useAuth();

  const refreshWorkspaces = useCallback(async () => {
    try {
      const ws = await api.getWorkspaces();
      setWorkspaces(ws);

      // Restore from localStorage or pick first
      const savedSlug = typeof window !== 'undefined' ? localStorage.getItem('currentWorkspaceSlug') : null;
      const saved = savedSlug ? ws.find(w => w.slug === savedSlug) : null;
      if (saved) {
        setCurrentWorkspaceState(saved);
      } else if (ws.length > 0) {
        setCurrentWorkspaceState(ws[0]);
        if (typeof window !== 'undefined') localStorage.setItem('currentWorkspaceSlug', ws[0].slug);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      refreshWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setIsLoading(false);
    }
  }, [isLoggedIn, refreshWorkspaces]);

  const setCurrentWorkspace = (ws: Workspace) => {
    setCurrentWorkspaceState(ws);
    if (typeof window !== 'undefined') localStorage.setItem('currentWorkspaceSlug', ws.slug);
  };

  return (
    <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, setCurrentWorkspace, refreshWorkspaces, isLoading }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
