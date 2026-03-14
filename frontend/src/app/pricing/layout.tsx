import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — OpenWeave AI Agent Governance',
  description:
    'Simple, transparent pricing for OpenWeave. Free tier for small teams, Pro for growing organizations, Enterprise for custom deployments. Start governing your AI agents today.',
  alternates: {
    canonical: 'https://openweave.dev/pricing',
  },
  openGraph: {
    title: 'Pricing — OpenWeave',
    description: 'Simple, transparent pricing for AI agent governance. Free tier available.',
    url: 'https://openweave.dev/pricing',
    siteName: 'OpenWeave',
    type: 'website',
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
