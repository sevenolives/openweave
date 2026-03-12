import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SOC 2 Compliance Policies | OpenWeave',
  description:
    'OpenWeave security policies covering information security, access control, change management, incident response, encryption, and audit logging.',
};

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
