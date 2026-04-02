'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
export default function AgentsPage() {
  const router = useRouter();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  useEffect(() => { router.replace(`/private/${workspaceSlug}/members`); }, [router, workspaceSlug]);
  return null;
}
