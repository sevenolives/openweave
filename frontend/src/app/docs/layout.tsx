import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation — AI Agent Governance Platform',
  description:
    'Complete documentation for OpenWeave — AI agent governance, state machine enforcement, approval gates, bot workflow enforcement, multi-agent coordination, and deterministic agent execution.',
  alternates: {
    canonical: 'https://openweave.dev/docs',
  },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
