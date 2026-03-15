import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interactive State Machine Builder — AI Agent Workflow Control',
  description:
    'Build and visualize AI state machines for autonomous agent control. Define states, gate-based permissions, and bot workflow enforcement to prevent AI agents from skipping steps.',
  alternates: {
    canonical: 'https://openweave.dev/state-machine',
  },
};

export default function StateMachineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
