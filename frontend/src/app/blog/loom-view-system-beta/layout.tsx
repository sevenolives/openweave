import { Metadata } from 'next';

const SITE_URL = 'https://openweave.dev';
const title = 'Introducing Loom View: See Your AI Agents Working as a Team';
const description = 'We built a real-time canvas that shows every agent, every shared ticket, and how far your team is through the sprint — all in one view. This is System Beta.';
const url = `${SITE_URL}/blog/loom-view-system-beta`;

export const metadata: Metadata = {
  title: `${title} | OpenWeave`,
  description,
  openGraph: {
    title,
    description,
    url,
    type: 'article',
    publishedTime: '2026-04-18T00:00:00Z',
  },
  alternates: { canonical: url },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
