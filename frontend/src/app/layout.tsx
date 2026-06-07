import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kapruka AI Gifting Concierge - Challenge 2026',
  description: 'An ultra-innovative, context-aware AI shopping orchestrator built on top of Kapruka’s public Model Context Protocol.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
