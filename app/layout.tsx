import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Discovery — Payer Member Value Chain",
  description:
    "Reimagining product discovery for payer organizations with a team of specialized AI agents: domain, defect detection, market analysis, and process analysis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
