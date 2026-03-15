import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Compare — OpenWeave vs LangSmith, Guardrails AI, AgentOps',
  description:
    'See how OpenWeave compares to monitoring and observability tools. Others observe. We enforce. State machine enforcement, gate-based permissions, and self-hosted deployment.',
  alternates: {
    canonical: 'https://openweave.dev/compare',
  },
  openGraph: {
    title: 'Compare — OpenWeave vs the Rest',
    description: 'Others observe. We enforce. See how OpenWeave compares to LangSmith, Guardrails AI, and AgentOps.',
    url: 'https://openweave.dev/compare',
    siteName: 'OpenWeave',
    type: 'website',
  },
};

export default function CompareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
