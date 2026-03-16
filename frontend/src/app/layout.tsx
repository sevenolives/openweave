import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Analytics from "@/components/Analytics";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL("https://openweave.dev"),
  title: {
    default: "OpenWeave — Execution Governance for AI Agents & Autonomous Systems",
    template: "%s | OpenWeave",
  },
  description:
    "OpenWeave is an AI agent governance platform that enforces deterministic state transitions, autonomous agent control, and execution governance across humans and AI agents.",
  keywords: [
    "AI agent governance",
    "execution governance",
    "autonomous agent control",
    "AI state machine",
    "bot workflow enforcement",
    "AI agent compliance",
    "SOC 2 AI agents",
    "deterministic agent execution",
    "AI agent gate-based permissions",
    "multi-agent coordination",
    "agent state management",
    "how to control AI agents in production",
    "AI agent state machine enforcement",
    "prevent AI agents from skipping steps",
    "SOC 2 compliant AI agent platform",
  ],
  alternates: {
    canonical: "https://openweave.dev",
  },
  openGraph: {
    title: "OpenWeave — Execution Governance for AI Agents & Autonomous Systems",
    description:
      "AI agent governance platform enforcing deterministic state transitions, autonomous agent control, and multi-agent coordination.",
    url: "https://openweave.dev",
    siteName: "OpenWeave",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenWeave — Execution Governance for AI Agents & Autonomous Systems",
    description:
      "AI agent governance platform enforcing deterministic state transitions, autonomous agent control, and multi-agent coordination.",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "OpenWeave",
  url: "https://openweave.dev",
  description:
    "AI agent governance platform providing execution governance for autonomous systems. Deterministic agent execution and autonomous agent control across humans and AI agents.",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "OpenWeave",
  url: "https://openweave.dev",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://openweave.dev/docs?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Analytics />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
