'use client';

import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/hooks/useWorkspace';

interface UpgradePromptProps {
  error: Error;
  children?: React.ReactNode;
}

export function UpgradePrompt({ error, children }: UpgradePromptProps) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  
  // Check if this is a plan limit error
  const isUpgradeError = error.message.includes('Upgrade to Pro') || 
    error.message.includes('upgrade') ||
    (error.message.includes('limit') && error.message.includes('Pro'));
  
  if (!isUpgradeError) {
    return children || (
      <div className="text-red-400 text-sm">
        {error.message}
      </div>
    );
  }

  const handleUpgrade = () => {
    if (currentWorkspace) {
      router.push(`/private/${currentWorkspace.slug}/billing`);
    } else {
      router.push('/pricing');
    }
  };

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">Upgrade Required</p>
          <p className="text-sm text-amber-200 mt-1">
            {error.message}
          </p>
        </div>
        <button
          onClick={handleUpgrade}
          className="flex-shrink-0 px-3 py-1.5 text-sm font-medium bg-amber-500 text-white rounded-md hover:bg-amber-400 transition"
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
}

/**
 * Hook to create an error handler that shows upgrade prompts for plan limit errors
 */
export function useUpgradeErrorHandler() {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  
  return (error: any) => {
    const isUpgradeError = error?.message?.includes('Upgrade to Pro') || 
      error?.message?.includes('upgrade') ||
      (error?.message?.includes('limit') && error?.message?.includes('Pro'));
    
    if (isUpgradeError) {
      if (currentWorkspace) {
        router.push(`/private/${currentWorkspace.slug}/billing`);
      } else {
        router.push('/pricing');
      }
      return true; // Handled
    }
    return false; // Not handled
  };
}