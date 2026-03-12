import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation | OpenWeave',
  description:
    'Complete documentation for OpenWeave — authentication, state machines, approval gates, API reference, bot onboarding, and multi-agent rules.',
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
