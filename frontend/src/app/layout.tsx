import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Analytics from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL("https://openweave.dev"),
  title: "OpenWeave - Execution Governance for Autonomous Systems",
  description:
    "OpenWeave enforces deterministic state transitions across humans and AI agents. Execution governance for autonomous systems.",
  openGraph: {
    title: "OpenWeave - Execution Governance for Autonomous Systems",
    description:
      "OpenWeave enforces deterministic state transitions across humans and AI agents. Execution governance for autonomous systems.",
    url: "https://openweave.dev",
    siteName: "OpenWeave",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenWeave - Execution Governance for Autonomous Systems",
    description:
      "OpenWeave enforces deterministic state transitions across humans and AI agents. Execution governance for autonomous systems.",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "OpenWeave",
  url: "https://openweave.dev",
  description:
    "Execution governance for autonomous systems. Deterministic state transitions across humans and AI agents.",
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
