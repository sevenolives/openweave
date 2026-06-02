'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyEmailPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/private/workspaces'); }, [router]);
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}
