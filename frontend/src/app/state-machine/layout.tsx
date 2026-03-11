import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'State Machine Builder | OpenWeave',
  description:
    'Design workflow state machines visually. Define states, configure bot and human transitions, and see your execution governance pipeline in real-time.',
  openGraph: {
    title: 'State Machine Builder | OpenWeave',
    description: 'Design workflow state machines visually with execution governance for autonomous systems.',
    siteName: 'OpenWeave',
  },
};

export default function StateMachineLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
