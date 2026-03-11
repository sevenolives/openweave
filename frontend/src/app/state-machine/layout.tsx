import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'State Machine Builder | OpenWeave',
  description:
    'Try the OpenWeave state machine builder — define states, transitions, and bot permissions to govern AI agent execution in your workflows.',
};

export default function StateMachineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
