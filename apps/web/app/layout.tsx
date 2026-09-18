import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Discovery — AI Product Research',
  description:
    'Structured product discovery: research once, preserve the evidence, analyse it many ways, generate decision-ready artifacts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
