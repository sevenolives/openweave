import { Metadata } from 'next';

const SITE_URL = 'https://openweave.dev';
const title = 'From State Machines to Gates: How We Simplified Execution Governance';
const description = 'We built a full state machine transition system with three models and an N×N matrix. Then we replaced it with two fields per state. Here\'s why.';
const url = `${SITE_URL}/blog/from-state-machines-to-gates`;

export const metadata: Metadata = {
  title: `${title} | OpenWeave`,
  description,
  openGraph: {
    title,
    description,
    url,
    type: 'article',
    publishedTime: '2026-03-15T00:00:00Z',
  },
  alternates: { canonical: url },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
