import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SOC 2 Compliance Policies — AI Agent Security',
  description:
    'SOC 2 compliant AI agent platform security policies covering information security, AI agent compliance, access control, change management, incident response, encryption, and audit logging.',
  alternates: {
    canonical: 'https://openweave.dev/policies',
  },
};

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
