'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { WorkspaceProvider } from '@/hooks/useWorkspace';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
